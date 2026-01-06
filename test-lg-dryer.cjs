// Test script to check LG ThinQ dryer status
require('dotenv/config');
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

// JSON-RPC request to get device list
const getDeviceListRequest = {
  jsonrpc: "2.0",
  id: 2,
  method: "tools/call",
  params: {
    name: "get_device_list",
    arguments: {}
  }
};

// JSON-RPC request to get dryer status
const getDryerStatusRequest = {
  jsonrpc: "2.0",
  id: 3,
  method: "tools/call",
  params: {
    name: "get_device_status",
    arguments: {
      device_id: "930ce551cecf46404810aed03560471f42cb50ab86af8378e209aab1d2a4b9a1"
    }
  }
};

// JSON-RPC request to get washer status
const getWasherStatusRequest = {
  jsonrpc: "2.0",
  id: 4,
  method: "tools/call",
  params: {
    name: "get_device_status",
    arguments: {
      device_id: "211e423487fc7b59e4b2aa8eecd763f09365f92db4137992496a776f17cb5112"
    }
  }
};

async function testMCPServer() {
  const server = spawn('./lg-thinq-mcp-wrapper.sh', [], {
    stdio: ['pipe', 'pipe', 'inherit'],
    env: {
      ...process.env,
      THINQ_PAT: process.env.THINQ_PAT,
      THINQ_COUNTRY: process.env.THINQ_COUNTRY || 'US'
    }
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
  console.log('Initializing MCP server...');
  server.stdin.write(JSON.stringify(initializeRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Send requests
  console.log('\nSending list tools request...');
  server.stdin.write(JSON.stringify(listToolsRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\nSending get device list request...');
  server.stdin.write(JSON.stringify(getDeviceListRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\nSending get dryer status request...');
  server.stdin.write(JSON.stringify(getDryerStatusRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\nSending get washer status request...');
  server.stdin.write(JSON.stringify(getWasherStatusRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Close the server
  server.kill();
}

testMCPServer().catch(console.error);
