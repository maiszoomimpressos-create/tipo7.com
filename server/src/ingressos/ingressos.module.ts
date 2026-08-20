import { Module } from '@nestjs/common';
import { OrgAdminModule } from '../org-admin/org-admin.module';
import { IngressosController } from './ingressos.controller';
import { IngressosService } from './ingressos.service';
import { LotesService } from './lotes.service';
import { IngressosLotesCronService } from './lotes-cron.service';

@Module({
  imports: [OrgAdminModule],
  controllers: [IngressosController],
  providers: [IngressosService, LotesService, IngressosLotesCronService],
  exports: [LotesService],
})
export class IngressosModule {}
