/**
 * Message Consumer
 *
 * Abstract base class for consuming messages from RabbitMQ queues.
 * Provides built-in retry logic with exponential backoff and dead-letter support.
 */

import type { ConsumeMessage } from 'amqplib';
import { type QueueConfig, defaultQueueConfig, type QueueName } from './queue-config.js';
import { type QueueConnection } from './queue-connection.js';

export interface ConsumerOptions {
  retryAttempts?: number;
  retryDelay?: number; // base delay in ms
  prefetchCount?: number;
}

const DEFAULT_CONSUMER_OPTIONS: Required<ConsumerOptions> = {
  retryAttempts: defaultQueueConfig.retryAttempts,
  retryDelay: defaultQueueConfig.retryDelay,
  prefetchCount: defaultQueueConfig.prefetchCount,
};

export abstract class MessageConsumer<T> {
  private connection: QueueConnection;
  private options: Required<ConsumerOptions>;
  private consumerTag: string | null = null;
  private isRunning = false;

  constructor(connection: QueueConnection, options?: ConsumerOptions) {
    this.connection = connection;
    this.options = { ...DEFAULT_CONSUMER_OPTIONS, ...options };
  }

  /**
   * Handle a message. Must be implemented by subclasses.
   * Should throw an error if processing fails (will trigger retry).
   *
   * @param message - The deserialized message payload
   */
  abstract handle(message: T): Promise<void>;

  /**
   * Start consuming messages from the specified queue.
   *
   * @param queue - Queue name to consume from
   */
  async start(queue: QueueName): Promise<void> {
    if (this.isRunning) {
      console.warn(`[MessageConsumer] Already consuming from queue`);
      return;
    }

    const channel = this.connection.getChannel();
    this.isRunning = true;

    const { consumerTag } = await channel.consume(
      queue,
      async (msg: ConsumeMessage | null) => {
        if (!msg) return;

        try {
          const content = JSON.parse(msg.content.toString()) as T;
          const attempt = this.getRetryAttempt(msg);

          await this.processWithRetry(content, attempt, msg, queue);
        } catch (err) {
          console.error(
            `[MessageConsumer] Fatal error processing message:`,
            (err as Error).message
          );
          // Reject without requeue - send to dead-letter
          channel.nack(msg, false, false);
        }
      },
      { noAck: false }
    );

    this.consumerTag = consumerTag;
    console.log(`[MessageConsumer] Started consuming from ${queue} (tag: ${consumerTag})`);
  }

  /**
   * Stop consuming messages.
   */
  async stop(): Promise<void> {
    if (!this.isRunning || !this.consumerTag) {
      return;
    }

    try {
      const channel = this.connection.getChannel();
      await channel.cancel(this.consumerTag);
      this.consumerTag = null;
      this.isRunning = false;
      console.log('[MessageConsumer] Stopped consuming');
    } catch (err) {
      console.error('[MessageConsumer] Error stopping consumer:', (err as Error).message);
    }
  }

  /**
   * Check if the consumer is currently running.
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Process a message with retry logic using exponential backoff.
   * Sends to dead-letter queue after max retries are exhausted.
   */
  private async processWithRetry(
    message: T,
    attempt: number,
    originalMsg: ConsumeMessage,
    queue: QueueName
  ): Promise<void> {
    const channel = this.connection.getChannel();

    try {
      await this.handle(message);
      // Acknowledge successful processing
      channel.ack(originalMsg);
    } catch (err) {
      const errorMessage = (err as Error).message;
      console.warn(
        `[MessageConsumer] Handle failed (attempt ${attempt + 1}/${this.options.retryAttempts}): ${errorMessage}`
      );

      if (attempt + 1 >= this.options.retryAttempts) {
        // Max retries exhausted - send to dead-letter queue
        console.error(
          `[MessageConsumer] Max retries exhausted for message. Sending to dead-letter queue.`
        );
        channel.nack(originalMsg, false, false);
      } else {
        // Delay then requeue with updated retry count
        const delay = this.calculateBackoff(attempt);
        await this.sleep(delay);

        // Republish with incremented retry header
        const headers = {
          ...(originalMsg.properties.headers || {}),
          'x-retry-attempt': attempt + 1,
          'x-original-queue': queue,
          'x-last-error': errorMessage,
        };

        channel.nack(originalMsg, false, false);

        // Republish to the same queue with updated headers
        channel.sendToQueue(
          queue,
          Buffer.from(JSON.stringify(message)),
          {
            persistent: true,
            headers,
            messageId: originalMsg.properties.messageId,
            timestamp: Date.now(),
            contentType: 'application/json',
            contentEncoding: 'utf-8',
          }
        );
      }
    }
  }

  /**
   * Calculate exponential backoff delay for retries.
   * Uses 2^attempt * baseDelay with jitter.
   */
  private calculateBackoff(attempt: number): number {
    const baseDelay = this.options.retryDelay;
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    // Add jitter (±20%) to prevent thundering herd
    const jitter = exponentialDelay * 0.2 * (Math.random() * 2 - 1);
    return Math.round(exponentialDelay + jitter);
  }

  /**
   * Get the current retry attempt from message headers.
   */
  private getRetryAttempt(msg: ConsumeMessage): number {
    const headers = msg.properties.headers;
    if (headers && typeof headers['x-retry-attempt'] === 'number') {
      return headers['x-retry-attempt'];
    }
    return 0;
  }

  /**
   * Sleep utility for retry delays.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
