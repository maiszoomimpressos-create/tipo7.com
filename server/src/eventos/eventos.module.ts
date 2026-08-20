import { Module } from '@nestjs/common';
import { CaixasModule } from '../caixas/caixas.module';
import { EventPermissionsModule } from '../event-permissions/event-permissions.module';
import { OrgAdminModule } from '../org-admin/org-admin.module';
import { EventosAdminController } from './eventos-admin.controller';
import { EventosAdminService } from './eventos-admin.service';
import { EventosLifecycleCronService } from './eventos-lifecycle-cron.service';

@Module({
  imports: [OrgAdminModule, EventPermissionsModule, CaixasModule],
  controllers: [EventosAdminController],
  providers: [EventosAdminService, EventosLifecycleCronService],
  exports: [EventosAdminService],
})
export class EventosModule {}
