import { Module } from '@nestjs/common';
import { AreaRestritaModule } from '../area-restrita/area-restrita.module';
import { PlatformAdminModule } from '../platform-admin/platform-admin.module';
import { AdminAreaRestritaController } from './admin-area-restrita.controller';
import { AdminBannersController } from './admin-banners.controller';
import { AdminContentController } from './admin-content.controller';
import { AdminFeeRulesController } from './admin-fee-rules.controller';
import { AdminGatewayLogoController } from './admin-gateway-logo.controller';
import { AdminIntegracoesController } from './admin-integracoes.controller';
import { AdminMiscController } from './admin-misc.controller';
import { AdminPaymentCredentialsController } from './admin-payment-credentials.controller';
import { AdminSaldoBilheteriaController } from './admin-saldo-bilheteria.controller';
import { AdminTeamController } from './admin-team.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [PlatformAdminModule, AreaRestritaModule],
  controllers: [
    AdminContentController,
    AdminTeamController,
    AdminMiscController,
    AdminFeeRulesController,
    AdminSaldoBilheteriaController,
    AdminIntegracoesController,
    AdminBannersController,
    AdminGatewayLogoController,
    AdminAreaRestritaController,
    AdminPaymentCredentialsController,
  ],
  providers: [AdminService],
})
export class AdminModule {}
