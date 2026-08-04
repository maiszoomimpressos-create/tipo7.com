import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AreaRestritaModule } from './area-restrita/area-restrita.module';
import { AuthModule } from './auth/auth.module';
import { EventPermissionsModule } from './event-permissions/event-permissions.module';
import { OrgAdminModule } from './org-admin/org-admin.module';
import { PlatformAdminModule } from './platform-admin/platform-admin.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    OrgAdminModule,
    EventPermissionsModule,
    PlatformAdminModule,
    AreaRestritaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
