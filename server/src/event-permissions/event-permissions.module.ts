import { Module } from '@nestjs/common';
import { OrgAdminModule } from '../org-admin/org-admin.module';
import { EventPermissionsService } from './event-permissions.service';

@Module({
  imports: [OrgAdminModule],
  providers: [EventPermissionsService],
  exports: [EventPermissionsService],
})
export class EventPermissionsModule {}
