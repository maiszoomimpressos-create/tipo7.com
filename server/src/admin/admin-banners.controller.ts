import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { LocalStorageService } from '../storage/local-storage.service';
import { AdminService } from './admin.service';

@UseGuards(SupabaseJwtGuard)
@Controller('admin/banners-sistema')
export class AdminBannersController {
  constructor(
    private readonly admin: AdminService,
    private readonly prisma: PrismaService,
    private readonly storageService: LocalStorageService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    await this.admin.requirePerm(user.id, 'gerenciar_eventos');
    const banners = await this.prisma.systemBanner.findMany({
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'desc' }],
      select: { id: true, imageUrl: true, active: true, orderIndex: true, createdAt: true },
    });
    return { banners: banners.map((b) => ({ id: b.id, image_url: b.imageUrl, active: b.active, order_index: b.orderIndex, created_at: b.createdAt })) };
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async upload(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file?: Express.Multer.File) {
    await this.admin.requirePerm(user.id, 'gerenciar_eventos');

    if (!file) throw new BadRequestException('Arquivo não enviado');
    if (file.size > 10 * 1024 * 1024) throw new BadRequestException('Imagem maior que 10 MB');

    const ext = file.originalname.split('.').pop() ?? 'jpg';
    const path = `_system-banners/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await this.storageService.storage
      .from('event-images')
      .upload(path, file.buffer, { contentType: file.mimetype });
    if (uploadError) throw new BadRequestException(uploadError.message);

    const { data: publicUrlData } = this.storageService.storage.from('event-images').getPublicUrl(path);

    const banner = await this.prisma.systemBanner.create({
      data: { imageUrl: publicUrlData.publicUrl },
      select: { id: true, imageUrl: true, active: true, orderIndex: true, createdAt: true },
    });
    return { banner: { id: banner.id, image_url: banner.imageUrl, active: banner.active, order_index: banner.orderIndex, created_at: banner.createdAt } };
  }

  @Patch(':id')
  async patch(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: { active?: boolean }) {
    await this.admin.requirePerm(user.id, 'gerenciar_eventos');
    if (typeof body.active !== 'boolean') throw new BadRequestException('Campo "active" obrigatório');
    await this.prisma.systemBanner.update({ where: { id }, data: { active: body.active } });
    return { ok: true };
  }

  @Delete(':id')
  async remover(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.admin.requirePerm(user.id, 'gerenciar_eventos');
    await this.prisma.systemBanner.delete({ where: { id } });
    return { ok: true };
  }
}
