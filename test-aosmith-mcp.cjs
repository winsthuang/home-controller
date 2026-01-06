// Test script to check A.O. Smith Water Heater MCP server
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

// JSON-RPC request to get devices
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
  const server = spawn('./aosmith-mcp-wrapper.sh', [], {
    stdio: ['pipe', 'pipe', 'inherit'],
    env: process.env
  });

  let buffer = '';
  let initialized = false;
  let deviceJunctionId = null;

  server.stdout.on('data', (data) => {
    buffer += data.toString();

    // Process complete JSON-RPC responses
    const lines = buffer.split('\n');
    buffer = lines.pop(); // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.trim()) {
        try {
          const response = JSON.parse(line);

          // Pretty print the response
          if (response.result?.content?.[0]?.text) {
            try {
              const content = JSON.parse(response.result.content[0].text);
              console.log(`Response (id: ${response.id}):`, JSON.stringify(content, null, 2));

              // Extract junction_id from devices response for follow-up queries
              if (response.id === 2 && content.devices?.[0]?.junction_id) {
                deviceJunctionId = content.devices[0].junction_id;
                console.log(`\nFound water heater junction_id: ${deviceJunctionId}`);
              }
            } catch {
              console.log('Response:', JSON.stringify(response, null, 2));
            }
          } else {
            console.log('Response:', JSON.stringify(response, null, 2));
          }

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
  console.log('Initializing A.O. Smith MCP server...');
  server.stdin.write(JSON.stringify(initializeRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Send requests
  console.log('\nSending list tools request...');
  server.stdin.write(JSON.stringify(listToolsRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\nSending get devices request (this will authenticate with iComm API)...');
  server.stdin.write(JSON.stringify(getDevicesRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 5000)); // Give more time for auth

  // If we found a device, get its status and energy usage
  if (deviceJunctionId) {
    console.log('\nSending get device status request...');
    const getStatusRequest = {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "get_device_status",
        arguments: { junction_id: deviceJunctionId }
      }
    };
    server.stdin.write(JSON.stringify(getStatusRequest) + '\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\nSending get energy usage request...');
    const getEnergyRequest = {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "get_energy_usage",
        arguments: { junction_id: deviceJunctionId }
      }
    };
    server.stdin.write(JSON.stringify(getEnergyRequest) + '\n');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // Close the server
  console.log('\nTest complete. Closing server...');
  server.kill();
}

testMCPServer().catch(console.error);
