import { Module } from '@nestjs/common';
import { TipPrintController } from './tipprint.controller';
import { TipPrintService } from './tipprint.service';

@Module({
  controllers: [TipPrintController],
  providers: [TipPrintService],
})
export class TipPrintModule {}
