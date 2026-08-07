import { Module } from '@nestjs/common';
import { MinhaAreaController } from './minha-area.controller';
import { MinhaAreaService } from './minha-area.service';

@Module({
  controllers: [MinhaAreaController],
  providers: [MinhaAreaService],
})
export class MinhaAreaModule {}
