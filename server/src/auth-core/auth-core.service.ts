import { BadRequestException, ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { EmailService } from '../common/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';

// Mesmo padrão de profile.service.ts / webhooks.service.ts.
function isUniqueConstraintError(err: unknown): err is Prisma.PrismaClientKnownRequestError {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

const ACCESS_TTL_SECONDS = 60 * 60; // 1h
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias
const RESET_TTL_MS = 30 * 60 * 1000; // 30 minutos
const BCRYPT_COST = 10;

// O Google exige client IDs distintos por tipo de fluxo OAuth: o client
// "Web application" (GOOGLE_CLIENT_ID, env var) é usado no fluxo de
// redirect (auth/google + callback); o Google Identity Services (One Tap,
// web/src/app/auth/page.tsx) precisa de um client "browser" registrado à
// parte — mesmo valor hardcoded lá, espelhado aqui pra aceitar os dois
// como audience válida.
const GOOGLE_ONETAP_CLIENT_ID = '140800251762-77n3v5pogj8ipsktbdo06cfhd6aok84h.apps.googleusercontent.com';

export interface PublicUser {
  id: string;
  email: string;
  fullName: string | null;
}

export interface SessionResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: PublicUser;
}

// Login por token+PIN devolve, junto da sessão normal, o evento a que esse
// acesso pertence — a rota pública /caixa usa isso pra redirecionar direto
// pra /trabalho/[eventId] sem round-trip extra.
export interface PinLoginResult extends SessionResult {
  eventId: string;
}

export interface RegisterInput {
  email?: string;
  password?: string;
  fullName?: string;
  phone?: string;
  cpf?: string;
  birthDate?: string;
  rg?: string;
  zipCode?: string;
  street?: string;
  streetNumber?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  complement?: string;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

// AuthModule próprio (Fase 6) — substitui o Supabase Auth. Reaproveita o
// hash bcrypt que já vinha do GoTrue (mesmo algoritmo), então usuários
// migrados não precisam trocar de senha. Refresh token é opaco (não JWT):
// só o hash fica salvo, permitindo revogar sessão por sessão.
@Injectable()
export class AuthCoreService {
  private readonly logger = new Logger(AuthCoreService.name);
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {
    this.googleClient = new OAuth2Client(this.config.get<string>('GOOGLE_CLIENT_ID'));
  }

  private signAccessToken(profile: { id: string; email: string; fullName: string | null }): string {
    return this.jwt.sign(
      { sub: profile.id, email: profile.email, role: 'authenticated', user_metadata: { full_name: profile.fullName } },
      { expiresIn: ACCESS_TTL_SECONDS },
    );
  }

  private async issueRefreshToken(userId: string): Promise<string> {
    const raw = randomBytes(32).toString('base64url');
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + REFRESH_TTL_MS) },
    });
    return raw;
  }

  private toPublicUser(profile: { id: string; email: string; fullName: string | null }): PublicUser {
    return { id: profile.id, email: profile.email, fullName: profile.fullName };
  }

  private async issueSession(profile: { id: string; email: string; fullName: string | null }): Promise<SessionResult> {
    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(profile),
      this.issueRefreshToken(profile.id),
    ]);
    return { accessToken, refreshToken, expiresIn: ACCESS_TTL_SECONDS, user: this.toPublicUser(profile) };
  }

  private async gerarUserCode(): Promise<string> {
    const rows = await this.prisma.$queryRaw<{ generate_user_code: string }[]>`SELECT generate_user_code()`;
    return rows[0].generate_user_code;
  }

  async register(input: RegisterInput): Promise<SessionResult> {
    const email = input.email?.trim().toLowerCase();
    if (!email || !input.password) throw new BadRequestException('Email e senha são obrigatórios');
    if (input.password.length < 8) throw new BadRequestException('Senha deve ter pelo menos 8 caracteres');

    if (await this.prisma.profile.findUnique({ where: { email }, select: { id: true } })) {
      throw new ConflictException('Este email já está cadastrado');
    }
    const cpf = input.cpf?.replace(/\D/g, '') || undefined;
    if (cpf && (await this.prisma.profile.findUnique({ where: { cpf }, select: { id: true } }))) {
      throw new ConflictException('Este CPF já está cadastrado');
    }
    const phone = input.phone?.replace(/\D/g, '') || undefined;
    if (phone && (await this.prisma.profile.findUnique({ where: { phone }, select: { id: true } }))) {
      throw new ConflictException('Este telefone já está cadastrado');
    }

    const encryptedPassword = await bcrypt.hash(input.password, BCRYPT_COST);
    const userCode = await this.gerarUserCode();

    // Achado real (08/08/2026, varredura): os findUnique acima são só um
    // pre-check (TOCTOU) — sem try/catch no create(), duas submissões
    // concorrentes com mesmo email/cpf/telefone (duplo clique, duas abas)
    // faziam a segunda estourar 500 cru em vez do ConflictException que o
    // pre-check tenta garantir.
    let profile;
    try {
      profile = await this.prisma.profile.create({
        data: {
          id: randomUUID(),
          email,
          encryptedPassword,
          emailVerified: false,
          fullName: input.fullName?.trim() || null,
          phone: phone ?? null,
          cpf: cpf ?? null,
          birthDate: input.birthDate ? new Date(input.birthDate) : null,
          rg: input.rg?.trim() || null,
          zipCode: input.zipCode?.trim() || null,
          street: input.street?.trim() || null,
          streetNumber: input.streetNumber?.trim() || null,
          neighborhood: input.neighborhood?.trim() || null,
          city: input.city?.trim() || null,
          state: input.state?.trim() || null,
          complement: input.complement?.trim() || null,
          userCode,
        },
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) throw new ConflictException('Email, CPF ou telefone já cadastrado.');
      throw err;
    }

    return this.issueSession(profile);
  }

  async login(emailRaw: string | undefined, password: string | undefined): Promise<SessionResult> {
    const email = emailRaw?.trim().toLowerCase();
    if (!email || !password) throw new UnauthorizedException('Email ou senha incorretos.');

    const profile = await this.prisma.profile.findUnique({ where: { email } });
    if (!profile?.encryptedPassword || !(await bcrypt.compare(password, profile.encryptedPassword))) {
      throw new UnauthorizedException('Email ou senha incorretos.');
    }
    return this.issueSession(profile);
  }

  // Login alternativo pra PC compartilhado / maquininha sem tela de OAuth
  // (design combinado 19/08/2026 — ver project_token_pin_acesso_caixa na
  // memória). Token identifica o EventStaff (gerado ao aceitar convite em
  // trabalhos.service.ts > responder()), PIN autentica (hash bcrypt, por
  // evento, criado em trabalhos.service.ts > definirPin()). Emite a MESMA
  // sessão JWT do login normal — a partir daí zero código novo no resto do
  // sistema, todas as restrições já construídas (isolamento por
  // estacionamento, permissão por evento) continuam valendo automático
  // porque é o userId real por trás do token.
  private static readonly PIN_MAX_TENTATIVAS = 5;
  private static readonly PIN_LOCK_MS = 15 * 60 * 1000;

  async loginComTokenPin(tokenRaw: string | undefined, pin: string | undefined): Promise<PinLoginResult> {
    const token = tokenRaw?.trim();
    if (!token || !pin) throw new UnauthorizedException('Token ou PIN inválido.');

    const staff = await this.prisma.eventStaff.findUnique({
      where: { token },
      select: {
        id: true, eventId: true, status: true, pinHash: true,
        pinTentativas: true, pinBloqueadoAte: true,
        user: { select: { id: true, email: true, fullName: true } },
      },
    });
    // Mesma mensagem genérica pra token inexistente, staff inativo/recusado
    // ou PIN ainda não configurado — não dar pista de qual parte está errada.
    if (!staff || staff.status !== 'active' || !staff.pinHash) {
      throw new UnauthorizedException('Token ou PIN inválido.');
    }

    if (staff.pinBloqueadoAte && staff.pinBloqueadoAte > new Date()) {
      const minutos = Math.ceil((staff.pinBloqueadoAte.getTime() - Date.now()) / 60_000);
      throw new UnauthorizedException(`Muitas tentativas erradas. Tente novamente em ${minutos} min.`);
    }

    if (!(await bcrypt.compare(pin, staff.pinHash))) {
      const tentativas = staff.pinTentativas + 1;
      const bloqueado = tentativas >= AuthCoreService.PIN_MAX_TENTATIVAS;
      await this.prisma.eventStaff.update({
        where: { id: staff.id },
        data: {
          pinTentativas: bloqueado ? 0 : tentativas,
          pinBloqueadoAte: bloqueado ? new Date(Date.now() + AuthCoreService.PIN_LOCK_MS) : null,
        },
      });
      throw new UnauthorizedException('Token ou PIN inválido.');
    }

    await this.prisma.eventStaff.update({
      where: { id: staff.id },
      data: { pinTentativas: 0, pinBloqueadoAte: null },
    });

    const session = await this.issueSession(staff.user);
    return { ...session, eventId: staff.eventId };
  }

  async refresh(rawRefreshToken: string | undefined): Promise<SessionResult> {
    if (!rawRefreshToken) throw new UnauthorizedException('Sessão expirada.');
    const tokenHash = sha256(rawRefreshToken);
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!row || row.revokedAt || row.expiresAt < new Date()) throw new UnauthorizedException('Sessão expirada.');

    // Rotação: revoga o token usado e emite um par novo — reduz o risco de
    // um refresh token roubado continuar valendo por 30 dias sem ser notado.
    await this.prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
    return this.issueSession(row.user);
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) return;
    await this.prisma.refreshToken.updateMany({ where: { tokenHash: sha256(rawRefreshToken) }, data: { revokedAt: new Date() } });
  }

  // Substitui SupabaseCompatService.verificarSenhaLogin (signInWithPassword).
  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const profile = await this.prisma.profile.findUnique({ where: { id: userId }, select: { encryptedPassword: true } });
    if (!profile?.encryptedPassword) return false;
    return bcrypt.compare(password, profile.encryptedPassword);
  }

  private async verifyGoogleIdToken(idToken: string) {
    const ticket = await this.googleClient.verifyIdToken({
      idToken,
      audience: [this.config.getOrThrow<string>('GOOGLE_CLIENT_ID'), GOOGLE_ONETAP_CLIENT_ID],
    });
    return ticket.getPayload();
  }

  // rawNonce: usado só no fluxo One Tap (auth/page.tsx) — o Google embute o
  // hash SHA-256 do nonce no id_token, e comparamos aqui contra o valor cru
  // que o próprio browser gerou, prevenindo replay do token fora do
  // contexto da tela de login. O fluxo de redirect (auth/google/callback)
  // já tem sua própria proteção CSRF via cookie de state, não precisa disso.
  async loginWithGoogle(idToken: string, rawNonce?: string): Promise<SessionResult> {
    const payload = await this.verifyGoogleIdToken(idToken).catch(() => null);
    const email = payload?.email?.toLowerCase();
    if (!email) throw new UnauthorizedException('Token do Google inválido.');

    if (rawNonce) {
      const expectedHash = createHash('sha256').update(rawNonce).digest('hex');
      if (payload?.nonce !== expectedHash) throw new UnauthorizedException('Token do Google inválido.');
    }

    let profile = await this.prisma.profile.findUnique({ where: { email } });
    if (!profile) {
      try {
        profile = await this.prisma.profile.create({
          data: {
            id: randomUUID(),
            email,
            fullName: payload?.name ?? null,
            emailVerified: true,
            userCode: await this.gerarUserCode(),
          },
        });
      } catch (err) {
        // Mesma corrida do register() acima — duas abas fazendo login com
        // Google ao mesmo tempo pela primeira vez podiam colidir no email.
        if (isUniqueConstraintError(err)) {
          profile = await this.prisma.profile.findUniqueOrThrow({ where: { email } });
        } else {
          throw err;
        }
      }
    } else if (!profile.emailVerified) {
      profile = await this.prisma.profile.update({ where: { id: profile.id }, data: { emailVerified: true } });
    }

    return this.issueSession(profile);
  }

  async forgotPassword(emailRaw: string | undefined): Promise<void> {
    const email = emailRaw?.trim().toLowerCase();
    if (!email) return;

    const profile = await this.prisma.profile.findUnique({ where: { email } });
    // Nunca revela se o email existe ou não — mesma postura do fluxo antigo.
    if (!profile) return;

    const raw = randomBytes(32).toString('base64url');
    await this.prisma.passwordResetToken.create({
      data: { userId: profile.id, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + RESET_TTL_MS) },
    });

    const appUrl = this.config.get<string>('NEXT_PUBLIC_APP_URL') ?? 'https://tipo7.com';
    const resetUrl = `${appUrl}/auth/recuperar?token=${raw}`;
    this.email.sendPasswordResetEmail({ to: email, resetUrl }).catch((err) => {
      this.logger.error('falha ao enviar email de recuperação de senha', err as Error);
    });
  }

  async resetPassword(rawToken: string | undefined, newPassword: string | undefined): Promise<void> {
    if (!rawToken || !newPassword) throw new BadRequestException('Dados inválidos.');
    if (newPassword.length < 8) throw new BadRequestException('Senha deve ter pelo menos 8 caracteres');

    const row = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(rawToken) } });
    if (!row || row.usedAt || row.expiresAt < new Date()) throw new BadRequestException('Link inválido ou expirado.');

    const encryptedPassword = await bcrypt.hash(newPassword, BCRYPT_COST);
    await this.prisma.$transaction([
      this.prisma.profile.update({ where: { id: row.userId }, data: { encryptedPassword } }),
      this.prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      // Revoga todas as sessões ativas — a senha mudou, tokens antigos não devem sobreviver.
      this.prisma.refreshToken.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
  }
}
