/**
 * Prisma Client Singleton
 *
 * Provides a single PrismaClient instance for the entire application.
 * Handles connection configuration, pooling, and graceful shutdown.
 */

import { PrismaClient } from '@prisma/client';

// ============================================================================
// Prisma Client Configuration
// ============================================================================

export interface PrismaClientConfig {
  /** Database connection URL (overrides DATABASE_URL env var) */
  databaseUrl?: string;
  /** Enable query logging */
  logQueries?: boolean;
  /** Connection pool minimum size */
  poolMin?: number;
  /** Connection pool maximum size */
  poolMax?: number;
  /** Connection timeout in milliseconds */
  connectionTimeout?: number;
}

// ============================================================================
// Singleton Instance
// ============================================================================

let prismaInstance: PrismaClient | null = null;

/**
 * Get or create the PrismaClient singleton instance.
 *
 * Uses connection pooling configured via DATABASE_URL query parameters:
 * - connection_limit: max connections in pool
 * - pool_timeout: seconds to wait for a connection from pool
 *
 * @param config - Optional configuration overrides
 * @returns PrismaClient instance
 */
export function getPrismaClient(config?: PrismaClientConfig): PrismaClient {
  if (prismaInstance) {
    return prismaInstance;
  }

  const logLevels: Array<'query' | 'info' | 'warn' | 'error'> = ['warn', 'error'];

  if (config?.logQueries || process.env.PRISMA_LOG_QUERIES === 'true') {
    logLevels.push('query');
  }

  if (process.env.NODE_ENV !== 'production') {
    logLevels.push('info');
  }

  prismaInstance = new PrismaClient({
    datasources: config?.databaseUrl
      ? { db: { url: config.databaseUrl } }
      : undefined,
    log: logLevels,
  });

  return prismaInstance;
}

/**
 * Disconnect the PrismaClient and release all connections.
 * Should be called during graceful shutdown.
 */
export async function disconnectPrisma(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }
}

/**
 * Reset the singleton (useful for testing).
 * Does NOT disconnect - call disconnectPrisma() first if needed.
 */
export function resetPrismaInstance(): void {
  prismaInstance = null;
}

// ============================================================================
// Default Export
// ============================================================================

export default getPrismaClient;
