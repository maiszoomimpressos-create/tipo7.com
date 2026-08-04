import { Module } from '@nestjs/common';
import { OrgAdminModule } from '../org-admin/org-admin.module';
import { BilheteriaController } from './bilheteria.controller';
import { BilheteriaService } from './bilheteria.service';

@Module({
  imports: [OrgAdminModule],
  controllers: [BilheteriaController],
  providers: [BilheteriaService],
})
export class BilheteriaModule {}
