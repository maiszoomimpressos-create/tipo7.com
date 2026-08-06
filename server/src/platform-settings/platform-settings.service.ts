import { Injectable } from '@nestjs/common';
import { MP_CRED_KEYS, PAGBANK_CRED_KEYS } from '../common/platform-credentials.service';
import { PrismaService } from '../prisma/prisma.service';

// Leitura pública de platform_settings — exclui só as chaves de credencial
// (as únicas realmente secretas). Fase 7.2, G3: substitui as queries diretas
// em evento/[id]/page.tsx, configuracoes/contas/page.tsx e minha-area/tarifas/page.tsx.
@Injectable()
export class PlatformSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublic() {
    const rows = await this.prisma.platformSetting.findMany({
      where: { key: { notIn: [...MP_CRED_KEYS, ...PAGBANK_CRED_KEYS] } },
    });
    const settings: Record<string, string> = {};
    for (const row of rows) settings[row.key] = row.value;
    return settings;
  }
}
