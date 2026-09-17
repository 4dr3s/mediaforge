import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const DEFAULT_PORT = 3000;

/**
 * The API must listen on 0.0.0.0, not on the default localhost: inside the container the
 * published port would never answer otherwise, and `docker compose up --wait` (task 1.4)
 * would report the API unhealthy for a reason that has nothing to do with the application.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? DEFAULT_PORT);

  await app.listen(port, '0.0.0.0');
}

void bootstrap();
