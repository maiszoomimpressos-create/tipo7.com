import { Module } from '@nestjs/common';
import { EventPermissionsModule } from '../event-permissions/event-permissions.module';
import { OrgAdminModule } from '../org-admin/org-admin.module';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [OrgAdminModule, EventPermissionsModule],
  controllers: [UploadsController],
  providers: [UploadsService],
})
export class UploadsModule {}
