import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MP_CRED_KEYS, PAGBANK_CRED_KEYS } from '../common/platform-credentials.service';
import { RateLimitDbService } from '../common/rate-limit-db.service';
import { PlatformAdminService, type AdminMember } from '../platform-admin/platform-admin.service';
import { PrismaService } from '../prisma/prisma.service';

const CHAVES_CREDENCIAIS_VALIDAS = new Set<string>([...MP_CRED_KEYS, ...PAGBANK_CRED_KEYS]);

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platformAdmin: PlatformAdminService,
    private readonly rateLimitDbService: RateLimitDbService,
  ) {}

  // Mantido por compatibilidade com os controllers de area-restrita — repassa
  // pro RateLimitDbService compartilhado (ver server/src/common/).
  async rateLimitDb(ip: string, key: string, max: number, windowMs: number): Promise<boolean> {
    return this.rateLimitDbService.check(ip, key, max, windowMs);
  }

  // ── helpers de permissão (lançam ForbiddenException) ────────────────────

  async requireMember(userId: string): Promise<AdminMember> {
    const member = await this.platformAdmin.getAdminMember(userId);
    if (!member) throw new ForbiddenException('Sem permissão');
    return member;
  }

  async requireSuperAdmin(userId: string): Promise<AdminMember> {
    const member = await this.requireMember(userId);
    if (member.role !== 'super_admin') throw new ForbiddenException('Sem permissão');
    return member;
  }

  async requirePerm(userId: string, perm: string): Promise<AdminMember> {
    const member = await this.requireMember(userId);
    if (!this.platformAdmin.can(member, perm)) throw new ForbiddenException('Sem permissão');
    return member;
  }

  async requireAcessoRestrito(userId: string): Promise<AdminMember> {
    const member = await this.requireMember(userId);
    if (!this.platformAdmin.temAcessoRestrito(member)) throw new ForbiddenException('Sem permissão');
    return member;
  }

  // ── conteudo (GET público, PUT super_admin) ──────────────────────────────

  async getConteudo(key: string) {
    const row = await this.prisma.platformContent.findUnique({ where: { key }, select: { content: true, updatedAt: true } });
    if (!row) throw new NotFoundException();
    return { content: row.content, updated_at: row.updatedAt };
  }

  async putConteudo(userId: string, key: string, content: string) {
    await this.requireSuperAdmin(userId);
    await this.prisma.platformContent.upsert({
      where: { key },
      create: { key, content, updatedAt: new Date() },
      update: { content, updatedAt: new Date() },
    });
    return { ok: true };
  }

  // ── equipe (platform_team) ───────────────────────────────────────────────

  async criarMembroEquipe(userId: string, body: { email?: string; role?: string; permissions?: string[] }) {
    await this.requireSuperAdmin(userId);

    if (!body.email || !body.role) throw new BadRequestException('email e role são obrigatórios');

    const rows = await this.prisma.$queryRaw<{ find_user_id_by_email: string | null }[]>`
      SELECT find_user_id_by_email(${body.email})
    `;
    const targetId = rows[0]?.find_user_id_by_email;
    if (!targetId) throw new NotFoundException('Usuário não encontrado. Ele precisa ter uma conta na Tipo7.');

    const profile = await this.prisma.profile.findUnique({ where: { id: targetId }, select: { fullName: true } });

    const permissions =
      body.role === 'admin'
        ? ['ver_dashboard', 'gerenciar_promotores', 'gerenciar_eventos', 'gerenciar_financeiro']
        : (body.permissions ?? []);

    const data = await this.prisma.platformTeam.create({
      data: { userId: targetId, role: body.role, permissions, addedBy: userId },
      select: { id: true, userId: true, role: true, permissions: true, createdAt: true },
    });

    return {
      member: {
        id: data.id,
        userId: data.userId,
        nome: profile?.fullName ?? 'Sem nome',
        role: data.role,
        permissions: data.permissions,
        createdAt: data.createdAt,
        isMe: false,
      },
    };
  }

  async removerMembroEquipe(userId: string, memberId: string) {
    await this.requireSuperAdmin(userId);

    const target = await this.prisma.platformTeam.findUnique({ where: { id: memberId }, select: { role: true } });
    if (target?.role === 'super_admin') throw new ForbiddenException('Não é possível remover um Super Admin.');

    await this.prisma.platformTeam.delete({ where: { id: memberId } });
    return { ok: true };
  }

  // ── promotores/:userId (fee_pct) ─────────────────────────────────────────

  async atualizarFeePctPromotor(userId: string, targetUserId: string, feePct: number) {
    await this.requirePerm(userId, 'gerenciar_promotores');

    if (typeof feePct !== 'number' || feePct < 0 || feePct > 100) {
      throw new BadRequestException('fee_pct deve ser um número entre 0 e 100');
    }

    await this.prisma.promotorMpAccount.updateMany({
      where: { userId: targetUserId },
      data: { feePct, updatedAt: new Date() },
    });
    return { ok: true };
  }

  // ── roadmap ───────────────────────────────────────────────────────────────

  async getRoadmap(userId: string) {
    await this.requireMember(userId);

    const row = await this.prisma.platformSetting.findUnique({ where: { key: 'roadmap_items' }, select: { value: true } });
    if (!row?.value) return { items: null };
    try {
      return { items: JSON.parse(row.value) };
    } catch {
      return { items: null };
    }
  }

  async patchRoadmap(userId: string, items: unknown) {
    await this.requireMember(userId);
    if (!Array.isArray(items)) throw new BadRequestException('Formato inválido');

    await this.prisma.platformSetting.upsert({
      where: { key: 'roadmap_items' },
      create: { key: 'roadmap_items', value: JSON.stringify(items), updatedAt: new Date() },
      update: { value: JSON.stringify(items), updatedAt: new Date() },
    });
    return { ok: true };
  }

  // ── settings (taxas) ──────────────────────────────────────────────────────

  async patchSettings(userId: string, body: Record<string, unknown>) {
    await this.requirePerm(userId, 'gerenciar_financeiro');

    const MODULE_PREFIXES = ['', 'bilheteria_', 'tenda_', 'estacionamento_'];
    const PERCENT_KEYS = new Set([
      'fee_pct_pix', 'fee_pct_credito_1x', 'fee_pct_credito_6x', 'fee_pct_credito_12x',
      ...MODULE_PREFIXES.map((p) => `${p}min_fee_pct`),
    ]);
    const BASE_VALUE_KEYS = new Set(MODULE_PREFIXES.map((p) => `${p}default_fee_pct`));
    const BASE_TYPE_KEYS = new Set(MODULE_PREFIXES.map((p) => `${p}default_fee_type`));
    const EXTRA_VALUE_KEYS = new Set(MODULE_PREFIXES.flatMap((p) => [1, 2].map((n) => `${p}extra_fee_${n}_value`)));
    const EXTRA_LABEL_KEYS = new Set(MODULE_PREFIXES.flatMap((p) => [1, 2].map((n) => `${p}extra_fee_${n}_label`)));
    const EXTRA_TYPE_KEYS = new Set(MODULE_PREFIXES.flatMap((p) => [1, 2].map((n) => `${p}extra_fee_${n}_type`)));

    const rows: { key: string; value: string }[] = [];

    for (const [key, val] of Object.entries(body)) {
      if (val === undefined) continue;

      if (PERCENT_KEYS.has(key)) {
        if (typeof val !== 'number' || val < 0 || val > 100) throw new BadRequestException(`${key} deve ser um número entre 0 e 100`);
        rows.push({ key, value: String(val) });
      } else if (BASE_VALUE_KEYS.has(key)) {
        if (typeof val !== 'number' || val < 0 || val > 1000000) throw new BadRequestException(`${key} deve ser um número entre 0 e 1000000`);
        rows.push({ key, value: String(val) });
      } else if (BASE_TYPE_KEYS.has(key)) {
        if (val !== 'fixed' && val !== 'percent') throw new BadRequestException(`${key} deve ser "fixed" ou "percent"`);
        rows.push({ key, value: val });
      } else if (EXTRA_VALUE_KEYS.has(key)) {
        if (typeof val !== 'number' || val < 0 || val > 1000000) throw new BadRequestException(`${key} deve ser um número entre 0 e 1000000`);
        rows.push({ key, value: String(val) });
      } else if (EXTRA_TYPE_KEYS.has(key)) {
        if (val !== 'fixed' && val !== 'percent') throw new BadRequestException(`${key} deve ser "fixed" ou "percent"`);
        rows.push({ key, value: val });
      } else if (EXTRA_LABEL_KEYS.has(key)) {
        if (typeof val !== 'string' || val.length > 60) throw new BadRequestException(`${key} deve ser um texto de até 60 caracteres`);
        rows.push({ key, value: val.trim() });
      } else {
        throw new BadRequestException(`Chave desconhecida: ${key}`);
      }
    }

    const now = new Date();
    await Promise.all(
      rows.map(({ key, value }) =>
        this.prisma.platformSetting.upsert({
          where: { key },
          create: { key, value, updatedAt: now },
          update: { value, updatedAt: now },
        }),
      ),
    );
    return { ok: true };
  }

  // ── fee-rules ──────────────────────────────────────────────────────────────

  async listFeeRules(userId: string) {
    await this.requirePerm(userId, 'gerenciar_financeiro');

    const rules = await this.prisma.feeRule.findMany({ orderBy: { createdAt: 'desc' } });

    const enriched = await Promise.all(
      rules.map(async (rule) => {
        let eventTitle: string | null = null;
        let promoterName: string | null = null;
        let quotaUsed = 0;

        if (rule.eventId) {
          const e = await this.prisma.event.findUnique({ where: { id: rule.eventId }, select: { title: true } });
          eventTitle = e?.title ?? null;
        }
        if (rule.userId) {
          const p = await this.prisma.profile.findUnique({ where: { id: rule.userId }, select: { fullName: true } });
          promoterName = p?.fullName ?? null;
        }

        if (rule.type === 'global_quota' && rule.quotaLimit) {
          const desde = rule.quotaPeriod === 'monthly' ? new Date(new Date().getFullYear(), new Date().getMonth(), 1) : new Date('2000-01-01T00:00:00Z');
          const orders = await this.prisma.order.findMany({ where: { status: 'approved', createdAt: { gte: desde } }, select: { id: true } });
          const ids = orders.map((o) => o.id);
          if (ids.length) {
            const items = await this.prisma.orderItem.findMany({ where: { orderId: { in: ids } }, select: { quantity: true } });
            quotaUsed = items.reduce((s, i) => s + i.quantity, 0);
          }
        }

        if (rule.type === 'promoter_quota' && rule.userId && rule.quotaLimit) {
          const desde = rule.quotaPeriod === 'monthly' ? new Date(new Date().getFullYear(), new Date().getMonth(), 1) : new Date('2000-01-01T00:00:00Z');
          const orgs = await this.prisma.organization.findMany({ where: { ownerId: rule.userId }, select: { id: true } });
          const orgIds = orgs.map((o) => o.id);
          if (orgIds.length) {
            const evs = await this.prisma.event.findMany({ where: { organizationId: { in: orgIds } }, select: { id: true } });
            const evIds = evs.map((e) => e.id);
            if (evIds.length) {
              const orders = await this.prisma.order.findMany({
                where: { eventId: { in: evIds }, status: 'approved', createdAt: { gte: desde } },
                select: { id: true },
              });
              const ids = orders.map((o) => o.id);
              if (ids.length) {
                const items = await this.prisma.orderItem.findMany({ where: { orderId: { in: ids } }, select: { quantity: true } });
                quotaUsed = items.reduce((s, i) => s + i.quantity, 0);
              }
            }
          }
        }

        return { ...rule, event_title: eventTitle, promoter_name: promoterName, quota_used: quotaUsed };
      }),
    );

    return { rules: enriched };
  }

  async criarFeeRule(userId: string, body: Record<string, any>) {
    await this.requirePerm(userId, 'gerenciar_financeiro');

    const TIPOS_VALIDOS = ['event', 'promoter_quota', 'global_quota'];
    if (!body.name || !body.type) throw new BadRequestException('Nome e tipo são obrigatórios');
    if (!TIPOS_VALIDOS.includes(body.type)) throw new BadRequestException(`Tipo inválido. Use: ${TIPOS_VALIDOS.join(', ')}`);
    if (body.discount_pct !== undefined && (body.discount_pct < 0 || body.discount_pct > 100)) {
      throw new BadRequestException('discount_pct deve ser entre 0 e 100');
    }
    if (body.type === 'event' && body.fee_type !== undefined) {
      if (body.fee_type !== 'fixed' && body.fee_type !== 'percent') throw new BadRequestException('fee_type deve ser "fixed" ou "percent"');
      if (typeof body.fee_value !== 'number' || body.fee_value < 0 || body.fee_value > 1000000) {
        throw new BadRequestException('fee_value deve ser um número entre 0 e 1000000');
      }
      for (const t of [body.extra_fee_1_type, body.extra_fee_2_type]) {
        if (t !== undefined && t !== 'fixed' && t !== 'percent') throw new BadRequestException('extra_fee_N_type deve ser "fixed" ou "percent"');
      }
    }

    const rule = await this.prisma.feeRule.create({
      data: {
        name: body.name,
        type: body.type,
        eventId: body.event_id || null,
        userId: body.user_id || null,
        discountPct: body.discount_pct ?? 100,
        quotaLimit: body.quota_limit || null,
        quotaPeriod: body.quota_period || null,
        bypassMinimum: body.bypass_minimum ?? false,
        notes: body.notes || null,
        createdBy: userId,
        feeType: body.fee_type ?? null,
        feeValue: body.fee_value ?? null,
        extraFee1Label: body.extra_fee_1_label ?? null,
        extraFee1Value: body.extra_fee_1_value ?? null,
        extraFee1Type: body.extra_fee_1_type ?? null,
        extraFee2Label: body.extra_fee_2_label ?? null,
        extraFee2Value: body.extra_fee_2_value ?? null,
        extraFee2Type: body.extra_fee_2_type ?? null,
      },
    });
    return { rule };
  }

  async removerFeeRule(userId: string, id: string) {
    await this.requirePerm(userId, 'gerenciar_financeiro');
    if (!id) throw new BadRequestException('id obrigatório');
    await this.prisma.feeRule.delete({ where: { id } });
    return { ok: true };
  }

  // ── saldo-bilheteria ─────────────────────────────────────────────────────

  async listSaldoBilheteria(userId: string) {
    await this.requirePerm(userId, 'gerenciar_financeiro');

    const saldos = await this.prisma.saldoBilheteria.findMany({
      where: { ativo: true },
      orderBy: { ativadoEm: 'desc' },
      select: {
        eventId: true, ativo: true, bloqueioAtivo: true, retencaoPct: true, avisoPct: true,
        metaReserva: true, saldoAtual: true, avisoDisparado: true, ativadoEm: true,
      },
    });

    const eventIds = saldos.map((s) => s.eventId);
    const eventos = eventIds.length
      ? await this.prisma.event.findMany({ where: { id: { in: eventIds } }, select: { id: true, title: true } })
      : [];
    const eventMap = new Map(eventos.map((e) => [e.id, e.title ?? 'Evento']));

    return {
      saldos: saldos.map((s) => ({
        event_id: s.eventId,
        ativo: s.ativo,
        bloqueio_ativo: s.bloqueioAtivo,
        retencao_pct: s.retencaoPct,
        aviso_pct: s.avisoPct,
        meta_reserva: s.metaReserva,
        saldo_atual: s.saldoAtual,
        aviso_disparado: s.avisoDisparado,
        ativado_em: s.ativadoEm,
        event_title: eventMap.get(s.eventId) ?? 'Evento',
      })),
    };
  }

  async patchSaldoBilheteria(userId: string, eventId: string, bloqueioAtivo: boolean) {
    await this.requirePerm(userId, 'gerenciar_financeiro');
    if (!eventId || typeof bloqueioAtivo !== 'boolean') {
      throw new BadRequestException('event_id e bloqueio_ativo são obrigatórios');
    }
    await this.prisma.saldoBilheteria.updateMany({ where: { eventId }, data: { bloqueioAtivo } });
    return { ok: true };
  }

  async listMovimentosSaldoBilheteria(userId: string, eventId: string) {
    await this.requirePerm(userId, 'gerenciar_financeiro');
    if (!eventId) throw new BadRequestException('event_id obrigatório');

    const movimentos = await this.prisma.saldoBilheteriaMovimento.findMany({
      where: { eventId },
      orderBy: { criadoEm: 'desc' },
      take: 200,
      select: { id: true, tipo: true, valor: true, saldoResultante: true, orderId: true, criadoEm: true },
    });
    return { movimentos };
  }

  // ── integracoes ────────────────────────────────────────────────────────────

  async listIntegracoes(userId: string) {
    await this.requireSuperAdmin(userId);

    const integracoes = await this.prisma.apiIntegracao.findMany({ orderBy: { areaSlug: 'asc' } });
    const rotas = await this.prisma.apiIntegracaoRota.findMany({ orderBy: { orderIndex: 'asc' } });

    return {
      integracoes: integracoes.map((i) => ({
        id: i.id,
        area_slug: i.areaSlug,
        nome: i.nome,
        base_url: i.baseUrl,
        api_key: i.apiKey,
        webhook_secret: i.webhookSecret,
        updated_at: i.updatedAt,
        rotas: rotas.filter((r) => r.integracaoId === i.id),
      })),
    };
  }

  async atualizarIntegracao(userId: string, id: string, body: { base_url?: string; api_key?: string; webhook_secret?: string }) {
    await this.requireSuperAdmin(userId);

    const data: Record<string, unknown> = { updatedAt: new Date() };
    if (body.base_url !== undefined) data.baseUrl = body.base_url.trim() || null;
    if (body.api_key !== undefined) data.apiKey = body.api_key.trim() || null;
    if (body.webhook_secret !== undefined) data.webhookSecret = body.webhook_secret.trim() || null;

    await this.prisma.apiIntegracao.update({ where: { id }, data });
    return { ok: true };
  }

  async atualizarIntegracaoRota(
    userId: string,
    id: string,
    body: { gatilho?: string; campos_envia?: string[]; campos_recebe?: string[]; observacao?: string },
  ) {
    await this.requireSuperAdmin(userId);

    const data: Record<string, unknown> = { updatedAt: new Date() };
    if (body.gatilho !== undefined) data.gatilho = body.gatilho.trim() || null;
    if (body.campos_envia !== undefined) data.camposEnvia = body.campos_envia.map((c) => c.trim()).filter(Boolean);
    if (body.campos_recebe !== undefined) data.camposRecebe = body.campos_recebe.map((c) => c.trim()).filter(Boolean);
    if (body.observacao !== undefined) data.observacao = body.observacao.trim() || null;

    await this.prisma.apiIntegracaoRota.update({ where: { id }, data });
    return { ok: true };
  }

  // ── mp-rates ───────────────────────────────────────────────────────────────

  private readonly DEFAULT_MP_RATES = {
    pix: '0,99',
    debito: '1,49',
    credito_1x: '4,98',
    credito_6x: '5,98',
    credito_12x: '6,98',
  };

  async getMpRates(userId: string) {
    await this.requirePerm(userId, 'gerenciar_financeiro');

    const settings = await this.prisma.platformSetting.findMany({ where: { key: 'mp_access_token' } });
    const token = settings[0]?.value || process.env.MP_ACCESS_TOKEN;
    if (!token) return { rates: this.DEFAULT_MP_RATES, source: 'default' };

    try {
      const [meRes, methodsRes] = await Promise.all([
        fetch('https://api.mercadopago.com/users/me', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('https://api.mercadopago.com/v1/payment_methods', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const me = meRes.ok ? await meRes.json() : null;
      const methods = methodsRes.ok ? await methodsRes.json() : null;

      return {
        rates: this.DEFAULT_MP_RATES,
        source: 'mp_api',
        account: me ? { id: me.id, email: me.email, site_id: me.site_id } : null,
        methods: Array.isArray(methods)
          ? methods.map((m: { id: string; name: string; payment_type_id: string }) => ({ id: m.id, name: m.name, type: m.payment_type_id }))
          : [],
      };
    } catch {
      return { rates: this.DEFAULT_MP_RATES, source: 'default' };
    }
  }

  // ── payment-credentials (segredos da própria conta Tipo7 nos gateways) ─────

  async salvarPaymentCredentials(userId: string, body: Record<string, unknown>) {
    await this.requireAcessoRestrito(userId);

    const rows: { key: string; value: string }[] = [];
    for (const [key, val] of Object.entries(body)) {
      if (val === undefined) continue;
      if (!CHAVES_CREDENCIAIS_VALIDAS.has(key)) throw new BadRequestException(`Chave desconhecida: ${key}`);
      if (typeof val !== 'string') throw new BadRequestException(`${key} deve ser um texto`);
      rows.push({ key, value: val.trim() });
    }

    const now = new Date();
    await Promise.all(
      rows.map(({ key, value }) =>
        this.prisma.platformSetting.upsert({
          where: { key },
          create: { key, value, updatedAt: now },
          update: { value, updatedAt: now },
        }),
      ),
    );

    return { ok: true };
  }
}
