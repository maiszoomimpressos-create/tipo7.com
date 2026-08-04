import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Ponte pro que ainda fica na Supabase enquanto Storage/Realtime/Auth não
// migram (ver plano de migração, Fase 6+): upload em Storage e
// reverificação de senha de login. Nada de dado de negócio passa por
// aqui — isso é só Prisma. Precisa da SUPABASE_SERVICE_ROLE_KEY (Storage)
// e da NEXT_PUBLIC_SUPABASE_ANON_KEY (signInWithPassword).
@Injectable()
export class SupabaseCompatService {
  private readonly serviceClient: SupabaseClient;
  private readonly anonClient: SupabaseClient;

  constructor(config: ConfigService) {
    const url = config.getOrThrow<string>('SUPABASE_URL');
    this.serviceClient = createClient(url, config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'));
    this.anonClient = createClient(url, config.getOrThrow<string>('NEXT_PUBLIC_SUPABASE_ANON_KEY'));
  }

  get storage() {
    return this.serviceClient.storage;
  }

  async verificarSenhaLogin(email: string, password: string): Promise<boolean> {
    const { error } = await this.anonClient.auth.signInWithPassword({ email, password });
    return !error;
  }
}
