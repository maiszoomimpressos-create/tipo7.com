import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseCompatService } from '../supabase-compat/supabase-compat.service';

// Porte 1:1 de web/src/app/api/carrossel/{upload,[slideId]}/route.ts.
@Injectable()
export class CarrosselService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseCompat: SupabaseCompatService,
  ) {}

  // Porte de minha-area/marketing/carrossel/page.tsx (Fase 7.2, G4) — não
  // lança erro se não houver organização, a página decide o que fazer.
  async listarMinhas(userId: string) {
    const org = await this.prisma.organization.findFirst({ where: { ownerId: userId }, select: { id: true } });
    if (!org) return { organizationId: null, slides: [] };

    const slides = await this.prisma.carrosselSlide.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, imageUrl: true, createdAt: true },
    });

    return {
      organizationId: org.id,
      slides: slides.map((s) => ({ id: s.id, image_url: s.imageUrl })),
    };
  }

  // Porte de segunda-tela/[eventoId]/page.tsx (Fase 7.2, G11) — slides da
  // organização DO EVENTO (não do usuário logado — quem abre a segunda tela
  // pode ser um operador, não o dono), com fallback pros próximos eventos
  // publicados da mesma organização quando não há slide nenhum cadastrado.
  // Bug real corrigido: o fallback original filtrava por `is_published`/
  // `cover_url`, colunas que não existem mais no schema — trocado por
  // `status`/`banner_url` (mesma chave de resposta `cover_url` mantida,
  // só a origem do dado é corrigida).
  async getSegundaTela(eventoId: string) {
    const evento = await this.prisma.event.findUnique({
      where: { id: eventoId },
      select: { id: true, title: true, organizationId: true },
    });
    const orgId = evento?.organizationId ?? '';

    const slidesRaw = orgId
      ? await this.prisma.carrosselSlide.findMany({
          where: { organizationId: orgId },
          orderBy: { createdAt: 'asc' },
          select: { id: true, imageUrl: true },
        })
      : [];
    const slides = slidesRaw.map((s) => ({ id: s.id, image_url: s.imageUrl }));

    let eventosProximos: Array<{ id: string; title: string; date_start: Date | null; local: string | null; cover_url: string | null }> = [];
    if (slides.length === 0 && orgId) {
      const proximos = await this.prisma.event.findMany({
        where: { organizationId: orgId, status: 'publicado', dateStart: { gte: new Date() } },
        orderBy: { dateStart: 'asc' },
        take: 10,
        select: { id: true, title: true, dateStart: true, venueName: true, city: true, bannerUrl: true },
      });
      eventosProximos = proximos.map((e) => ({
        id: e.id,
        title: e.title ?? '',
        date_start: e.dateStart,
        local: [e.venueName, e.city].filter(Boolean).join(' — ') || null,
        cover_url: e.bannerUrl,
      }));
    }

    return {
      eventoTitle: evento?.title ?? 'Evento',
      slides,
      eventosProximos,
    };
  }

  async upload(userId: string, orgId: string | undefined, file: Express.Multer.File | undefined) {
    if (!file || !orgId) throw new BadRequestException('Campos obrigatórios ausentes');

    const org = await this.prisma.organization.findFirst({ where: { id: orgId, ownerId: userId }, select: { id: true } });
    if (!org) throw new ForbiddenException('Sem permissão');

    const ext = (file.originalname.split('.').pop() ?? 'jpg').toLowerCase();
    const path = `${orgId}/${randomUUID()}.${ext}`;

    const { error: storageErr } = await this.supabaseCompat.storage
      .from('carrossel')
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: false });
    if (storageErr) throw new InternalServerErrorException(storageErr.message);

    const {
      data: { publicUrl },
    } = this.supabaseCompat.storage.from('carrossel').getPublicUrl(path);

    try {
      const slide = await this.prisma.carrosselSlide.create({
        data: { organizationId: orgId, imageUrl: publicUrl, storagePath: path },
      });
      return {
        id: slide.id,
        organization_id: slide.organizationId,
        image_url: slide.imageUrl,
        storage_path: slide.storagePath,
        created_at: slide.createdAt,
      };
    } catch (err) {
      await this.supabaseCompat.storage.from('carrossel').remove([path]);
      throw new InternalServerErrorException((err as Error).message);
    }
  }

  async remover(userId: string, slideId: string) {
    const slide = await this.prisma.carrosselSlide.findUnique({
      where: { id: slideId },
      select: { id: true, storagePath: true, organizationId: true },
    });
    if (!slide) throw new NotFoundException('Slide não encontrado');

    const org = await this.prisma.organization.findFirst({ where: { id: slide.organizationId, ownerId: userId }, select: { id: true } });
    if (!org) throw new ForbiddenException('Sem permissão');

    await this.supabaseCompat.storage.from('carrossel').remove([slide.storagePath]);
    await this.prisma.carrosselSlide.delete({ where: { id: slideId } });

    return { ok: true };
  }
}
