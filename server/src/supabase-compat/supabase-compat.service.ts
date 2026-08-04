import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Ponte pro que ainda fica na Supabase depois da Fase 6 (Storage/Realtime —
// fora de escopo da migração de banco/auth). Auth já não depende mais da
// Supabase (AuthModule próprio em server/src/auth-core/); o que sobrou
// aqui é só o passthrough de Storage (avatars, event-images, carrossel,
// organization-logos). Precisa da SUPABASE_SERVICE_ROLE_KEY.
@Injectable()
export class SupabaseCompatService {
  private readonly serviceClient: SupabaseClient;

  constructor(config: ConfigService) {
    const url = config.getOrThrow<string>('SUPABASE_URL');
    this.serviceClient = createClient(url, config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'));
  }

  get storage() {
    return this.serviceClient.storage;
  }
}
