#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import dotenv from 'dotenv';
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
} from 'amazon-cognito-identity-js';

// Load environment variables
dotenv.config();

// Phyn API configuration
const PHYN_API_BASE_URL = 'https://api.phyn.com';
const COGNITO_USER_POOL_ID = 'us-east-1_UAv6IUsyh';
const COGNITO_CLIENT_ID = '5q2m8ti0urmepg4lup8q0ptldq';

const PHYN_USERNAME = process.env.PHYN_USERNAME;
const PHYN_PASSWORD = process.env.PHYN_PASSWORD;
const PHYN_API_KEY = process.env.PHYN_API_KEY;

// Validate credentials
if (!PHYN_USERNAME || !PHYN_PASSWORD || !PHYN_API_KEY) {
  console.error('Error: PHYN_USERNAME, PHYN_PASSWORD, and PHYN_API_KEY must be set in .env file');
  process.exit(1);
}

// Token storage
let accessToken = null;
let idToken = null;
let refreshToken = null;
let tokenExpiration = null;

// Create Cognito User Pool
const userPool = new CognitoUserPool({
  UserPoolId: COGNITO_USER_POOL_ID,
  ClientId: COGNITO_CLIENT_ID,
});

// Authenticate with Cognito
function authenticate() {
  return new Promise((resolve, reject) => {
    const authenticationDetails = new AuthenticationDetails({
      Username: PHYN_USERNAME,
      Password: PHYN_PASSWORD,
    });

    const cognitoUser = new CognitoUser({
      Username: PHYN_USERNAME,
      Pool: userPool,
    });

    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: (result) => {
        accessToken = result.getAccessToken().getJwtToken();
        idToken = result.getIdToken().getJwtToken();
        refreshToken = result.getRefreshToken().getToken();
        // Token expires in 1 hour, refresh 5 minutes early
        tokenExpiration = Date.now() + (55 * 60 * 1000);
        resolve(result);
      },
      onFailure: (err) => {
        reject(err);
      },
      newPasswordRequired: (userAttributes, requiredAttributes) => {
        reject(new Error('New password required - please update your password in the Phyn app first'));
      },
    });
  });
}

// Refresh tokens if needed
async function ensureAuthenticated() {
  if (!accessToken || Date.now() >= tokenExpiration) {
    await authenticate();
  }
}

// Create axios instance for Phyn API
async function phynApiRequest(method, endpoint, data = null) {
  await ensureAuthenticated();

  const config = {
    method,
    url: `${PHYN_API_BASE_URL}${endpoint}`,
    headers: {
      'Authorization': accessToken,
      'Content-Type': 'application/json',
      'x-api-key': PHYN_API_KEY,
      'User-Agent': 'phyn/18 CFNetwork/1331.0.7 Darwin/21.4.0',
      'Accept': 'application/json',
    },
  };

  if (data) {
    config.data = data;
  }

  const response = await axios(config);
  return response.data;
}

// Create MCP server
const server = new Server(
  {
    name: 'phyn-water-controller',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_devices',
        description: 'Get all Phyn devices (Phyn Plus and Smart Water Sensors)',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_device_status',
        description: 'Get current status of a Phyn device (pressure, flow, state)',
        inputSchema: {
          type: 'object',
          properties: {
            device_id: {
              type: 'string',
              description: 'The device ID to query',
            },
          },
          required: ['device_id'],
        },
      },
      {
        name: 'get_consumption',
        description: 'Get water consumption data for a device. Duration format: YYYY/MM/DD for daily, YYYY/MM for monthly, YYYY for yearly',
        inputSchema: {
          type: 'object',
          properties: {
            device_id: {
              type: 'string',
              description: 'The device ID to query',
            },
            duration: {
              type: 'string',
              description: 'Time period: YYYY/MM/DD (day), YYYY/MM (month), or YYYY (year)',
            },
          },
          required: ['device_id'],
        },
      },
      {
        name: 'shutoff_valve',
        description: 'Open or close the water shutoff valve (Phyn Plus only)',
        inputSchema: {
          type: 'object',
          properties: {
            device_id: {
              type: 'string',
              description: 'The Phyn Plus device ID',
            },
            action: {
              type: 'string',
              enum: ['open', 'close'],
              description: 'Open or close the valve',
            },
          },
          required: ['device_id', 'action'],
        },
      },
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get_devices': {
        // Get homes - devices are included in the home response
        const homes = await phynApiRequest('GET', `/homes?user_id=${encodeURIComponent(PHYN_USERNAME)}`);
        const allDevices = [];

        for (const home of homes) {
          if (home.devices && Array.isArray(home.devices)) {
            allDevices.push(...home.devices.map(d => ({
              ...d,
              home_id: home.id,
              home_name: home.name || home.address,
            })));
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(allDevices, null, 2),
            },
          ],
        };
      }

      case 'get_device_status': {
        const { device_id } = args;
        const status = await phynApiRequest('GET', `/devices/${device_id}/state`);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(status, null, 2),
            },
          ],
        };
      }

      case 'get_consumption': {
        const { device_id, duration } = args;
        let endpoint = `/devices/${device_id}/consumption/details`;

        if (duration) {
          endpoint += `?duration=${duration}`;
        }

        const consumption = await phynApiRequest('GET', endpoint);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(consumption, null, 2),
            },
          ],
        };
      }

      case 'shutoff_valve': {
        const { device_id, action } = args;
        const sov_state = action === 'open' ? 'open' : 'closed';

        const result = await phynApiRequest('POST', `/devices/${device_id}/sov`, {
          sov_state,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Valve ${action}ed successfully`,
                result,
              }, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: true,
            message: error.message,
            details: error.response?.data || 'No additional details',
            statusCode: error.response?.status || 'N/A',
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Phyn Water Controller MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
