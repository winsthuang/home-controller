#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import ModbusRTU from 'modbus-serial';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Zehnder ComfoConnect Pro configuration
const ZEHNDER_HOST = process.env.ZEHNDER_HOST;
const ZEHNDER_PORT = parseInt(process.env.ZEHNDER_PORT || '502', 10);
const ZEHNDER_SLAVE_ID = parseInt(process.env.ZEHNDER_SLAVE_ID || '1', 10);

// Validate configuration
if (!ZEHNDER_HOST) {
  console.error('Error: ZEHNDER_HOST must be set in .env file');
  process.exit(1);
}

// Modbus client instance (reused across calls)
let client = null;

/**
 * Get or create Modbus TCP connection
 */
async function getClient() {
  if (client && client.isOpen) {
    return client;
  }

  client = new ModbusRTU();
  await client.connectTCP(ZEHNDER_HOST, { port: ZEHNDER_PORT });
  client.setID(ZEHNDER_SLAVE_ID);
  client.setTimeout(5000);
  return client;
}

/**
 * Fan speed label mapping
 */
const FAN_SPEED_LABELS = {
  0: 'Away',
  1: 'Low',
  2: 'Medium',
  3: 'High'
};

/**
 * Temperature profile label mapping
 */
const TEMP_PROFILE_LABELS = {
  0: 'Comfort',
  1: 'Eco',
  2: 'Warm'
};

/**
 * Profile mode label mapping
 */
const PROFILE_MODE_LABELS = {
  0: 'Manual',
  1: 'Auto'
};

// Create MCP server
const server = new Server(
  {
    name: 'zehnder-ventilation',
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
        name: 'get_ventilation_status',
        description: 'Get current ventilation sensor data (airflow, temperatures, humidities, CO2, filter status)',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_ventilation_mode',
        description: 'Get current ventilation mode settings (fan speed, temperature profile, setpoint)',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'set_fan_speed',
        description: 'Set ventilation fan speed (0=Away, 1=Low, 2=Medium, 3=High)',
        inputSchema: {
          type: 'object',
          properties: {
            speed: {
              type: 'number',
              description: 'Fan speed: 0=Away, 1=Low, 2=Medium, 3=High',
              minimum: 0,
              maximum: 3,
            },
          },
          required: ['speed'],
        },
      },
      {
        name: 'set_temp_profile',
        description: 'Set temperature profile (0=Comfort, 1=Eco, 2=Warm)',
        inputSchema: {
          type: 'object',
          properties: {
            profile: {
              type: 'number',
              description: 'Temperature profile: 0=Comfort, 1=Eco, 2=Warm',
              minimum: 0,
              maximum: 2,
            },
          },
          required: ['profile'],
        },
      },
      {
        name: 'set_temp_setpoint',
        description: 'Set temperature setpoint in °C (e.g. 21.5)',
        inputSchema: {
          type: 'object',
          properties: {
            temperature: {
              type: 'number',
              description: 'Temperature setpoint in °C (e.g. 21.5)',
              minimum: 15,
              maximum: 27,
            },
          },
          required: ['temperature'],
        },
      },
      {
        name: 'set_boost_mode',
        description: 'Enable or disable boost/party mode',
        inputSchema: {
          type: 'object',
          properties: {
            enabled: {
              type: 'boolean',
              description: 'true to enable boost mode, false to disable',
            },
          },
          required: ['enabled'],
        },
      },
      {
        name: 'set_away_mode',
        description: 'Enable or disable away mode',
        inputSchema: {
          type: 'object',
          properties: {
            enabled: {
              type: 'boolean',
              description: 'true to enable away mode, false to disable',
            },
          },
          required: ['enabled'],
        },
      },
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const modbusClient = await getClient();

    switch (name) {
      case 'get_ventilation_status': {
        // Read input registers 6-25 (20 registers)
        const data = await modbusClient.readInputRegisters(6, 20);
        const regs = data.data;

        const status = {
          airflow: regs[0],                        // Register 6: m³/h
          temperatures: {
            room: regs[1] / 10,                    // Register 7: °C x10
            extract: regs[2] / 10,                 // Register 8: °C x10
            exhaust: regs[3] / 10,                 // Register 9: °C x10
            outdoor: regs[4] / 10,                 // Register 10: °C x10
            supply: regs[5] / 10,                  // Register 11: °C x10
          },
          humidities: {
            room: regs[6],                         // Register 12: %
            extract: regs[7],                      // Register 13: %
            exhaust: regs[8],                      // Register 14: %
            outdoor: regs[9],                      // Register 15: %
            supply: regs[10],                      // Register 16: %
          },
          co2Zones: [
            regs[11],                              // Register 17: ppm
            regs[12],                              // Register 18: ppm
            regs[13],                              // Register 19: ppm
          ],
          filterDaysRemaining: regs[14],           // Register 20: days
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

      case 'get_ventilation_mode': {
        // Read holding registers 0-4 (5 registers)
        const data = await modbusClient.readHoldingRegisters(0, 5);
        const regs = data.data;

        const mode = {
          fanSpeed: regs[0],                       // Register 0: 0-3
          fanSpeedLabel: FAN_SPEED_LABELS[regs[0]] || `Unknown (${regs[0]})`,
          tempProfile: regs[1],                    // Register 1: 0-2
          tempProfileLabel: TEMP_PROFILE_LABELS[regs[1]] || `Unknown (${regs[1]})`,
          profileMode: regs[2],                    // Register 2: 0-1
          profileModeLabel: PROFILE_MODE_LABELS[regs[2]] || `Unknown (${regs[2]})`,
          tempSetpoint: regs[3] / 10,              // Register 3: °C x10
          boostDuration: regs[4],                  // Register 4: minutes
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(mode, null, 2),
            },
          ],
        };
      }

      case 'set_fan_speed': {
        const { speed } = args;
        if (speed < 0 || speed > 3) {
          throw new Error('Fan speed must be 0 (Away), 1 (Low), 2 (Medium), or 3 (High)');
        }

        await modbusClient.writeRegister(0, speed);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Fan speed set to ${FAN_SPEED_LABELS[speed]} (${speed})`,
              }, null, 2),
            },
          ],
        };
      }

      case 'set_temp_profile': {
        const { profile } = args;
        if (profile < 0 || profile > 2) {
          throw new Error('Temperature profile must be 0 (Comfort), 1 (Eco), or 2 (Warm)');
        }

        await modbusClient.writeRegister(1, profile);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Temperature profile set to ${TEMP_PROFILE_LABELS[profile]}`,
              }, null, 2),
            },
          ],
        };
      }

      case 'set_temp_setpoint': {
        const { temperature } = args;
        if (temperature < 15 || temperature > 27) {
          throw new Error('Temperature setpoint must be between 15°C and 27°C');
        }

        // Convert to x10 integer (e.g. 21.5 → 215)
        const value = Math.round(temperature * 10);
        await modbusClient.writeRegister(3, value);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Temperature setpoint set to ${temperature}°C`,
              }, null, 2),
            },
          ],
        };
      }

      case 'set_boost_mode': {
        const { enabled } = args;
        await modbusClient.writeCoil(6, enabled);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Boost mode ${enabled ? 'enabled' : 'disabled'}`,
              }, null, 2),
            },
          ],
        };
      }

      case 'set_away_mode': {
        const { enabled } = args;
        await modbusClient.writeCoil(7, enabled);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Away mode ${enabled ? 'enabled' : 'disabled'}`,
              }, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    // Reset client on connection errors so next call reconnects
    if (client && !client.isOpen) {
      client = null;
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: true,
            message: error.message,
            details: error.code || 'No additional details',
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
  console.error('Zehnder Ventilation MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
