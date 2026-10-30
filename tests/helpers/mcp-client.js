// Spawns a project MCP server over stdio and talks JSON-RPC to it (newline-delimited).
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function startMcpServer(script, env = {}) {
  const child = spawn(process.execPath, [path.join(ROOT, script)], {
    env: { ...process.env, ...env },
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
  // Tool call: returns the result plus `data`, the parsed JSON text (null for tool errors).
  const call = async (name, args) => {
    const res = await request('tools/call', { name, arguments: args });
    return { ...res.result, data: res.result.isError ? null : JSON.parse(res.result.content[0].text) };
  };
  const notify = (method) => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method }) + '\n');
  return { child, request, call, notify, stop: () => child.kill() };
}
