import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface TornarResponsavelBody {
  phone?: string;
  nicho?: 'eventos' | 'estacionamento' | 'ambos';
  cnpj?: string;
  nome_fantasia?: string;
  capacity?: number;
  has_parking?: boolean;
  parking_spots?: number;
}

@Injectable()
export class VenuesService {
  constructor(private readonly prisma: PrismaService) {}

  // GET /venues/minhas — porte de hooks/useCodigos.ts (Fase 7.2, G6).
  async listarMinhas(userId: string) {
    const admins = await this.prisma.venueAdmin.findMany({
      where: { userId, status: 'ativo' },
      select: { venue: { select: { codigo: true } } },
    });
    return { venues: admins.map((a) => ({ codigo: a.venue.codigo })) };
  }

  // POST /venues/:id/tornar-responsavel — marca o usuário logado como
  // administrador/curador do lugar. Gera o código T7-BR-E-xxx na primeira
  // vez que alguém assume o lugar.
  async tornarResponsavel(userId: string, venueId: string, body: TornarResponsavelBody) {
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId }, select: { id: true, codigo: true } });
    if (!venue) throw new NotFoundException('Local não encontrado');

    await this.prisma.venueAdmin.upsert({
      where: { venueId_userId: { venueId, userId } },
      create: { venueId, userId, role: 'admin', status: 'ativo' },
      update: { role: 'admin', status: 'ativo' },
    });

    let codigo = venue.codigo;
    if (!codigo) {
      const rows = await this.prisma.$queryRaw<{ generate_org_code: string | null }[]>`
        SELECT generate_org_code('estabelecimento')
      `;
      codigo = rows[0]?.generate_org_code ?? null;
      if (!codigo) throw new InternalServerErrorException('Erro ao gerar código');
    }

    const data: Record<string, unknown> = { codigo };
    if (body.phone !== undefined) data.phone = body.phone || null;
    if (body.nicho !== undefined) data.nicho = body.nicho || null;
    if (body.cnpj !== undefined) data.cnpj = body.cnpj ? body.cnpj.replace(/\D/g, '') : null;
    if (body.nome_fantasia !== undefined) data.nomeFantasia = body.nome_fantasia || null;
    if (body.capacity !== undefined) data.capacity = body.capacity || null;
    if (body.has_parking !== undefined) data.hasParking = body.has_parking;
    if (body.parking_spots !== undefined) data.parkingSpots = body.parking_spots || null;

    const venueAtualizado = await this.prisma.venue.update({ where: { id: venueId }, data });
    return { venue: venueAtualizado };
  }
}
