import { Module } from '@nestjs/common';
import { EventPermissionsModule } from '../event-permissions/event-permissions.module';
import { OrgAdminModule } from '../org-admin/org-admin.module';
import { EventosAdminController } from './eventos-admin.controller';
import { EventosAdminService } from './eventos-admin.service';

@Module({
  imports: [OrgAdminModule, EventPermissionsModule],
  controllers: [EventosAdminController],
  providers: [EventosAdminService],
})
export class EventosModule {}
