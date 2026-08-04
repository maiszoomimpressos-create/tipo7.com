import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Janela de elegibilidade pro carrossel de destaque: evento entra a partir
// de 2 meses antes de acontecer. Pool grande (até 100) ordenado por data —
// mesmos parâmetros de web/src/app/api/eventos/destaque/route.ts.
const JANELA_MESES = 2;
const POOL_MAX = 100;
const FETCH_MAX_DISTANCIA = 500;
const RAIO_TETO_KM = 500;
const MIN_CARROSSEL = 4;

function limiteSuperior(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + JANELA_MESES);
  return d;
}

// Distância em linha reta (Haversine), em km.
function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (g: number) => (g * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const COLUNAS_DESTAQUE = {
  id: true,
  title: true,
  description: true,
  dateStart: true,
  city: true,
  state: true,
  bannerUrl: true,
  status: true,
  lat: true,
  lng: true,
} as const;

type EventoDestaque = {
  id: string;
  title: string | null;
  description: string | null;
  dateStart: Date | null;
  city: string | null;
  state: string | null;
  bannerUrl: string | null;
  status: string;
  lat: number | null;
  lng: number | null;
};

function normalizar(rows: EventoDestaque[]) {
  return rows.map(({ bannerUrl, ...rest }) => ({ ...rest, cover_url: bannerUrl ?? null }));
}

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async buscar(params: { q: string; categoria: string; cidade: string; limit: number }) {
    const { q, categoria, cidade, limit } = params;

    const eventos = await this.prisma.event.findMany({
      where: {
        status: 'publicado',
        dateStart: { gte: new Date() },
        ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
        ...(categoria ? { category: categoria } : {}),
        ...(cidade ? { city: { contains: cidade, mode: 'insensitive' } } : {}),
      },
      select: { id: true, title: true, dateStart: true, city: true, state: true, bannerUrl: true, category: true },
      orderBy: { dateStart: 'asc' },
      take: limit,
    });

    const ids = eventos.map((e) => e.id);
    const minPrices: Record<string, number | null> = Object.fromEntries(ids.map((id) => [id, null]));

    if (ids.length > 0) {
      const tickets = await this.prisma.eventTicket.findMany({
        where: { eventId: { in: ids } },
        select: { eventId: true, price: true },
      });
      for (const t of tickets) {
        const atual = minPrices[t.eventId];
        const preco = Number(t.price);
        if (atual === null || preco < atual) minPrices[t.eventId] = preco;
      }
    }

    return { eventos: eventos.map((e) => ({ ...e, minPrice: minPrices[e.id] ?? null })) };
  }

  async destaque(params: { estado: string | null; lat: number | null; lng: number | null }) {
    const { estado, lat, lng } = params;
    const temCoordenadaUsuario = lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng);

    const banners = await this.prisma.systemBanner.findMany({
      where: { active: true },
      select: { id: true, imageUrl: true },
      orderBy: { orderIndex: 'asc' },
    });
    const bannersOut = banners.map((b) => ({ id: b.id, image_url: b.imageUrl }));

    if (temCoordenadaUsuario) {
      const pool = await this.prisma.event.findMany({
        where: {
          status: 'publicado',
          parentEventId: null,
          dateStart: { gte: new Date(), lte: limiteSuperior() },
        },
        select: COLUNAS_DESTAQUE,
        orderBy: { dateStart: 'asc' },
        take: FETCH_MAX_DISTANCIA,
      });

      if (pool.length > 0) {
        const comDistancia = pool.map((evento) => ({
          evento,
          distancia:
            evento.lat != null && evento.lng != null
              ? distanciaKm(lat as number, lng as number, evento.lat, evento.lng)
              : null,
        }));

        comDistancia.sort((a, b) => {
          if (a.distancia == null && b.distancia == null) return 0;
          if (a.distancia == null) return 1;
          if (b.distancia == null) return -1;
          return a.distancia - b.distancia;
        });

        const dentroDoRaio = comDistancia.filter((x) => x.distancia != null && x.distancia <= RAIO_TETO_KM);
        const selecionadosBase = dentroDoRaio.length >= MIN_CARROSSEL ? dentroDoRaio : comDistancia;
        const selecionados = selecionadosBase.slice(0, POOL_MAX);

        return {
          eventos: normalizar(selecionados.map((x) => x.evento)),
          banners: bannersOut,
          filtrado: true,
          estado: null,
        };
      }
    }

    if (estado) {
      const eventosEstado = await this.prisma.event.findMany({
        where: {
          status: 'publicado',
          parentEventId: null,
          state: estado,
          dateStart: { gte: new Date(), lte: limiteSuperior() },
        },
        select: COLUNAS_DESTAQUE,
        orderBy: { dateStart: 'asc' },
        take: POOL_MAX,
      });

      if (eventosEstado.length > 0) {
        return { eventos: normalizar(eventosEstado), banners: bannersOut, filtrado: true, estado };
      }
    }

    const eventos = await this.prisma.event.findMany({
      where: {
        status: 'publicado',
        parentEventId: null,
        dateStart: { gte: new Date(), lte: limiteSuperior() },
      },
      select: COLUNAS_DESTAQUE,
      orderBy: { dateStart: 'asc' },
      take: POOL_MAX,
    });

    return { eventos: normalizar(eventos), banners: bannersOut, filtrado: false, estado: null };
  }
}
