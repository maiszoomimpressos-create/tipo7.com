import { Module } from '@nestjs/common';
import { AuthCoreModule } from '../auth-core/auth-core.module';
import { HolderLinksController, HolderLinksPublicController } from './holder-links.controller';
import { HolderLinksService } from './holder-links.service';

@Module({
  imports: [AuthCoreModule],
  controllers: [HolderLinksController, HolderLinksPublicController],
  providers: [HolderLinksService],
})
export class HolderLinksModule {}
