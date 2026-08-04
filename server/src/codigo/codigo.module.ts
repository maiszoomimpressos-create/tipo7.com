import { Module } from '@nestjs/common';
import { CodigoController } from './codigo.controller';

@Module({
  controllers: [CodigoController],
})
export class CodigoModule {}
