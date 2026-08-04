import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Porte 1:1 de web/src/lib/feeRules.ts.
export interface FeeLine {
  type: 'fixed' | 'percent';
  value: number;
}

export interface FeeConfig {
  base: FeeLine;
  extras: FeeLine[];
  minFeePct: number;
}

export interface CalcParams {
  eventoId: string;
  ownerId: string | null;
  total: number;
  ticketCount: number;
  config: FeeConfig;
}

function valorLinha(linha: FeeLine, total: number): number {
  if (linha.type === 'percent') return Math.round(total * linha.value) / 100;
  return Math.round(linha.value * 100) / 100;
}

function valorFeeCompleto(config: FeeConfig, total: number): number {
  return valorLinha(config.base, total) + config.extras.reduce((s, e) => s + valorLinha(e, total), 0);
}

function aplicarPiso(valor: number, base: FeeLine, minFeePct: number, total: number, bypass: boolean): number {
  if (bypass || base.type !== 'percent') return valor;
  const piso = Math.round(total * minFeePct) / 100;
  return Math.max(valor, piso);
}

function comDesconto(valorNormal: number, discountPct: number): number {
  return Math.round(valorNormal * (1 - discountPct / 100) * 100) / 100;
}

function periodoInicio(period: string | null): Date {
  if (period === 'monthly') {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return new Date('2000-01-01T00:00:00Z');
}

@Injectable()
export class FeeRulesService {
  constructor(private readonly prisma: PrismaService) {}

  // Lê a config de taxa de Ingressos on-line (Financeiro > Tarifas) direto
  // de platform_settings — chaves sem prefixo.
  async buscarConfigTaxaIngressosOnline(): Promise<FeeConfig> {
    const settings = await this.prisma.platformSetting.findMany({
      where: {
        key: {
          in: [
            'default_fee_pct', 'default_fee_type', 'min_fee_pct',
            'extra_fee_1_value', 'extra_fee_1_type',
            'extra_fee_2_value', 'extra_fee_2_type',
          ],
        },
      },
    });
    const map: Record<string, string> = {};
    for (const s of settings) map[s.key] = s.value;

    const base: FeeLine = {
      type: (map.default_fee_type as 'fixed' | 'percent') ?? 'percent',
      value: Number(map.default_fee_pct ?? 10),
    };

    const extra1Value = Number(map.extra_fee_1_value ?? 0);
    const extra2Value = Number(map.extra_fee_2_value ?? 0);
    const extras: FeeLine[] = [
      extra1Value > 0 ? { type: (map.extra_fee_1_type as 'fixed' | 'percent') ?? 'percent', value: extra1Value } : null,
      extra2Value > 0 ? { type: (map.extra_fee_2_type as 'fixed' | 'percent') ?? 'percent', value: extra2Value } : null,
    ].filter((l): l is FeeLine => l !== null);

    return { base, extras, minFeePct: Number(map.min_fee_pct ?? 0) };
  }

  async calcularTaxaPlataforma(p: CalcParams): Promise<number> {
    const { eventoId, ownerId, total, ticketCount, config } = p;

    // 1. Regra por evento específico
    const regraEvento = await this.prisma.feeRule.findFirst({
      where: { type: 'event', eventId: eventoId, active: true },
      select: {
        discountPct: true, bypassMinimum: true, feeType: true, feeValue: true,
        extraFee1Value: true, extraFee1Type: true, extraFee2Value: true, extraFee2Type: true,
      },
    });

    if (regraEvento) {
      if (regraEvento.feeValue !== null && regraEvento.feeType) {
        const eventBase: FeeLine = { type: regraEvento.feeType as 'fixed' | 'percent', value: Number(regraEvento.feeValue) };
        const eventExtras: FeeLine[] = [
          regraEvento.extraFee1Value ? { type: regraEvento.extraFee1Type as 'fixed' | 'percent', value: Number(regraEvento.extraFee1Value) } : null,
          regraEvento.extraFee2Value ? { type: regraEvento.extraFee2Type as 'fixed' | 'percent', value: Number(regraEvento.extraFee2Value) } : null,
        ].filter((l): l is FeeLine => l !== null);

        const valor = valorFeeCompleto({ base: eventBase, extras: eventExtras, minFeePct: config.minFeePct }, total);
        return aplicarPiso(valor, eventBase, config.minFeePct, total, regraEvento.bypassMinimum);
      }

      const valor = comDesconto(valorFeeCompleto(config, total), Number(regraEvento.discountPct));
      return aplicarPiso(valor, config.base, config.minFeePct, total, regraEvento.bypassMinimum);
    }

    // 2. Quota por promotor
    if (ownerId) {
      const regraPromotor = await this.prisma.feeRule.findFirst({
        where: { type: 'promoter_quota', userId: ownerId, active: true },
        select: { discountPct: true, quotaLimit: true, quotaPeriod: true, bypassMinimum: true },
      });

      if (regraPromotor?.quotaLimit) {
        const usados = await this.contarTicketsPromotor(ownerId, regraPromotor.quotaPeriod);
        const restam = regraPromotor.quotaLimit - usados;
        if (restam >= ticketCount) {
          const valor = comDesconto(valorFeeCompleto(config, total), Number(regraPromotor.discountPct));
          return aplicarPiso(valor, config.base, config.minFeePct, total, regraPromotor.bypassMinimum);
        }
      }
    }

    // 3. Quota global
    const regraGlobal = await this.prisma.feeRule.findFirst({
      where: { type: 'global_quota', active: true },
      select: { discountPct: true, quotaLimit: true, quotaPeriod: true, bypassMinimum: true },
    });

    if (regraGlobal?.quotaLimit) {
      const usados = await this.contarTicketsGlobal(regraGlobal.quotaPeriod);
      const restam = regraGlobal.quotaLimit - usados;
      if (restam >= ticketCount) {
        const valor = comDesconto(valorFeeCompleto(config, total), Number(regraGlobal.discountPct));
        return aplicarPiso(valor, config.base, config.minFeePct, total, regraGlobal.bypassMinimum);
      }
    }

    // 4. Taxa normal sem desconto
    return aplicarPiso(valorFeeCompleto(config, total), config.base, config.minFeePct, total, false);
  }

  private async contarTicketsPromotor(userId: string, period: string | null): Promise<number> {
    const desde = periodoInicio(period);

    const orgs = await this.prisma.organization.findMany({ where: { ownerId: userId }, select: { id: true } });
    const orgIds = orgs.map((o) => o.id);
    if (!orgIds.length) return 0;

    const events = await this.prisma.event.findMany({ where: { organizationId: { in: orgIds } }, select: { id: true } });
    const eventIds = events.map((e) => e.id);
    if (!eventIds.length) return 0;

    const orders = await this.prisma.order.findMany({
      where: { eventId: { in: eventIds }, status: 'approved', createdAt: { gte: desde } },
      select: { id: true },
    });
    const orderIds = orders.map((o) => o.id);
    if (!orderIds.length) return 0;

    const items = await this.prisma.orderItem.findMany({ where: { orderId: { in: orderIds } }, select: { quantity: true } });
    return items.reduce((s, i) => s + i.quantity, 0);
  }

  private async contarTicketsGlobal(period: string | null): Promise<number> {
    const desde = periodoInicio(period);

    const orders = await this.prisma.order.findMany({ where: { status: 'approved', createdAt: { gte: desde } }, select: { id: true } });
    const orderIds = orders.map((o) => o.id);
    if (!orderIds.length) return 0;

    const items = await this.prisma.orderItem.findMany({ where: { orderId: { in: orderIds } }, select: { quantity: true } });
    return items.reduce((s, i) => s + i.quantity, 0);
  }
}
