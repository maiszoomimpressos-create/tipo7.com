import { Module } from '@nestjs/common';
import { OrgAdminService } from './org-admin.service';

@Module({
  providers: [OrgAdminService],
  exports: [OrgAdminService],
})
export class OrgAdminModule {}
