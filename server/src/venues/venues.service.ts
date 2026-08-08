import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Mesmo padrão de profile.service.ts / webhooks.service.ts.
function isUniqueConstraintError(err: unknown): err is Prisma.PrismaClientKnownRequestError {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

interface UpsertGoogleBody {
  name?:           string;
  googlePlaceId?:  string;
  zipCode?:        string | null;
  street?:         string | null;
  streetNumber?:   string | null;
  neighborhood?:   string | null;
  city?:           string | null;
  state?:          string | null;
  lat?:            number | null;
  lng?:            number | null;
}

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

  // POST /venues — porte de criar-evento/[id]/EventoForm.tsx (Fase 7.2-b,
  // 07/08/2026): upsert por google_place_id, mesma semântica do
  // .upsert({...}, {onConflict:'google_place_id'}) que rodava direto no
  // browser contra a Supabase. Sem dono nenhum atribuído aqui — só cria/
  // atualiza o cadastro básico do local; "tornar-se responsável" continua
  // sendo uma ação separada e deliberada (rota acima).
  async upsertPorGooglePlaceId(body: UpsertGoogleBody) {
    if (!body.googlePlaceId) throw new BadRequestException('googlePlaceId obrigatório');
    const venue = await this.prisma.venue.upsert({
      where: { googlePlaceId: body.googlePlaceId },
      create: {
        name: body.name ?? '',
        googlePlaceId: body.googlePlaceId,
        zipCode: body.zipCode ?? null,
        street: body.street ?? null,
        streetNumber: body.streetNumber ?? null,
        neighborhood: body.neighborhood ?? null,
        city: body.city ?? null,
        state: body.state ?? null,
        lat: body.lat ?? null,
        lng: body.lng ?? null,
      },
      update: {
        name: body.name ?? '',
        zipCode: body.zipCode ?? null,
        street: body.street ?? null,
        streetNumber: body.streetNumber ?? null,
        neighborhood: body.neighborhood ?? null,
        city: body.city ?? null,
        state: body.state ?? null,
        lat: body.lat ?? null,
        lng: body.lng ?? null,
      },
      select: { id: true },
    });
    return { id: venue.id };
  }

  // GET /venues/minhas — porte de hooks/useCodigos.ts (Fase 7.2, G6) +
  // perfil/page.tsx (Fase 7.2, G14, precisa também do nome do lugar).
  async listarMinhas(userId: string) {
    const admins = await this.prisma.venueAdmin.findMany({
      where: { userId, status: 'ativo' },
      select: { venue: { select: { codigo: true, name: true } } },
    });
    return { venues: admins.map((a) => ({ codigo: a.venue.codigo, name: a.venue.name })) };
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

    // Achado real (08/08/2026, varredura): cnpj é @unique em Venue e sem
    // try/catch aqui — pior ainda, o único chamador (EventoForm.tsx) engole
    // o erro inteiro num `.catch(() => {})` "pra não bloquear o salvamento
    // do evento", então uma colisão de CNPJ falhava 100% em silêncio: o
    // usuário achava que tinha assumido o estabelecimento e nada era gravado.
    let venueAtualizado;
    try {
      venueAtualizado = await this.prisma.venue.update({ where: { id: venueId }, data });
    } catch (err) {
      if (isUniqueConstraintError(err)) throw new ConflictException('Este CNPJ já está cadastrado em outro estabelecimento.');
      throw err;
    }
    return { venue: venueAtualizado };
  }
}
