import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';

// Substitui o SupabaseCompatService.storage (achado real, 14/08/2026: o
// projeto Supabase que hospedava avatars/event-images/carrossel parou de
// existir — domínio não resolve DNS nenhum, todas as imagens do site
// quebraram). Grava no disco do próprio VPS, no volume persistente montado
// em UPLOAD_DIR (EasyPanel, serviço `server`, mount `/app/uploads` — sem
// esse volume qualquer deploy novo apagaria os uploads, container é
// descartável). Serve publicamente via `app.useStaticAssets()` (ver
// main.ts) sob o prefixo /uploads, exposto ao navegador através do rewrite
// `/uploads/:path*` do web/next.config.mjs (mesmo domínio do site, sem
// precisar mexer em CSP img-src).
//
// Interface mantida IDÊNTICA à do `SupabaseClient.storage` (`.from(bucket)
// .upload/getPublicUrl/remove`) de propósito — os 4 call sites que usavam
// Supabase Storage (uploads, carrossel, banners-sistema, gateway-logo)
// trocam só o import/tipo injetado, zero mudança de lógica de negócio.
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? '/app/uploads';
const PUBLIC_BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tipo7.com';

interface UploadOptions {
  contentType?: string;
  upsert?: boolean;
}

@Injectable()
export class LocalStorageService {
  get storage() {
    return {
      from: (bucket: string) => this.bucket(bucket),
    };
  }

  private bucket(bucket: string) {
    return {
      upload: (relPath: string, buffer: Buffer, options?: UploadOptions) => this.upload(bucket, relPath, buffer, options),
      getPublicUrl: (relPath: string) => this.getPublicUrl(bucket, relPath),
      remove: (relPaths: string[]) => this.remove(bucket, relPaths),
    };
  }

  private async upload(
    bucket: string,
    relPath: string,
    buffer: Buffer,
    options?: UploadOptions,
  ): Promise<{ error: { message: string } | null }> {
    try {
      const fullPath = this.resolve(bucket, relPath);

      if (!options?.upsert) {
        const exists = await fs
          .access(fullPath)
          .then(() => true)
          .catch(() => false);
        if (exists) return { error: { message: `Já existe um arquivo em "${relPath}"` } };
      }

      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, buffer);
      return { error: null };
    } catch (err) {
      return { error: { message: (err as Error).message } };
    }
  }

  private getPublicUrl(bucket: string, relPath: string): { data: { publicUrl: string } } {
    return { data: { publicUrl: `${PUBLIC_BASE}/uploads/${bucket}/${relPath}` } };
  }

  private async remove(bucket: string, relPaths: string[]): Promise<{ error: { message: string } | null }> {
    try {
      await Promise.all(
        relPaths.map((relPath) => fs.rm(this.resolve(bucket, relPath), { force: true })),
      );
      return { error: null };
    } catch (err) {
      return { error: { message: (err as Error).message } };
    }
  }

  // Impede path traversal (bucket/relPath vêm de UUID gerado no próprio
  // backend hoje, mas a função fica defensiva mesmo assim).
  private resolve(bucket: string, relPath: string): string {
    const full = path.resolve(UPLOAD_DIR, bucket, relPath);
    const root = path.resolve(UPLOAD_DIR);
    if (!full.startsWith(root + path.sep) && full !== root) {
      throw new Error('Caminho de arquivo inválido');
    }
    return full;
  }
}
