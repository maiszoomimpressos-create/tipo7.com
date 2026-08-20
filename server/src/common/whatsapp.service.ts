import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Integração com a Boot Whats (comunica-aoboot.vercel.app) — dispara
// mensagens de WhatsApp (ingresso emitido, estacionamento, etc.) usando os
// dados estruturados; o texto da mensagem é montado inteiramente do lado
// deles, a Tipo7 só manda os campos. Credenciais (base_url + api_key) ficam
// em api_integracoes (area_slug='whatsapp'), editável em Admin > API — sem
// isso configurado, o envio é pulado silenciosamente (log de aviso), nunca
// quebra o fluxo principal de emissão de ingresso.
export type WhatsAppNotificationType =
  | 'compra_confirmada'
  | 'ingresso_emitido'
  | 'estacionamento_emitido'
  | 'lista_espera'
  | 'agendamento_confirmado'
  // Adicionado 20/08/2026 (eventos-admin.service.ts > adiar()) — AINDA NÃO
  // confirmado que a Boot Whats reconhece esse tipo/monta uma mensagem
  // sensata pra ele. Primeiro envio real vai revelar isso (mesmo padrão de
  // descoberta por tentativa do 'estacionamento_emitido', ver achados reais
  // documentados ali).
  | 'evento_adiado';

interface EnviarParams {
  to: string; // telefone como salvo em profiles.phone (DDD+número, sem "55")
  recipientName: string;
  type?: WhatsAppNotificationType;
  qrData?: string;
  details?: Record<string, string>;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async getCredenciais(): Promise<{ baseUrl: string; apiKey: string } | null> {
    const integracao = await this.prisma.apiIntegracao.findUnique({ where: { areaSlug: 'whatsapp' } });
    if (!integracao?.baseUrl || !integracao?.apiKey) return null;
    return { baseUrl: integracao.baseUrl.replace(/\/$/, ''), apiKey: integracao.apiKey };
  }

  // profiles.phone é salvo só como DDD+número (ex: "46988212389") — a Boot
  // Whats exige código do país na frente (ex: "5546988212389").
  private normalizarTelefone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    return digits.startsWith('55') ? digits : `55${digits}`;
  }

  async enviar(params: EnviarParams): Promise<void> {
    const creds = await this.getCredenciais();
    if (!creds) {
      this.logger.warn('[whatsapp] integração não configurada (Admin > API) — envio pulado');
      return;
    }

    try {
      const res = await fetch(`${creds.baseUrl}/whatsapp/purchase-confirmation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.apiKey}` },
        body: JSON.stringify({
          to: this.normalizarTelefone(params.to),
          type: params.type ?? 'compra_confirmada',
          recipientName: params.recipientName,
          ...(params.qrData ? { qrData: params.qrData } : {}),
          ...(params.details ? { details: params.details } : {}),
        }),
      });
      const bodyText = await res.text().catch(() => '');
      // Achado real (17/08/2026): "aceitou sem 422" não é a mesma coisa que
      // "mandou de verdade" — a Boot Whats pode devolver HTTP 200 com
      // `success: false` no corpo (mesmo formato do erro de validação, só
      // sem status de erro), e o código antigo só olhava `res.ok`, nunca o
      // corpo em caso de sucesso aparente. Log em nível LOG (não warn/error)
      // pra não gerar ruído — só serve de rastro pra comparar quando alguém
      // reportar "não chegou".
      let success: boolean | undefined;
      try { success = JSON.parse(bodyText)?.success; } catch { /* corpo não é JSON, ignora */ }

      if (!res.ok || success === false) {
        this.logger.error(`[whatsapp] falha ao enviar (${res.status}): ${bodyText}`);
      } else {
        this.logger.log(`[whatsapp] enviado (${res.status}) to=${this.normalizarTelefone(params.to)} type=${params.type ?? 'compra_confirmada'}: ${bodyText}`);
      }
    } catch (err) {
      this.logger.error('[whatsapp] erro ao chamar Boot Whats', err as Error);
    }
  }
}
