/**
 * Database Package
 *
 * Provides PostgreSQL database access, schema definitions,
 * migrations, and ORM (Prisma) configuration for the gaming platform.
 */

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

// ============================================================================
// Connection Management (placeholder - implemented in Task 1.3)
// ============================================================================

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
