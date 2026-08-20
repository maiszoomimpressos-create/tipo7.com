import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { TrabalhosService } from './trabalhos.service';

@UseGuards(SupabaseJwtGuard)
@Controller('trabalhos')
export class TrabalhosController {
  constructor(private readonly trabalhos: TrabalhosService) {}

  @Get()
  listar(@CurrentUser() user: AuthenticatedUser) {
    return this.trabalhos.listar(user.id);
  }

  @Post('responder')
  responder(@CurrentUser() user: AuthenticatedUser, @Body() body: { staffId?: string; acao?: string }) {
    return this.trabalhos.responder(user.id, body.staffId, body.acao);
  }

  @Post('pin')
  definirPin(@CurrentUser() user: AuthenticatedUser, @Body() body: { staffId?: string; pin?: string }) {
    return this.trabalhos.definirPin(user.id, body.staffId, body.pin);
  }
}
