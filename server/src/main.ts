import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true — necessário pro webhook da Autosave, que verifica HMAC
  // sobre os bytes crus do corpo (não sobre o JSON re-serializado, que pode
  // ter ordem de chaves/espaçamento diferente do que a Autosave assinou).
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.use(cookieParser());
  app.enableCors({ origin: process.env.WEB_APP_URL ?? true, credentials: true });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
