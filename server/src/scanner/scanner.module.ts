import { Module } from '@nestjs/common';
import { OrgAdminModule } from '../org-admin/org-admin.module';
import { ScannerController } from './scanner.controller';
import { ScannerService } from './scanner.service';

@Module({
  imports: [OrgAdminModule],
  controllers: [ScannerController],
  providers: [ScannerService],
})
export class ScannerModule {}
