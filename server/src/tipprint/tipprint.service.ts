import { HttpException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Provisionamento automático do PrintServer TipPrint pra PC Windows —
// elimina o passo manual de "baixa ZIP genérico, cola a chave em
// config.txt". Contrato completo em memória do projeto
// (project_tipprint_provisionamento_pc). Credenciais (base_url + a chave
// de sistema "tp_live_...") ficam em api_integracoes (area_slug='tipprint'),
// editável em Admin > API — mesmo padrão do WhatsAppService.
//
// ⚠️ 14/08/2026: o TipPrint Backend já implementou e testou /provision e
// /download/:token localmente, mas ainda só roda em localhost na máquina
// do desenvolvedor — não tem endereço público ainda. Até a credencial ser
// configurada aqui (base_url + api_key presentes), configurado() retorna
// false e o frontend cai de volta pro fluxo de hoje (Web Serial), sem
// quebrar nada em produção.
@Injectable()
export class TipPrintService {
  private readonly logger = new Logger(TipPrintService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async getCredenciais(): Promise<{ baseUrl: string; apiKey: string } | null> {
    const integracao = await this.prisma.apiIntegracao.findUnique({ where: { areaSlug: 'tipprint' } });
    if (!integracao?.baseUrl || !integracao?.apiKey) return null;
    return { baseUrl: integracao.baseUrl.replace(/\/$/, ''), apiKey: integracao.apiKey };
  }

  async configurado(): Promise<boolean> {
    return (await this.getCredenciais()) !== null;
  }

  // Pede um token novo, individual pra essa instalação — nunca expõe a
  // chave de sistema pro navegador do cliente, só o downloadUrl de uso
  // único que ela gera.
  async provisionar(label?: string): Promise<{ downloadUrl: string; expiresAt: string }> {
    const cred = await this.getCredenciais();
    if (!cred) {
      throw new HttpException(
        { ok: false, error: 'Instalação automática do TipPrint ainda não disponível.' },
        503,
      );
    }

    let res: Response;
    try {
      res = await fetch(`${cred.baseUrl}/provision`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cred.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(label ? { label } : {}),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      this.logger.error(`Falha ao contatar o TipPrint Backend: ${(err as Error).message}`);
      throw new HttpException({ ok: false, error: 'Não foi possível contatar o servidor do TipPrint agora.' }, 502);
    }

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      throw new HttpException({ ok: false, error: data?.error ?? 'Falha ao gerar a instalação.' }, res.status || 502);
    }

    return { downloadUrl: data.downloadUrl, expiresAt: data.expiresAt };
  }
}
