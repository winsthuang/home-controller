// Test script for the Rachio Sprinkler Controller MCP server
const { spawn } = require('child_process');
const path = require('path');

const SCRIPT_DIR = __dirname;

const initializeRequest = {
  jsonrpc: '2.0',
  id: 0,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test-client', version: '1.0.0' },
  },
};

const initializedNotification = {
  jsonrpc: '2.0',
  method: 'notifications/initialized',
};

const listToolsRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/list',
};

const getDevicesRequest = {
  jsonrpc: '2.0',
  id: 2,
  method: 'tools/call',
  params: { name: 'get_devices', arguments: {} },
};

async function testMCPServer() {
  console.log('Starting Rachio MCP Server test...\n');

  const server = spawn(path.join(SCRIPT_DIR, 'rachio-mcp-wrapper.sh'), [], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: SCRIPT_DIR,
  });

  let buffer = '';
  let initialized = false;

  server.stdout.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const response = JSON.parse(line);
        console.log('Response:', JSON.stringify(response, null, 2));

        if (response.id === 0 && response.result && !initialized) {
          initialized = true;
          console.log('\nSending initialized notification...');
          server.stdin.write(JSON.stringify(initializedNotification) + '\n');
        }
      } catch (e) {
        console.log('Raw output:', line);
      }
    }
  });

  server.stderr.on('data', (data) => {
    console.log('Server log:', data.toString().trim());
  });

  server.on('error', (error) => console.error('Server error:', error));
  server.on('close', (code) => {
    console.log('\nServer closed with code:', code);
    process.exit(code || 0);
  });

  await new Promise((r) => setTimeout(r, 500));

  console.log('Initializing MCP server...');
  server.stdin.write(JSON.stringify(initializeRequest) + '\n');
  await new Promise((r) => setTimeout(r, 1500));

  console.log('\nSending list tools request...');
  server.stdin.write(JSON.stringify(listToolsRequest) + '\n');
  await new Promise((r) => setTimeout(r, 1000));

  console.log('\nSending get_devices request...');
  server.stdin.write(JSON.stringify(getDevicesRequest) + '\n');
  await new Promise((r) => setTimeout(r, 5000));

  console.log('\nTest complete. Closing server...');
  server.kill();
}

testMCPServer().catch(console.error);
