/**
 * Queue Configuration
 *
 * Defines the RabbitMQ connection configuration and queue names
 * used across the gaming platform for async message processing.
 */

export interface QueueConfig {
  url: string;
  prefetchCount: number;
  retryAttempts: number;
  retryDelay: number; // ms
  reconnectInterval: number; // ms
  maxReconnectAttempts: number;
}

export const defaultQueueConfig: QueueConfig = {
  url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  prefetchCount: 10,
  retryAttempts: 3,
  retryDelay: 5000,
  reconnectInterval: 3000,
  maxReconnectAttempts: 10,
};

export const QUEUES = {
  NOTIFICATIONS: 'notifications',
  ANALYTICS_EVENTS: 'analytics-events',
  COMMISSION_CALCULATIONS: 'commission-calculations',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export interface PublishOptions {
  persistent?: boolean;
  priority?: number;
  expiration?: string; // TTL in ms as string
  headers?: Record<string, string | number | boolean>;
  correlationId?: string;
  replyTo?: string;
}

export const DEFAULT_PUBLISH_OPTIONS: PublishOptions = {
  persistent: true,
  priority: 0,
};
