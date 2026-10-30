// End-to-end: spawns the real MCP server over stdio with a throwaway data file inside the project.
import { describe, it, expect, afterAll } from 'vitest';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FILE = path.join(ROOT, 'tests', '.tmp-leaderboard-' + process.pid + '.json');

afterAll(() => fs.rmSync(FILE, { force: true }));

function startServer() {
  const child = spawn(process.execPath, [path.join(ROOT, 'mcp/leaderboard/server.js')], {
    env: { ...process.env, LEADERBOARD_FILE: FILE },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let buffer = '';
  const waiting = new Map();
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const msg = JSON.parse(buffer.slice(0, nl));
      buffer = buffer.slice(nl + 1);
      waiting.get(msg.id)?.(msg);
    }
  });
  let nextId = 1;
  const request = (method, params) =>
    new Promise((resolve) => {
      const id = nextId++;
      waiting.set(id, resolve);
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  const call = async (name, args) => {
    const res = await request('tools/call', { name, arguments: args });
    return { ...res.result, data: res.result.isError ? null : JSON.parse(res.result.content[0].text) };
  };
  return { child, request, call, notify: (method) => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method }) + '\n') };
}

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
