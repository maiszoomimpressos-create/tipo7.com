import { Module } from '@nestjs/common';
import { CaixasModule } from '../caixas/caixas.module';
import { EventPermissionsModule } from '../event-permissions/event-permissions.module';
import { EstacionamentoController } from './estacionamento.controller';
import { EstacionamentoService } from './estacionamento.service';

@Module({
  imports: [EventPermissionsModule, CaixasModule],
  controllers: [EstacionamentoController],
  providers: [EstacionamentoService],
})
export class EstacionamentoModule {}
