import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { HealthController } from '../health/health.controller.js';
import { loadEnv } from '../config/env.js';

const env = loadEnv();

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: env.LOG_LEVEL,
        transport:
          env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
        // PII redaction baseline. Tighten in dedicated logging service.
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers["x-api-key"]',
            '*.password',
            '*.passwordHash',
            '*.ssn',
            '*.dob',
            '*.cardNumber',
            '*.cvv',
            '*.routingNumber',
            '*.accountNumber',
          ],
          censor: '[redacted]',
        },
      },
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
