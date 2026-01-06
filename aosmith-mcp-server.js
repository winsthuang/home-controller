#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// A.O. Smith API configuration (from py-aosmith reverse engineering)
const AOSMITH_API_BASE_URL = 'https://r2.wh8.co';
const AOSMITH_APP_VERSION = '13.0.8';

const AOSMITH_EMAIL = process.env.AOSMITH_EMAIL;
const AOSMITH_PASSWORD = process.env.AOSMITH_PASSWORD;

// Validate credentials
if (!AOSMITH_EMAIL || !AOSMITH_PASSWORD) {
  console.error('Error: AOSMITH_EMAIL and AOSMITH_PASSWORD must be set in .env file');
  process.exit(1);
}

// Token storage
let accessToken = null;
let tokenExpiration = null;

// GraphQL queries and mutations
const GRAPHQL_QUERIES = {
  login: `
    query login($passcode: String) {
      login(passcode: $passcode) {
        user {
          tokens {
            accessToken
            idToken
            refreshToken
          }
        }
      }
    }
  `,

  getDevices: `
    query devices($forceUpdate: Boolean) {
      devices(forceUpdate: $forceUpdate) {
        brand
        model
        deviceType
        dsn
        junctionId
        name
        serial
        install {
          location
        }
        data {
          __typename
          temperatureSetpoint
          temperatureSetpointPending
          temperatureSetpointPrevious
          temperatureSetpointMaximum
          modes {
            mode
            controls
          }
          isOnline
          ... on NextGenHeatPump {
            firmwareVersion
            hotWaterStatus
            mode
            modePending
          }
          ... on RE3Connected {
            firmwareVersion
            hotWaterStatus
            mode
            modePending
          }
          ... on RE3Premium {
            firmwareVersion
            hotWaterStatus
            mode
            modePending
          }
        }
      }
    }
  `,

  getEnergyUseData: `
    query getEnergyUseData($dsn: String!) {
      getEnergyUseData(dsn: $dsn) {
        average
        graphData {
          date
          kwh
        }
        lifetimeKwh
        startDate
      }
    }
  `,

  updateSetpoint: `
    mutation updateSetpoint($junctionId: String!, $setpoint: Int!) {
      updateSetpoint(junctionId: $junctionId, value: $setpoint) {
        junctionId
        temperatureSetpointPending
      }
    }
  `,

  updateMode: `
    mutation updateMode($junctionId: String!, $mode: ModeInput!) {
      updateMode(junctionId: $junctionId, mode: $mode)
    }
  `,
};

// Create passcode from credentials (py-aosmith method)
function createPasscode(email, password) {
  const credentials = JSON.stringify({ email, password });
  const urlEncoded = encodeURIComponent(credentials);
  return Buffer.from(urlEncoded).toString('base64');
}

// Authenticate with A.O. Smith API
async function login() {
  const passcode = createPasscode(AOSMITH_EMAIL, AOSMITH_PASSWORD);

  try {
    const response = await axios.post(
      `${AOSMITH_API_BASE_URL}/graphql`,
      {
        query: GRAPHQL_QUERIES.login,
        variables: { passcode },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'brand': 'icomm',
          'version': AOSMITH_APP_VERSION,
          'User-Agent': 'okhttp/4.9.2',
        },
        timeout: 20000,
      }
    );

    if (response.data.errors) {
      throw new Error(response.data.errors[0]?.message || 'Login failed');
    }

    const tokens = response.data.data?.login?.user?.tokens;
    if (!tokens?.accessToken) {
      throw new Error('No access token in login response');
    }

    accessToken = tokens.accessToken;
    // Token expires in ~1 hour, refresh 10 minutes early
    tokenExpiration = Date.now() + (50 * 60 * 1000);

    console.error('A.O. Smith authentication successful');
    return response.data.data.login;
  } catch (error) {
    console.error('A.O. Smith login error:', error.message);
    throw new Error(`Authentication failed: ${error.message}`);
  }
}

// Ensure we have a valid token
async function ensureAuthenticated() {
  if (!accessToken || Date.now() >= tokenExpiration) {
    await login();
  }
}

// Make authenticated GraphQL request with auto-retry on 401
async function graphqlRequest(query, variables = {}, retryCount = 0) {
  await ensureAuthenticated();

  try {
    const response = await axios.post(
      `${AOSMITH_API_BASE_URL}/graphql`,
      { query, variables },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'brand': 'icomm',
          'version': AOSMITH_APP_VERSION,
          'User-Agent': 'okhttp/4.9.2',
        },
        timeout: 20000,
      }
    );

    if (response.data.errors) {
      const error = response.data.errors[0];
      // Check for auth errors
      if (error?.extensions?.code === 'UNAUTHENTICATED' || error?.message?.includes('auth')) {
        if (retryCount < 1) {
          // Clear token and retry
          accessToken = null;
          return graphqlRequest(query, variables, retryCount + 1);
        }
      }
      throw new Error(error?.message || 'GraphQL request failed');
    }

    return response.data.data;
  } catch (error) {
    // Handle 401 Unauthorized
    if (error.response?.status === 401 && retryCount < 1) {
      accessToken = null;
      return graphqlRequest(query, variables, retryCount + 1);
    }
    throw error;
  }
}

// Create MCP server
const server = new Server(
  {
    name: 'aosmith-water-heater',
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
        description: 'Get all A.O. Smith water heaters linked to your iComm account',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_device_status',
        description: 'Get detailed status of a specific water heater (temperature, mode, online status)',
        inputSchema: {
          type: 'object',
          properties: {
            junction_id: {
              type: 'string',
              description: 'The junction ID of the water heater (from get_devices)',
            },
          },
          required: ['junction_id'],
        },
      },
      {
        name: 'set_temperature',
        description: 'Set the target water temperature (95-140°F)',
        inputSchema: {
          type: 'object',
          properties: {
            junction_id: {
              type: 'string',
              description: 'The junction ID of the water heater',
            },
            temperature: {
              type: 'number',
              description: 'Target temperature in Fahrenheit (95-140)',
              minimum: 95,
              maximum: 140,
            },
          },
          required: ['junction_id', 'temperature'],
        },
      },
      {
        name: 'set_mode',
        description: 'Change the water heater operation mode',
        inputSchema: {
          type: 'object',
          properties: {
            junction_id: {
              type: 'string',
              description: 'The junction ID of the water heater',
            },
            mode: {
              type: 'string',
              description: 'Operation mode: HEAT_PUMP (most efficient), HYBRID (balanced), ELECTRIC (fastest recovery), VACATION (energy saver when away)',
              enum: ['HEAT_PUMP', 'HYBRID', 'ELECTRIC', 'VACATION'],
            },
          },
          required: ['junction_id', 'mode'],
        },
      },
      {
        name: 'get_energy_usage',
        description: 'Get energy consumption data for a water heater',
        inputSchema: {
          type: 'object',
          properties: {
            junction_id: {
              type: 'string',
              description: 'The junction ID of the water heater',
            },
          },
          required: ['junction_id'],
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
        const data = await graphqlRequest(GRAPHQL_QUERIES.getDevices, { forceUpdate: true });

        // Format devices for easier reading
        const devices = (data.devices || []).map(device => ({
          junction_id: device.junctionId,
          dsn: device.dsn,
          name: device.name,
          brand: device.brand,
          model: device.model,
          device_type: device.deviceType,
          serial: device.serial,
          location: device.install?.location || 'Unknown',
          status: {
            online: device.data?.isOnline ?? false,
            current_setpoint: device.data?.temperatureSetpoint,
            setpoint_pending: device.data?.temperatureSetpointPending,
            max_temperature: device.data?.temperatureSetpointMaximum,
            mode: device.data?.mode,
            mode_pending: device.data?.modePending,
            hot_water_status: device.data?.hotWaterStatus,
            available_modes: device.data?.modes?.map(m => m.mode) || [],
          },
          firmware: device.data?.firmwareVersion,
        }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                device_count: devices.length,
                devices,
              }, null, 2),
            },
          ],
        };
      }

      case 'get_device_status': {
        const { junction_id } = args;

        const data = await graphqlRequest(GRAPHQL_QUERIES.getDevices, { forceUpdate: true });
        const device = data.devices?.find(d => d.junctionId === junction_id);

        if (!device) {
          throw new Error(`Water heater not found with junction_id: ${junction_id}`);
        }

        const status = {
          junction_id: device.junctionId,
          name: device.name,
          brand: device.brand,
          model: device.model,
          device_type: device.deviceType,
          serial: device.serial,
          location: device.install?.location || 'Unknown',
          online: device.data?.isOnline ?? false,
          temperature: {
            current_setpoint: device.data?.temperatureSetpoint,
            setpoint_pending: device.data?.temperatureSetpointPending,
            previous: device.data?.temperatureSetpointPrevious,
            maximum: device.data?.temperatureSetpointMaximum,
            unit: '°F',
          },
          mode: {
            current: device.data?.mode,
            pending: device.data?.modePending,
            available: device.data?.modes?.map(m => m.mode) || [],
          },
          hot_water_status: device.data?.hotWaterStatus,
          firmware: device.data?.firmwareVersion,
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(status, null, 2),
            },
          ],
        };
      }

      case 'set_temperature': {
        const { junction_id, temperature } = args;

        // Validate temperature range
        if (temperature < 95 || temperature > 140) {
          throw new Error('Temperature must be between 95°F and 140°F');
        }

        const data = await graphqlRequest(GRAPHQL_QUERIES.updateSetpoint, {
          junctionId: junction_id,
          setpoint: Math.round(temperature),
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Temperature setpoint updated to ${temperature}°F`,
                junction_id: data.updateSetpoint?.junctionId,
                pending_setpoint: data.updateSetpoint?.temperatureSetpointPending,
              }, null, 2),
            },
          ],
        };
      }

      case 'set_mode': {
        const { junction_id, mode } = args;

        // Validate mode
        const validModes = ['HEAT_PUMP', 'HYBRID', 'ELECTRIC', 'VACATION'];
        if (!validModes.includes(mode)) {
          throw new Error(`Invalid mode. Must be one of: ${validModes.join(', ')}`);
        }

        // ModeInput expects the mode value as a string
        const data = await graphqlRequest(GRAPHQL_QUERIES.updateMode, {
          junctionId: junction_id,
          mode: { mode: mode },
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Operation mode updated to ${mode}`,
                result: data.updateMode,
              }, null, 2),
            },
          ],
        };
      }

      case 'get_energy_usage': {
        const { junction_id } = args;

        // First, get the device to find its DSN (required for energy query)
        const devicesData = await graphqlRequest(GRAPHQL_QUERIES.getDevices, { forceUpdate: false });
        const device = devicesData.devices?.find(d => d.junctionId === junction_id);

        if (!device) {
          throw new Error(`Water heater not found with junction_id: ${junction_id}`);
        }

        if (!device.dsn) {
          throw new Error('Device DSN not available for energy query');
        }

        const data = await graphqlRequest(GRAPHQL_QUERIES.getEnergyUseData, {
          dsn: device.dsn,
        });

        const energyData = data.getEnergyUseData || {};

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                junction_id,
                device_name: device.name,
                lifetime_kwh: energyData.lifetimeKwh,
                average_daily_kwh: energyData.average,
                tracking_since: energyData.startDate,
                recent_usage: (energyData.graphData || []).slice(-7).map(d => ({
                  date: d.date,
                  kwh: d.kwh,
                })),
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
  console.error('A.O. Smith Water Heater MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
