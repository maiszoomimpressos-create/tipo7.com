import { Module } from '@nestjs/common';
import { CaixasModule } from '../caixas/caixas.module';
import { EventPermissionsModule } from '../event-permissions/event-permissions.module';
import { PagamentosFisicosModule } from '../pagamentos-fisicos/pagamentos-fisicos.module';
import { EstacionamentoController } from './estacionamento.controller';
import { EstacionamentoService } from './estacionamento.service';

@Module({
  imports: [EventPermissionsModule, CaixasModule, PagamentosFisicosModule],
  controllers: [EstacionamentoController],
  providers: [EstacionamentoService],
})
export class EstacionamentoModule {}
