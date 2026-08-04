import { Module } from '@nestjs/common';
import { PlatformAdminModule } from '../platform-admin/platform-admin.module';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

@Module({
  imports: [PlatformAdminModule],
  controllers: [UsuariosController],
  providers: [UsuariosService],
})
export class UsuariosModule {}
