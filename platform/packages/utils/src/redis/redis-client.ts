import { Redis, RedisOptions } from 'ioredis';

/**
 * Redis connection configuration interface.
 */
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  maxRetriesPerRequest: number;
  enableReadyCheck: boolean;
  lazyConnect: boolean;
}

/**
 * Default Redis configuration.
 * Values are sourced from environment variables with sensible defaults.
 */
export const defaultRedisConfig: RedisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
};

/**
 * RedisClient wraps the ioredis client with connection lifecycle management.
 * Supports connection pooling via ioredis's built-in connection handling.
 */
export class RedisClient {
  private client: Redis;

  constructor(config: RedisConfig = defaultRedisConfig) {
    this.client = new Redis(config as RedisOptions);
  }

  /**
   * Returns the underlying ioredis client instance.
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * Establish connection to Redis.
   * Only needed when lazyConnect is true.
   */
  async connect(): Promise<void> {
    await this.client.connect();
  }

  /**
   * Gracefully disconnect from Redis.
   */
  async disconnect(): Promise<void> {
    await this.client.quit();
  }

  /**
   * Health check - pings the Redis server.
   */
  async ping(): Promise<string> {
    return this.client.ping();
  }

  /**
   * Check if the client is connected and ready.
   */
  isReady(): boolean {
    return this.client.status === 'ready';
  }
}
