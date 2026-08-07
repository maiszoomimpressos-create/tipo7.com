import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { AdminService } from './admin.service';

@UseGuards(SupabaseJwtGuard)
@Controller('admin')
export class AdminMiscController {
  constructor(private readonly admin: AdminService) {}

  @Get('roadmap')
  getRoadmap(@CurrentUser() user: AuthenticatedUser) {
    return this.admin.getRoadmap(user.id);
  }

  @Patch('roadmap')
  patchRoadmap(@CurrentUser() user: AuthenticatedUser, @Body() body: { items?: unknown }) {
    return this.admin.patchRoadmap(user.id, body.items);
  }

  @Patch('settings')
  patchSettings(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>) {
    return this.admin.patchSettings(user.id, body);
  }

  @Get('settings')
  getSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.admin.getSettings(user.id);
  }

  @Get('mp-rates')
  getMpRates(@CurrentUser() user: AuthenticatedUser) {
    return this.admin.getMpRates(user.id);
  }

  // Porte de web/src/lib/adminAuth.ts (getAdminMember) — Fase 7.2, helper
  // cross-cutting. Sem guard extra além do de classe: só devolve dados do
  // próprio usuário logado, nada de terceiros.
  @Get('whoami')
  whoami(@CurrentUser() user: AuthenticatedUser) {
    return this.admin.whoami(user.id);
  }
}
