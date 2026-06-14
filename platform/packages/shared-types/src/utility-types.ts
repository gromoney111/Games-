/**
 * Utility Types
 *
 * Common utility types used across the platform for pagination,
 * date ranges, durations, and generic response structures.
 */

// ============================================================================
// Pagination
// ============================================================================

export interface Pagination {
  page: number;
  limit: number;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// ============================================================================
// Date and Time
// ============================================================================

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface Duration {
  hours?: number;
  minutes?: number;
  seconds?: number;
  milliseconds?: number;
}

// ============================================================================
// Generic API Response
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  timestamp: Date;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

// ============================================================================
// Sort and Filter
// ============================================================================

export type SortOrder = 'asc' | 'desc';

export interface SortOption {
  field: string;
  order: SortOrder;
}

// ============================================================================
// Timestamp Mixin
// ============================================================================

export interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
}
