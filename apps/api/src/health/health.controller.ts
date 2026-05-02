import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '@eazepay/service-auth';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  ready(): { status: 'ok' } {
    // TODO: wire DB ping, Redis ping, downstream lender SLA snapshot here.
    return { status: 'ok' };
  }
}
