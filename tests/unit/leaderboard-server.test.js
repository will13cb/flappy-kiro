// End-to-end: spawns the real MCP server over stdio with a throwaway data file inside the project.
import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, startMcpServer } from '../helpers/mcp-client.js';

const FILE = path.join(ROOT, 'tests', '.tmp-leaderboard-' + process.pid + '.json');

afterAll(() => fs.rmSync(FILE, { force: true }));

const startServer = () => startMcpServer('mcp/leaderboard/server.js', { LEADERBOARD_FILE: FILE });

describe('leaderboard MCP server', () => {
  it('speaks MCP and persists scores across restarts', async () => {
    const a = startServer();
    const init = await a.request('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
    expect(init.result.serverInfo.name).toBe('flappy-kiro-leaderboard');
    expect(init.result.capabilities.tools).toBeDefined();
    a.notify('notifications/initialized');

    const list = await a.request('tools/list', {});
    expect(list.result.tools.map((t) => t.name)).toEqual(['submit_score', 'get_leaderboard', 'get_player', 'list_achievements']);

    const sub = await a.call('submit_score', { player: 'Ana', score: 12 });
    expect(sub.data).toMatchObject({ isNewBest: true, rank: 1 });
    const bad = await a.call('submit_score', { player: 'Ana', score: -3 });
    expect(bad.isError).toBe(true);
    expect(bad.content[0].text).toMatch(/score/);

    const unknown = await a.request('tools/call', { name: 'nope', arguments: {} });
    expect(unknown.error.code).toBe(-32602);
    const missing = await a.request('does/not/exist', {});
    expect(missing.error.code).toBe(-32601);
    a.child.kill();

    const b = startServer();
    await b.request('initialize', {});
    const board = await b.call('get_leaderboard', { limit: 5 });
    expect(board.data.entries).toEqual([{ rank: 1, player: 'Ana', bestScore: 12, runs: 1, achievements: 3 }]);
    b.child.kill();
  }, 20000);
});
