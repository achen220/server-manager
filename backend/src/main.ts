import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  const port = process.env['PORT'] || 3000;
  await app.listen(port, '127.0.0.1');
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/api`,
  );
}

bootstrap();
