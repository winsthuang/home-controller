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

// Miele API configuration
const MIELE_API_BASE_URL = process.env.MIELE_API_BASE_URL || 'https://api.mcs3.miele.com/v1';
const MIELE_ACCESS_TOKEN = process.env.MIELE_ACCESS_TOKEN;

// Temperature ranges for known cooling devices (in Celsius)
const DEVICE_TEMP_RANGES = {
  'KS 7793 D': {
    zones: {
      1: { min: 1, max: 9, name: 'Main Compartment' },
      2: { min: 0, max: 3, name: 'PerfectFresh Drawer' },
    },
  },
  'FNS 7794 E': {
    zones: {
      1: { min: -24, max: -16, name: 'Freezer Compartment' },
    },
  },
};

// Create axios instance for Miele API
const mieleApi = axios.create({
  baseURL: MIELE_API_BASE_URL,
  headers: {
    'Authorization': `Bearer ${MIELE_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

// Create MCP server
const server = new Server(
  {
    name: 'miele-home-controller',
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
        description: 'Get all Miele devices connected to your account',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_device_status',
        description: 'Get detailed status information for a specific Miele device',
        inputSchema: {
          type: 'object',
          properties: {
            deviceId: {
              type: 'string',
              description: 'The ID of the device to get status for',
            },
          },
          required: ['deviceId'],
        },
      },
      {
        name: 'device_action',
        description: 'Perform an action on a Miele device (start, stop, pause, etc.)',
        inputSchema: {
          type: 'object',
          properties: {
            deviceId: {
              type: 'string',
              description: 'The ID of the device to control',
            },
            action: {
              type: 'string',
              description: 'The action to perform (e.g., "start", "stop", "pause")',
              enum: ['start', 'stop', 'pause', 'powerOn', 'powerOff'],
            },
          },
          required: ['deviceId', 'action'],
        },
      },
      {
        name: 'set_temperature',
        description: 'Set target temperature for a Miele refrigerator or freezer',
        inputSchema: {
          type: 'object',
          properties: {
            deviceId: {
              type: 'string',
              description: 'The ID of the device (refrigerator or freezer)',
            },
            temperature: {
              type: 'number',
              description: 'Target temperature in Celsius (e.g., 4 for fridge, -18 for freezer)',
            },
            zone: {
              type: 'number',
              description: 'Temperature zone (default: 1). Zone 1 is main compartment. Zone 2 on fridges is PerfectFresh drawer.',
            },
          },
          required: ['deviceId', 'temperature'],
        },
      },
      {
        name: 'get_temperature_settings',
        description: 'Get current temperature settings and available ranges for a refrigerator or freezer',
        inputSchema: {
          type: 'object',
          properties: {
            deviceId: {
              type: 'string',
              description: 'The ID of the device to query',
            },
          },
          required: ['deviceId'],
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
        const response = await mieleApi.get('/devices');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case 'get_device_status': {
        const { deviceId } = args;
        const response = await mieleApi.get(`/devices/${deviceId}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case 'device_action': {
        const { deviceId, action } = args;
        const response = await mieleApi.put(`/devices/${deviceId}/actions`, {
          processAction: action,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                action: action,
                deviceId: deviceId,
                response: response.data,
              }, null, 2),
            },
          ],
        };
      }

      case 'get_temperature_settings': {
        const { deviceId } = args;
        const response = await mieleApi.get(`/devices/${deviceId}`);
        const device = response.data;
        const model = device.ident?.deviceIdentLabel?.techType;
        const deviceType = device.ident?.type?.value_localized;

        const currentTemps = device.state?.temperature || [];
        const targetTemps = device.state?.targetTemperature || [];
        const knownDevice = DEVICE_TEMP_RANGES[model];

        const zones = [];
        const numZones = Math.max(
          currentTemps.filter(t => t.value_localized !== null).length,
          targetTemps.filter(t => t.value_localized !== null).length,
          knownDevice ? Object.keys(knownDevice.zones).length : 0
        );

        for (let i = 0; i < numZones; i++) {
          const zoneNum = i + 1;
          const zoneConfig = knownDevice?.zones?.[zoneNum];
          zones.push({
            zone: zoneNum,
            name: zoneConfig?.name || `Zone ${zoneNum}`,
            currentTemperature: currentTemps[i]?.value_localized,
            targetTemperature: targetTemps[i]?.value_localized,
            unit: currentTemps[i]?.unit || 'Celsius',
            range: zoneConfig ? { min: zoneConfig.min, max: zoneConfig.max } : null,
          });
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                deviceId,
                model,
                type: deviceType,
                zones,
              }, null, 2),
            },
          ],
        };
      }

      case 'set_temperature': {
        const { deviceId, temperature, zone = 1 } = args;

        // Get device info to validate
        const deviceResponse = await mieleApi.get(`/devices/${deviceId}`);
        const device = deviceResponse.data;
        const model = device.ident?.deviceIdentLabel?.techType;
        const knownDevice = DEVICE_TEMP_RANGES[model];
        const zoneConfig = knownDevice?.zones?.[zone];

        // Validate zone exists
        if (knownDevice && !zoneConfig) {
          const validZones = Object.keys(knownDevice.zones).join(', ');
          throw new Error(`Invalid zone ${zone} for ${model}. Valid zones: ${validZones}`);
        }

        // Validate temperature range
        if (zoneConfig && (temperature < zoneConfig.min || temperature > zoneConfig.max)) {
          throw new Error(
            `Temperature ${temperature}°C out of range for ${zoneConfig.name}. ` +
            `Valid range: ${zoneConfig.min}°C to ${zoneConfig.max}°C`
          );
        }

        // Get previous temperature for response
        const prevTemp = device.state?.targetTemperature?.[zone - 1]?.value_localized;

        // Send temperature change
        const response = await mieleApi.put(`/devices/${deviceId}/actions`, {
          targetTemperature: [{ zone, value: temperature }],
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                deviceId,
                model,
                zone,
                zoneName: zoneConfig?.name || `Zone ${zone}`,
                previousTemperature: prevTemp,
                newTemperature: temperature,
                unit: 'Celsius',
                response: response.data,
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
  console.error('Miele Home Controller MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
