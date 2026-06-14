/**
 * Games Repository
 *
 * Database access layer for game catalog operations via Prisma ORM.
 * Provides CRUD operations for games, with filtering, pagination, and slug lookups.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';

export interface GameWhereInput {
  status?: string;
  category?: string;
  tags?: { hasSome: string[] };
  OR?: Array<Record<string, any>>;
}

@Injectable()
export class GamesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find games matching filter criteria with pagination.
   * Returns a tuple of [items, total count].
   */
  async findMany(
    where: GameWhereInput,
    skip: number,
    take: number,
  ): Promise<[any[], number]> {
    const [items, total] = await Promise.all([
      this.prisma.game.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          category: true,
          tags: true,
          thumbnailUrl: true,
          config: true,
          seoMetadata: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.game.count({ where }),
    ]);
    return [items, total];
  }

  /**
   * Find a single game by its URL slug.
   * Only returns published games by default.
   */
  async findBySlug(slug: string, statusFilter?: string) {
    const where: any = { slug };
    if (statusFilter) {
      where.status = statusFilter;
    }
    return this.prisma.game.findFirst({ where });
  }

  /**
   * Find a game by ID.
   */
  async findById(id: string) {
    return this.prisma.game.findUnique({ where: { id } });
  }

  /**
   * Check if a slug is already in use.
   */
  async slugExists(slug: string): Promise<boolean> {
    const count = await this.prisma.game.count({ where: { slug } });
    return count > 0;
  }

  /**
   * Check if a slug is in use by a game other than the given ID.
   */
  async slugExistsExcluding(slug: string, excludeId: string): Promise<boolean> {
    const count = await this.prisma.game.count({
      where: { slug, NOT: { id: excludeId } },
    });
    return count > 0;
  }

  /**
   * Create a new game.
   */
  async create(data: CreateGameDto) {
    return this.prisma.game.create({
      data: {
        title: data.title,
        description: data.description,
        slug: data.slug,
        category: data.category,
        tags: data.tags || [],
        thumbnailUrl: data.thumbnailUrl || '',
        config: data.config || {},
        seoMetadata: data.seoMetadata || {},
        status: 'DRAFT',
      },
    });
  }

  /**
   * Update a game by ID.
   */
  async update(id: string, data: Partial<UpdateGameDto>) {
    return this.prisma.game.update({
      where: { id },
      data,
    });
  }

  /**
   * Update a game's status (publish/unpublish/archive).
   */
  async updateStatus(id: string, status: string) {
    return this.prisma.game.update({
      where: { id },
      data: { status },
    });
  }
}
