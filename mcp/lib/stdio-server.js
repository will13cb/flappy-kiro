// Minimal MCP server over stdio: newline-delimited JSON-RPC 2.0, tools only.
// Shared by the project's local MCP servers so none of them need an SDK dependency.
import readline from 'node:readline';

const PROTOCOL_VERSION = '2024-11-05';

// tools: [{ name, description, inputSchema, handler(args) }]. A handler returns any JSON value
// or throws; a thrown error is reported to the client as a tool error, not a protocol error.
export function createMcpServer({ name, version, tools }) {
  const byName = new Map(tools.map((t) => [t.name, t]));

  async function handle(msg) {
    const { id, method, params } = msg || {};
    const isRequest = id !== undefined && id !== null;
    const reply = (result) => ({ jsonrpc: '2.0', id, result });
    const fail = (code, message) => ({ jsonrpc: '2.0', id: isRequest ? id : null, error: { code, message } });

    if (!msg || msg.jsonrpc !== '2.0' || typeof method !== 'string') return fail(-32600, 'Invalid request');
    if (!isRequest) return null; // notifications (e.g. notifications/initialized) get no response

    switch (method) {
      case 'initialize':
        return reply({
          protocolVersion: (params && params.protocolVersion) || PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name, version },
        });
      case 'ping':
        return reply({});
      case 'tools/list':
        return reply({
          tools: tools.map(({ name: n, description, inputSchema }) => ({ name: n, description, inputSchema })),
        });
      case 'tools/call': {
        const tool = byName.get(params && params.name);
        if (!tool) return fail(-32602, 'Unknown tool: ' + (params && params.name));
        try {
          const result = await tool.handler((params && params.arguments) || {});
          return reply({ content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] });
        } catch (e) {
          return reply({ content: [{ type: 'text', text: 'Error: ' + (e && e.message ? e.message : String(e)) }], isError: true });
        }
      }
      default:
        return fail(-32601, 'Method not found: ' + method);
    }
  }

  // Reads requests from input, writes responses to output. Logs go to stderr only (stdout is the protocol).
  function listen(input = process.stdin, output = process.stdout) {
    const rl = readline.createInterface({ input, crlfDelay: Infinity });
    rl.on('line', async (line) => {
      if (!line.trim()) return;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        output.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) + '\n');
        return;
      }
      const res = await handle(msg);
      if (res) output.write(JSON.stringify(res) + '\n');
    });
    return rl;
  }

  return { handle, listen };
}
