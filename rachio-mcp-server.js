#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const RACHIO_API_BASE_URL = 'https://api.rach.io/1';
const RACHIO_API_KEY = process.env.RACHIO_API_KEY;

if (!RACHIO_API_KEY) {
  console.error('Error: RACHIO_API_KEY must be set in .env file');
  process.exit(1);
}

let cachedPersonId = null;

async function rachioRequest(method, endpoint, data = null) {
  const config = {
    method,
    url: `${RACHIO_API_BASE_URL}${endpoint}`,
    headers: {
      'Authorization': `Bearer ${RACHIO_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  };
  if (data !== null) config.data = data;
  const response = await axios(config);
  return response.data;
}

async function getPersonId() {
  if (cachedPersonId) return cachedPersonId;
  const info = await rachioRequest('GET', '/public/person/info');
  cachedPersonId = info.id;
  return cachedPersonId;
}

async function getPerson() {
  const id = await getPersonId();
  return await rachioRequest('GET', `/public/person/${id}`);
}

function summarizeDevice(device) {
  return {
    id: device.id,
    name: device.name,
    model: device.model,
    serialNumber: device.serialNumber,
    macAddress: device.macAddress,
    status: device.status,
    on: device.on,
    paused: device.paused,
    rainDelayExpirationDate: device.rainDelayExpirationDate || null,
    timeZone: device.timeZone,
    latitude: device.latitude,
    longitude: device.longitude,
    elevation: device.elevation,
    zoneCount: Array.isArray(device.zones) ? device.zones.length : 0,
    zones: Array.isArray(device.zones)
      ? device.zones.map((z) => ({
          id: z.id,
          zoneNumber: z.zoneNumber,
          name: z.name,
          enabled: z.enabled,
          runtime: z.runtime,
          customNozzle: z.customNozzle?.name,
          customSoil: z.customSoil?.name,
          customSlope: z.customSlope?.name,
          customCrop: z.customCrop?.name,
          customShade: z.customShade?.name,
        }))
      : [],
    scheduleRules: Array.isArray(device.scheduleRules)
      ? device.scheduleRules.map((s) => ({
          id: s.id,
          name: s.name,
          enabled: s.enabled,
          rainDelay: s.rainDelay,
          totalDuration: s.totalDuration,
        }))
      : [],
    flexScheduleRules: Array.isArray(device.flexScheduleRules)
      ? device.flexScheduleRules.map((s) => ({
          id: s.id,
          name: s.name,
          enabled: s.enabled,
        }))
      : [],
  };
}

const server = new Server(
  { name: 'rachio-sprinkler-controller', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_devices',
        description: 'List all Rachio sprinkler controllers on the account, with zones and schedules summarized.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'get_device_status',
        description: 'Get detailed status for a specific Rachio controller (power, paused, rain delay, current watering).',
        inputSchema: {
          type: 'object',
          properties: {
            device_id: { type: 'string', description: 'The Rachio device (controller) id' },
          },
          required: ['device_id'],
        },
      },
      {
        name: 'get_current_schedule',
        description: 'Get the currently active schedule on a controller (which zone is watering and how long is left). Returns an empty object if nothing is running.',
        inputSchema: {
          type: 'object',
          properties: {
            device_id: { type: 'string', description: 'The Rachio device (controller) id' },
          },
          required: ['device_id'],
        },
      },
      {
        name: 'get_zones',
        description: 'List all zones for a specific controller, with their numbers, names, and enabled state.',
        inputSchema: {
          type: 'object',
          properties: {
            device_id: { type: 'string', description: 'The Rachio device (controller) id' },
          },
          required: ['device_id'],
        },
      },
      {
        name: 'get_zone',
        description: 'Get detailed info for a single Rachio zone.',
        inputSchema: {
          type: 'object',
          properties: {
            zone_id: { type: 'string', description: 'The zone id (uuid)' },
          },
          required: ['zone_id'],
        },
      },
      {
        name: 'start_zone',
        description: 'Start watering a single zone for the given number of minutes (1–180).',
        inputSchema: {
          type: 'object',
          properties: {
            zone_id: { type: 'string', description: 'The zone id (uuid) to start' },
            minutes: {
              type: 'number',
              description: 'Run duration in minutes (1–180).',
              minimum: 1,
              maximum: 180,
            },
          },
          required: ['zone_id', 'minutes'],
        },
      },
      {
        name: 'start_multiple_zones',
        description: 'Queue multiple zones to run sequentially. Each item is { zone_id, minutes, sortOrder }.',
        inputSchema: {
          type: 'object',
          properties: {
            zones: {
              type: 'array',
              description: 'Ordered list of zones to run',
              items: {
                type: 'object',
                properties: {
                  zone_id: { type: 'string' },
                  minutes: { type: 'number', minimum: 1, maximum: 180 },
                  sortOrder: { type: 'number', description: 'Run order (0-based)' },
                },
                required: ['zone_id', 'minutes', 'sortOrder'],
              },
              minItems: 1,
            },
          },
          required: ['zones'],
        },
      },
      {
        name: 'stop_water',
        description: 'Immediately stop any active watering on the given controller.',
        inputSchema: {
          type: 'object',
          properties: {
            device_id: { type: 'string', description: 'The Rachio device (controller) id' },
          },
          required: ['device_id'],
        },
      },
      {
        name: 'set_rain_delay',
        description: 'Pause all schedules on the controller for the given duration (in seconds, max 604800 = 7 days). Use 0 to clear the delay.',
        inputSchema: {
          type: 'object',
          properties: {
            device_id: { type: 'string', description: 'The Rachio device (controller) id' },
            duration_seconds: {
              type: 'number',
              description: 'Delay in seconds. 0 clears any active delay. Max 604800 (7 days).',
              minimum: 0,
              maximum: 604800,
            },
          },
          required: ['device_id', 'duration_seconds'],
        },
      },
      {
        name: 'set_device_enabled',
        description: 'Turn the controller standby on or off. When disabled, schedules will not run.',
        inputSchema: {
          type: 'object',
          properties: {
            device_id: { type: 'string', description: 'The Rachio device (controller) id' },
            enabled: { type: 'boolean', description: 'true → device on, false → standby/off' },
          },
          required: ['device_id', 'enabled'],
        },
      },
      {
        name: 'set_zone_enabled',
        description: 'Enable or disable a single zone (excludes/includes it from schedules).',
        inputSchema: {
          type: 'object',
          properties: {
            zone_id: { type: 'string', description: 'The zone id (uuid)' },
            enabled: { type: 'boolean' },
          },
          required: ['zone_id', 'enabled'],
        },
      },
      {
        name: 'get_schedule_rule',
        description: 'Get details for a single schedule rule by id.',
        inputSchema: {
          type: 'object',
          properties: {
            schedule_id: { type: 'string' },
          },
          required: ['schedule_id'],
        },
      },
      {
        name: 'start_schedule',
        description: 'Manually trigger a schedule rule to run now.',
        inputSchema: {
          type: 'object',
          properties: {
            schedule_id: { type: 'string' },
          },
          required: ['schedule_id'],
        },
      },
      {
        name: 'skip_schedule',
        description: 'Skip the next occurrence of a schedule rule.',
        inputSchema: {
          type: 'object',
          properties: {
            schedule_id: { type: 'string' },
          },
          required: ['schedule_id'],
        },
      },
      {
        name: 'get_forecast',
        description: 'Get the weather forecast for the controller location.',
        inputSchema: {
          type: 'object',
          properties: {
            device_id: { type: 'string', description: 'The Rachio device (controller) id' },
            units: {
              type: 'string',
              enum: ['US', 'METRIC'],
              description: 'Units of measure (default US)',
            },
          },
          required: ['device_id'],
        },
      },
      {
        name: 'get_events',
        description: 'Get the controller event log between two timestamps (Unix epoch ms). Default range is the last 7 days.',
        inputSchema: {
          type: 'object',
          properties: {
            device_id: { type: 'string', description: 'The Rachio device (controller) id' },
            start_time_ms: { type: 'number', description: 'Start time, Unix epoch milliseconds' },
            end_time_ms: { type: 'number', description: 'End time, Unix epoch milliseconds' },
          },
          required: ['device_id'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get_devices': {
        const person = await getPerson();
        const devices = (person.devices || []).map(summarizeDevice);
        const payload = {
          accountId: person.id,
          username: person.username,
          fullName: person.fullName,
          deviceCount: devices.length,
          devices,
        };
        if (devices.length === 0) {
          payload.note = 'No Rachio controllers are linked to this account yet. Add one in the Rachio app, then re-run.';
        }
        return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
      }

      case 'get_device_status': {
        const { device_id } = args;
        const device = await rachioRequest('GET', `/public/device/${device_id}`);
        return {
          content: [{ type: 'text', text: JSON.stringify(summarizeDevice(device), null, 2) }],
        };
      }

      case 'get_current_schedule': {
        const { device_id } = args;
        const current = await rachioRequest('GET', `/public/device/${device_id}/current_schedule`);
        const isRunning = current && Object.keys(current).length > 0;
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                isRunning
                  ? { running: true, ...current }
                  : { running: false, message: 'No schedule is currently active.' },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'get_zones': {
        const { device_id } = args;
        const device = await rachioRequest('GET', `/public/device/${device_id}`);
        const zones = (device.zones || []).map((z) => ({
          id: z.id,
          zoneNumber: z.zoneNumber,
          name: z.name,
          enabled: z.enabled,
          runtime: z.runtime,
          customNozzle: z.customNozzle?.name,
          customSoil: z.customSoil?.name,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(zones, null, 2) }] };
      }

      case 'get_zone': {
        const { zone_id } = args;
        const zone = await rachioRequest('GET', `/public/zone/${zone_id}`);
        return { content: [{ type: 'text', text: JSON.stringify(zone, null, 2) }] };
      }

      case 'start_zone': {
        const { zone_id, minutes } = args;
        const duration = Math.round(minutes * 60);
        await rachioRequest('PUT', '/public/zone/start', { id: zone_id, duration });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { success: true, message: `Started zone ${zone_id} for ${minutes} minute(s).` },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'start_multiple_zones': {
        const { zones } = args;
        const payload = {
          zones: zones.map((z) => ({
            id: z.zone_id,
            duration: Math.round(z.minutes * 60),
            sortOrder: z.sortOrder,
          })),
        };
        await rachioRequest('PUT', '/public/zone/start_multiple', payload);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { success: true, message: `Queued ${zones.length} zone(s) to run sequentially.`, payload },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'stop_water': {
        const { device_id } = args;
        await rachioRequest('PUT', '/public/device/stop_water', { id: device_id });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, message: 'Stopped active watering.' }, null, 2),
            },
          ],
        };
      }

      case 'set_rain_delay': {
        const { device_id, duration_seconds } = args;
        await rachioRequest('PUT', '/public/device/rain_delay', {
          id: device_id,
          duration: duration_seconds,
        });
        const human =
          duration_seconds === 0
            ? 'Cleared rain delay.'
            : `Set rain delay for ${Math.round(duration_seconds / 3600)} hour(s).`;
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, message: human }, null, 2) }],
        };
      }

      case 'set_device_enabled': {
        const { device_id, enabled } = args;
        const endpoint = enabled ? '/public/device/on' : '/public/device/off';
        await rachioRequest('PUT', endpoint, { id: device_id });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { success: true, message: enabled ? 'Controller turned on.' : 'Controller put in standby.' },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'set_zone_enabled': {
        const { zone_id, enabled } = args;
        const endpoint = enabled ? '/public/zone/enable' : '/public/zone/disable';
        await rachioRequest('PUT', endpoint, { id: zone_id });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { success: true, message: `Zone ${zone_id} ${enabled ? 'enabled' : 'disabled'}.` },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'get_schedule_rule': {
        const { schedule_id } = args;
        const rule = await rachioRequest('GET', `/public/schedulerule/${schedule_id}`);
        return { content: [{ type: 'text', text: JSON.stringify(rule, null, 2) }] };
      }

      case 'start_schedule': {
        const { schedule_id } = args;
        await rachioRequest('PUT', '/public/schedulerule/start', { id: schedule_id });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, message: `Started schedule ${schedule_id}.` }, null, 2),
            },
          ],
        };
      }

      case 'skip_schedule': {
        const { schedule_id } = args;
        await rachioRequest('PUT', '/public/schedulerule/skip', { id: schedule_id });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { success: true, message: `Skipped next run of schedule ${schedule_id}.` },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'get_forecast': {
        const { device_id, units = 'US' } = args;
        const forecast = await rachioRequest(
          'GET',
          `/public/device/${device_id}/forecast?units=${encodeURIComponent(units)}`
        );
        return { content: [{ type: 'text', text: JSON.stringify(forecast, null, 2) }] };
      }

      case 'get_events': {
        const { device_id } = args;
        const end = args.end_time_ms ?? Date.now();
        const start = args.start_time_ms ?? end - 7 * 24 * 60 * 60 * 1000;
        const events = await rachioRequest(
          'GET',
          `/public/device/${device_id}/event?startTime=${start}&endTime=${end}`
        );
        return { content: [{ type: 'text', text: JSON.stringify(events, null, 2) }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: true,
              message: error.message,
              details: error.response?.data || 'No additional details',
              statusCode: error.response?.status || 'N/A',
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Rachio Sprinkler Controller MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
