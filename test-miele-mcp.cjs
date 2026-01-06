// Test script to check Miele appliances status
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

async function testMCPServer() {
  const server = spawn('./miele-mcp-wrapper.sh', [], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      MIELE_ACCESS_TOKEN: process.env.MIELE_ACCESS_TOKEN,
      MIELE_API_BASE_URL: process.env.MIELE_API_BASE_URL || 'https://api.mcs3.miele.com/v1'
    }
  });

  let buffer = '';
  let initialized = false;
  let devices = null;

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

          // Check if this is the get_devices response
          if (response.id === 2 && response.result) {
            try {
              const content = response.result.content[0].text;
              devices = JSON.parse(content);
              console.log('\nFound devices, will query each one...\n');

              // Query each device
              let requestId = 3;
              for (const deviceId in devices) {
                const device = devices[deviceId];
                console.log(`Querying device: ${deviceId} (${device.ident?.deviceName || 'Unknown'})`);

                const getDeviceStatusRequest = {
                  jsonrpc: "2.0",
                  id: requestId++,
                  method: "tools/call",
                  params: {
                    name: "get_device_status",
                    arguments: {
                      deviceId: deviceId
                    }
                  }
                };

                server.stdin.write(JSON.stringify(getDeviceStatusRequest) + '\n');
              }
            } catch (e) {
              console.error('Error parsing devices:', e);
            }
          }
        } catch (e) {
          console.log('Raw output:', line);
        }
      }
    }
  });

  server.stderr.on('data', (data) => {
    console.error('Server stderr:', data.toString());
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
  console.log('Initializing Miele MCP server...');
  server.stdin.write(JSON.stringify(initializeRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Send requests
  console.log('\nSending list tools request...');
  server.stdin.write(JSON.stringify(listToolsRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\nSending get devices request...');
  server.stdin.write(JSON.stringify(getDevicesRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Wait for device status queries
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Close the server
  server.kill();
}

testMCPServer().catch(console.error);
