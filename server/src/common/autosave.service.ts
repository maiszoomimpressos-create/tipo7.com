import { Injectable } from '@nestjs/common';
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
