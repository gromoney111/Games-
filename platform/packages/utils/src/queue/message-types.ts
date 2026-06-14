/**
 * Message Types
 *
 * Typed message schemas for all platform message queues.
 * Each queue has a corresponding message interface defining its payload shape.
 */

// ============================================================================
// Notification Queue Messages
// ============================================================================

export type NotificationType =
  | 'purchase_confirmation'
  | 'commission_earned'
  | 'security_alert'
  | 'account_locked'
  | 'password_changed'
  | 'new_device_login';

export type NotificationChannel = 'push' | 'email' | 'in_app';

export interface NotificationMessage {
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  createdAt: string; // ISO 8601 timestamp
}

// ============================================================================
// Analytics Events Queue Messages
// ============================================================================

export type AnalyticsEventType =
  | 'game_start'
  | 'game_end'
  | 'game_action'
  | 'purchase'
  | 'page_view'
  | 'user_login'
  | 'user_register'
  | 'affiliate_click'
  | 'affiliate_conversion'
  | 'ad_impression'
  | 'ad_click';

export interface AnalyticsEventMessage {
  userId?: string;
  sessionId?: string;
  eventType: AnalyticsEventType;
  payload: Record<string, unknown>;
  timestamp: string; // ISO 8601 timestamp
  metadata?: {
    userAgent?: string;
    ipAddress?: string;
    country?: string;
    device?: string;
    platform?: 'web' | 'mobile' | 'admin';
  };
}

// ============================================================================
// Commission Calculations Queue Messages
// ============================================================================

export interface CommissionCalculationMessage {
  affiliateId: string;
  conversionEventId: string;
  transactionAmount: number; // in smallest currency unit (cents)
  currency: string; // ISO 4217 code
  gameId?: string;
  userId: string; // the converting user
  trackingCode: string;
  timestamp: string; // ISO 8601 timestamp
}

// ============================================================================
// Queue-to-Message Type Mapping
// ============================================================================

export interface QueueMessageMap {
  notifications: NotificationMessage;
  'analytics-events': AnalyticsEventMessage;
  'commission-calculations': CommissionCalculationMessage;
}
