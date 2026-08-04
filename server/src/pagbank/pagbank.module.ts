import { Module } from '@nestjs/common';
import { PagbankController } from './pagbank.controller';
import { PagbankService } from './pagbank.service';

@Module({
  controllers: [PagbankController],
  providers: [PagbankService],
})
export class PagbankModule {}
