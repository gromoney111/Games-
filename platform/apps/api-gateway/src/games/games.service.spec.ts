/**
 * Games Service Unit Tests
 *
 * Tests for game catalog filtering, pagination, slug lookup, CDN prefixing,
 * and slug uniqueness validation.
 *
 * Requirements tested: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { GamesService } from './games.service';
import { GamesRepository } from './games.repository';
import { GameCategory } from './dto/list-games.dto';

describe('GamesService', () => {
  let service: GamesService;
  let repository: jest.Mocked<GamesRepository>;
  let configService: jest.Mocked<ConfigService>;

  const mockGame = {
    id: 'game-1',
    slug: 'bubble-shooter',
    title: 'Bubble Shooter',
    description: 'A fun bubble shooting game',
    category: 'casual',
    tags: ['casual', 'arcade'],
    thumbnailUrl: 'games/bubble-shooter/thumb.png',
    config: { maxPlayers: 1 },
    seoMetadata: {
      metaTitle: 'Bubble Shooter | Gaming Platform',
      metaDescription: 'Play Bubble Shooter online',
      keywords: ['bubble', 'shooter'],
    },
    status: 'PUBLISHED',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamesService,
        {
          provide: GamesRepository,
          useValue: {
            findMany: jest.fn(),
            findBySlug: jest.fn(),
            findById: jest.fn(),
            slugExists: jest.fn(),
            slugExistsExcluding: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            updateStatus: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('https://cdn.gaming-platform.com'),
          },
        },
      ],
    }).compile();

    service = module.get<GamesService>(GamesService);
    repository = module.get(GamesRepository) as jest.Mocked<GamesRepository>;
    configService = module.get(ConfigService) as jest.Mocked<ConfigService>;
  });

  describe('listGames', () => {
    it('should return paginated published games with defaults (page 1, limit 20)', async () => {
      const games = [mockGame];
      repository.findMany.mockResolvedValue([games, 1]);

      const result = await service.listGames({});

      expect(repository.findMany).toHaveBeenCalledWith(
        { status: 'PUBLISHED' },
        0,
        20,
      );
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
      expect(result.hasNextPage).toBe(false);
      expect(result.hasPreviousPage).toBe(false);
    });

    it('should filter by category', async () => {
      repository.findMany.mockResolvedValue([[], 0]);

      await service.listGames({ category: GameCategory.PUZZLE });

      expect(repository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'PUBLISHED', category: 'puzzle' }),
        0,
        20,
      );
    });

    it('should filter by comma-separated tags', async () => {
      repository.findMany.mockResolvedValue([[], 0]);

      await service.listGames({ tags: 'arcade, puzzle, strategy' });

      expect(repository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'PUBLISHED',
          tags: { hasSome: ['arcade', 'puzzle', 'strategy'] },
        }),
        0,
        20,
      );
    });

    it('should apply search to title and description', async () => {
      repository.findMany.mockResolvedValue([[], 0]);

      await service.listGames({ search: 'bubble' });

      expect(repository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'PUBLISHED',
          OR: [
            { title: { contains: 'bubble', mode: 'insensitive' } },
            { description: { contains: 'bubble', mode: 'insensitive' } },
          ],
        }),
        0,
        20,
      );
    });

    it('should calculate pagination correctly', async () => {
      repository.findMany.mockResolvedValue([[], 55]);

      const result = await service.listGames({ page: 2, limit: 20 });

      expect(repository.findMany).toHaveBeenCalledWith(
        { status: 'PUBLISHED' },
        20, // skip = (2-1) * 20
        20,
      );
      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(3);
      expect(result.hasNextPage).toBe(true);
      expect(result.hasPreviousPage).toBe(true);
    });

    it('should add CDN prefix to thumbnail URLs', async () => {
      repository.findMany.mockResolvedValue([[mockGame], 1]);

      const result = await service.listGames({});

      expect(result.items[0].thumbnailUrl).toBe(
        'https://cdn.gaming-platform.com/games/bubble-shooter/thumb.png',
      );
    });

    it('should ignore empty tag strings', async () => {
      repository.findMany.mockResolvedValue([[], 0]);

      await service.listGames({ tags: ',,,' });

      expect(repository.findMany).toHaveBeenCalledWith(
        { status: 'PUBLISHED' },
        0,
        20,
      );
    });
  });

  describe('getGameBySlug', () => {
    it('should return game detail with CDN-prefixed assets', async () => {
      repository.findBySlug.mockResolvedValue(mockGame);

      const result = await service.getGameBySlug('bubble-shooter');

      expect(repository.findBySlug).toHaveBeenCalledWith('bubble-shooter', 'PUBLISHED');
      expect(result.slug).toBe('bubble-shooter');
      expect(result.thumbnailUrl).toBe(
        'https://cdn.gaming-platform.com/games/bubble-shooter/thumb.png',
      );
      expect(result.seoMetadata).toBeDefined();
    });

    it('should throw NotFoundException for non-existent slug', async () => {
      repository.findBySlug.mockResolvedValue(null);

      await expect(service.getGameBySlug('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should not distinguish between unpublished and non-existent (Requirement 3.2)', async () => {
      // Both cases return null from repository (filtered by PUBLISHED status)
      repository.findBySlug.mockResolvedValue(null);

      await expect(service.getGameBySlug('draft-game')).rejects.toThrow(
        'Game not found',
      );
    });
  });

  describe('createGame', () => {
    it('should create a game with valid data', async () => {
      repository.slugExists.mockResolvedValue(false);
      repository.create.mockResolvedValue({ ...mockGame, status: 'DRAFT' });

      const result = await service.createGame({
        title: 'Bubble Shooter',
        description: 'A fun bubble shooting game',
        slug: 'bubble-shooter',
        category: GameCategory.CASUAL,
        tags: ['casual', 'arcade'],
      });

      expect(repository.slugExists).toHaveBeenCalledWith('bubble-shooter');
      expect(repository.create).toHaveBeenCalled();
      expect(result.status).toBe('DRAFT');
    });

    it('should reject duplicate slug (Requirement 3.3)', async () => {
      repository.slugExists.mockResolvedValue(true);

      await expect(
        service.createGame({
          title: 'New Game',
          description: 'Description',
          slug: 'bubble-shooter',
          category: GameCategory.CASUAL,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateGame', () => {
    it('should update an existing game', async () => {
      repository.findById.mockResolvedValue(mockGame);
      repository.update.mockResolvedValue({ ...mockGame, title: 'Updated Title' });

      const result = await service.updateGame('game-1', { title: 'Updated Title' });

      expect(result.title).toBe('Updated Title');
    });

    it('should reject slug change if new slug already exists', async () => {
      repository.findById.mockResolvedValue(mockGame);
      repository.slugExistsExcluding.mockResolvedValue(true);

      await expect(
        service.updateGame('game-1', { slug: 'taken-slug' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException for non-existent game', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.updateGame('bad-id', { title: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('addCdnPrefix', () => {
    it('should prepend CDN URL to relative paths', () => {
      expect(service.addCdnPrefix('games/thumb.png')).toBe(
        'https://cdn.gaming-platform.com/games/thumb.png',
      );
    });

    it('should not modify absolute http URLs', () => {
      expect(service.addCdnPrefix('http://example.com/img.png')).toBe(
        'http://example.com/img.png',
      );
    });

    it('should not modify absolute https URLs', () => {
      expect(service.addCdnPrefix('https://example.com/img.png')).toBe(
        'https://example.com/img.png',
      );
    });

    it('should handle leading slash in relative paths', () => {
      expect(service.addCdnPrefix('/games/thumb.png')).toBe(
        'https://cdn.gaming-platform.com/games/thumb.png',
      );
    });

    it('should return empty string for null/undefined', () => {
      expect(service.addCdnPrefix(null)).toBe('');
      expect(service.addCdnPrefix(undefined)).toBe('');
      expect(service.addCdnPrefix('')).toBe('');
    });
  });

  describe('updateGameStatus', () => {
    it('should update game status for existing game', async () => {
      repository.findById.mockResolvedValue(mockGame);
      repository.updateStatus.mockResolvedValue({ ...mockGame, status: 'ARCHIVED' });

      const result = await service.updateGameStatus('game-1', 'ARCHIVED');
      expect(result.status).toBe('ARCHIVED');
    });

    it('should throw NotFoundException for non-existent game', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.updateGameStatus('bad-id', 'PUBLISHED'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
