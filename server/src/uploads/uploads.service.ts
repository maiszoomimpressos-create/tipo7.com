import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EventPermissionsService } from '../event-permissions/event-permissions.service';
import { OrgAdminService } from '../org-admin/org-admin.service';
import { SupabaseCompatService } from '../supabase-compat/supabase-compat.service';

// Fase 6 — as políticas de RLS do Storage da Supabase exigem
// auth.uid()/auth.role()='authenticated' (ex: "avatar upload proprio",
// "event-images: upload autenticado", "organization-logos_insert") — sem
// sessão da Supabase Auth no browser, upload direto client-side pra essas
// buckets passa a ser sempre rejeitado pela RLS. Rotea via service_role
// (bypassa RLS), mesmo padrão já usado em admin-banners/carrossel desde a
// Fase 2/5.
@Injectable()
export class UploadsService {
  constructor(
    private readonly supabaseCompat: SupabaseCompatService,
    private readonly orgAdmin: OrgAdminService,
    private readonly eventPermissions: EventPermissionsService,
  ) {}

  private extFrom(filename: string): string {
    return (filename.split('.').pop() ?? 'jpg').toLowerCase();
  }

  private async uploadAndGetUrl(bucket: string, path: string, file: Express.Multer.File): Promise<string> {
    const { error } = await this.supabaseCompat.storage.from(bucket).upload(path, file.buffer, {
      upsert: true,
      contentType: file.mimetype,
    });
    if (error) throw new InternalServerErrorException(error.message);

    const {
      data: { publicUrl },
    } = this.supabaseCompat.storage.from(bucket).getPublicUrl(path);
    return publicUrl;
  }

  async uploadAvatar(userId: string, file: Express.Multer.File | undefined): Promise<{ url: string }> {
    if (!file) throw new BadRequestException('Arquivo não enviado');
    const path = `${userId}/${randomUUID()}.${this.extFrom(file.originalname)}`;
    const url = await this.uploadAndGetUrl('avatars', path, file);
    return { url };
  }

  async uploadEventImage(userId: string, eventoId: string, file: Express.Multer.File | undefined): Promise<{ url: string }> {
    if (!file) throw new BadRequestException('Arquivo não enviado');
    if (!(await this.eventPermissions.isEventOwner(userId, eventoId))) throw new ForbiddenException('Sem permissão');

    const path = `${eventoId}/${randomUUID()}.${this.extFrom(file.originalname)}`;
    const url = await this.uploadAndGetUrl('event-images', path, file);
    return { url };
  }

  async uploadOrganizationLogo(userId: string, orgId: string, file: Express.Multer.File | undefined): Promise<{ url: string }> {
    if (!file) throw new BadRequestException('Arquivo não enviado');
    if (!(await this.orgAdmin.isOrgAdmin(orgId, userId))) throw new ForbiddenException('Sem permissão');

    const path = `${orgId}/${randomUUID()}.${this.extFrom(file.originalname)}`;
    const url = await this.uploadAndGetUrl('organization-logos', path, file);
    return { url };
  }
}
