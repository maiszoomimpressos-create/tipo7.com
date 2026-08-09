import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const AUTOSAVE_TIMEOUT_MS = 3000;

type Area = 'usuarios' | 'estacionamento';

interface AutosaveVehicle {
  plate?: string;
  brand?: string;
  model?: string;
  color?: string;
  driver_phone?: string;
}

// Contrato completo de POST /vehicles, recebido do time da Autosave em
// 08/08/2026 — ver docs/boot-whats-details.md (não, esse é do WhatsApp;
// contrato de veículo ficou em memória de projeto, não em docs/ ainda).
// `type`/`status` são enum fixo do lado deles — valores aceitos ainda não
// confirmados, por isso ficam como string livre aqui também por enquanto
// (o campo é opcional; se vier errado, a Autosave rejeita e devolvemos o
// erro deles pro usuário, não inventamos validação nossa sem saber a lista
// real).
export interface AutosaveVehicleFull {
  plate: string;
  name?: string;
  type?: string;
  brand?: string;
  model?: string;
  year?: number;
  color?: string;
  status?: string;
  category?: string;
  species?: string;
  body_type?: string;
  chassis_number?: string;
  renavam?: string;
  engine_number?: string;
  security_code?: string;
  license_expiry?: string; // AAAA-MM-DD
  licensing_year?: number;
  restrictions?: string;
  odometer_km?: number;
  fuel_type?: string;
  capacity?: number;
  power_cv?: number;
  displacement?: string;
  cmt?: string;
  axles?: number;
  owner_name?: string;
  owner_document?: string;
  driver_phone?: string;
  city?: string;
  state?: string;
  notes?: string;
}

export type SalvarVeiculoResultado =
  | { ok: true; vehicle: Record<string, unknown>; created: boolean }
  | { ok: false; status: number; message: string };

export interface VeiculoConsultado {
  modelo: string | null;
  cor: string | null;
  telefone: string | null;
}

export interface AutosaveCustomer {
  external_id?: string;
  full_name?: string;
  email?: string;
  cpf?: string;
  phone?: string;
  rg?: string;
  birth_date?: string;
  zip_code?: string;
  street?: string;
  street_number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  complement?: string;
}

// Porte 1:1 de web/src/lib/autosave.ts — nunca deve travar o fluxo
// principal, qualquer falha/instabilidade vira "não achou" (best-effort).
@Injectable()
export class AutosaveService {
  private readonly logger = new Logger(AutosaveService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async getCredenciais(area: Area): Promise<{ baseUrl: string; apiKey: string } | null> {
    try {
      const row = await this.prisma.apiIntegracao.findUnique({
        where: { areaSlug: area },
        select: { baseUrl: true, apiKey: true },
      });
      if (!row?.baseUrl || !row?.apiKey) return null;
      return { baseUrl: row.baseUrl, apiKey: row.apiKey };
    } catch {
      return null;
    }
  }

  private montarModelo(v: AutosaveVehicle): string | null {
    const partes = [v.brand, v.model].filter(Boolean);
    return partes.length > 0 ? partes.join(' ') : null;
  }

  private async fetchComTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AUTOSAVE_TIMEOUT_MS);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async buscarVeiculoPorPlaca(placa: string): Promise<VeiculoConsultado | null> {
    const creds = await this.getCredenciais('estacionamento');
    if (!creds) return null;

    try {
      const res = await this.fetchComTimeout(`${creds.baseUrl}/vehicles?plate=${encodeURIComponent(placa)}`, {
        headers: { 'x-api-key': creds.apiKey },
      });
      if (!res.ok) return null;

      const data = (await res.json()) as { found?: boolean; vehicles?: AutosaveVehicle[] };
      if (!data.found || !data.vehicles?.length) return null;

      const exato = data.vehicles.find((v) => v.plate?.toUpperCase() === placa.toUpperCase()) ?? data.vehicles[0];

      return {
        modelo: this.montarModelo(exato),
        cor: exato.color?.trim() || null,
        telefone: exato.driver_phone?.trim() || null,
      };
    } catch {
      return null;
    }
  }

  // Achado real (08/08/2026): buscarVeiculoPorPlaca acima só devolve
  // modelo/cor/telefone — o suficiente pra entrada do estacionamento, mas
  // o modal de Veículo em /perfil precisa de TODOS os campos pra
  // pré-preencher o formulário quando o usuário já tem o carro cadastrado
  // (mesmo padrão de handleBlurCpf em ProfileForm.tsx). Método novo, não
  // reaproveita o de cima pra não quebrar quem já usa o formato reduzido.
  async buscarVeiculoCompletoPorPlaca(placa: string): Promise<Record<string, unknown> | null> {
    const creds = await this.getCredenciais('estacionamento');
    if (!creds) return null;

    try {
      const res = await this.fetchComTimeout(`${creds.baseUrl}/vehicles?plate=${encodeURIComponent(placa)}`, {
        headers: { 'x-api-key': creds.apiKey },
      });
      if (!res.ok) return null;

      const data = (await res.json()) as { found?: boolean; vehicles?: Array<Record<string, unknown>> };
      if (!data.found || !data.vehicles?.length) return null;

      return (
        data.vehicles.find((v) => String(v.plate ?? '').toUpperCase() === placa.toUpperCase()) ?? data.vehicles[0]
      );
    } catch {
      return null;
    }
  }

  async buscarClientePorCpf(cpf: string): Promise<AutosaveCustomer | null> {
    const creds = await this.getCredenciais('usuarios');
    if (!creds) return null;

    try {
      const res = await this.fetchComTimeout(`${creds.baseUrl}/customers?cpf=${encodeURIComponent(cpf)}`, {
        headers: { 'x-api-key': creds.apiKey },
      });
      if (!res.ok) return null;

      const data = (await res.json()) as { found?: boolean; customer?: AutosaveCustomer };
      if (!data.found || !data.customer) return null;
      return data.customer;
    } catch {
      return null;
    }
  }

  async salvarVeiculoNaAutosave(dados: { placa: string; modelo: string; cor: string; telefone?: string }): Promise<void> {
    const creds = await this.getCredenciais('estacionamento');
    if (!creds) return;

    try {
      await this.fetchComTimeout(`${creds.baseUrl}/vehicles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': creds.apiKey },
        body: JSON.stringify({
          plate: dados.placa,
          model: dados.modelo,
          color: dados.cor,
          ...(dados.telefone && { driver_phone: dados.telefone }),
        }),
      });
    } catch {
      // Best-effort — se a Autosave estiver fora do ar, ignora.
    }
  }

  // Achado real (08/08/2026): salvarVeiculoNaAutosave() acima é best-effort
  // silencioso, pensado pra chamada em background durante a entrada do
  // estacionamento (não pode travar o fluxo do atendente). O modal de
  // Veículo em /perfil é uma ação direta do usuário — precisa saber se
  // salvou ou não, e por quê (ex: enum de type/status inválido). Método
  // novo, em vez de reaproveitar o silencioso.
  async criarOuAtualizarVeiculo(dados: AutosaveVehicleFull): Promise<SalvarVeiculoResultado> {
    const creds = await this.getCredenciais('estacionamento');
    if (!creds) return { ok: false, status: 503, message: 'Integração com a Autosave não está configurada.' };

    try {
      const res = await this.fetchComTimeout(`${creds.baseUrl}/vehicles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': creds.apiKey },
        body: JSON.stringify(dados),
      });
      // Achado real (08/08/2026): a Autosave devolve o erro em `error`, não
      // `message` (ex: {"error":"invalid input value for enum vehicle_type:
      // \"carro\""}) — só lendo `body?.message` a mensagem real nunca
      // chegava no usuário, sempre caía no genérico.
      const body = await res.json().catch(() => null) as { vehicle?: Record<string, unknown>; created?: boolean; message?: string; error?: string } | null;
      if (!res.ok) {
        this.logger.warn(`[autosave/vehicles] recusado (${res.status}) pra placa ${dados.plate}: ${body?.error || body?.message || 'sem detalhe'}`);
        return { ok: false, status: res.status, message: body?.error || body?.message || 'A Autosave recusou os dados do veículo.' };
      }
      if (!body?.vehicle) return { ok: false, status: 502, message: 'Resposta inesperada da Autosave.' };
      return { ok: true, vehicle: body.vehicle, created: body.created ?? false };
    } catch (err) {
      this.logger.error(`[autosave/vehicles] falha ao falar com a Autosave pra placa ${dados.plate}`, err as Error);
      return { ok: false, status: 504, message: 'Não foi possível falar com a Autosave agora. Tente de novo em instantes.' };
    }
  }

  async enviarClienteParaAutosave(dados: AutosaveCustomer): Promise<void> {
    const creds = await this.getCredenciais('usuarios');
    if (!creds) return;

    try {
      await this.fetchComTimeout(`${creds.baseUrl}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': creds.apiKey },
        body: JSON.stringify(dados),
      });
    } catch {
      // Best-effort — se a Autosave estiver fora do ar, ignora.
    }
  }
}
