// Test script to check HUUM Sauna MCP server
const { spawn } = require('child_process');

// JSON-RPC request to initialize
const initializeRequest = {
  jsonrpc: "2.0",
  id: 0,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "test-client",
      version: "1.0.0"
    }
  }
};

// JSON-RPC notification that initialization is complete
const initializedNotification = {
  jsonrpc: "2.0",
  method: "notifications/initialized"
};

// JSON-RPC request to list tools
const listToolsRequest = {
  jsonrpc: "2.0",
  id: 1,
  method: "tools/list"
};

// JSON-RPC request to get sauna status
const getSaunaStatusRequest = {
  jsonrpc: "2.0",
  id: 2,
  method: "tools/call",
  params: {
    name: "get_sauna_status",
    arguments: {}
  }
};

async function testMCPServer() {
  const server = spawn('./huum-mcp-wrapper.sh', [], {
    stdio: ['pipe', 'pipe', 'inherit'],
    env: process.env
  });

  let buffer = '';
  let initialized = false;

  server.stdout.on('data', (data) => {
    buffer += data.toString();

    // Process complete JSON-RPC responses
    const lines = buffer.split('\n');
    buffer = lines.pop(); // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.trim()) {
        try {
          const response = JSON.parse(line);
          console.log('Response:', JSON.stringify(response, null, 2));

          // Check if this is the initialization response
          if (response.id === 0 && response.result && !initialized) {
            initialized = true;
            console.log('\nSending initialized notification...');
            server.stdin.write(JSON.stringify(initializedNotification) + '\n');
          }
        } catch (e) {
          console.log('Raw output:', line);
        }
      }
    }
  });

  server.on('error', (error) => {
    console.error('Server error:', error);
  });

  server.on('close', (code) => {
    console.log('Server closed with code:', code);
    process.exit(code || 0);
  });

  // Give server time to start
  await new Promise(resolve => setTimeout(resolve, 500));

  // Initialize
  console.log('Initializing HUUM MCP server...');
  server.stdin.write(JSON.stringify(initializeRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Send requests
  console.log('\nSending list tools request...');
  server.stdin.write(JSON.stringify(listToolsRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\nSending get sauna status request...');
  server.stdin.write(JSON.stringify(getSaunaStatusRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Close the server
  server.kill();
}

testMCPServer().catch(console.error);
