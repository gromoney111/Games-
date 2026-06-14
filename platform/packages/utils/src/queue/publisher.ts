/**
 * Message Publisher
 *
 * Base publisher class for sending messages to RabbitMQ queues.
 * Supports single and batch message publishing with configurable options.
 */

import {
  type QueueName,
  type PublishOptions,
  DEFAULT_PUBLISH_OPTIONS,
} from './queue-config.js';
import { type QueueConnection } from './queue-connection.js';

export interface PublishResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class MessagePublisher {
  private connection: QueueConnection;

  constructor(connection: QueueConnection) {
    this.connection = connection;
  }

  /**
   * Publish a single message to a queue.
   *
   * @param queue - Target queue name
   * @param message - Message payload (will be JSON-serialized)
   * @param options - Optional publish options (persistence, priority, TTL)
   */
  async publish<T>(
    queue: QueueName,
    message: T,
    options?: PublishOptions
  ): Promise<PublishResult> {
    try {
      const channel = this.connection.getChannel();
      const mergedOptions = { ...DEFAULT_PUBLISH_OPTIONS, ...options };
      const messageId = crypto.randomUUID();

      const buffer = Buffer.from(JSON.stringify(message));

      const published = channel.sendToQueue(queue, buffer, {
        persistent: mergedOptions.persistent,
        priority: mergedOptions.priority,
        expiration: mergedOptions.expiration,
        headers: mergedOptions.headers,
        correlationId: mergedOptions.correlationId,
        replyTo: mergedOptions.replyTo,
        messageId,
        timestamp: Date.now(),
        contentType: 'application/json',
        contentEncoding: 'utf-8',
      });

      if (!published) {
        // Channel buffer is full, wait for drain event
        await new Promise<void>((resolve) => {
          channel.once('drain', resolve);
        });
      }

      return { success: true, messageId };
    } catch (err) {
      const errorMessage = (err as Error).message;
      console.error(`[MessagePublisher] Failed to publish to ${queue}:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Publish a batch of messages to a queue.
   * Messages are sent sequentially to maintain ordering.
   *
   * @param queue - Target queue name
   * @param messages - Array of message payloads
   * @param options - Optional publish options applied to all messages
   * @returns Array of publish results for each message
   */
  async publishBatch<T>(
    queue: QueueName,
    messages: T[],
    options?: PublishOptions
  ): Promise<PublishResult[]> {
    const results: PublishResult[] = [];

    for (const message of messages) {
      const result = await this.publish(queue, message, options);
      results.push(result);
    }

    return results;
  }

  /**
   * Check if the publisher is ready to send messages.
   */
  isReady(): boolean {
    return this.connection.isConnected();
  }
}
