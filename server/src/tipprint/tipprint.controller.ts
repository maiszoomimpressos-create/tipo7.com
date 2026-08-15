import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import { TipPrintService } from './tipprint.service';

@UseGuards(SupabaseJwtGuard)
@Controller('tipprint')
export class TipPrintController {
  constructor(private readonly tipprint: TipPrintService) {}

  @Post('provision')
  async provisionar(@Body() body: { label?: string }) {
    const { downloadUrl, expiresAt } = await this.tipprint.provisionar(body?.label);
    return { ok: true, downloadUrl, expiresAt };
  }
}
