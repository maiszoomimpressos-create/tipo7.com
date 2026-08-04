import { Body, Controller, Delete, Param, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { CarrosselService } from './carrossel.service';

@UseGuards(SupabaseJwtGuard)
@Controller('carrossel')
export class CarrosselController {
  constructor(private readonly carrossel: CarrosselService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Body('org_id') orgId?: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.carrossel.upload(user.id, orgId, file);
  }

  @Delete(':slideId')
  remover(@CurrentUser() user: AuthenticatedUser, @Param('slideId') slideId: string) {
    return this.carrossel.remover(user.id, slideId);
  }
}
