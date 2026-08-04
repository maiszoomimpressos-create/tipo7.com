import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { SupabaseJwtGuard } from './guards/supabase-jwt.guard';
import { SupabaseJwtStrategy } from './strategies/supabase-jwt.strategy';

@Module({
  imports: [PassportModule],
  providers: [SupabaseJwtStrategy, SupabaseJwtGuard],
  exports: [SupabaseJwtGuard],
})
export class AuthModule {}
