import { Module } from '@nestjs/common';
import { OrgAdminModule } from '../org-admin/org-admin.module';
import { CaixasController } from './caixas.controller';
import { CaixasService } from './caixas.service';

@Module({
  imports: [OrgAdminModule],
  controllers: [CaixasController],
  providers: [CaixasService],
  exports: [CaixasService],
})
export class CaixasModule {}
