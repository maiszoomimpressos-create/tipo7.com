import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { HoldersService } from './holders.service';

@UseGuards(SupabaseJwtGuard)
@Controller('holders')
export class HoldersController {
  constructor(private readonly holders: HoldersService) {}

  @Post()
  salvar(@CurrentUser() user: AuthenticatedUser, @Body() body: any) {
    return this.holders.salvar(user.id, body);
  }
}
