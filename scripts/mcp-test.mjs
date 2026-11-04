import { spawn } from 'node:child_process';

const child = spawn(process.execPath, ['dist/cli.js', '--root', 'fixtures/ts-web', 'mcp'], {
  stdio: ['pipe', 'pipe', 'pipe'],
});
let buffer = '';
const messages = [];
child.stdout.on('data', (chunk) => {
  buffer += chunk.toString();
  let index;
  while ((index = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) continue;
    try {
      messages.push(JSON.parse(line));
    } catch (err) {
      console.error('bad line', line, err.message);
    }
  }
});
child.stderr.on('data', (chunk) => console.error('stderr:', chunk.toString()));

const send = (obj) => child.stdin.write(`${JSON.stringify(obj)}\n`);
send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1' } } });
send({ jsonrpc: '2.0', method: 'notifications/initialized' });
send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'vibemap_context', arguments: { area: 'auth', budget: 400 } } });
send({ jsonrpc: '2.0', id: 4, method: 'resources/read', params: { uri: 'vibemap://maps/00-overview' } });
send({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'vibemap_check', arguments: {} } });

await new Promise((resolve) => setTimeout(resolve, 1800));
child.stdin.end();
await new Promise((resolve) => child.on('exit', resolve));
const summary = messages.map((m) => ({
  id: m.id,
  error: m.error,
  result: m.result ? {
    protocolVersion: m.result.protocolVersion,
    tools: m.result.tools?.length,
    text: m.result.content?.[0]?.text?.slice(0, 220),
    resources: m.result.contents?.length,
  } : undefined,
}));
console.log(JSON.stringify(summary, null, 2));
