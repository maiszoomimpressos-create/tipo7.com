import { Module } from '@nestjs/common';
import { PlatformAdminService } from './platform-admin.service';

@Module({
  providers: [PlatformAdminService],
  exports: [PlatformAdminService],
})
export class PlatformAdminModule {}
