// Test script to check Phyn Water Monitor MCP server
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

// JSON-RPC request to get all devices
const getDevicesRequest = {
  jsonrpc: "2.0",
  id: 2,
  method: "tools/call",
  params: {
    name: "get_devices",
    arguments: {}
  }
};

// JSON-RPC request to get device status (Phyn Plus)
const getDeviceStatusRequest = {
  jsonrpc: "2.0",
  id: 3,
  method: "tools/call",
  params: {
    name: "get_device_status",
    arguments: {
      device_id: "28F53743B8D8"  // Phyn Plus
    }
  }
};

// JSON-RPC request to get consumption
const getConsumptionRequest = {
  jsonrpc: "2.0",
  id: 4,
  method: "tools/call",
  params: {
    name: "get_consumption",
    arguments: {
      device_id: "28F53743B8D8",  // Phyn Plus
      duration: "2026/01"  // Current month
    }
  }
};

async function testMCPServer() {
  console.log('Starting Phyn MCP Server test...\n');

  const server = spawn('./phyn-mcp-wrapper.sh', [], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: '/Users/winstonhuang/Documents/Claude Code/Home Controller'
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

  server.stderr.on('data', (data) => {
    console.log('Server log:', data.toString());
  });

  server.on('error', (error) => {
    console.error('Server error:', error);
  });

  server.on('close', (code) => {
    console.log('\nServer closed with code:', code);
    process.exit(code || 0);
  });

  // Give server time to start
  await new Promise(resolve => setTimeout(resolve, 500));

  // Initialize
  console.log('Initializing MCP server...');
  server.stdin.write(JSON.stringify(initializeRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Send list tools request
  console.log('\nSending list tools request...');
  server.stdin.write(JSON.stringify(listToolsRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Get devices
  console.log('\nSending get devices request...');
  server.stdin.write(JSON.stringify(getDevicesRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Get device status
  console.log('\nSending get device status request (Phyn Plus)...');
  server.stdin.write(JSON.stringify(getDeviceStatusRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Get consumption
  console.log('\nSending get consumption request...');
  server.stdin.write(JSON.stringify(getConsumptionRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Close the server
  console.log('\nTest complete. Closing server...');
  server.kill();
}

testMCPServer().catch(console.error);
