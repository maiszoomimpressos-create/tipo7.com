import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './admin/admin.module';
import { AreaRestritaModule } from './area-restrita/area-restrita.module';
import { AuthModule } from './auth/auth.module';
import { AuthCoreModule } from './auth-core/auth-core.module';
import { BilheteriaModule } from './bilheteria/bilheteria.module';
import { CadastroModule } from './cadastro/cadastro.module';
import { CaixasModule } from './caixas/caixas.module';
import { CarrosselModule } from './carrossel/carrossel.module';
import { CheckoutModule } from './checkout/checkout.module';
import { ChecksModule } from './checks/checks.module';
import { CommonModule } from './common/common.module';
import { CodigoModule } from './codigo/codigo.module';
import { EstacionamentoModule } from './estacionamento/estacionamento.module';
import { EventPermissionsModule } from './event-permissions/event-permissions.module';
import { EventosModule } from './eventos/eventos.module';
import { EventsModule } from './events/events.module';
import { HoldersModule } from './holders/holders.module';
import { HolderLinksModule } from './holder-links/holder-links.module';
import { IngressosModule } from './ingressos/ingressos.module';
import { MpModule } from './mp/mp.module';
import { OrgAdminModule } from './org-admin/org-admin.module';
import { MinhaAreaModule } from './minha-area/minha-area.module';
import { OrdersModule } from './orders/orders.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { PagbankModule } from './pagbank/pagbank.module';
import { PlacesModule } from './places/places.module';
import { PlatformAdminModule } from './platform-admin/platform-admin.module';
import { PlatformSettingsModule } from './platform-settings/platform-settings.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProfileModule } from './profile/profile.module';
import { PromotorProfileModule } from './promotor-profile/promotor-profile.module';
import { QrModule } from './qr/qr.module';
import { QzModule } from './qz/qz.module';
import { ScannerModule } from './scanner/scanner.module';
import { StaffFunctionTemplatesModule } from './staff-function-templates/staff-function-templates.module';
import { StatsModule } from './stats/stats.module';
import { SupabaseCompatModule } from './supabase-compat/supabase-compat.module';
import { TrabalhosModule } from './trabalhos/trabalhos.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { VenuesModule } from './venues/venues.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    SupabaseCompatModule,
    CommonModule,
    AuthModule,
    AuthCoreModule,
    OrgAdminModule,
    EventPermissionsModule,
    PlatformAdminModule,
    AreaRestritaModule,
    EventsModule,
    PlacesModule,
    StatsModule,
    ChecksModule,
    StaffFunctionTemplatesModule,
    CodigoModule,
    OrganizationsModule,
    OrdersModule,
    MinhaAreaModule,
    EventosModule,
    VenuesModule,
    AdminModule,
    CaixasModule,
    EstacionamentoModule,
    ScannerModule,
    BilheteriaModule,
    CheckoutModule,
    WebhooksModule,
    MpModule,
    PagbankModule,
    QzModule,
    QrModule,
    CadastroModule,
    TrabalhosModule,
    UsuariosModule,
    HoldersModule,
    HolderLinksModule,
    IngressosModule,
    CarrosselModule,
    UploadsModule,
    ProfileModule,
    PromotorProfileModule,
    PlatformSettingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
