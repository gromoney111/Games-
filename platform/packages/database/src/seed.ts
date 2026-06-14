/**
 * Database Seed Script
 *
 * Seeds the database with initial data:
 * - Admin user account
 * - Game categories with sample games
 * - Default system configuration
 *
 * Run with: npx prisma db seed
 */

import { PrismaClient, UserRole, AccountStatus, GameCategory, GameStatus } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// Seed Data
// ============================================================================

const ADMIN_USER = {
  email: 'admin@gamingplatform.com',
  username: 'admin',
  // Pre-hashed password for "Admin@123!" using Argon2id
  // In production, this should be set via environment variable or manual setup
  passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$placeholder_salt$placeholder_hash',
  role: UserRole.ADMIN,
  status: AccountStatus.ACTIVE,
};

const SAMPLE_GAMES = [
  // Puzzle Games
  {
    slug: '2048',
    title: '2048',
    description: 'Slide numbered tiles on a grid to combine them and create a tile with the number 2048.',
    category: GameCategory.PUZZLE,
    tags: ['puzzle', 'numbers', 'strategy', 'brain'],
    status: GameStatus.PUBLISHED,
    config: { minPlayers: 1, maxPlayers: 1, sessionTimeout: 3600, maxScore: 999999 },
    seoMetadata: { metaTitle: '2048 - Number Puzzle Game', metaDescription: 'Play 2048 online. Slide tiles to combine numbers and reach the 2048 tile.' },
  },
  {
    slug: 'sudoku',
    title: 'Sudoku',
    description: 'Fill the 9x9 grid with numbers so that each row, column, and 3x3 box contains all digits from 1 to 9.',
    category: GameCategory.PUZZLE,
    tags: ['puzzle', 'numbers', 'logic', 'brain'],
    status: GameStatus.PUBLISHED,
    config: { minPlayers: 1, maxPlayers: 1, sessionTimeout: 7200, difficulties: ['easy', 'medium', 'hard', 'expert'] },
    seoMetadata: { metaTitle: 'Sudoku - Logic Puzzle Game', metaDescription: 'Play Sudoku online. Challenge your brain with number puzzles of varying difficulty.' },
  },
  {
    slug: 'block-puzzle',
    title: 'Block Puzzle',
    description: 'Drag and drop blocks to fill rows and columns. Clear lines to score points in this addictive puzzle game.',
    category: GameCategory.PUZZLE,
    tags: ['puzzle', 'blocks', 'casual', 'tetris-style'],
    status: GameStatus.PUBLISHED,
    config: { minPlayers: 1, maxPlayers: 1, sessionTimeout: 3600 },
    seoMetadata: { metaTitle: 'Block Puzzle - Casual Puzzle Game', metaDescription: 'Play Block Puzzle online. Drag and drop blocks to clear lines and score points.' },
  },
  {
    slug: 'water-sort-puzzle',
    title: 'Water Sort Puzzle',
    description: 'Sort colored water between bottles until each bottle contains only one color.',
    category: GameCategory.PUZZLE,
    tags: ['puzzle', 'colors', 'sorting', 'relaxing'],
    status: GameStatus.PUBLISHED,
    config: { minPlayers: 1, maxPlayers: 1, sessionTimeout: 3600, levels: 100 },
    seoMetadata: { metaTitle: 'Water Sort Puzzle - Color Sorting Game', metaDescription: 'Play Water Sort Puzzle. Sort colored water between bottles in this relaxing puzzle game.' },
  },
  {
    slug: 'word-search',
    title: 'Word Search',
    description: 'Find hidden words in a grid of letters. Words can be placed horizontally, vertically, or diagonally.',
    category: GameCategory.PUZZLE,
    tags: ['puzzle', 'words', 'educational', 'brain'],
    status: GameStatus.PUBLISHED,
    config: { minPlayers: 1, maxPlayers: 1, sessionTimeout: 1800 },
    seoMetadata: { metaTitle: 'Word Search - Find Hidden Words', metaDescription: 'Play Word Search online. Find hidden words in a grid of letters.' },
  },
  {
    slug: 'crossword-puzzle',
    title: 'Crossword Puzzle',
    description: 'Solve crossword puzzles by filling in words based on clues. Test your vocabulary and knowledge.',
    category: GameCategory.PUZZLE,
    tags: ['puzzle', 'words', 'educational', 'vocabulary'],
    status: GameStatus.PUBLISHED,
    config: { minPlayers: 1, maxPlayers: 1, sessionTimeout: 7200 },
    seoMetadata: { metaTitle: 'Crossword Puzzle - Word Game', metaDescription: 'Play Crossword Puzzle online. Solve word puzzles and expand your vocabulary.' },
  },
  // Casual Games
  {
    slug: 'bubble-shooter',
    title: 'Bubble Shooter',
    description: 'Shoot colored bubbles to match groups of three or more. Clear the board to advance through levels.',
    category: GameCategory.CASUAL,
    tags: ['casual', 'bubble', 'colors', 'relaxing'],
    status: GameStatus.PUBLISHED,
    config: { minPlayers: 1, maxPlayers: 1, sessionTimeout: 3600 },
    seoMetadata: { metaTitle: 'Bubble Shooter - Casual Shooting Game', metaDescription: 'Play Bubble Shooter online. Match and pop colorful bubbles in this classic casual game.' },
  },
  {
    slug: 'color-sort',
    title: 'Color Sort',
    description: 'Sort colored balls into tubes so each tube contains balls of only one color.',
    category: GameCategory.CASUAL,
    tags: ['casual', 'colors', 'sorting', 'puzzle'],
    status: GameStatus.PUBLISHED,
    config: { minPlayers: 1, maxPlayers: 1, sessionTimeout: 3600 },
    seoMetadata: { metaTitle: 'Color Sort - Ball Sorting Game', metaDescription: 'Play Color Sort online. Sort colored balls into matching tubes.' },
  },
  {
    slug: 'memory-cards',
    title: 'Memory Cards',
    description: 'Flip cards to find matching pairs. Test your memory with increasing difficulty levels.',
    category: GameCategory.CASUAL,
    tags: ['casual', 'memory', 'brain', 'cards'],
    status: GameStatus.PUBLISHED,
    config: { minPlayers: 1, maxPlayers: 1, sessionTimeout: 1800 },
    seoMetadata: { metaTitle: 'Memory Cards - Memory Matching Game', metaDescription: 'Play Memory Cards online. Test your memory by finding matching card pairs.' },
  },
  // Arcade Games
  {
    slug: 'endless-runner',
    title: 'Endless Runner',
    description: 'Run as far as you can while dodging obstacles. Collect coins and power-ups to boost your score.',
    category: GameCategory.ACTION,
    tags: ['arcade', 'running', 'action', 'fast-paced'],
    status: GameStatus.PUBLISHED,
    config: { minPlayers: 1, maxPlayers: 1, sessionTimeout: 1800 },
    seoMetadata: { metaTitle: 'Endless Runner - Arcade Running Game', metaDescription: 'Play Endless Runner online. Run, jump, and dodge obstacles in this fast-paced arcade game.' },
  },
  {
    slug: 'space-shooter',
    title: 'Space Shooter',
    description: 'Defend the galaxy from alien invaders. Shoot enemies, dodge bullets, and collect upgrades.',
    category: GameCategory.ACTION,
    tags: ['arcade', 'shooting', 'space', 'action'],
    status: GameStatus.PUBLISHED,
    config: { minPlayers: 1, maxPlayers: 1, sessionTimeout: 1800 },
    seoMetadata: { metaTitle: 'Space Shooter - Arcade Shooting Game', metaDescription: 'Play Space Shooter online. Defend the galaxy and destroy alien invaders.' },
  },
  {
    slug: 'flappy-bird',
    title: 'Flappy Bird',
    description: 'Tap to fly through gaps between pipes. Simple but challenging - how far can you go?',
    category: GameCategory.ACTION,
    tags: ['arcade', 'flying', 'casual', 'challenging'],
    status: GameStatus.PUBLISHED,
    config: { minPlayers: 1, maxPlayers: 1, sessionTimeout: 1800 },
    seoMetadata: { metaTitle: 'Flappy Bird - Tap to Fly Game', metaDescription: 'Play Flappy Bird online. Tap to fly through pipes in this addictive arcade game.' },
  },
  {
    slug: 'snake',
    title: 'Snake Game',
    description: 'Control a growing snake to eat food without hitting walls or your own tail.',
    category: GameCategory.ACTION,
    tags: ['arcade', 'classic', 'snake', 'retro'],
    status: GameStatus.PUBLISHED,
    config: { minPlayers: 1, maxPlayers: 1, sessionTimeout: 1800 },
    seoMetadata: { metaTitle: 'Snake Game - Classic Arcade Game', metaDescription: 'Play the classic Snake Game online. Eat food, grow longer, and avoid crashing.' },
  },
  // Strategy Games
  {
    slug: 'chess',
    title: 'Chess',
    description: 'Play chess against the computer or challenge friends. Multiple difficulty levels available.',
    category: GameCategory.STRATEGY,
    tags: ['strategy', 'board', 'classic', 'competitive'],
    status: GameStatus.PUBLISHED,
    config: { minPlayers: 1, maxPlayers: 2, sessionTimeout: 7200 },
    seoMetadata: { metaTitle: 'Chess - Classic Strategy Board Game', metaDescription: 'Play Chess online. Challenge your strategic thinking against AI or other players.' },
  },
  {
    slug: 'checkers',
    title: 'Checkers',
    description: 'Classic board game of strategy. Jump over opponents pieces to capture them and reach the other side.',
    category: GameCategory.STRATEGY,
    tags: ['strategy', 'board', 'classic', 'competitive'],
    status: GameStatus.PUBLISHED,
    config: { minPlayers: 1, maxPlayers: 2, sessionTimeout: 3600 },
    seoMetadata: { metaTitle: 'Checkers - Classic Board Game', metaDescription: 'Play Checkers online. Jump and capture in this classic strategy board game.' },
  },
  {
    slug: 'tic-tac-toe',
    title: 'Tic Tac Toe',
    description: 'Classic X and O game. Play against AI with varying difficulty or challenge a friend.',
    category: GameCategory.STRATEGY,
    tags: ['strategy', 'board', 'classic', 'quick'],
    status: GameStatus.PUBLISHED,
    config: { minPlayers: 1, maxPlayers: 2, sessionTimeout: 600 },
    seoMetadata: { metaTitle: 'Tic Tac Toe - Classic X and O Game', metaDescription: 'Play Tic Tac Toe online. The classic game of X and O with AI opponents.' },
  },
  // Educational Games
  {
    slug: 'math-challenge',
    title: 'Math Challenge',
    description: 'Solve math problems against the clock. Improve your arithmetic speed with addition, subtraction, multiplication, and division.',
    category: GameCategory.EDUCATIONAL,
    tags: ['educational', 'math', 'brain', 'quiz'],
    status: GameStatus.PUBLISHED,
    config: { minPlayers: 1, maxPlayers: 1, sessionTimeout: 1800 },
    seoMetadata: { metaTitle: 'Math Challenge - Educational Math Game', metaDescription: 'Play Math Challenge online. Solve math problems and improve your arithmetic skills.' },
  },
  {
    slug: 'quiz-master',
    title: 'Quiz Master',
    description: 'Test your general knowledge across various categories. Multiple choice questions with increasing difficulty.',
    category: GameCategory.EDUCATIONAL,
    tags: ['educational', 'quiz', 'trivia', 'knowledge'],
    status: GameStatus.PUBLISHED,
    config: { minPlayers: 1, maxPlayers: 1, sessionTimeout: 3600 },
    seoMetadata: { metaTitle: 'Quiz Master - Trivia Quiz Game', metaDescription: 'Play Quiz Master online. Test your knowledge with trivia questions across many categories.' },
  },
  // More Puzzle Games
  {
    slug: 'sliding-puzzle',
    title: 'Sliding Puzzle',
    description: 'Rearrange scrambled tiles by sliding them into the correct order. A classic brain teaser.',
    category: GameCategory.PUZZLE,
    tags: ['puzzle', 'sliding', 'brain', 'classic'],
    status: GameStatus.PUBLISHED,
    config: { minPlayers: 1, maxPlayers: 1, sessionTimeout: 3600 },
    seoMetadata: { metaTitle: 'Sliding Puzzle - Classic Brain Teaser', metaDescription: 'Play Sliding Puzzle online. Rearrange scrambled tiles in this classic brain teaser.' },
  },
  {
    slug: 'match-3-puzzle',
    title: 'Match 3 Puzzle',
    description: 'Swap adjacent gems to create matches of three or more. Clear the board and score big combos.',
    category: GameCategory.PUZZLE,
    tags: ['puzzle', 'matching', 'gems', 'casual'],
    status: GameStatus.PUBLISHED,
    config: { minPlayers: 1, maxPlayers: 1, sessionTimeout: 3600 },
    seoMetadata: { metaTitle: 'Match 3 Puzzle - Gem Matching Game', metaDescription: 'Play Match 3 Puzzle online. Swap gems to create matches and score combos.' },
  },
  // Card Games
  {
    slug: 'solitaire',
    title: 'Solitaire',
    description: 'Classic Klondike Solitaire. Arrange all cards into foundation piles by suit from Ace to King.',
    category: GameCategory.CASUAL,
    tags: ['cards', 'classic', 'solitaire', 'relaxing'],
    status: GameStatus.PUBLISHED,
    config: { minPlayers: 1, maxPlayers: 1, sessionTimeout: 7200 },
    seoMetadata: { metaTitle: 'Solitaire - Classic Card Game', metaDescription: 'Play Solitaire online. The classic Klondike card game, free to play.' },
  },
  // More Arcade Games
  {
    slug: 'breakout',
    title: 'Breakout',
    description: 'Break all the bricks by bouncing a ball off a paddle. Classic arcade action with power-ups.',
    category: GameCategory.ACTION,
    tags: ['arcade', 'classic', 'bricks', 'retro'],
    status: GameStatus.PUBLISHED,
    config: { minPlayers: 1, maxPlayers: 1, sessionTimeout: 1800 },
    seoMetadata: { metaTitle: 'Breakout - Brick Breaking Arcade Game', metaDescription: 'Play Breakout online. Break bricks with a bouncing ball in this classic arcade game.' },
  },
  {
    slug: 'whack-a-mole',
    title: 'Whack-a-Mole',
    description: 'Whack the moles as they pop out of their holes. Quick reflexes required for high scores!',
    category: GameCategory.ACTION,
    tags: ['arcade', 'reflexes', 'fun', 'quick'],
    status: GameStatus.PUBLISHED,
    config: { minPlayers: 1, maxPlayers: 1, sessionTimeout: 600 },
    seoMetadata: { metaTitle: 'Whack-a-Mole - Reflex Arcade Game', metaDescription: 'Play Whack-a-Mole online. Test your reflexes by whacking moles as they appear.' },
  },
  {
    slug: 'tetris',
    title: 'Tetris',
    description: 'Arrange falling blocks to complete horizontal lines. A timeless classic puzzle arcade game.',
    category: GameCategory.PUZZLE,
    tags: ['puzzle', 'blocks', 'classic', 'arcade'],
    status: GameStatus.PUBLISHED,
    config: { minPlayers: 1, maxPlayers: 1, sessionTimeout: 3600 },
    seoMetadata: { metaTitle: 'Tetris - Classic Block Puzzle Game', metaDescription: 'Play Tetris online. Arrange falling blocks to clear lines in this timeless classic.' },
  },
  {
    slug: 'word-scramble',
    title: 'Word Scramble',
    description: 'Unscramble the letters to form words. Multiple difficulty levels and categories available.',
    category: GameCategory.EDUCATIONAL,
    tags: ['educational', 'words', 'vocabulary', 'brain'],
    status: GameStatus.PUBLISHED,
    config: { minPlayers: 1, maxPlayers: 1, sessionTimeout: 1800 },
    seoMetadata: { metaTitle: 'Word Scramble - Word Puzzle Game', metaDescription: 'Play Word Scramble online. Unscramble letters to form words and expand your vocabulary.' },
  },
];

// ============================================================================
// Seed Function
// ============================================================================

async function main() {
  console.log('🌱 Starting database seed...\n');

  // Create admin user
  console.log('👤 Creating admin user...');
  const adminUser = await prisma.user.upsert({
    where: { email: ADMIN_USER.email },
    update: {},
    create: {
      ...ADMIN_USER,
      profile: {
        create: {
          displayName: 'Platform Admin',
          preferredLanguage: 'en',
          notificationPrefs: { email: true, push: true, sms: false },
          privacySettings: { profilePublic: false, showOnlineStatus: false },
        },
      },
    },
  });
  console.log(`  ✅ Admin user created: ${adminUser.email} (${adminUser.id})`);

  // Create sample games
  console.log('\n🎮 Creating sample games...');
  for (const gameData of SAMPLE_GAMES) {
    const game = await prisma.game.upsert({
      where: { slug: gameData.slug },
      update: {},
      create: {
        slug: gameData.slug,
        title: gameData.title,
        description: gameData.description,
        category: gameData.category,
        tags: gameData.tags,
        status: gameData.status,
        config: gameData.config as object,
        seoMetadata: gameData.seoMetadata as object,
        monetizationConfig: { adsEnabled: true, inAppPurchases: false },
      },
    });
    console.log(`  ✅ Game created: ${game.title} (${game.slug})`);
  }

  console.log(`\n✨ Seed complete! Created 1 admin user and ${SAMPLE_GAMES.length} games.`);
}

// ============================================================================
// Execute
// ============================================================================

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
