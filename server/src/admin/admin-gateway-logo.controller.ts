import { BadRequestException, Body, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseCompatService } from '../supabase-compat/supabase-compat.service';
import { AdminService } from './admin.service';

const GATEWAYS = new Set(['mercadopago', 'pagbank']);

@UseGuards(SupabaseJwtGuard)
@Controller('admin/gateway-logo')
export class AdminGatewayLogoController {
  constructor(
    private readonly admin: AdminService,
    private readonly prisma: PrismaService,
    private readonly supabaseCompat: SupabaseCompatService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
    @Body('gateway') gateway?: string,
  ) {
    await this.admin.requireAcessoRestrito(user.id);

    if (!gateway || !GATEWAYS.has(gateway)) throw new BadRequestException('Gateway inválido');
    if (!file) throw new BadRequestException('Arquivo não enviado');
    if (file.size > 5 * 1024 * 1024) throw new BadRequestException('Imagem maior que 5 MB');

    const ext = file.originalname.split('.').pop() ?? 'png';
    const path = `_gateway-logos/${gateway}.${ext}`;

    const { error: uploadError } = await this.supabaseCompat.storage
      .from('event-images')
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: true });
    if (uploadError) throw new BadRequestException(uploadError.message);

    const { data: publicUrlData } = this.supabaseCompat.storage.from('event-images').getPublicUrl(path);
    const url = `${publicUrlData.publicUrl}?v=${Date.now()}`;

    await this.prisma.platformSetting.upsert({
      where: { key: `gateway_logo_${gateway}` },
      create: { key: `gateway_logo_${gateway}`, value: url, updatedAt: new Date() },
      update: { value: url, updatedAt: new Date() },
    });

    return { url };
  }
}
