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

// Tedee API configuration
const TEDEE_API_BASE_URL = 'https://api.tedee.com/api/v1.32';
const TEDEE_API_KEY = process.env.TEDEE_API_KEY;

// Validate credentials
if (!TEDEE_API_KEY) {
  console.error('Error: TEDEE_API_KEY must be set in .env file');
  console.error('Get your Personal Access Key at: https://portal.tedee.com/personal-access-keys');
  process.exit(1);
}

// Create axios instance with auth header
const tedeeApi = axios.create({
  baseURL: TEDEE_API_BASE_URL,
  headers: {
    'Authorization': `PersonalKey ${TEDEE_API_KEY}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 30000,
});

// Lock state mapping
const LOCK_STATES = {
  0: 'Uncalibrated',
  1: 'Calibrating',
  2: 'Unlocked',
  3: 'SemiLocked',
  4: 'Unlocking',
  5: 'Locking',
  6: 'Locked',
  7: 'PulledManually',
  8: 'Pulling',
  9: 'Unknown',
  18: 'Updating',
};

// Door state mapping
const DOOR_STATES = {
  0: 'Unknown',
  1: 'Closed',
  2: 'Open',
  3: 'NotFullyClosed',
};

// Activity event types
const EVENT_TYPES = {
  1: 'Lock',
  2: 'Unlock',
  3: 'Pull',
  4: 'Open',
  5: 'Close',
  6: 'Calibration',
  7: 'DoorOpen',
  8: 'DoorClose',
  9: 'SemiLock',
};

// Activity source types
const SOURCE_TYPES = {
  0: 'Unknown',
  1: 'Manual',
  2: 'Button',
  3: 'RemoteButton',
  4: 'Keypad',
  5: 'AutoUnlock',
  6: 'AutoLock',
  7: 'Widget',
  8: 'HomeKit',
  9: 'App',
};

// Format lock state for display
function formatLockState(state) {
  return LOCK_STATES[state] || `Unknown (${state})`;
}

// Format door state for display
function formatDoorState(state) {
  return DOOR_STATES[state] || `Unknown (${state})`;
}

// Format event type for display
function formatEventType(type) {
  return EVENT_TYPES[type] || `Unknown (${type})`;
}

// Format source type for display
function formatSourceType(source) {
  return SOURCE_TYPES[source] || `Unknown (${source})`;
}

// Create MCP server
const server = new Server(
  {
    name: 'tedee-smart-lock',
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
        description: 'Get all Tedee smart locks linked to your account',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_device_status',
        description: 'Get detailed status of a specific lock (state, battery, door)',
        inputSchema: {
          type: 'object',
          properties: {
            lock_id: {
              type: 'number',
              description: 'The ID of the lock (from get_devices)',
            },
          },
          required: ['lock_id'],
        },
      },
      {
        name: 'sync_all_locks',
        description: 'Refresh and get current status of all locks',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'lock_door',
        description: 'Lock a specific door',
        inputSchema: {
          type: 'object',
          properties: {
            lock_id: {
              type: 'number',
              description: 'The ID of the lock to lock',
            },
          },
          required: ['lock_id'],
        },
      },
      {
        name: 'unlock_door',
        description: 'Unlock a specific door',
        inputSchema: {
          type: 'object',
          properties: {
            lock_id: {
              type: 'number',
              description: 'The ID of the lock to unlock',
            },
            mode: {
              type: 'number',
              description: 'Unlock mode: 2=force, 3=no auto-pull, 4=unlock or pull (optional)',
              enum: [2, 3, 4],
            },
          },
          required: ['lock_id'],
        },
      },
      {
        name: 'pull_spring',
        description: 'Pull spring (for locks with auto-pull disabled)',
        inputSchema: {
          type: 'object',
          properties: {
            lock_id: {
              type: 'number',
              description: 'The ID of the lock',
            },
          },
          required: ['lock_id'],
        },
      },
      {
        name: 'get_operation_status',
        description: 'Check the status of an async lock/unlock operation',
        inputSchema: {
          type: 'object',
          properties: {
            operation_id: {
              type: 'string',
              description: 'The operation ID returned from lock/unlock',
            },
          },
          required: ['operation_id'],
        },
      },
      {
        name: 'get_activity_log',
        description: 'Get recent activity history for a lock',
        inputSchema: {
          type: 'object',
          properties: {
            lock_id: {
              type: 'number',
              description: 'The ID of the lock',
            },
            count: {
              type: 'number',
              description: 'Number of events to return (max 200, default 20)',
              minimum: 1,
              maximum: 200,
            },
          },
          required: ['lock_id'],
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
        const response = await tedeeApi.get('/my/lock');

        const locks = (response.data.result || []).map(lock => ({
          id: lock.id,
          name: lock.name,
          serial_number: lock.serialNumber,
          type: lock.type === 2 ? 'Tedee PRO' : lock.type === 4 ? 'Tedee GO' : `Type ${lock.type}`,
          device_revision: lock.deviceRevision,
          connected_to_bridge: lock.connectedToId ? true : false,
          bridge_id: lock.connectedToId,
        }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                lock_count: locks.length,
                locks,
              }, null, 2),
            },
          ],
        };
      }

      case 'get_device_status': {
        const { lock_id } = args;

        const response = await tedeeApi.get(`/my/lock/${lock_id}/sync`);
        const lock = response.data.result;

        if (!lock) {
          throw new Error(`Lock not found with ID: ${lock_id}`);
        }

        // Properties are in lockProperties for sync endpoint
        const props = lock.lockProperties || {};

        const status = {
          id: lock.id,
          name: lock.name,
          serial_number: lock.serialNumber,
          is_connected: lock.isConnected,
          lock_state: formatLockState(props.state),
          lock_state_code: props.state,
          door_state: props.doorState !== undefined ? formatDoorState(props.doorState) : 'N/A',
          door_state_code: props.doorState,
          battery: {
            level: props.batteryLevel,
            is_charging: props.isCharging,
          },
          last_state_changed: props.lastStateChangedDate,
          jammed_retries: lock.jammed?.retries || 0,
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

      case 'sync_all_locks': {
        const response = await tedeeApi.get('/my/lock/sync');

        const locks = (response.data.result || []).map(lock => {
          const props = lock.lockProperties || {};
          return {
            id: lock.id,
            name: lock.name,
            is_connected: lock.isConnected,
            lock_state: formatLockState(props.state),
            lock_state_code: props.state,
            door_state: props.doorState !== undefined ? formatDoorState(props.doorState) : 'N/A',
            battery_level: props.batteryLevel,
            is_charging: props.isCharging,
            last_state_changed: props.lastStateChangedDate,
          };
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                lock_count: locks.length,
                locks,
              }, null, 2),
            },
          ],
        };
      }

      case 'lock_door': {
        const { lock_id } = args;

        const response = await tedeeApi.post(`/my/lock/${lock_id}/operation/lock`);
        const result = response.data.result;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Lock command sent to lock ${lock_id}`,
                operation_id: result?.operationId,
                last_state_changed: result?.lastStateChangedDate,
              }, null, 2),
            },
          ],
        };
      }

      case 'unlock_door': {
        const { lock_id, mode } = args;

        let url = `/my/lock/${lock_id}/operation/unlock`;
        if (mode) {
          url += `?mode=${mode}`;
        }

        const response = await tedeeApi.post(url);
        const result = response.data.result;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Unlock command sent to lock ${lock_id}`,
                operation_id: result?.operationId,
                last_state_changed: result?.lastStateChangedDate,
              }, null, 2),
            },
          ],
        };
      }

      case 'pull_spring': {
        const { lock_id } = args;

        const response = await tedeeApi.post(`/my/lock/${lock_id}/operation/pull`);
        const result = response.data.result;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Pull spring command sent to lock ${lock_id}`,
                operation_id: result?.operationId,
                last_state_changed: result?.lastStateChangedDate,
              }, null, 2),
            },
          ],
        };
      }

      case 'get_operation_status': {
        const { operation_id } = args;

        const response = await tedeeApi.get(`/my/device/operation/${operation_id}`);
        const result = response.data.result;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                operation_id,
                status: result?.status === 1 ? 'COMPLETED' : 'PENDING',
                result_code: result?.result,
                success: result?.result === 0,
              }, null, 2),
            },
          ],
        };
      }

      case 'get_activity_log': {
        const { lock_id, count = 20 } = args;

        const response = await tedeeApi.get(`/my/deviceactivity`, {
          params: {
            deviceId: lock_id,
            elements: Math.min(count, 200),
          },
        });

        const activities = (response.data.result || []).map(activity => ({
          id: activity.id,
          date: activity.date,
          event: formatEventType(activity.event),
          event_code: activity.event,
          source: formatSourceType(activity.source),
          source_code: activity.source,
          user_name: activity.username || 'Unknown',
          user_id: activity.userId,
        }));

        // Count locks and unlocks
        const lockCount = activities.filter(a => a.event_code === 1).length;
        const unlockCount = activities.filter(a => a.event_code === 2).length;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                lock_id,
                event_count: activities.length,
                summary: {
                  locks: lockCount,
                  unlocks: unlockCount,
                },
                activities,
              }, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    // Handle API errors
    let errorMessage = error.message;
    let statusCode = error.response?.status || 'N/A';
    let details = error.response?.data || 'No additional details';

    if (statusCode === 401) {
      errorMessage = 'Authentication failed. Check your TEDEE_API_KEY in .env file.';
    } else if (statusCode === 404) {
      errorMessage = 'Resource not found. Check the lock ID or operation ID.';
    } else if (statusCode === 403) {
      errorMessage = 'Permission denied. Ensure your API key has the required scopes.';
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: true,
            message: errorMessage,
            details,
            statusCode,
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
  console.error('Tedee Smart Lock MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
