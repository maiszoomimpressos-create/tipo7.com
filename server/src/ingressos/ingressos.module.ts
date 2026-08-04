import { Module } from '@nestjs/common';
import { OrgAdminModule } from '../org-admin/org-admin.module';
import { IngressosController } from './ingressos.controller';
import { IngressosService } from './ingressos.service';

@Module({
  imports: [OrgAdminModule],
  controllers: [IngressosController],
  providers: [IngressosService],
})
export class IngressosModule {}
