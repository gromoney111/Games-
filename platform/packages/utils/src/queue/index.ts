/**
 * Queue Module
 *
 * Message queue infrastructure for the gaming platform.
 * Provides RabbitMQ connection management, publishing, and consuming
 * with built-in retry logic and dead-letter support.
 */

export {
  type QueueConfig,
  defaultQueueConfig,
  QUEUES,
  type QueueName,
  type PublishOptions,
  DEFAULT_PUBLISH_OPTIONS,
} from './queue-config.js';

export {
  QueueConnection,
  type ConnectionState,
} from './queue-connection.js';

export {
  MessagePublisher,
  type PublishResult,
} from './publisher.js';

export {
  MessageConsumer,
  type ConsumerOptions,
} from './consumer.js';

export {
  type NotificationMessage,
  type NotificationType,
  type NotificationChannel,
  type AnalyticsEventMessage,
  type AnalyticsEventType,
  type CommissionCalculationMessage,
  type QueueMessageMap,
} from './message-types.js';
