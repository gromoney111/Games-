/**
 * Games Service
 *
 * Business logic for game catalog and discovery:
 * - List published games with filtering (category, tags, search) and pagination
 * - Get game detail by slug with CDN-prefixed asset URLs and SEO metadata
 * - Create/update games with slug uniqueness and validation
 * - Publish/unpublish game lifecycle management
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GamesRepository, GameWhereInput } from './games.repository';
import { ListGamesDto } from './dto/list-games.dto';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';

/** Result shape for paginated game lists */
export interface PagedGameResult {
  items: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

@Injectable()
export class GamesService {
  private readonly cdnBaseUrl: string;

  constructor(
    private readonly gamesRepository: GamesRepository,
    private readonly configService: ConfigService,
  ) {
    this.cdnBaseUrl = this.configService.get<string>(
      'CDN_BASE_URL',
      'https://cdn.gaming-platform.com',
    );
  }

  /**
   * List published games with pagination, category filter, tag filter, and search.
   * Default page size: 20, max: 100. Only returns games with status PUBLISHED.
   *
   * Requirement 3.1: paginated list of published games matching filters
   */
  async listGames(query: ListGamesDto): Promise<PagedGameResult> {
    const { category, tags, search, page = 1, limit = 20 } = query;

    // Build filter - only show published games
    const where: GameWhereInput = { status: 'PUBLISHED' };

    if (category) {
      where.category = category;
    }

    if (tags) {
      const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
      if (tagList.length > 0) {
        where.tags = { hasSome: tagList };
      }
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [items, total] = await this.gamesRepository.findMany(where, skip, limit);

    // Add CDN prefix to thumbnail URLs for listed items
    const itemsWithCdn = items.map((item: any) => ({
      ...item,
      thumbnailUrl: this.addCdnPrefix(item.thumbnailUrl),
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      items: itemsWithCdn,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  /**
   * Get full game detail by slug. Returns complete game info with SEO metadata.
   * Returns 404 if game is not found or not published (does not distinguish).
   * Asset URLs are served with CDN prefix for low-latency delivery.
   *
   * Requirement 3.2: complete game info with SEO metadata
   * Requirement 3.5: CDN asset serving with caching headers
   */
  async getGameBySlug(slug: string): Promise<any> {
    const game = await this.gamesRepository.findBySlug(slug, 'PUBLISHED');

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Add CDN prefix to asset URLs (Requirement 3.5)
    return {
      ...game,
      thumbnailUrl: this.addCdnPrefix(game.thumbnailUrl),
    };
  }

  /**
   * Create a new game (admin only).
   * Validates slug uniqueness and URL-safety.
   *
   * Requirement 3.3: slug uniqueness and URL-safety
   * Requirement 3.4: title ≤ 100 chars, description ≤ 5000 chars
   */
  async createGame(dto: CreateGameDto): Promise<any> {
    // Check slug uniqueness (Requirement 3.3)
    const slugExists = await this.gamesRepository.slugExists(dto.slug);
    if (slugExists) {
      throw new ConflictException(`A game with slug "${dto.slug}" already exists`);
    }

    return this.gamesRepository.create(dto);
  }

  /**
   * Update an existing game (admin only).
   * Validates slug uniqueness if slug is being changed.
   */
  async updateGame(id: string, dto: UpdateGameDto): Promise<any> {
    const existing = await this.gamesRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Game not found');
    }

    // If slug is changing, verify uniqueness
    if (dto.slug && dto.slug !== existing.slug) {
      const slugExists = await this.gamesRepository.slugExistsExcluding(dto.slug, id);
      if (slugExists) {
        throw new ConflictException(`A game with slug "${dto.slug}" already exists`);
      }
    }

    return this.gamesRepository.update(id, dto);
  }

  /**
   * Update game status (publish/unpublish/archive).
   */
  async updateGameStatus(id: string, status: string): Promise<any> {
    const existing = await this.gamesRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Game not found');
    }

    return this.gamesRepository.updateStatus(id, status);
  }

  /**
   * Add CDN base URL prefix to asset URLs for low-latency delivery.
   * Only modifies relative paths; absolute URLs are returned as-is.
   *
   * Requirement 3.5: serve game assets through CDN
   */
  addCdnPrefix(url: string | null | undefined): string {
    if (!url) return '';
    // Already absolute URL - return as-is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    // Prepend CDN base URL for relative paths
    return `${this.cdnBaseUrl}/${url.replace(/^\//, '')}`;
  }
}
