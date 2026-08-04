import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import { UsuariosService } from './usuarios.service';

@UseGuards(SupabaseJwtGuard)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get('buscar')
  buscar(@Query('q') q?: string) {
    const query = q?.trim();
    if (!query) throw new BadRequestException('Parâmetro q obrigatório');
    return this.usuarios.buscar(query);
  }
}
