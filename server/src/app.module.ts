import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './admin/admin.module';
import { AreaRestritaModule } from './area-restrita/area-restrita.module';
import { AuthModule } from './auth/auth.module';
import { BilheteriaModule } from './bilheteria/bilheteria.module';
import { CaixasModule } from './caixas/caixas.module';
import { CheckoutModule } from './checkout/checkout.module';
import { ChecksModule } from './checks/checks.module';
import { CommonModule } from './common/common.module';
import { CodigoModule } from './codigo/codigo.module';
import { EstacionamentoModule } from './estacionamento/estacionamento.module';
import { EventPermissionsModule } from './event-permissions/event-permissions.module';
import { EventosModule } from './eventos/eventos.module';
import { EventsModule } from './events/events.module';
import { MpModule } from './mp/mp.module';
import { OrgAdminModule } from './org-admin/org-admin.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { PagbankModule } from './pagbank/pagbank.module';
import { PlacesModule } from './places/places.module';
import { PlatformAdminModule } from './platform-admin/platform-admin.module';
import { PrismaModule } from './prisma/prisma.module';
import { ScannerModule } from './scanner/scanner.module';
import { StaffFunctionTemplatesModule } from './staff-function-templates/staff-function-templates.module';
import { StatsModule } from './stats/stats.module';
import { SupabaseCompatModule } from './supabase-compat/supabase-compat.module';
import { VenuesModule } from './venues/venues.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    SupabaseCompatModule,
    CommonModule,
    AuthModule,
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
