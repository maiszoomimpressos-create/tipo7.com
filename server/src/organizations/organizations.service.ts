import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { validarCNPJ } from '../common/document-validation.util';
import { OrgAdminService } from '../org-admin/org-admin.service';
import { PrismaService } from '../prisma/prisma.service';

interface OrgBody {
  documento?: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  logoUrl?: string | null;
  zipCode?: string;
  street?: string;
  streetNumber?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  complement?: string;
  phone?: string;
  nicho?: 'eventos' | 'estacionamento' | 'ambos';
}

function validarDocumento(documento?: string): string | null {
  const digitos = (documento ?? '').replace(/\D/g, '');
  if (digitos.length === 14) {
    if (!validarCNPJ(digitos)) throw new BadRequestException('CNPJ inválido');
    return digitos;
  }
  if (digitos.length !== 0 && digitos.length !== 11) {
    throw new BadRequestException('Documento deve ter 11 dígitos (CPF) ou 14 (CNPJ)');
  }
  return null;
}

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgAdmin: OrgAdminService,
  ) {}

  // GET /organizations — organizações que o usuário administra (dono
  // integral ou sócio) ou foi convidado pra administrar (status='convidado')
  async listMinhas(userId: string) {
    const rows = await this.prisma.organizationAdmin.findMany({
      where: { userId, status: { not: 'removido' } },
      orderBy: { createdAt: 'asc' },
      select: {
        role: true,
        participacao: true,
        percentual: true,
        status: true,
        organizationId: true,
        organization: {
          select: {
            id: true, name: true, cnpj: true, nomeFantasia: true, codigo: true, logoUrl: true,
            city: true, state: true, street: true, streetNumber: true, neighborhood: true,
            zipCode: true, complement: true, phone: true, nicho: true, capacity: true,
          },
        },
      },
    });

    const organizacoes = rows.map((r) => ({
      ...r.organization,
      role: r.role,
      participacao: r.participacao,
      percentual: r.percentual ? Number(r.percentual) : null,
      status: r.status,
    }));

    return { organizacoes };
  }

  // POST /organizations — cria uma nova organização.
  async criar(userId: string, body: OrgBody) {
    const cnpj = validarDocumento(body.documento);
    const nome = body.razaoSocial?.trim() || body.nomeFantasia?.trim();
    if (!nome) throw new BadRequestException('Informe um nome');

    if (cnpj) {
      const count = await this.prisma.organization.count({ where: { cnpj } });
      if (count > 0) throw new ConflictException('Este CNPJ já está cadastrado por outra organização.');
    }

    const rows = await this.prisma.$queryRaw<{ generate_org_code: string }[]>`
      SELECT generate_org_code('promotora')
    `;
    const codigo = rows[0]?.generate_org_code;
    if (!codigo) throw new InternalServerErrorException('Erro ao gerar código');

    const org = await this.prisma.organization.create({
      data: {
        ownerId: userId,
        type: 'promotora',
        codigo,
        name: nome,
        cnpj,
        nomeFantasia: body.nomeFantasia?.trim() || null,
        logoUrl: body.logoUrl || null,
        zipCode: body.zipCode || null,
        street: body.street || null,
        streetNumber: body.streetNumber || null,
        neighborhood: body.neighborhood || null,
        city: body.city || null,
        state: body.state || null,
        complement: body.complement || null,
        phone: body.phone || null,
        nicho: body.nicho || null,
      },
    });

    await this.prisma.organizationAdmin.create({
      data: {
        organizationId: org.id,
        userId,
        role: 'admin',
        status: 'ativo',
        participacao: 'integral',
        percentual: 100,
        invitedBy: null,
      },
    });

    return { organizacao: { ...org, role: 'admin', participacao: 'integral', percentual: 100, status: 'ativo' } };
  }

  // PUT /organizations/:id
  async atualizar(userId: string, id: string, body: OrgBody) {
    if (!(await this.orgAdmin.isOrgAdmin(id, userId))) throw new ForbiddenException('Sem permissão');

    const cnpj = validarDocumento(body.documento);
    const nome = body.razaoSocial?.trim() || body.nomeFantasia?.trim();
    if (!nome) throw new BadRequestException('Informe um nome');

    if (cnpj) {
      const count = await this.prisma.organization.count({ where: { cnpj, id: { not: id } } });
      if (count > 0) throw new ConflictException('Este CNPJ já está cadastrado por outra organização.');
    }

    const org = await this.prisma.organization.update({
      where: { id },
      data: {
        name: nome,
        cnpj,
        nomeFantasia: body.nomeFantasia?.trim() || null,
        logoUrl: body.logoUrl || null,
        zipCode: body.zipCode || null,
        street: body.street || null,
        streetNumber: body.streetNumber || null,
        neighborhood: body.neighborhood || null,
        city: body.city || null,
        state: body.state || null,
        complement: body.complement || null,
        phone: body.phone || null,
      },
    });

    return { organizacao: org };
  }

  // GET /organizations/:id/socios
  async listSocios(userId: string, id: string) {
    if (!(await this.orgAdmin.isOrgAdmin(id, userId))) throw new ForbiddenException('Sem permissão');

    const rows = await this.prisma.organizationAdmin.findMany({
      where: { organizationId: id, status: { not: 'removido' } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, userId: true, role: true, participacao: true, percentual: true, status: true,
        user: { select: { fullName: true, userCode: true } },
      },
    });

    return {
      socios: rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        role: r.role,
        participacao: r.participacao,
        percentual: r.percentual ? Number(r.percentual) : null,
        status: r.status,
        nome: r.user?.fullName ?? null,
        codigo: r.user?.userCode ?? null,
      })),
    };
  }

  // POST /organizations/:id/socios — convida alguém (CPF, código T7 ou email).
  async convidarSocio(
    userId: string,
    id: string,
    body: { identificador?: string; participacao?: 'integral' | 'socio'; percentual?: number },
  ) {
    if (!(await this.orgAdmin.isOrgAdmin(id, userId))) throw new ForbiddenException('Sem permissão');

    const identificador = body.identificador?.trim() ?? '';
    const participacao = body.participacao === 'integral' ? 'integral' : 'socio';
    if (!identificador) throw new BadRequestException('Informe o CPF, código T7 ou e-mail da pessoa');

    let percentual: number;
    if (participacao === 'integral') {
      percentual = 100;
    } else {
      percentual = Number(body.percentual);
      if (!Number.isFinite(percentual) || percentual <= 0 || percentual > 100) {
        throw new BadRequestException('Informe a porcentagem de participação do sócio (entre 0 e 100).');
      }
    }

    let pessoa: { id: string; fullName: string | null } | null = null;

    if (identificador.includes('@')) {
      const rows = await this.prisma.$queryRaw<{ get_user_id_by_email: string | null }[]>`
        SELECT get_user_id_by_email(${identificador})
      `;
      const foundId = rows[0]?.get_user_id_by_email;
      if (foundId) {
        pessoa = await this.prisma.profile.findUnique({ where: { id: foundId }, select: { id: true, fullName: true } });
      }
    } else {
      const cpfDigitos = identificador.replace(/\D/g, '');
      pessoa =
        cpfDigitos.length === 11
          ? await this.prisma.profile.findFirst({ where: { cpf: cpfDigitos }, select: { id: true, fullName: true } })
          : await this.prisma.profile.findFirst({
              where: { userCode: { equals: identificador, mode: 'insensitive' } },
              select: { id: true, fullName: true },
            });
    }

    if (!pessoa) throw new NotFoundException('Pessoa não encontrada com esse CPF/código/e-mail.');
    if (pessoa.id === userId) throw new ConflictException('Você já administra essa organização.');

    const existente = await this.prisma.organizationAdmin.findFirst({
      where: { organizationId: id, userId: pessoa.id },
      select: { id: true, status: true },
    });

    if (existente && existente.status !== 'removido') {
      throw new ConflictException(
        existente.status === 'ativo' ? 'Essa pessoa já administra essa organização.' : 'Essa pessoa já tem um convite pendente.',
      );
    }

    if (existente) {
      await this.prisma.organizationAdmin.update({
        where: { id: existente.id },
        data: { status: 'convidado', participacao, percentual, invitedBy: userId, role: 'admin' },
      });
    } else {
      await this.prisma.organizationAdmin.create({
        data: {
          organizationId: id,
          userId: pessoa.id,
          role: 'admin',
          status: 'convidado',
          participacao,
          percentual,
          invitedBy: userId,
        },
      });
    }

    return { ok: true, nome: pessoa.fullName };
  }

  // POST /organizations/:id/socios/responder — o próprio convidado aceita/recusa.
  async responderConvite(userId: string, id: string, aceitar: boolean) {
    const convite = await this.prisma.organizationAdmin.findFirst({
      where: { organizationId: id, userId, status: 'convidado' },
      select: { id: true, percentual: true },
    });
    if (!convite) throw new NotFoundException('Convite não encontrado');

    if (aceitar) {
      await this.prisma.organizationAdmin.update({ where: { id: convite.id }, data: { status: 'ativo' } });

      // Diluição automática: dono integral único perde a diferença pro
      // novo sócio — só nesse caso simples (1 outro admin integral).
      const percentualNovoSocio = Number(convite.percentual ?? 0);
      if (percentualNovoSocio > 0) {
        const outrosAdmins = await this.prisma.organizationAdmin.findMany({
          where: { organizationId: id, status: 'ativo', id: { not: convite.id } },
          select: { id: true, participacao: true },
        });
        const integrais = outrosAdmins.filter((a) => a.participacao === 'integral');
        if (integrais.length === 1) {
          const restante = Math.max(0, 100 - percentualNovoSocio);
          await this.prisma.organizationAdmin.update({
            where: { id: integrais[0].id },
            data: { participacao: 'socio', percentual: restante },
          });
        }
      }
    } else {
      await this.prisma.organizationAdmin.update({ where: { id: convite.id }, data: { status: 'removido' } });
    }

    return { ok: true };
  }

  // GET /organizations/pedidos-pendentes — convites ENVIADOS ainda sem resposta.
  async pedidosPendentes(userId: string) {
    const minhasOrgs = await this.prisma.organizationAdmin.findMany({
      where: { userId, status: 'ativo' },
      select: { organizationId: true },
    });
    const orgIds = minhasOrgs.map((r) => r.organizationId);
    if (orgIds.length === 0) return { pedidos: [] };

    const rows = await this.prisma.organizationAdmin.findMany({
      where: { organizationId: { in: orgIds }, status: 'convidado', userId: { not: userId } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, participacao: true, percentual: true, createdAt: true,
        organization: { select: { name: true, nomeFantasia: true } },
        user: { select: { fullName: true, userCode: true } },
      },
    });

    return {
      pedidos: rows.map((r) => ({
        id: r.id,
        organizacao: r.organization.nomeFantasia || r.organization.name || 'Organização',
        participacao: r.participacao,
        percentual: r.percentual ? Number(r.percentual) : null,
        nome: r.user?.fullName ?? null,
        codigo: r.user?.userCode ?? null,
        criadoEm: r.createdAt,
      })),
    };
  }

  // GET /organizations/colaboradores — pedidos de equipe mandados pra
  // eventos de TODAS as organizações que o usuário administra ativamente.
  // Porte de web/src/app/configuracoes/colaboradores/page.tsx: antes usava
  // get_emails_by_ids via RPC direto na Supabase; profiles.email (Fase 6)
  // já resolve isso via relation normal, sem precisar da função SQL aqui.
  async colaboradores(userId: string) {
    const minhasOrgs = await this.prisma.organizationAdmin.findMany({
      where: { userId, status: 'ativo' },
      select: { organizationId: true },
    });
    const orgIds = minhasOrgs.map((r) => r.organizationId);
    if (orgIds.length === 0) return { linhas: [] };

    const staffRows = await this.prisma.eventStaff.findMany({
      where: {
        status: { in: ['pending', 'active'] },
        event: { organizationId: { in: orgIds } },
      },
      select: {
        id: true,
        status: true,
        event: { select: { id: true, title: true, dateStart: true, dateEnd: true } },
        user: { select: { id: true, fullName: true, userCode: true, email: true } },
        eventPosition: { select: { name: true } },
      },
    });

    const hoje = new Date().toISOString().slice(0, 10);

    const linhas = staffRows.flatMap((r) => {
      const inicio = r.event.dateStart ? r.event.dateStart.toISOString().slice(0, 10) : null;
      const fim = r.event.dateEnd ? r.event.dateEnd.toISOString().slice(0, 10) : inicio;

      let aba: 'pendentes' | 'ativos' | 'aceitos' | null = null;
      if (r.status === 'pending') aba = 'pendentes';
      else if (r.status === 'active') {
        if (inicio && fim && inicio <= hoje && hoje <= fim) aba = 'ativos';
        else if (inicio && inicio > hoje) aba = 'aceitos';
      }
      if (!aba) return [];

      return [
        {
          id: r.id,
          nome: r.user.fullName,
          email: r.user.email,
          codigo: r.user.userCode,
          funcao: r.eventPosition?.name ?? null,
          evento: r.event.title ?? 'Evento',
          aba,
        },
      ];
    });

    return { linhas };
  }

  // GET /organizations/socios-ativos — todo mundo que já aceitou administrar
  // alguma das organizações do usuário.
  async sociosAtivos(userId: string) {
    const minhasOrgs = await this.prisma.organizationAdmin.findMany({
      where: { userId, status: 'ativo' },
      select: { organizationId: true },
    });
    const orgIds = minhasOrgs.map((r) => r.organizationId);
    if (orgIds.length === 0) return { socios: [] };

    const rows = await this.prisma.organizationAdmin.findMany({
      where: { organizationId: { in: orgIds }, status: 'ativo' },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, userId: true, participacao: true, percentual: true,
        organization: { select: { name: true, nomeFantasia: true } },
        user: { select: { fullName: true, userCode: true } },
      },
    });

    const userIds = Array.from(new Set(rows.map((r) => r.userId)));
    const emailRows =
      userIds.length > 0
        ? await this.prisma.$queryRaw<{ id: string; email: string }[]>`
            SELECT * FROM get_emails_by_ids(${userIds}::uuid[])
          `
        : [];
    const emailMap = new Map(emailRows.map((e) => [e.id, e.email]));

    return {
      socios: rows.map((r) => ({
        id: r.id,
        organizacao: r.organization.nomeFantasia || r.organization.name || 'Organização',
        participacao: r.participacao,
        percentual: r.percentual ? Number(r.percentual) : null,
        nome: r.user?.fullName ?? null,
        codigo: r.user?.userCode ?? null,
        email: emailMap.get(r.userId) ?? null,
        voceMesmo: r.userId === userId,
      })),
    };
  }
}
