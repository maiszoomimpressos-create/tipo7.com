import { Global, Module } from '@nestjs/common';
import { SupabaseCompatService } from './supabase-compat.service';

@Global()
@Module({
  providers: [SupabaseCompatService],
  exports: [SupabaseCompatService],
})
export class SupabaseCompatModule {}
