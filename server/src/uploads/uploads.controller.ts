import { Controller, Param, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { UploadsService } from './uploads.service';

@UseGuards(SupabaseJwtGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  uploadAvatar(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file?: Express.Multer.File) {
    return this.uploads.uploadAvatar(user.id, file);
  }

  @Post('event-image/:eventoId')
  @UseInterceptors(FileInterceptor('file'))
  uploadEventImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventoId') eventoId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.uploads.uploadEventImage(user.id, eventoId, file);
  }

  @Post('organization-logo/:orgId')
  @UseInterceptors(FileInterceptor('file'))
  uploadOrganizationLogo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orgId') orgId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.uploads.uploadOrganizationLogo(user.id, orgId, file);
  }
}
