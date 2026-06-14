/**
 * Queue Connection Manager
 *
 * Manages the RabbitMQ connection lifecycle with automatic reconnection.
 * Provides channel creation and management for publishers and consumers.
 */

import amqplib, { type ChannelModel, type Channel } from 'amqplib';
import { type QueueConfig, defaultQueueConfig, type QueueName, QUEUES } from './queue-config.js';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'closing';

export class QueueConnection {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private config: QueueConfig;
  private state: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = { ...defaultQueueConfig, ...config };
  }

  /**
   * Establish connection to RabbitMQ and set up the channel.
   * Automatically declares all platform queues.
   */
  async connect(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      return;
    }

    this.state = 'connecting';

    try {
      this.connection = await amqplib.connect(this.config.url);

      this.connection.on('error', (err: Error) => {
        console.error('[QueueConnection] Connection error:', err.message);
        this.handleDisconnect();
      });

      this.connection.on('close', () => {
        if (this.state !== 'closing') {
          console.warn('[QueueConnection] Connection closed unexpectedly');
          this.handleDisconnect();
        }
      });

      this.channel = await this.connection.createChannel();
      await this.channel.prefetch(this.config.prefetchCount);

      // Declare all platform queues with dead-letter exchange
      await this.declareQueues();

      this.state = 'connected';
      this.reconnectAttempts = 0;

      console.log('[QueueConnection] Connected to RabbitMQ');
    } catch (err) {
      this.state = 'disconnected';
      console.error('[QueueConnection] Failed to connect:', (err as Error).message);
      this.scheduleReconnect();
    }
  }

  /**
   * Declares all platform queues with dead-letter exchange configuration.
   */
  private async declareQueues(): Promise<void> {
    if (!this.channel) return;

    // Declare dead-letter exchange and queue
    await this.channel.assertExchange('dlx', 'direct', { durable: true });
    await this.channel.assertQueue('dead-letter-queue', { durable: true });
    await this.channel.bindQueue('dead-letter-queue', 'dlx', '');

    // Declare all platform queues
    const queueNames: QueueName[] = Object.values(QUEUES);
    for (const queueName of queueNames) {
      await this.channel.assertQueue(queueName, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': 'dlx',
          'x-dead-letter-routing-key': '',
        },
      });
    }
  }

  /**
   * Handle disconnection event and attempt reconnection.
   */
  private handleDisconnect(): void {
    this.state = 'disconnected';
    this.connection = null;
    this.channel = null;
    this.scheduleReconnect();
  }

  /**
   * Schedule a reconnection attempt with backoff.
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error(
        `[QueueConnection] Max reconnect attempts (${this.config.maxReconnectAttempts}) reached. Giving up.`
      );
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectInterval * this.reconnectAttempts;

    console.log(
      `[QueueConnection] Attempting reconnect (${this.reconnectAttempts}/${this.config.maxReconnectAttempts}) in ${delay}ms`
    );

    this.reconnectTimer = setTimeout(async () => {
      await this.connect();
    }, delay);
  }

  /**
   * Get the current channel. Throws if not connected.
   */
  getChannel(): Channel {
    if (!this.channel || this.state !== 'connected') {
      throw new Error('[QueueConnection] Not connected. Call connect() first.');
    }
    return this.channel;
  }

  /**
   * Get the current connection state.
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Check if the connection is currently active.
   */
  isConnected(): boolean {
    return this.state === 'connected' && this.channel !== null;
  }

  /**
   * Gracefully close the connection.
   */
  async close(): Promise<void> {
    this.state = 'closing';

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
    } catch (err) {
      console.error('[QueueConnection] Error during close:', (err as Error).message);
    } finally {
      this.state = 'disconnected';
      console.log('[QueueConnection] Connection closed');
    }
  }
}
