import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Porte 1:1 de web/src/app/api/usuarios/buscar/route.ts.
@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

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
}
