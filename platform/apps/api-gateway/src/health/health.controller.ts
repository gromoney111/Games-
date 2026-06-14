import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { SkipRateLimit } from '../common/decorators/rate-limit.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { HealthService, HealthReport } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly startTime = Date.now();

  constructor(private readonly healthService: HealthService) {}

  @Public()
  @SkipRateLimit()
  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    schema: {
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
        uptime: { type: 'number', example: 12345 },
        version: { type: 'string', example: '1.0.0' },
        environment: { type: 'string', example: 'development' },
      },
    },
  })
  getHealth() {
    const uptimeMs = Date.now() - this.startTime;
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptimeMs / 1000),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };
  }

  @Get('detailed')
  @Roles('admin')
  @ApiOperation({ summary: 'Detailed health check for all downstream services' })
  @ApiResponse({
    status: 200,
    description: 'Detailed health report for all downstream services',
    schema: {
      properties: {
        status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
        checks: {
          type: 'object',
          properties: {
            database: { type: 'string', enum: ['up', 'down'] },
            redis: { type: 'string', enum: ['up', 'down'] },
            rabbitmq: { type: 'string', enum: ['up', 'down'] },
          },
        },
        timestamp: { type: 'string' },
        uptime: { type: 'number' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions - admin role required',
  })
  async getDetailedHealth(): Promise<HealthReport> {
    return this.healthService.checkAll();
  }
}
