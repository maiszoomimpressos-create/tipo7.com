import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Porte de web/src/app/criar-evento/{page,PromoterOnboarding}.tsx (Fase 7.2, G13).
// PromotorProfile é 1:1 com o usuário (userId @unique no schema).
@Injectable()
export class PromotorProfileService {
  constructor(private readonly prisma: PrismaService) {}

  // GET /profile/promotor — só o `id`, é tudo que criar-evento/page.tsx usa
  // hoje (PromoterOnboarding.tsx, que consumiria o resto, não está
  // renderizado em nenhuma tela ainda — código órfão do lado da UI, mas a
  // escrita abaixo é portada mesmo assim).
  async getMeuPerfil(userId: string) {
    const perfil = await this.prisma.promotorProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    return perfil ?? null;
  }

  // POST /profile/promotor — cria ou atualiza, mesma lógica de
  // PromoterOnboarding.tsx::handleSalvar (update+delete+reinsere sócios em
  // modo edição; insert+insere sócios em modo criação).
  async salvarMeuPerfil(
    userId: string,
    body: {
      tipoPessoa?: 'pf' | 'pj';
      tipoEspaco?: 'proprio' | 'alugado';
      numSocios?: '1' | '2-5' | '6+';
      socios?: Array<{ nome: string; cpf: string; telefone?: string | null; email?: string | null }>;
    },
  ) {
    // Achado real (08/08/2026, varredura): findUnique+create/update na mão
    // tem uma janela de corrida (dois POSTs concorrentes em /profile/promotor
    // podiam ambos cair no ramo "não existe" e o segundo create() estourar
    // 500 cru em userId @unique) — relacionado ao bug já conhecido de
    // "promotor duplicado". upsert() é atômico (ON CONFLICT do Postgres),
    // elimina a janela.
    const existenteAntes = await this.prisma.promotorProfile.findUnique({ where: { userId }, select: { id: true } });
    const salvo = await this.prisma.promotorProfile.upsert({
      where: { userId },
      create: { userId, tipoPessoa: body.tipoPessoa ?? '', tipoEspaco: body.tipoEspaco ?? '', numSocios: body.numSocios ?? '' },
      update: { tipoPessoa: body.tipoPessoa, tipoEspaco: body.tipoEspaco, numSocios: body.numSocios },
      select: { id: true },
    });
    const promotorId = salvo.id;
    if (existenteAntes) {
      await this.prisma.promotorSocio.deleteMany({ where: { promotorId } });
    }

    const socios = (body.socios ?? []).filter((s) => s.nome?.trim() && s.cpf?.replace(/\D/g, '').length === 11);
    if (socios.length > 0) {
      await this.prisma.promotorSocio.createMany({
        data: socios.map((s) => ({
          promotorId,
          nome: s.nome.trim(),
          cpf: s.cpf.replace(/\D/g, ''),
          telefone: s.telefone || null,
          email: s.email || null,
        })),
      });
    }

    return { ok: true, id: promotorId };
  }
}
