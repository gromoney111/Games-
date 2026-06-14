/**
 * Sessions Controller
 *
 * Handles game session lifecycle endpoints:
 * - POST /games/:gameId/sessions - start a new game session
 * - POST /games/sessions/:sessionId/actions - process a game action
 * - POST /games/sessions/:sessionId/end - end a game session
 *
 * All endpoints require authentication (JWT guard applied globally).
 * Ownership verification is handled in the service layer.
 *
 * Requirements: 4.1-4.7, 5.1-5.5
 */

import {
  Controller,
  Post,
  Param,
  Body,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { GameActionDto } from './dto/game-action.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/guards/jwt-auth.guard';

@Controller('games')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  /**
   * POST /games/:gameId/sessions
   *
   * Start a new game session for the authenticated user.
   * Validates user is active, game is published, and concurrent limit not exceeded.
   *
   * Returns: { sessionId, gameId, state, startedAt }
   *
   * Requirement 4.1, 4.2
   */
  @Post(':gameId/sessions')
  async startSession(
    @Param('gameId') gameId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.sessionsService.startSession(user.userId, gameId);
  }

  /**
   * POST /games/sessions/:sessionId/actions
   *
   * Process a game action within an active session.
   * Validates action against current state, computes new state deterministically.
   * Auto-ends the session if game-over condition is detected.
   *
   * Returns: { state, score, actionsCount, gameOver } or end-session result on game-over
   *
   * Requirements: 4.3, 4.4, 4.7, 5.1, 5.2, 5.5
   */
  @Post('sessions/:sessionId/actions')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  async processAction(
    @Param('sessionId') sessionId: string,
    @Body() action: GameActionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.sessionsService.processAction(sessionId, action, user.userId);
  }

  /**
   * POST /games/sessions/:sessionId/end
   *
   * End a game session manually. Persists final score to PostgreSQL,
   * cleans up Redis session data, and publishes analytics event.
   *
   * Returns: { sessionId, finalScore, duration, actionsCount, gameOver: true }
   *
   * Requirements: 4.5, 4.6, 5.5
   */
  @Post('sessions/:sessionId/end')
  async endSession(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.sessionsService.endSession(sessionId, user.userId);
  }
}
