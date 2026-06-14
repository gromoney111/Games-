# Implementation Plan: Gaming Platform

## Overview

This implementation plan covers the full build of the gaming platform — a comprehensive web and mobile application hosting 25-30 integrated games with user dashboards, in-app purchases, affiliate program, Google Ads, SEO, analytics, and full legal compliance. The tech stack is TypeScript end-to-end: Node.js/NestJS microservices on the backend, React SPA for web, React Native for mobile, PostgreSQL for persistence, Redis for caching/sessions, and Kubernetes for orchestration.

Tasks are ordered for incremental delivery: infrastructure first, then core services, then integrations and cross-cutting concerns, finishing with testing and deployment automation.

## Tasks

- [x] 1. Project infrastructure and shared foundations
  - [x] 1.1 Initialize monorepo structure with shared packages
    - Create monorepo with Turborepo/Nx containing: `apps/api-gateway`, `apps/web`, `apps/mobile`, `apps/admin`, `packages/shared-types`, `packages/database`, `packages/utils`
    - Configure TypeScript project references, ESLint, Prettier, and base tsconfig
    - Set up package.json workspaces and scripts
    - _Requirements: 24.1_

  - [x] 1.2 Define shared TypeScript types and interfaces
    - Create type definitions mapping all Lean data models: `User`, `Game`, `Transaction`, `Affiliate`, `GameSession`, `GameState`, `GameAction`
    - Define enums for `UserRole`, `AccountStatus`, `GameCategory`, `TransactionStatus`, `AffiliateTier`, `AffiliateStatus`
    - Define service interface contracts: `IUserService`, `IGameService`, `IPaymentService`, `IAffiliateService`, `IAnalyticsService`, `IAdService`
    - _Requirements: 1, 2, 3, 4, 7, 9_

  - [x] 1.3 Set up PostgreSQL database schema and migrations
    - Create migration files for all tables: users, user_profiles, games, game_sessions, game_results, transactions, affiliates, affiliate_clicks, commissions, ad_impressions, analytics_events, audit_logs, notifications
    - Define indexes: composite on (userId, gameId, createdAt), unique on email, unique on game slug, unique on affiliate tracking code
    - Set up Prisma ORM with schema validation
    - _Requirements: 18.3, 19.5, 24.3_

  - [x] 1.4 Set up Redis configuration and connection module
    - Create Redis client module with connection pooling
    - Define key namespaces for sessions, rate limiting, caching, and frequency caps
    - Implement TTL management utilities (session TTL, 5-min profile cache, 30-sec leaderboard cache)
    - _Requirements: 19.4, 19.5_

  - [x] 1.5 Set up message queue infrastructure
    - Configure RabbitMQ/SQS connection with TypeScript client
    - Define queues: notifications, analytics-events, commission-calculations
    - Implement publisher and consumer base classes with retry logic
    - _Requirements: 21.4_

  - [x] 1.6 Set up Docker and docker-compose for local development
    - Create Dockerfiles for each service
    - Create docker-compose.yml with PostgreSQL, Redis, RabbitMQ, Elasticsearch containers
    - Configure environment variables and secrets management
    - _Requirements: 24.1, 24.3_

- [x] 2. API Gateway and authentication service
  - [x] 2.1 Implement API Gateway with NestJS
    - Create NestJS application with route forwarding to microservices
    - Implement JWT RS256 token validation middleware
    - Implement request logging and correlation ID propagation
    - Configure CORS with strict origin whitelist
    - _Requirements: 17.1, 18.5_

  - [x] 2.2 Implement rate limiting middleware
    - Create sliding window rate limiter using Redis (100 req/min per user)
    - Return 429 Too Many Requests with Retry-After header on limit exceeded
    - Implement separate rate limits for different endpoint categories
    - _Requirements: 17.2, 17.3_

  - [ ]* 2.3 Write property test for rate limiting enforcement
    - **Property 26: Rate Limiting Enforcement**
    - **Validates: Requirements 17.2, 17.3**

  - [x] 2.4 Implement webhook signature validation
    - Create middleware for validating Stripe webhook signatures
    - Create middleware for validating external service callback signatures
    - Return 403 for invalid signatures
    - _Requirements: 17.5_

  - [x] 2.5 Implement service unavailability handling
    - Return 503 with Retry-After header when backend services are down
    - Implement health check endpoints for all downstream services
    - _Requirements: 17.4_

  - [ ]* 2.6 Write property test for JWT validation correctness
    - **Property 25: JWT Validation Correctness**
    - **Validates: Requirement 17.1**

- [x] 3. User service — registration and authentication
  - [x] 3.1 Implement user registration endpoint
    - Create `POST /auth/register` accepting email and password
    - Validate email (RFC 5322) and password (min 8 chars, complexity)
    - Hash password with Argon2id (per-user salt, 3 iterations)
    - Create user with pending status, send email verification link
    - Return descriptive error (without revealing account details) if email exists
    - _Requirements: 1.1, 1.2, 1.7, 2.4, 2.5_

  - [x] 3.2 Implement user authentication endpoint
    - Create `POST /auth/login` accepting email and password
    - Implement constant-time response regardless of user existence (dummy hash on miss)
    - Issue access token (15-min expiry) and refresh token (7-day expiry)
    - Track failed attempts, lock account after max attempts exceeded
    - Reset failed attempts and update last login on success
    - _Requirements: 1.3, 1.4, 1.5, 1.6_

  - [ ]* 3.3 Write property test for authentication timing uniformity
    - **Property 1: Authentication Timing Uniformity**
    - **Validates: Requirement 1.4**

  - [ ]* 3.4 Write property test for account lockout enforcement
    - **Property 2: Account Lockout Enforcement**
    - **Validates: Requirements 1.5, 1.6**

  - [x] 3.5 Implement token refresh endpoint
    - Create `POST /auth/refresh` accepting refresh token
    - Validate refresh token and issue new token pair
    - Invalidate old refresh token (rotation)
    - _Requirements: 1.3_

- [ ] 4. User service — profile management
  - [~] 4.1 Implement user profile CRUD endpoints
    - Create `GET /users/:id/profile` returning full profile
    - Create `PUT /users/:id/profile` with validation (username 3-30 alphanumeric, valid email)
    - Implement profile caching in Redis (5-min TTL)
    - Return specific validation errors on invalid data
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 4.2 Write property test for username and email validation
    - **Property 3: Username and Email Validation**
    - **Validates: Requirements 2.4, 2.5**

  - [ ]* 4.3 Write property test for profile update round-trip
    - **Property 4: Profile Update Round-Trip**
    - **Validates: Requirements 2.1, 2.2**

  - [~] 4.4 Implement GDPR data portability and account deactivation
    - Create `POST /users/:id/deactivate` to deactivate account
    - Create `GET /users/:id/export` to export all user data in JSON format
    - Create `DELETE /users/:id` for right to erasure (30-day deletion)
    - _Requirements: 2.6, 13.4, 13.5_

- [~] 5. Checkpoint - Core user services
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Game service — catalog and discovery
  - [~] 6.1 Implement game catalog endpoints
    - Create `GET /games` with pagination, category filter, tag filter, and search
    - Create `GET /games/:slug` returning full game detail with SEO metadata
    - Validate slug uniqueness and URL-safety, title ≤ 100 chars, description ≤ 5000 chars
    - Serve game asset URLs through CDN with caching headers
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 6.2 Write property test for game catalog filter correctness
    - **Property 5: Game Catalog Filter Correctness**
    - **Validates: Requirements 3.1, 3.3, 3.4**

  - [~] 6.3 Implement game administration endpoints
    - Create `POST /admin/games` for adding games
    - Create `PUT /admin/games/:id` for updating games
    - Create `PATCH /admin/games/:id/status` for publish/unpublish
    - Restrict to admin role
    - _Requirements: 16.3, 16.5_

- [ ] 7. Game service — session management
  - [~] 7.1 Implement game session lifecycle
    - Create `POST /games/:id/sessions` to start a new session
    - Validate user is active and game is published
    - Enforce concurrent session limit (reject with info about active sessions)
    - Create initial game state in Redis with session TTL
    - Track game start event in analytics
    - _Requirements: 4.1, 4.2_

  - [~] 7.2 Implement game action processing
    - Create `POST /games/sessions/:id/actions` to process game actions
    - Validate action against current state (reject invalid with error, no state change)
    - Compute new state deterministically and update Redis
    - Calculate score updates
    - Auto-end session on game-over condition
    - _Requirements: 4.3, 4.4, 4.7, 5.1, 5.2_

  - [ ]* 7.3 Write property test for game state determinism
    - **Property 6: Game State Determinism**
    - **Validates: Requirements 4.3, 5.1**

  - [ ]* 7.4 Write property test for invalid action state preservation
    - **Property 8: Invalid Action State Preservation**
    - **Validates: Requirement 4.4**

  - [~] 7.5 Implement session end and timeout handling
    - Create `POST /games/sessions/:id/end` to end session
    - Persist final score to PostgreSQL, clean up Redis session
    - Implement background job for session timeout expiry
    - Reject all actions to ended sessions
    - _Requirements: 4.5, 4.6, 5.5_

  - [ ]* 7.6 Write property test for session immutability after end
    - **Property 7: Session Immutability After End**
    - **Validates: Requirements 4.4, 5.5**

  - [ ]* 7.7 Write property test for concurrent session limit enforcement
    - **Property 9: Concurrent Session Limit Enforcement**
    - **Validates: Requirement 4.2**

  - [~] 7.8 Implement game state corruption recovery
    - Detect inconsistent Redis state (negative lives, invalid level)
    - Attempt recovery from last valid checkpoint
    - If no checkpoint available, gracefully end session with last valid score
    - Log corruption events for investigation
    - _Requirements: 5.3, 5.4_

- [ ] 8. Game service — leaderboard and scoring
  - [~] 8.1 Implement leaderboard endpoints
    - Create `GET /games/:id/leaderboard` with time period filter and limit (1-1000)
    - Sort descending by score, break ties by earliest timestamp
    - Assign unique sequential ranks 1..N
    - Cache leaderboard in Redis (30-second TTL)
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 8.2 Write property test for leaderboard ordering invariant
    - **Property 10: Leaderboard Ordering Invariant**
    - **Validates: Requirements 6.1, 6.2, 6.4**

- [~] 9. Checkpoint - Game services complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Payment service — in-app purchases
  - [~] 10.1 Implement purchase initiation
    - Create `POST /purchases/initiate` accepting item ID and payment method
    - Validate purchase eligibility: active account, age restriction, daily limit (rolling 24h), stock availability
    - Create payment intent with Stripe
    - Record pending transaction in PostgreSQL
    - Return specific error for each failure mode
    - _Requirements: 7.1, 7.3, 7.4, 7.5_

  - [ ]* 10.2 Write property test for purchase eligibility specificity
    - **Property 12: Purchase Eligibility Specificity**
    - **Validates: Requirement 7.3**

  - [ ]* 10.3 Write property test for daily purchase limit enforcement
    - **Property 13: Daily Purchase Limit Enforcement**
    - **Validates: Requirement 7.4**

  - [ ]* 10.4 Write property test for transaction amount validity
    - **Property 11: Transaction Amount Validity**
    - **Validates: Requirements 7.5, 7.6**

  - [~] 10.5 Implement payment webhook processing
    - Create `POST /webhooks/stripe` for payment.succeeded and payment.failed events
    - Validate webhook signature
    - On success: mark transaction completed, grant item to user, send notification
    - On failure: mark transaction failed, notify user
    - _Requirements: 7.2, 8.5_

  - [~] 10.6 Implement refund processing
    - Create `POST /purchases/:id/refund` with reason
    - Validate refund amount does not exceed original
    - Process refund through Stripe, update transaction status
    - _Requirements: 7.6_

  - [~] 10.7 Implement payment timeout and retry handling
    - Mark transactions as pending_confirmation on gateway timeout (30s)
    - Background job retries status check every 60s for up to 24h
    - Auto-grant item if confirmed within retry period
    - Auto-refund and notify if failed after retry period
    - Maintain audit trail of all state changes
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 11. Affiliate service
  - [~] 11.1 Implement affiliate registration and management
    - Create `POST /affiliates/apply` for affiliate application
    - Create `GET /affiliates/:id` for affiliate details
    - Generate unique URL-safe tracking codes on approval
    - Implement approval workflow (admin approves/rejects)
    - _Requirements: 9.1, 9.2_

  - [ ]* 11.2 Write property test for affiliate tracking code uniqueness
    - **Property 16: Affiliate Tracking Code Uniqueness**
    - **Validates: Requirement 9.2**

  - [~] 11.3 Implement affiliate click and conversion tracking
    - Create `GET /r/:trackingCode` redirect endpoint for click tracking
    - Record click events with IP, timestamp, user agent
    - Track conversion events when tracked users complete qualifying actions
    - _Requirements: 9.3, 9.4_

  - [~] 11.4 Implement commission calculation
    - Calculate commission based on affiliate tier (Bronze 5%, Silver 10%, Gold 15%, Platinum 20%)
    - Apply promotional bonus multipliers
    - Cap effective rate at maximum allowed commission
    - Run fraud score check before crediting
    - Reject commission and flag affiliate if fraud score exceeds threshold
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.6_

  - [ ]* 11.5 Write property test for commission rate boundedness
    - **Property 14: Commission Rate Boundedness**
    - **Validates: Requirements 10.1, 10.2**

  - [ ]* 11.6 Write property test for affiliate fraud threshold enforcement
    - **Property 15: Affiliate Fraud Threshold Enforcement**
    - **Validates: Requirements 10.4, 11.1**

  - [~] 11.7 Implement affiliate payout processing
    - Create `POST /affiliates/:id/payout` for payout requests
    - Enforce minimum $50 payout threshold
    - Process payout through payment gateway
    - _Requirements: 10.5_

  - [ ]* 11.8 Write property test for minimum payout threshold
    - **Property 17: Minimum Payout Threshold**
    - **Validates: Requirement 10.5**

  - [~] 11.9 Implement affiliate fraud detection
    - Detect abnormal click patterns (>100/min from single IP)
    - Detect geographic impossibility
    - Temporarily suspend and flag suspicious affiliates
    - Admin confirm/reject workflow (restore or ban)
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [~] 12. Checkpoint - Monetization services complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Ad service — Google Ads integration
  - [~] 13.1 Implement ad placement and serving
    - Create `GET /ads/placement` accepting page context and placement config
    - Return appropriate ad unit based on context
    - Implement frequency capping using Redis counters with TTL window
    - _Requirements: 12.1, 12.4_

  - [~] 13.2 Implement ad impression and click tracking
    - Create `POST /ads/:id/impression` for recording impressions
    - Create `POST /ads/:id/click` for recording clicks
    - Check user consent: store personalized impression if consent given, anonymous if not
    - Increment frequency cap counter on impression
    - _Requirements: 12.2, 12.3, 12.5, 12.6_

  - [ ]* 13.3 Write property test for consent-driven ad tracking
    - **Property 18: Consent-Driven Ad Tracking**
    - **Validates: Requirements 12.5, 12.6, 13.1**

  - [ ]* 13.4 Write property test for ad frequency cap enforcement
    - **Property 19: Ad Frequency Cap Enforcement**
    - **Validates: Requirement 12.4**

  - [~] 13.5 Implement ad revenue reporting
    - Create `GET /admin/ads/revenue` with date range filter
    - Aggregate impressions, clicks, and revenue per placement
    - _Requirements: 12.1_

- [ ] 14. GDPR and consent management
  - [~] 14.1 Implement consent management system
    - Create `POST /users/:id/consent` for granting/withdrawing consent
    - Track consent changes in audit trail with timestamps
    - Immediately stop personalized tracking on withdrawal
    - Switch to anonymous mode mid-request if consent withdrawn during processing
    - _Requirements: 13.1, 13.2, 13.6_

  - [~] 14.2 Implement PII data purge on consent withdrawal
    - Purge PII-linked records created after consent withdrawal timestamp
    - Preserve records created before withdrawal
    - Log compliance events for audit
    - _Requirements: 13.3_

  - [ ]* 14.3 Write property test for consent withdrawal data purge
    - **Property 20: Consent Withdrawal Data Purge**
    - **Validates: Requirements 13.2, 13.3**

  - [~] 14.4 Implement cookie consent banner and legal pages
    - Create endpoints serving Terms of Service, Privacy Policy, Cookie Policy, Refund Policy
    - Implement cookie consent banner logic (obtain explicit consent before non-essential cookies)
    - Ensure Google AdSense compliance for content guidelines
    - _Requirements: 22.1, 22.2, 22.3_

  - [~] 14.5 Implement age restriction enforcement
    - Validate user age against content and purchase restrictions
    - Block age-restricted content and purchases for underage users
    - _Requirements: 22.4_

  - [ ]* 14.6 Write property test for age restriction enforcement
    - **Property 28: Age Restriction Enforcement**
    - **Validates: Requirement 22.4**

- [ ] 15. SEO service
  - [~] 15.1 Implement SEO metadata generation
    - Create SEO metadata generator for game pages
    - Truncate meta title to ≤ 60 chars (with ellipsis + platform suffix)
    - Truncate meta description to ≤ 160 chars
    - Generate valid canonical URLs
    - Extract keywords from title, description, and tags
    - _Requirements: 14.1, 14.2, 14.4, 14.5_

  - [ ]* 15.2 Write property test for SEO metadata length constraints
    - **Property 21: SEO Metadata Length Constraints**
    - **Validates: Requirements 14.1, 14.2, 14.5**

  - [~] 15.3 Implement JSON-LD structured data generation
    - Generate schema.org VideoGame JSON-LD for each game page
    - Include required fields: name, description, genre, url, image, aggregateRating
    - _Requirements: 14.3_

  - [ ]* 15.4 Write property test for SEO structured data validity
    - **Property 22: SEO Structured Data Validity**
    - **Validates: Requirement 14.3**

- [ ] 16. Analytics service
  - [~] 16.1 Implement event tracking and ingestion
    - Create `POST /analytics/events` for event recording
    - Accept events: game_start, game_end, purchase, page_view
    - Store with full context (user, timestamp, event-specific data)
    - Process events asynchronously via message queue
    - _Requirements: 15.1_

  - [~] 16.2 Implement metrics and reporting endpoints
    - Create `GET /admin/analytics/users` for user engagement metrics
    - Create `GET /admin/analytics/games` for game performance metrics
    - Create `GET /admin/analytics/revenue` for financial metrics (gross, refunds, net, by source)
    - Enforce net revenue = gross revenue - refunds consistency
    - _Requirements: 15.2, 15.3, 15.4_

  - [ ]* 16.3 Write property test for revenue metrics consistency
    - **Property 23: Revenue Metrics Consistency**
    - **Validates: Requirement 15.4**

  - [~] 16.4 Implement data retention policy
    - Create background job to purge raw events beyond retention period
    - Preserve aggregated summaries permanently
    - _Requirements: 15.5_

  - [~] 16.5 Implement Google Search Console and Analytics integration
    - Integrate Google Search Console API for indexing management
    - Integrate Google Analytics 4 for behavior tracking
    - Create SEO metrics endpoint for admin dashboard
    - _Requirements: 15.1_

- [ ] 17. Notification service
  - [~] 17.1 Implement notification processing
    - Create notification consumer listening to message queue
    - Implement push notification sending (Firebase Cloud Messaging)
    - Implement email notification sending (SendGrid)
    - Handle notification types: purchase confirmation, commission earned, security alerts
    - _Requirements: 21.1, 21.2, 21.3, 21.4_

- [~] 18. Checkpoint - All backend services complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 19. Admin dashboard
  - [~] 19.1 Implement admin dashboard backend
    - Create `GET /admin/dashboard` returning real-time metrics (active users, sessions, revenue, health)
    - Create `POST /admin/users/:id/suspend`, `POST /admin/users/:id/reactivate`, `DELETE /admin/users/:id`
    - Record audit log entries for all admin actions
    - Restrict all endpoints to admin role
    - _Requirements: 16.1, 16.2, 16.5_

  - [ ]* 19.2 Write property test for admin authorization enforcement
    - **Property 24: Admin Authorization Enforcement**
    - **Validates: Requirement 16.5**

  - [~] 19.3 Implement admin dashboard frontend
    - Create React admin SPA with authentication
    - Build real-time metrics dashboard with charts
    - Build user management, game management, and affiliate management pages
    - Build report generation interface
    - _Requirements: 16.1, 16.2, 16.3, 16.4_

- [ ] 20. Web application frontend
  - [~] 20.1 Implement web SPA core shell and routing
    - Create React SPA with routing: home, game catalog, game detail, user profile, leaderboard
    - Implement authentication flow (login, register, token management)
    - Set up responsive layout with mobile-first design
    - _Requirements: 1, 2, 3_

  - [~] 20.2 Implement game catalog and discovery UI
    - Build game browsing page with category filters, search, and pagination
    - Build game detail page with SEO metadata, structured data, and Open Graph tags
    - _Requirements: 3.1, 3.2, 14.1, 14.3_

  - [~] 20.3 Implement game player and session UI
    - Build game container component with HTML5 Canvas/WebGL rendering
    - Implement session lifecycle: start, action dispatch, end
    - Display real-time score and game state
    - Implement leaderboard display
    - _Requirements: 4.1, 4.3, 4.5, 6.1_

  - [~] 20.4 Implement user dashboard
    - Build profile management page
    - Build game history and statistics views
    - Build inventory and purchased items view
    - Build notification center
    - _Requirements: 2.1, 2.2_

  - [~] 20.5 Implement purchase and store UI
    - Build virtual item store with purchase flow
    - Integrate Stripe Elements for payment
    - Display purchase history and receipts
    - _Requirements: 7.1, 7.2_

  - [~] 20.6 Implement cookie consent and legal pages
    - Build cookie consent banner component
    - Build legal page templates (Terms, Privacy, Cookies, Refund)
    - Implement consent preference management UI
    - _Requirements: 22.1, 22.2, 13.1_

  - [~] 20.7 Implement ad placement components
    - Build ad slot components for various placements
    - Integrate Google AdSense/Ad Manager SDK
    - Respect user consent preferences for ad personalization
    - _Requirements: 12.1, 12.5, 12.6_

- [ ] 21. Mobile application
  - [~] 21.1 Implement React Native mobile app core
    - Create React Native project with navigation (home, catalog, profile, settings)
    - Implement authentication flow with secure token storage
    - Set up push notification handling (Firebase Cloud Messaging)
    - _Requirements: 1, 21.1_

  - [~] 21.2 Implement mobile game experience
    - Build game catalog browsing and filtering
    - Build game player component optimized for mobile
    - Implement in-app purchase flow (Google Play / App Store billing)
    - _Requirements: 3.1, 4.1, 7.1_

- [~] 22. Checkpoint - Frontend applications complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 23. Game integration module
  - [~] 23.1 Implement game integration SDK and framework
    - Create game integration interface/contract that all games must implement
    - Define game lifecycle hooks: init, start, processAction, getState, end
    - Build game asset loader with CDN integration
    - Create 3 sample game implementations (puzzle, action, casual) as reference
    - _Requirements: 3.5, 4.1, 4.3_

  - [~] 23.2 Integrate 25-30 HTML5 games
    - Integrate games across categories: puzzle, action, strategy, casual, multiplayer, educational
    - Configure game-specific settings (difficulty levels, session timeouts, scoring rules)
    - Set up CDN delivery for all game assets
    - Verify each game works through the session management API
    - _Requirements: 3.1, 4.1_

- [ ] 24. Security hardening
  - [~] 24.1 Implement platform security measures
    - Configure AES-256-GCM encryption at rest for sensitive database columns
    - Enforce TLS 1.3 for all service-to-service and client-server communication
    - Implement parameterized queries across all database interactions (validate via Prisma)
    - Implement HTML sanitization for all user-generated content (DOMPurify)
    - Configure strict Content Security Policy headers
    - Ensure payment tokenization (no raw card data stored)
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6_

  - [ ]* 24.2 Write property test for HTML sanitization completeness
    - **Property 27: HTML Sanitization Completeness**
    - **Validates: Requirement 18.4**

  - [ ]* 24.3 Write property test for audit trail completeness
    - **Property 29: Audit Trail Completeness**
    - **Validates: Requirements 8.5, 13.6, 16.2**

- [ ] 25. Database resilience and performance
  - [~] 25.1 Implement database connection resilience
    - Configure connection pool with queue timeout (5 seconds)
    - Implement auto-scaling of connection pool up to hard limit
    - Implement circuit breaker (opens after 10 consecutive failures, redirects reads to replica)
    - Return 503 with Retry-After on pool exhaustion
    - _Requirements: 20.1, 20.2, 20.3, 20.4_

  - [~] 25.2 Implement performance optimizations
    - Configure Redis caching for all specified TTLs
    - Set up read replicas for analytics queries
    - Configure horizontal auto-scaling policies (CPU, memory, queue depth)
    - Verify API response targets: 200ms P95 general, 50ms P95 game actions
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6_

- [~] 26. Checkpoint - Integration and security complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 27. Testing infrastructure
  - [~] 27.1 Implement unit test suite
    - Write unit tests for authentication logic (hashing, token generation, rate limiting)
    - Write unit tests for game state transitions and score calculations
    - Write unit tests for commission calculation and tier rates
    - Write unit tests for SEO metadata generation and truncation
    - Write unit tests for input validation functions
    - Achieve 90% line coverage for core business logic
    - _Requirements: 23.1_

  - [~] 27.2 Implement integration test suite
    - Write integration tests for complete API request/response cycles through gateway
    - Write payment flow tests using Stripe test mode
    - Write game session tests for full lifecycle
    - Write analytics pipeline tests (event emission to dashboard)
    - Write cross-service communication tests under failure conditions
    - _Requirements: 23.2_

  - [~] 27.3 Implement end-to-end test suite
    - Write E2E tests for user journey: registration → game play → purchase
    - Write E2E tests for affiliate journey: registration → link → click → conversion → payout
    - Write E2E tests for admin journey: game management → user moderation → reporting
    - _Requirements: 23.3_

  - [~] 27.4 Implement performance and security tests
    - Write load tests validating response time targets under 10,000 concurrent sessions
    - Write security tests for auth, authorization, input sanitization, and encryption
    - Integrate dependency vulnerability scanning into CI pipeline
    - _Requirements: 23.4, 23.5, 18.7_

- [ ] 28. CI/CD pipeline and deployment
  - [~] 28.1 Implement CI/CD pipeline
    - Create GitHub Actions / GitLab CI pipeline configuration
    - Build container images for all services
    - Run lint, unit tests, integration tests in pipeline
    - Deploy to staging environment on merge to develop
    - Deploy to production with manual approval gate
    - _Requirements: 24.1_

  - [~] 28.2 Implement Kubernetes deployment manifests
    - Create Helm charts for all microservices
    - Configure horizontal pod autoscaling
    - Configure health checks and readiness probes
    - Set up phased rollout with rollback capability (< 5 minutes)
    - _Requirements: 24.2, 24.3_

  - [~] 28.3 Implement monitoring and observability
    - Deploy Prometheus for metrics collection
    - Deploy Grafana dashboards (system health, request rates, error rates, latency)
    - Configure alerting on threshold violations
    - Deploy centralized logging (ELK stack)
    - _Requirements: 24.4, 24.5_

- [~] 29. Final checkpoint - Platform deployment ready
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation between major phases
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- TypeScript is used end-to-end: NestJS backend, React web frontend, React Native mobile
- The 25-30 game integrations (task 23.2) represent the largest single effort and may be parallelized across team members
- All payment integrations should use Stripe test mode during development
- Security measures should be implemented early but hardened in task 24
- Monitoring should be set up before production deployment to catch issues during staging testing

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "1.5", "1.6"] },
    { "id": 2, "tasks": ["2.1", "3.1"] },
    { "id": 3, "tasks": ["2.2", "2.4", "2.5", "3.2", "3.5"] },
    { "id": 4, "tasks": ["2.3", "2.6", "3.3", "3.4", "4.1"] },
    { "id": 5, "tasks": ["4.2", "4.3", "4.4", "6.1"] },
    { "id": 6, "tasks": ["6.2", "6.3", "7.1"] },
    { "id": 7, "tasks": ["7.2", "7.5", "7.8", "8.1"] },
    { "id": 8, "tasks": ["7.3", "7.4", "7.6", "7.7", "8.2"] },
    { "id": 9, "tasks": ["10.1", "11.1"] },
    { "id": 10, "tasks": ["10.2", "10.3", "10.4", "10.5", "10.6", "11.2", "11.3"] },
    { "id": 11, "tasks": ["10.7", "11.4", "11.7", "11.9"] },
    { "id": 12, "tasks": ["11.5", "11.6", "11.8", "13.1"] },
    { "id": 13, "tasks": ["13.2", "13.5", "14.1", "14.4", "14.5"] },
    { "id": 14, "tasks": ["13.3", "13.4", "14.2", "14.3", "14.6", "15.1"] },
    { "id": 15, "tasks": ["15.2", "15.3", "16.1"] },
    { "id": 16, "tasks": ["15.4", "16.2", "16.4", "16.5", "17.1"] },
    { "id": 17, "tasks": ["16.3", "19.1"] },
    { "id": 18, "tasks": ["19.2", "19.3", "20.1", "21.1"] },
    { "id": 19, "tasks": ["20.2", "20.3", "20.4", "20.5", "20.6", "20.7", "21.2"] },
    { "id": 20, "tasks": ["23.1"] },
    { "id": 21, "tasks": ["23.2", "24.1"] },
    { "id": 22, "tasks": ["24.2", "24.3", "25.1", "25.2"] },
    { "id": 23, "tasks": ["27.1", "27.2"] },
    { "id": 24, "tasks": ["27.3", "27.4"] },
    { "id": 25, "tasks": ["28.1"] },
    { "id": 26, "tasks": ["28.2", "28.3"] }
  ]
}
```
