/**
 * Database Package
 *
 * Provides PostgreSQL database access via Prisma ORM,
 * schema definitions, migrations, and connection management
 * for the gaming platform.
 */

// ============================================================================
// Re-export Prisma Client and Generated Types
// ============================================================================

export { PrismaClient } from '@prisma/client';
export type {
  User,
  UserProfile,
  Game,
  GameSession,
  GameResult,
  Transaction,
  Affiliate,
  AffiliateClick,
  Commission,
  AdImpression,
  AnonymousImpression,
  AnalyticsEvent,
  AuditLog,
  Notification,
  ConsentRecord,
} from '@prisma/client';

export {
  UserRole,
  AccountStatus,
  GameCategory,
  GameStatus,
  TransactionStatus,
  PaymentMethod,
  AffiliateStatus,
  AffiliateTier,
  CommissionStatus,
  NotificationType,
} from '@prisma/client';

// ============================================================================
// Client Singleton
// ============================================================================

export { getPrismaClient, disconnectPrisma, resetPrismaInstance } from './client';
export type { PrismaClientConfig } from './client';

// ============================================================================
// Database Configuration
// ============================================================================

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  poolMin: number;
  poolMax: number;
  connectionTimeout: number;
}

/**
 * Build a DATABASE_URL connection string from individual config values.
 */
export function buildDatabaseUrl(config: DatabaseConfig): string {
  const sslParam = config.ssl ? '?sslmode=require' : '';
  const poolParams = `connection_limit=${config.poolMax}&pool_timeout=${Math.floor(config.connectionTimeout / 1000)}`;
  const separator = sslParam ? '&' : '?';
  return `postgresql://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}${sslParam}${separator}${poolParams}`;
}

/**
 * Get database configuration from environment variables.
 */
export function getDatabaseConfig(): DatabaseConfig {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'gaming_platform',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true',
    poolMin: parseInt(process.env.DB_POOL_MIN || '2', 10),
    poolMax: parseInt(process.env.DB_POOL_MAX || '10', 10),
    connectionTimeout: parseInt(process.env.DB_TIMEOUT || '5000', 10),
  };
}

export default getDatabaseConfig;
