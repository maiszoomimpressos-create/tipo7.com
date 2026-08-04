import { Body, Controller, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { AdminService } from './admin.service';

// Porte 1:1 de web/src/app/api/admin/payment-credentials/route.ts — separado
// de admin/settings porque aqui são segredos, com exigência de acesso mais
// restrita (mesma barra da página Bancos).
@UseGuards(SupabaseJwtGuard)
@Controller('admin/payment-credentials')
export class AdminPaymentCredentialsController {
  constructor(private readonly admin: AdminService) {}

  @Patch()
  salvar(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>) {
    return this.admin.salvarPaymentCredentials(user.id, body);
  }
}
