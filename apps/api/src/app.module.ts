import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/**
 * The root module of the API. In this slice it carries exactly one thing: the health
 * endpoint the container healthcheck depends on. Submission (C1), lifecycle (C2), dispatch
 * (C3) and download (C8) modules arrive with their own work units (WU-7, WU-16, WU-17).
 */
@Module({
  controllers: [HealthController],
})
export class AppModule {}
