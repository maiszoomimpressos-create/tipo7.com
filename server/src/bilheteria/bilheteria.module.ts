import { Module } from '@nestjs/common';
import { OrgAdminModule } from '../org-admin/org-admin.module';
import { BilheteriaController } from './bilheteria.controller';
import { BilheteriaService } from './bilheteria.service';
import { BilheteriaStreamService } from './bilheteria-stream.service';

@Module({
  imports: [OrgAdminModule],
  controllers: [BilheteriaController],
  providers: [BilheteriaService, BilheteriaStreamService],
})
export class BilheteriaModule {}
