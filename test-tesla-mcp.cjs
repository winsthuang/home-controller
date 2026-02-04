// Test script to check Tesla Energy MCP server
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

// JSON-RPC request to get energy sites
const getEnergySitesRequest = {
  jsonrpc: "2.0",
  id: 2,
  method: "tools/call",
  params: {
    name: "get_energy_sites",
    arguments: {}
  }
};

async function testMCPServer() {
  const server = spawn('./tesla-mcp-wrapper.sh', [], {
    stdio: ['pipe', 'pipe', 'inherit'],
    env: process.env
  });

  let buffer = '';
  let initialized = false;
  let siteId = null;

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

              // Extract site_id from energy sites response
              if (response.id === 2 && content.sites?.[0]?.energy_site_id) {
                siteId = content.sites[0].energy_site_id;
                console.log(`\nFound energy site ID: ${siteId}`);
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
  console.log('Initializing Tesla Energy MCP server...');
  server.stdin.write(JSON.stringify(initializeRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Send requests
  console.log('\nSending list tools request...');
  server.stdin.write(JSON.stringify(listToolsRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\nSending get energy sites request...');
  server.stdin.write(JSON.stringify(getEnergySitesRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 5000)); // Give time for auth

  // If we found a site, get its live status and history
  if (siteId) {
    console.log('\nSending get live status request...');
    const getLiveStatusRequest = {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "get_live_status",
        arguments: { site_id: siteId }
      }
    };
    server.stdin.write(JSON.stringify(getLiveStatusRequest) + '\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\nSending get energy history request (last day)...');
    const getEnergyHistoryRequest = {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "get_energy_history",
        arguments: { site_id: siteId, period: 'day' }
      }
    };
    server.stdin.write(JSON.stringify(getEnergyHistoryRequest) + '\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // Close the server
  console.log('\nTest complete. Closing server...');
  server.kill();
}

testMCPServer().catch(console.error);
