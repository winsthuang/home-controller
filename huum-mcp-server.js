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

// HUUM API configuration
const HUUM_API_BASE_URL = 'https://api.huum.eu';
const HUUM_USERNAME = process.env.HUUM_USERNAME;
const HUUM_PASSWORD = process.env.HUUM_PASSWORD;

// Validate credentials
if (!HUUM_USERNAME || !HUUM_PASSWORD) {
  console.error('Error: HUUM_USERNAME and HUUM_PASSWORD must be set in .env file');
  process.exit(1);
}

// Create axios instance for HUUM API with Basic Auth
const huumApi = axios.create({
  baseURL: HUUM_API_BASE_URL,
  auth: {
    username: HUUM_USERNAME,
    password: HUUM_PASSWORD,
  },
  headers: {
    'Content-Type': 'application/json',
  },
});

// Create MCP server
const server = new Server(
  {
    name: 'huum-sauna-controller',
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
        name: 'get_sauna_status',
        description: 'Get current status of the HUUM sauna (temperature, heater state, etc.)',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'start_sauna',
        description: 'Start the sauna and set target temperature (40-110°C)',
        inputSchema: {
          type: 'object',
          properties: {
            targetTemperature: {
              type: 'number',
              description: 'Target temperature in Celsius (40-110)',
              minimum: 40,
              maximum: 110,
            },
          },
          required: ['targetTemperature'],
        },
      },
      {
        name: 'stop_sauna',
        description: 'Stop/turn off the sauna',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'toggle_light',
        description: 'Toggle the sauna light on/off',
        inputSchema: {
          type: 'object',
          properties: {},
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
      case 'get_sauna_status': {
        const response = await huumApi.get('/action/home/status');

        // Format the response nicely
        const status = response.data;

        // Heater is only "on" if actively heating:
        // - Has a target temperature set
        // - Has a valid end date in the future
        // - Duration is greater than 0
        const now = Math.floor(Date.now() / 1000); // Current Unix timestamp
        const isHeating = status.targetTemperature &&
                         status.endDate &&
                         status.endDate > now &&
                         status.duration > 0;

        const formattedStatus = {
          temperature: status.temperature || 'N/A',
          targetTemperature: status.targetTemperature || 'N/A',
          heaterOn: isHeating,
          humidity: status.humidity || 'N/A',
          startDate: status.startDate || null,
          endDate: status.endDate || null,
          duration: status.duration || 0,
          rawStatus: status,
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(formattedStatus, null, 2),
            },
          ],
        };
      }

      case 'start_sauna': {
        const { targetTemperature } = args;

        // Validate temperature range
        if (targetTemperature < 40 || targetTemperature > 110) {
          throw new Error('Target temperature must be between 40°C and 110°C');
        }

        const response = await huumApi.post(`/action/home/start?targetTemperature=${targetTemperature}`);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Sauna started with target temperature ${targetTemperature}°C`,
                status: response.data,
              }, null, 2),
            },
          ],
        };
      }

      case 'stop_sauna': {
        const response = await huumApi.post('/action/home/stop');

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: 'Sauna stopped',
                status: response.data,
              }, null, 2),
            },
          ],
        };
      }

      case 'toggle_light': {
        const response = await huumApi.get('/action/home/light');

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: 'Sauna light toggled',
                status: response.data,
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
  console.error('HUUM Sauna Controller MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
