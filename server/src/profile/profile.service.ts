import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { apenasDigitos } from '../common/document-validation.util';
import { PrismaService } from '../prisma/prisma.service';

// Mesmo padrão de webhooks.service.ts (isUniqueConstraintError) — detecta
// violação de índice único do Postgres (P2002) sem depender do texto do erro.
function isUniqueConstraintError(err: unknown): err is Prisma.PrismaClientKnownRequestError {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

// Achado real (08/08/2026, follow-up do fix original): `err.meta.target`
// (o caminho "clássico" do Prisma) vem VAZIO neste projeto, porque o server
// usa o driver adapter do pg (`@prisma/adapter-pg` — ver log de boot
// "Conectado ao Postgres via Prisma (driver adapter pg)"), que reporta o
// nome da coluna em `err.meta.driverAdapterError.cause.constraint.fields`
// em vez de `err.meta.target`. Sem isso, a mensagem sempre caía no genérico
// "Um dos dados informados já está em uso" — o usuário salvando telefone+CPF
// juntos não tinha como saber qual dos dois era o problema de verdade.
// Tenta os 3 caminhos possíveis, do mais específico ao mais genérico
// (o 3º usa `err.message`, que o Prisma sempre formata com o nome do campo
// entre crases — "Unique constraint failed on the fields: (`phone`)" —
// então funciona mesmo se a forma interna do driver adapter mudar de novo).
function camposUnicosViolados(err: Prisma.PrismaClientKnownRequestError): string[] {
  const target = err.meta?.target;
  if (Array.isArray(target)) return target as string[];
  if (typeof target === 'string') return [target];

  const viaAdapter = (err.meta as Record<string, unknown> | undefined)?.driverAdapterError as
    | { cause?: { constraint?: { fields?: string[] } } }
    | undefined;
  const camposAdapter = viaAdapter?.cause?.constraint?.fields;
  if (Array.isArray(camposAdapter)) return camposAdapter;

  const match = err.message.match(/fields:\s*\(([^)]+)\)/);
  if (match) return match[1].split(',').map((s) => s.trim().replace(/`/g, ''));

  return [];
}

// Nome amigável por campo — a coluna que colidiu (ex: 'phone') não é o nome
// que o usuário reconhece.
const CAMPO_LABEL: Record<string, string> = {
  phone: 'Esse telefone já está cadastrado em outra conta.',
  cpf: 'Esse CPF já está cadastrado em outra conta.',
  email: 'Esse email já está cadastrado em outra conta.',
};

// Porte de web/src/app/perfil/ProfileForm.tsx e outros ~9 arquivos que
// liam/escreviam a tabela profiles direto (Fase 7.2, grupo G2).
@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  // Resposta em snake_case — minimiza o diff nos vários consumidores que
  // hoje leem direto do Supabase (mesmo padrão do getEventoCore, Fase 7.1-b).
  async getProfile(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
      select: {
        fullName: true, phone: true, cpf: true, rg: true, birthDate: true, avatarUrl: true,
        zipCode: true, street: true, streetNumber: true, neighborhood: true, city: true,
        state: true, addressType: true, complement: true, createdAt: true, userCode: true, email: true,
      },
    });
    if (!profile) throw new NotFoundException('Perfil não encontrado');

    return {
      full_name: profile.fullName,
      phone: profile.phone,
      cpf: profile.cpf,
      rg: profile.rg,
      // birthDate é uma coluna @db.Date (só data, sem hora) — .toISOString()
      // devolve timestamp completo ("1981-04-02T00:00:00.000Z"), que quebra
      // o parser ingênuo do front (isoToDisplay faz iso.split('-'), assumindo
      // "AAAA-MM-DD" puro). Corta pra só os 10 primeiros caracteres.
      birth_date: profile.birthDate ? profile.birthDate.toISOString().slice(0, 10) : null,
      avatar_url: profile.avatarUrl,
      zip_code: profile.zipCode,
      street: profile.street,
      street_number: profile.streetNumber,
      neighborhood: profile.neighborhood,
      city: profile.city,
      state: profile.state,
      address_type: profile.addressType,
      complement: profile.complement,
      created_at: profile.createdAt.toISOString(),
      user_code: profile.userCode,
      email: profile.email,
    };
  }

  async atualizarProfile(
    userId: string,
    body: {
      fullName?: string; phone?: string | null; cpf?: string | null; rg?: string | null;
      birthDate?: string | null; avatarUrl?: string | null;
      zipCode?: string | null; street?: string | null; streetNumber?: string | null;
      neighborhood?: string | null; city?: string | null; state?: string | null;
      addressType?: string | null; complement?: string | null;
    },
  ) {
    try {
      await this.prisma.profile.update({
        where: { id: userId },
        data: {
          ...(body.fullName !== undefined ? { fullName: body.fullName } : {}),
          // Máscara é só do front — aqui sempre grava só dígitos (ou null),
          // nunca o que o body mandou cru. Ver apenasDigitos().
          ...(body.phone !== undefined ? { phone: body.phone ? apenasDigitos(body.phone) : null } : {}),
          ...(body.cpf !== undefined ? { cpf: body.cpf ? apenasDigitos(body.cpf) : null } : {}),
          ...(body.rg !== undefined ? { rg: body.rg } : {}),
          ...(body.birthDate !== undefined ? { birthDate: body.birthDate ? new Date(body.birthDate) : null } : {}),
          ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl } : {}),
          ...(body.zipCode !== undefined ? { zipCode: body.zipCode } : {}),
          ...(body.street !== undefined ? { street: body.street } : {}),
          ...(body.streetNumber !== undefined ? { streetNumber: body.streetNumber } : {}),
          ...(body.neighborhood !== undefined ? { neighborhood: body.neighborhood } : {}),
          ...(body.city !== undefined ? { city: body.city } : {}),
          ...(body.state !== undefined ? { state: body.state } : {}),
          ...(body.addressType !== undefined ? { addressType: body.addressType } : {}),
          ...(body.complement !== undefined ? { complement: body.complement } : {}),
        },
      });
    } catch (err) {
      // Achado real (08/08/2026): phone/cpf/email são @unique na tabela —
      // salvar um telefone que já pertence a outra conta estourava 500 cru,
      // e o front só sabia mostrar "Erro ao salvar. Tente novamente." sem
      // explicar o motivo. Devolve 409 com mensagem específica do campo.
      if (isUniqueConstraintError(err)) {
        const alvo = camposUnicosViolados(err);
        const campo = alvo.find((c) => c in CAMPO_LABEL);
        throw new ConflictException(campo ? CAMPO_LABEL[campo] : 'Um dos dados informados já está em uso em outra conta.');
      }
      throw err;
    }

    return { ok: true };
  }
}
