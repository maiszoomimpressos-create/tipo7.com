import { Module } from '@nestjs/common';
import { AreaRestritaGuard } from './area-restrita.guard';
import { AreaRestritaService } from './area-restrita.service';

@Module({
  providers: [AreaRestritaService, AreaRestritaGuard],
  exports: [AreaRestritaService, AreaRestritaGuard],
})
export class AreaRestritaModule {}
