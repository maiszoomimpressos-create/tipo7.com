import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AutosaveService } from './autosave.service';
import { EventFamilyService } from './event-family.service';
import { FeeRulesService } from './fee-rules.service';
import { MpTokenService } from './mp-token.service';
import { PlatformCredentialsService } from './platform-credentials.service';
import { RateLimitDbService } from './rate-limit-db.service';
import { SaldoBilheteriaService } from './saldo-bilheteria.service';

const PROVIDERS = [
  RateLimitDbService,
  AuditService,
  PlatformCredentialsService,
  MpTokenService,
  AutosaveService,
  FeeRulesService,
  SaldoBilheteriaService,
  EventFamilyService,
];

@Global()
@Module({
  providers: PROVIDERS,
  exports: PROVIDERS,
})
export class CommonModule {}
