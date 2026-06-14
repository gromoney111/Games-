/**
 * Games Controller Unit Tests
 *
 * Tests for game catalog endpoints including:
 * - GET /games with pagination and filters
 * - GET /games/:slug with CDN caching headers
 * - POST /admin/games with validation
 *
 * Requirements tested: 3.1, 3.2, 3.5
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';
import { GameCategory } from './dto/list-games.dto';

describe('GamesController', () => {
  let controller: GamesController;
  let service: jest.Mocked<GamesService>;

  const mockPagedResult = {
    items: [
      {
        id: 'game-1',
        slug: 'bubble-shooter',
        title: 'Bubble Shooter',
        description: 'A fun game',
        category: 'casual',
        tags: ['casual'],
        thumbnailUrl: 'https://cdn.gaming-platform.com/thumb.png',
        config: {},
        seoMetadata: {},
        status: 'PUBLISHED',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  };

  const mockGameDetail = {
    id: 'game-1',
    slug: 'bubble-shooter',
    title: 'Bubble Shooter',
    description: 'A fun bubble shooting game',
    category: 'casual',
    tags: ['casual', 'arcade'],
    thumbnailUrl: 'https://cdn.gaming-platform.com/thumb.png',
    config: { maxPlayers: 1 },
    seoMetadata: {
      metaTitle: 'Bubble Shooter | Gaming Platform',
      metaDescription: 'Play Bubble Shooter online',
      keywords: ['bubble', 'shooter'],
    },
    status: 'PUBLISHED',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GamesController],
      providers: [
        {
          provide: GamesService,
          useValue: {
            listGames: jest.fn(),
            getGameBySlug: jest.fn(),
            createGame: jest.fn(),
            updateGame: jest.fn(),
            updateGameStatus: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<GamesController>(GamesController);
    service = module.get(GamesService) as jest.Mocked<GamesService>;
  });

  describe('GET /games (listGames)', () => {
    it('should return paginated game list with default parameters', async () => {
      service.listGames.mockResolvedValue(mockPagedResult);

      const result = await controller.listGames({});

      expect(service.listGames).toHaveBeenCalledWith({});
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should pass category filter to service', async () => {
      service.listGames.mockResolvedValue({ ...mockPagedResult, items: [] });

      await controller.listGames({ category: GameCategory.PUZZLE });

      expect(service.listGames).toHaveBeenCalledWith(
        expect.objectContaining({ category: GameCategory.PUZZLE }),
      );
    });

    it('should pass search parameter to service', async () => {
      service.listGames.mockResolvedValue({ ...mockPagedResult, items: [] });

      await controller.listGames({ search: 'shooter' });

      expect(service.listGames).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'shooter' }),
      );
    });

    it('should pass pagination parameters to service', async () => {
      service.listGames.mockResolvedValue({ ...mockPagedResult, items: [] });

      await controller.listGames({ page: 3, limit: 50 });

      expect(service.listGames).toHaveBeenCalledWith(
        expect.objectContaining({ page: 3, limit: 50 }),
      );
    });
  });

  describe('GET /games/:slug (getGameBySlug)', () => {
    it('should return game detail for valid slug', async () => {
      service.getGameBySlug.mockResolvedValue(mockGameDetail);
      const mockRes = {
        setHeader: jest.fn(),
      } as unknown as any;

      const result = await controller.getGameBySlug('bubble-shooter', mockRes);

      expect(service.getGameBySlug).toHaveBeenCalledWith('bubble-shooter');
      expect(result.slug).toBe('bubble-shooter');
      expect(result.seoMetadata).toBeDefined();
    });

    it('should set Cache-Control headers for CDN caching (Requirement 3.5)', async () => {
      service.getGameBySlug.mockResolvedValue(mockGameDetail);
      const mockRes = {
        setHeader: jest.fn(),
      } as unknown as any;

      await controller.getGameBySlug('bubble-shooter', mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'public, max-age=300, s-maxage=600',
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith('Vary', 'Accept-Encoding');
    });

    it('should propagate NotFoundException for unknown slug', async () => {
      service.getGameBySlug.mockRejectedValue(
        new NotFoundException('Game not found'),
      );
      const mockRes = {
        setHeader: jest.fn(),
      } as unknown as any;

      await expect(
        controller.getGameBySlug('non-existent', mockRes),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('POST /admin/games (createGame)', () => {
    it('should create a game with valid data', async () => {
      const newGame = { ...mockGameDetail, status: 'DRAFT' };
      service.createGame.mockResolvedValue(newGame);

      const result = await controller.createGame({
        title: 'Bubble Shooter',
        description: 'A fun bubble shooting game',
        slug: 'bubble-shooter',
        category: GameCategory.CASUAL,
        tags: ['casual', 'arcade'],
      });

      expect(service.createGame).toHaveBeenCalled();
      expect(result.status).toBe('DRAFT');
    });
  });

  describe('PUT /admin/games/:id (updateGame)', () => {
    it('should update game with partial data', async () => {
      service.updateGame.mockResolvedValue({ ...mockGameDetail, title: 'Updated' });

      const result = await controller.updateGame('game-1', { title: 'Updated' });

      expect(service.updateGame).toHaveBeenCalledWith('game-1', { title: 'Updated' });
      expect(result.title).toBe('Updated');
    });
  });

  describe('PATCH /admin/games/:id/status (updateGameStatus)', () => {
    it('should update game status', async () => {
      service.updateGameStatus.mockResolvedValue({ ...mockGameDetail, status: 'ARCHIVED' });

      const result = await controller.updateGameStatus('game-1', 'ARCHIVED');

      expect(service.updateGameStatus).toHaveBeenCalledWith('game-1', 'ARCHIVED');
      expect(result.status).toBe('ARCHIVED');
    });
  });
});
