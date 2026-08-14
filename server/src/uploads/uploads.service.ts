import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EventPermissionsService } from '../event-permissions/event-permissions.service';
import { OrgAdminService } from '../org-admin/org-admin.service';
import { LocalStorageService } from '../storage/local-storage.service';

// Upload vai direto pro disco do VPS via LocalStorageService (ver
// server/src/storage/) — não é mais Supabase Storage desde 14/08/2026 (o
// projeto que hospedava esses buckets parou de existir, todas as imagens do
// site quebraram). Continua roteado pelo backend com service account
// (nunca client-side) pelo mesmo motivo de sempre: usuário comum não tem
// acesso de escrita direto ao disco do servidor.
@Injectable()
export class UploadsService {
  constructor(
    private readonly storageService: LocalStorageService,
    private readonly orgAdmin: OrgAdminService,
    private readonly eventPermissions: EventPermissionsService,
  ) {}

  private extFrom(filename: string): string {
    return (filename.split('.').pop() ?? 'jpg').toLowerCase();
  }

  private async uploadAndGetUrl(bucket: string, path: string, file: Express.Multer.File): Promise<string> {
    const { error } = await this.storageService.storage.from(bucket).upload(path, file.buffer, {
      upsert: true,
      contentType: file.mimetype,
    });
    if (error) throw new InternalServerErrorException(error.message);

    const {
      data: { publicUrl },
    } = this.storageService.storage.from(bucket).getPublicUrl(path);
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
