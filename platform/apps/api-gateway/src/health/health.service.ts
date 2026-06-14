import { Injectable, Logger } from '@nestjs/common';

/**
 * Health check status for individual services.
 */
export type ServiceStatus = 'up' | 'down';

/**
 * Overall health report structure.
 */
export interface HealthReport {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: ServiceStatus;
    redis: ServiceStatus;
    rabbitmq: ServiceStatus;
  };
  timestamp: string;
  uptime: number;
}

/**
 * Service responsible for performing health checks against all downstream
 * services (database, Redis, RabbitMQ) and providing aggregated health reports.
 *
 * Requirements: 17.4
 */
@Injectable()
export class HealthService {
  private readonly logger = new Logger('HealthService');
  private readonly startTime = Date.now();

  /**
   * Check all downstream services and return an aggregated health report.
   */
  async checkAll(): Promise<HealthReport> {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkRabbitMQ(),
    ]);

    const databaseStatus: ServiceStatus =
      checks[0].status === 'fulfilled' ? 'up' : 'down';
    const redisStatus: ServiceStatus =
      checks[1].status === 'fulfilled' ? 'up' : 'down';
    const rabbitmqStatus: ServiceStatus =
      checks[2].status === 'fulfilled' ? 'up' : 'down';

    const allUp =
      databaseStatus === 'up' &&
      redisStatus === 'up' &&
      rabbitmqStatus === 'up';
    const allDown =
      databaseStatus === 'down' &&
      redisStatus === 'down' &&
      rabbitmqStatus === 'down';

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (allUp) {
      overallStatus = 'healthy';
    } else if (allDown) {
      overallStatus = 'unhealthy';
    } else {
      overallStatus = 'degraded';
    }

    const report: HealthReport = {
      status: overallStatus,
      checks: {
        database: databaseStatus,
        redis: redisStatus,
        rabbitmq: rabbitmqStatus,
      },
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };

    if (overallStatus !== 'healthy') {
      this.logger.warn(
        `Health check degraded: database=${databaseStatus}, redis=${redisStatus}, rabbitmq=${rabbitmqStatus}`,
      );
    }

    return report;
  }

  /**
   * Check database connectivity.
   * In a real implementation, this would use the PrismaService to run a query.
   */
  private async checkDatabase(): Promise<void> {
    try {
      // Attempt a simple query to verify database connectivity
      // In production, inject PrismaService and call $queryRaw`SELECT 1`
      const dbHost = process.env.DATABASE_URL;
      if (!dbHost) {
        throw new Error('DATABASE_URL not configured');
      }
      // Placeholder: actual connectivity check would go here
      // await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      this.logger.error(`Database health check failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Check Redis connectivity.
   * In a real implementation, this would use the Redis client to send a PING.
   */
  private async checkRedis(): Promise<void> {
    try {
      const redisHost = process.env.REDIS_HOST;
      if (!redisHost) {
        throw new Error('REDIS_HOST not configured');
      }
      // Placeholder: actual Redis PING check would go here
      // await this.redis.ping();
    } catch (error) {
      this.logger.error(`Redis health check failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Check RabbitMQ connectivity.
   * In a real implementation, this would use the AMQP client to check connection.
   */
  private async checkRabbitMQ(): Promise<void> {
    try {
      const rabbitmqUrl = process.env.RABBITMQ_URL;
      if (!rabbitmqUrl) {
        throw new Error('RABBITMQ_URL not configured');
      }
      // Placeholder: actual RabbitMQ connection check would go here
      // await this.amqp.checkConnection();
    } catch (error) {
      this.logger.error(`RabbitMQ health check failed: ${(error as Error).message}`);
      throw error;
    }
  }
}
