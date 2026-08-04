import { BadRequestException, Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { AdminService } from './admin.service';

@Controller('admin/conteudo')
export class AdminContentController {
  constructor(private readonly admin: AdminService) {}

  // Público — platform_content é de leitura pública (sem guard).
  @Get()
  get(@Query('key') key?: string) {
    if (!key) throw new BadRequestException('key required');
    return this.admin.getConteudo(key);
  }

  @UseGuards(SupabaseJwtGuard)
  @Put()
  put(@CurrentUser() user: AuthenticatedUser, @Body() body: { key?: string; content?: string }) {
    if (!body.key || body.content === undefined) throw new BadRequestException('key e content são obrigatórios');
    return this.admin.putConteudo(user.id, body.key, body.content);
  }
}
