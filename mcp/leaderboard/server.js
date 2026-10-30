// Flappy Kiro leaderboard MCP server (stdio). Persists to a JSON file:
// LEADERBOARD_FILE if set, otherwise data/leaderboard.json in the project.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createMcpServer } from '../lib/stdio-server.js';
import * as lb from './leaderboard.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DEFAULT_FILE = path.join(ROOT, 'data', 'leaderboard.json');

// File-backed store. A missing file is an empty board; a corrupt file is an error, never silently replaced.
export function createFileStore(file) {
  function load() {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch (e) {
      if (e.code === 'ENOENT') return lb.emptyData();
      throw e;
    }
    const data = JSON.parse(text);
    if (!data || data.version !== 1 || typeof data.players !== 'object') {
      throw new Error('unrecognised leaderboard file: ' + file);
    }
    return data;
  }
  // Write to a temp file then rename, so a crash mid-write can't corrupt the board.
  function save(data) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
    fs.renameSync(tmp, file);
  }
  return { load, save };
}

export function createLeaderboardServer({ store, now = () => new Date().toISOString() }) {
  const tools = [
    {
      name: 'submit_score',
      description: 'Record a finished Flappy Kiro run. Updates the player\'s best score, rank and achievements.',
      inputSchema: {
        type: 'object',
        properties: {
          player: { type: 'string', description: '1-20 characters: letters, digits, spaces, _ or -' },
          score: { type: 'integer', minimum: 0, maximum: lb.MAX_SCORE },
        },
        required: ['player', 'score'],
        additionalProperties: false,
      },
      handler: ({ player, score }) => {
        const { data, result } = lb.submitScore(store.load(), player, score, now());
        store.save(data);
        return result;
      },
    },
    {
      name: 'get_leaderboard',
      description: 'Top players ranked by best score (ties share a rank; earlier best wins the order).',
      inputSchema: {
        type: 'object',
        properties: { limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 } },
        additionalProperties: false,
      },
      handler: ({ limit = 10 }) => lb.getLeaderboard(store.load(), limit),
    },
    {
      name: 'get_player',
      description: 'One player\'s rank, best and total score, run count and achievement progress.',
      inputSchema: {
        type: 'object',
        properties: { player: { type: 'string' } },
        required: ['player'],
        additionalProperties: false,
      },
      handler: ({ player }) => lb.getPlayer(store.load(), player),
    },
    {
      name: 'list_achievements',
      description: 'All achievements with how many players have unlocked each.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      handler: () => lb.listAchievements(store.load()),
    },
  ];
  return createMcpServer({ name: 'flappy-kiro-leaderboard', version: '1.0.0', tools });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.env.LEADERBOARD_FILE ? path.resolve(process.env.LEADERBOARD_FILE) : DEFAULT_FILE;
  createLeaderboardServer({ store: createFileStore(file) }).listen();
  process.stderr.write('flappy-kiro-leaderboard: using ' + file + '\n');
}
