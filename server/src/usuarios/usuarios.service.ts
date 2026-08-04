import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformAdminService } from '../platform-admin/platform-admin.service';

type StatsRow = { user_id: string; qtd_compras: bigint | number; total_gasto: string | number | null };

// Porte 1:1 de web/src/app/api/usuarios/buscar/route.ts.
@Injectable()
export class UsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platformAdmin: PlatformAdminService,
  ) {}

  async buscar(q: string) {
    let targetId: string | null = null;
    let targetNome: string | null = null;

    if (q.toUpperCase().startsWith('T7-')) {
      const perfil = await this.prisma.profile.findUnique({
        where: { userCode: q.toUpperCase() },
        select: { id: true, fullName: true },
      });
      targetId = perfil?.id ?? null;
      targetNome = perfil?.fullName ?? null;
    } else {
      const rows = await this.prisma.$queryRaw<{ find_user_id_by_email: string | null }[]>`
        SELECT find_user_id_by_email(${q})
      `;
      const foundId = rows[0]?.find_user_id_by_email;
      if (foundId) {
        targetId = foundId;
        const perfil = await this.prisma.profile.findUnique({ where: { id: foundId }, select: { fullName: true } });
        targetNome = perfil?.fullName ?? q ?? null;
      }
    }

    if (!targetId) throw new NotFoundException('Usuário não encontrado. Verifique o email ou código T7-USR.');

    return { id: targetId, nome: targetNome };
  }

  // Lista completa pro painel admin (Admin > Usuários) — antes vinha de
  // supabase.auth.admin.listUsers() + join com profiles/user_order_stats.
  // Como a Fase 6 já saiu da Supabase Auth, profiles.email é a fonte de
  // verdade agora (auth.admin.listUsers() nem enxergaria usuários
  // registrados depois do corte).
  async listAdmin(userId: string) {
    const member = await this.platformAdmin.getAdminMember(userId);
    if (!member) throw new ForbiddenException('Sem permissão');

    const perfis = await this.prisma.profile.findMany({
      select: {
        id: true, email: true, fullName: true, cpf: true, phone: true, userCode: true,
        zipCode: true, street: true, streetNumber: true, neighborhood: true, city: true,
        state: true, complement: true, createdAt: true,
      },
    });

    const ids = perfis.map((p) => p.id);
    const stats = ids.length
      ? await this.prisma.$queryRaw<StatsRow[]>`
          SELECT user_id, qtd_compras, total_gasto FROM user_order_stats WHERE user_id = ANY(${ids}::uuid[])
        `
      : [];
    const statsMap = new Map(stats.map((s) => [s.user_id, s]));

    const rows = perfis.map((p) => {
      const s = statsMap.get(p.id);
      const endereco = [p.street, p.streetNumber, p.neighborhood, p.complement].filter(Boolean).join(', ');
      return {
        id: p.id,
        email: p.email ?? '—',
        nome: p.fullName ?? '—',
        cpf: p.cpf,
        phone: p.phone,
        userCode: p.userCode,
        cadastroEm: p.createdAt,
        qtdCompras: s ? Number(s.qtd_compras) : 0,
        totalGasto: s ? Number(s.total_gasto ?? 0) : 0,
        cep: p.zipCode,
        endereco: endereco || null,
        cidade: p.city,
        estado: p.state,
      };
    });

    rows.sort((a, b) => new Date(b.cadastroEm ?? 0).getTime() - new Date(a.cadastroEm ?? 0).getTime());
    return rows;
  }
}
