import { BadRequestException, Body, ConflictException, Controller, Get, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AreaRestritaService } from '../area-restrita/area-restrita.service';
import { AuthCoreService } from '../auth-core/auth-core.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { AdminService } from './admin.service';

@UseGuards(SupabaseJwtGuard)
@Controller('admin/area-restrita')
export class AdminAreaRestritaController {
  constructor(
    private readonly admin: AdminService,
    private readonly prisma: PrismaService,
    private readonly areaRestrita: AreaRestritaService,
    private readonly authCore: AuthCoreService,
  ) {}

  // Porte de web/src/lib/areaRestrita.ts (Fase 7.2, G3) — a leitura antiga
  // no Next.js verificava o cookie com QR_SECRET, mas quem emite o cookie
  // hoje é este controller, com AREA_RESTRITA_SECRET (segredo diferente) —
  // a verificação nunca batia e travava qualquer admin na tela de senha
  // mesmo digitando certo. Esta rota vira a única fonte de verdade.
  @Get('status')
  async status(@CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    await this.admin.requireAcessoRestrito(user.id);
    // temSenha (Fase 7.2, G15) — porte de admin/area-restrita/page.tsx, que
    // lia platform_team.senha_restrita_hash só pra saber se já cadastrou.
    const row = await this.prisma.platformTeam.findUnique({
      where: { userId: user.id },
      select: { senhaRestritaHash: true },
    });
    return {
      desbloqueada: this.areaRestrita.estaDesbloqueada(req, user.id),
      temSenha: !!row?.senhaRestritaHash,
    };
  }

  @Post('senha')
  async senha(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: { senhaAtual?: string; novaSenha?: string },
  ) {
    if (!(await this.admin.rateLimitDb(req.ip ?? '0.0.0.0', `area-restrita-senha-${user.id}`, 5, 5 * 60_000))) {
      throw new BadRequestException('Muitas tentativas. Aguarde um momento.');
    }

    await this.admin.requireAcessoRestrito(user.id);

    if (!body.novaSenha || body.novaSenha.length < 6) {
      throw new BadRequestException('A nova senha precisa ter pelo menos 6 caracteres');
    }

    const row = await this.prisma.platformTeam.findUnique({ where: { userId: user.id }, select: { senhaRestritaHash: true } });

    if (row?.senhaRestritaHash) {
      if (!body.senhaAtual || !this.areaRestrita.verificarSenha(body.senhaAtual, row.senhaRestritaHash)) {
        throw new UnauthorizedException('Senha atual incorreta');
      }
    }

    await this.prisma.platformTeam.update({
      where: { userId: user.id },
      data: { senhaRestritaHash: this.areaRestrita.hashSenha(body.novaSenha) },
    });

    this.areaRestrita.desbloquear(res, user.id);
    return { ok: true };
  }

  @Post('desbloquear')
  async desbloquear(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: { senha?: string },
  ) {
    if (!(await this.admin.rateLimitDb(req.ip ?? '0.0.0.0', `area-restrita-desbloquear-${user.id}`, 5, 5 * 60_000))) {
      throw new BadRequestException('Muitas tentativas. Aguarde um momento.');
    }

    await this.admin.requireAcessoRestrito(user.id);

    if (!body.senha) throw new BadRequestException('Informe a senha');

    const row = await this.prisma.platformTeam.findUnique({ where: { userId: user.id }, select: { senhaRestritaHash: true } });
    if (!row?.senhaRestritaHash) throw new ConflictException('Você ainda não cadastrou uma senha de acesso');
    if (!this.areaRestrita.verificarSenha(body.senha, row.senhaRestritaHash)) throw new UnauthorizedException('Senha incorreta');

    this.areaRestrita.desbloquear(res, user.id);
    return { ok: true };
  }

  @Post('bloquear')
  bloquear(@Res({ passthrough: true }) res: Response) {
    this.areaRestrita.bloquear(res);
    return { ok: true };
  }

  @Post('recuperar')
  async recuperar(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: { senhaLogin?: string; novaSenha?: string },
  ) {
    if (!user.email) throw new UnauthorizedException('Não autenticado');

    if (!(await this.admin.rateLimitDb(req.ip ?? '0.0.0.0', `area-restrita-recuperar-${user.id}`, 5, 5 * 60_000))) {
      throw new BadRequestException('Muitas tentativas. Aguarde um momento.');
    }

    await this.admin.requireAcessoRestrito(user.id);

    if (!body.senhaLogin) throw new BadRequestException('Informe sua senha de login');
    if (!body.novaSenha || body.novaSenha.length < 6) {
      throw new BadRequestException('A nova senha precisa ter pelo menos 6 caracteres');
    }

    const ok = await this.authCore.verifyPassword(user.id, body.senhaLogin);
    if (!ok) throw new UnauthorizedException('Senha de login incorreta');

    await this.prisma.platformTeam.update({
      where: { userId: user.id },
      data: { senhaRestritaHash: this.areaRestrita.hashSenha(body.novaSenha) },
    });

    this.areaRestrita.desbloquear(res, user.id);
    return { ok: true };
  }
}
