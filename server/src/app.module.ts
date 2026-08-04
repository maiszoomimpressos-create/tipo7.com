import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AreaRestritaModule } from './area-restrita/area-restrita.module';
import { AuthModule } from './auth/auth.module';
import { ChecksModule } from './checks/checks.module';
import { CodigoModule } from './codigo/codigo.module';
import { EventPermissionsModule } from './event-permissions/event-permissions.module';
import { EventsModule } from './events/events.module';
import { OrgAdminModule } from './org-admin/org-admin.module';
import { PlacesModule } from './places/places.module';
import { PlatformAdminModule } from './platform-admin/platform-admin.module';
import { PrismaModule } from './prisma/prisma.module';
import { StaffFunctionTemplatesModule } from './staff-function-templates/staff-function-templates.module';
import { StatsModule } from './stats/stats.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
