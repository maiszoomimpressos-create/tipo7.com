import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AutosaveService } from './autosave.service';
import { EmailService } from './email.service';
import { EventFamilyService } from './event-family.service';
import { FeeRulesService } from './fee-rules.service';
import { GatewayResolverService } from './gateway-resolver.service';
import { IssueTicketsService } from './issue-tickets.service';
import { MpTokenService } from './mp-token.service';
import { PagBankClientService } from './pagbank-client.service';
import { PagBankTokenService } from './pagbank-token.service';
import { PedidoAtomicoService } from './pedido-atomico.service';
import { PlatformCredentialsService } from './platform-credentials.service';
import { RateLimitDbService } from './rate-limit-db.service';
import { SaldoBilheteriaService } from './saldo-bilheteria.service';
import { WhatsAppService } from './whatsapp.service';

const PROVIDERS = [
  RateLimitDbService,
  AuditService,
  PlatformCredentialsService,
  MpTokenService,
  AutosaveService,
  FeeRulesService,
  SaldoBilheteriaService,
  EventFamilyService,
  PedidoAtomicoService,
  GatewayResolverService,
  EmailService,
  WhatsAppService,
  IssueTicketsService,
  PagBankClientService,
  PagBankTokenService,
];

@Global()
@Module({
  providers: PROVIDERS,
  exports: PROVIDERS,
})
export class CommonModule {}
