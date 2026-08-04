import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { ScannerService } from './scanner.service';

@UseGuards(SupabaseJwtGuard)
@Controller('scanner')
export class ScannerController {
  constructor(private readonly scanner: ScannerService) {}

  @Post('validate')
  validate(@CurrentUser() user: AuthenticatedUser, @Req() req: Request, @Body() body: { qr_token?: string; eventoId?: string }) {
    return this.scanner.validate(user.id, req.ip ?? '0.0.0.0', body);
  }
}
