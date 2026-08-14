import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true — necessário pro webhook da Autosave, que verifica HMAC
  // sobre os bytes crus do corpo (não sobre o JSON re-serializado, que pode
  // ter ordem de chaves/espaçamento diferente do que a Autosave assinou).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  app.use(cookieParser());
  app.enableCors({ origin: process.env.WEB_APP_URL ?? true, credentials: true });

  // Serve os uploads (avatar/banner/logo/carrossel) direto do volume
  // persistente do VPS sob /uploads — ver server/src/storage/. Substitui o
  // Supabase Storage (achado real, 14/08/2026: o projeto Supabase morreu e
  // derrubou todas as imagens do site).
  app.useStaticAssets(process.env.UPLOAD_DIR ?? '/app/uploads', { prefix: '/uploads/' });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
