import { BadRequestException, Controller, Get, InternalServerErrorException, Query, UseGuards } from '@nestjs/common';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import { PrismaService } from '../prisma/prisma.service';

@UseGuards(SupabaseJwtGuard)
@Controller('codigo')
export class CodigoController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async gerar(@Query('tipo') tipo?: string) {
    if (tipo !== 'promotora' && tipo !== 'estabelecimento') {
      throw new BadRequestException('tipo inválido');
    }

    const rows = await this.prisma.$queryRaw<{ generate_org_code: string }[]>`
      SELECT generate_org_code(${tipo})
    `;
    const codigo = rows[0]?.generate_org_code;
    if (!codigo) throw new InternalServerErrorException('Erro ao gerar código');

    return { codigo };
  }
}
