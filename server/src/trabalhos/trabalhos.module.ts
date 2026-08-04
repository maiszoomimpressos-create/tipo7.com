import { Module } from '@nestjs/common';
import { TrabalhosController } from './trabalhos.controller';
import { TrabalhosService } from './trabalhos.service';

@Module({
  controllers: [TrabalhosController],
  providers: [TrabalhosService],
})
export class TrabalhosModule {}
