import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Porte 1:1 de web/src/lib/orgAdmin.ts.
// Dono (organizations.owner_id) OU membro ativo em organization_admins.
// Mesma regra da function is_org_admin() do banco (usada nas policies de
// RLS) — replicada aqui em código de app porque o Prisma, assim como o
// client de service role hoje, não passa por RLS nenhuma.
@Injectable()
export class OrgAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async isOrgAdmin(organizationId: string, userId: string): Promise<boolean> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { ownerId: true },
    });
    if (org?.ownerId === userId) return true;

    const adminRow = await this.prisma.organizationAdmin.findFirst({
      where: { organizationId, userId, status: 'ativo' },
      select: { id: true },
    });
    return !!adminRow;
  }
}
