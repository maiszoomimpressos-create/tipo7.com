import { Module } from '@nestjs/common';
import { AuthCoreModule } from '../auth-core/auth-core.module';
import { EventPermissionsModule } from '../event-permissions/event-permissions.module';
import { OrgAdminModule } from '../org-admin/org-admin.module';
import { CaixasController } from './caixas.controller';
import { CaixasService } from './caixas.service';

@Module({
  imports: [OrgAdminModule, AuthCoreModule, EventPermissionsModule],
  controllers: [CaixasController],
  providers: [CaixasService],
  exports: [CaixasService],
})
export class CaixasModule {}
