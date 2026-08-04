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
