import { Module } from '@nestjs/common';
import { PromotorProfileController } from './promotor-profile.controller';
import { PromotorProfileService } from './promotor-profile.service';

@Module({
  controllers: [PromotorProfileController],
  providers: [PromotorProfileService],
})
export class PromotorProfileModule {}
