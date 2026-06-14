import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  environment: process.env.NODE_ENV || 'development',

  // Frontend URLs for CORS
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001',
  adminUrl: process.env.ADMIN_URL || 'http://localhost:3002',

  // JWT Configuration
  jwt: {
    publicKey: process.env.JWT_PUBLIC_KEY || '',
    privateKey: process.env.JWT_PRIVATE_KEY || '',
    accessTokenExpiry: process.env.JWT_ACCESS_TOKEN_EXPIRY || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_TOKEN_EXPIRY || '7d',
    issuer: process.env.JWT_ISSUER || 'gaming-platform',
    audience: process.env.JWT_AUDIENCE || 'gaming-platform-api',
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
  },

  // Microservice URLs
  services: {
    userService: process.env.USER_SERVICE_URL || 'http://localhost:3010',
    gameService: process.env.GAME_SERVICE_URL || 'http://localhost:3011',
    paymentService: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3012',
    affiliateService: process.env.AFFILIATE_SERVICE_URL || 'http://localhost:3013',
    adService: process.env.AD_SERVICE_URL || 'http://localhost:3014',
    analyticsService: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3015',
    notificationService: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3016',
  },
}));
