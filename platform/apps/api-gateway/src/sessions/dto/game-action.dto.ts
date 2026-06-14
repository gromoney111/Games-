/**
 * Game Action DTO
 *
 * Validates incoming game action requests. Each action has a type
 * (e.g., 'move', 'swap', 'place', 'rotate') and a game-specific payload.
 */

import { IsString, IsObject, IsNotEmpty } from 'class-validator';

export class GameActionDto {
  /**
   * The type of game action being performed.
   * Examples: 'move', 'swap', 'place', 'rotate', 'select', 'submit'
   */
  @IsString()
  @IsNotEmpty()
  actionType: string;

  /**
   * Game-specific action data.
   * Structure depends on the game and action type.
   * Examples:
   *  - move: { x: 3, y: 5, direction: 'up' }
   *  - swap: { from: { x: 1, y: 2 }, to: { x: 1, y: 3 } }
   *  - place: { position: { x: 4, y: 4 }, piece: 'L' }
   */
  @IsObject()
  @IsNotEmpty()
  payload: Record<string, any>;
}
