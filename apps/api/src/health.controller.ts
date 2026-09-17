import { Controller, Get } from '@nestjs/common';

export interface HealthPayload {
  status: 'ok';
}

/**
 * Liveness endpoint: it answers "the process is up and serving HTTP", and deliberately says
 * nothing about PostgreSQL or Redis.
 *
 * Why the restraint: `docker compose up --wait` reads this endpoint. If it also failed on a
 * database outage, the API container would be marked unhealthy every time PostgreSQL restarts,
 * and the acceptance check for task 1.4 would flap for reasons the API cannot fix. Readiness
 * (can this instance serve traffic?) is a different question and gets its own answer when
 * there is traffic to serve.
 */
@Controller('health')
export class HealthController {
  @Get()
  check(): HealthPayload {
    return { status: 'ok' };
  }
}
