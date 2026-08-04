import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Porte 1:1 de web/src/lib/adminAuth.ts.
export type AdminRole = 'super_admin' | 'admin' | 'member';

export interface AdminMember {
  role: AdminRole;
  permissions: string[];
  acessoRestrito: boolean;
}

@Injectable()
export class PlatformAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getAdminMember(userId: string): Promise<AdminMember | null> {
    const row = await this.prisma.platformTeam.findUnique({
      where: { userId },
      select: { role: true, permissions: true, acessoRestrito: true },
    });
    if (!row) return null;
    return {
      role: row.role as AdminRole,
      permissions: row.permissions,
      acessoRestrito: row.acessoRestrito,
    };
  }

  can(member: AdminMember, perm: string): boolean {
    if (member.role === 'super_admin' || member.role === 'admin') return true;
    return member.permissions.includes(perm);
  }

  // Área restrita (Equipe, Financeiro, API) — mais rígida que can(): role
  // 'admin' sozinho NÃO basta, precisa ser super_admin ou ter o acesso
  // explicitamente concedido (acessoRestrito=true).
  temAcessoRestrito(member: AdminMember): boolean {
    return member.role === 'super_admin' || member.acessoRestrito === true;
  }
}
