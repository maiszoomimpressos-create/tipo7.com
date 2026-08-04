import { Controller, Get, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { CurrentUser } from './auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from './auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from './auth/strategies/supabase-jwt.strategy';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @UseGuards(SupabaseJwtGuard)
  @Get('whoami')
  whoami(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }
}
