import { Module } from '@nestjs/common';
import { CarrosselController } from './carrossel.controller';
import { CarrosselService } from './carrossel.service';

@Module({
  controllers: [CarrosselController],
  providers: [CarrosselService],
})
export class CarrosselModule {}
