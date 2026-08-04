import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { getIp, rateLimitLocal, tooManyRequests } from '../common/rate-limit.util';
import { RateLimitDbService } from '../common/rate-limit-db.service';
import { CadastroService } from './cadastro.service';

// Porte 1:1 de web/src/app/api/auth/{cpf-lookup,cpf-confirmar,sync-autosave}/route.ts.
// cpf-lookup e cpf-confirmar são públicas (chamadas durante o cadastro,
// antes do usuário existir na sessão) — só rate-limitadas, sem guard.
@Controller('auth')
export class CadastroController {
  constructor(
    private readonly cadastro: CadastroService,
    private readonly rateLimitDb: RateLimitDbService,
  ) {}

  @Post('cpf-lookup')
  cpfLookup(@Req() req: Request, @Body() body: { cpf?: string }) {
    if (!rateLimitLocal(getIp(req), 'cpf-lookup', 8, 60_000)) tooManyRequests();
    return this.cadastro.cpfLookup(body.cpf);
  }

  // Rate limit via banco (não em memória): esse é o endpoint sensível de
  // verdade — é literalmente "tentar adivinhar" um dado, então precisa
  // valer entre instâncias diferentes, não só por processo.
  @Post('cpf-confirmar')
  async cpfConfirmar(@Req() req: Request, @Body() body: { cpf?: string; valor?: string }) {
    await this.rateLimitDb.enforce(getIp(req), 'cpf-confirmar', 5, 5 * 60_000);
    return this.cadastro.cpfConfirmar(body.cpf, body.valor);
  }

  @UseGuards(SupabaseJwtGuard)
  @Post('sync-autosave')
  syncAutosave(@CurrentUser() user: AuthenticatedUser) {
    return this.cadastro.syncAutosave(user.id);
  }
}
