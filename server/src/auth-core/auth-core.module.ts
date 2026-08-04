import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthCoreController } from './auth-core.controller';
import { AuthCoreService } from './auth-core.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { algorithm: 'HS256' },
      }),
    }),
  ],
  controllers: [AuthCoreController],
  providers: [AuthCoreService],
  exports: [AuthCoreService],
})
export class AuthCoreModule {}
