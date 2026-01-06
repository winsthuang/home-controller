// Data Collector Module
// Collects data from all MCP servers using JSON-RPC protocol

import { spawn } from 'child_process';
import { paths, deviceIds } from './config.js';

const TIMEOUT_MS = 30000;  // 30 second timeout per server

/**
 * Send JSON-RPC message to MCP server and wait for response
 */
function sendRequest(server, request) {
  return new Promise((resolve, reject) => {
    server.stdin.write(JSON.stringify(request) + '\n');
    resolve();
  });
}

/**
 * Create MCP client for a wrapper script
 */
function createMCPClient(wrapperScript) {
  return new Promise((resolve, reject) => {
    const server = spawn(wrapperScript, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: paths.projectRoot
    });

    let buffer = '';
    const responses = [];
    let initialized = false;

    server.stdout.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = JSON.parse(line);
            responses.push(response);

            // Send initialized notification after init response
            if (response.id === 0 && response.result && !initialized) {
              initialized = true;
              server.stdin.write(JSON.stringify({
                jsonrpc: "2.0",
                method: "notifications/initialized"
              }) + '\n');
            }
          } catch (e) {
            // Ignore non-JSON output
          }
        }
      }
    });

    server.on('error', reject);

    resolve({ server, responses });
  });
}

/**
 * Initialize MCP server
 */
async function initializeMCP(server) {
  const initRequest = {
    jsonrpc: "2.0",
    id: 0,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "email-report-collector", version: "1.0.0" }
    }
  };

  server.stdin.write(JSON.stringify(initRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 2000));
}

/**
 * Call an MCP tool
 */
async function callTool(server, responses, toolName, args = {}, requestId) {
  const startLen = responses.length;

  const request = {
    jsonrpc: "2.0",
    id: requestId,
    method: "tools/call",
    params: { name: toolName, arguments: args }
  };

  server.stdin.write(JSON.stringify(request) + '\n');

  // Wait for response
  const maxWait = 10000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    const response = responses.find(r => r.id === requestId);
    if (response) {
      return response;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return null;
}

/**
 * Collect data from LG ThinQ MCP
 */
async function collectLGData() {
  try {
    const { server, responses } = await createMCPClient('./lg-thinq-mcp-wrapper.sh');

    await initializeMCP(server);

    // Get washer status
    const washerResponse = await callTool(server, responses, 'get_device_status',
      { device_id: deviceIds.lg.washer }, 10);

    // Get dryer status
    const dryerResponse = await callTool(server, responses, 'get_device_status',
      { device_id: deviceIds.lg.dryer }, 11);

    server.kill();

    // Parse responses
    let washerData = { status: 'unknown', cycleCount: 0 };
    let dryerData = { status: 'unknown' };

    if (washerResponse?.result?.content?.[0]?.text) {
      const text = washerResponse.result.content[0].text;
      const match = text.match(/\{.*\}/s) || text.match(/\[.*\]/s);
      if (match) {
        try {
          // Convert Python-style to JSON (single quotes, True/False)
          const jsonStr = match[0]
            .replace(/'/g, '"')
            .replace(/True/g, 'true')
            .replace(/False/g, 'false');
          const parsed = JSON.parse(jsonStr);
          const data = Array.isArray(parsed) ? parsed[0] : parsed;
          washerData = {
            status: data.runState?.currentState || 'UNKNOWN',
            cycleCount: data.cycle?.cycleCount || 0,
            remainHour: data.timer?.remainHour || 0,
            remainMinute: data.timer?.remainMinute || 0,
            remoteEnabled: data.remoteControlEnable?.remoteControlEnabled || false
          };
        } catch (e) {}
      }
    }

    if (dryerResponse?.result?.content?.[0]?.text) {
      const text = dryerResponse.result.content[0].text;
      const match = text.match(/\{.*\}/s);
      if (match) {
        try {
          // Convert Python-style to JSON
          const jsonStr = match[0]
            .replace(/'/g, '"')
            .replace(/True/g, 'true')
            .replace(/False/g, 'false');
          const parsed = JSON.parse(jsonStr);
          dryerData = {
            status: parsed.runState?.currentState || 'UNKNOWN',
            remainHour: parsed.timer?.remainHour || 0,
            remainMinute: parsed.timer?.remainMinute || 0,
            remoteEnabled: parsed.remoteControlEnable?.remoteControlEnabled || false
          };
        } catch (e) {}
      }
    }

    return {
      success: true,
      washer: washerData,
      dryer: dryerData
    };
  } catch (error) {
    return { success: false, error: error.message, washer: null, dryer: null };
  }
}

/**
 * Collect data from Miele MCP
 */
async function collectMieleData() {
  try {
    const { server, responses } = await createMCPClient('./miele-mcp-wrapper.sh');

    await initializeMCP(server);

    // Get all device statuses
    const ovenResponse = await callTool(server, responses, 'get_device_status',
      { deviceId: deviceIds.miele.oven }, 20);

    const fridgeResponse = await callTool(server, responses, 'get_device_status',
      { deviceId: deviceIds.miele.refrigerator }, 21);

    const freezerResponse = await callTool(server, responses, 'get_device_status',
      { deviceId: deviceIds.miele.freezer }, 22);

    server.kill();

    const parseDeviceStatus = (response) => {
      if (!response?.result?.content?.[0]?.text) return null;
      try {
        const text = response.result.content[0].text;
        return JSON.parse(text);
      } catch (e) {
        return null;
      }
    };

    const ovenData = parseDeviceStatus(ovenResponse);
    const fridgeData = parseDeviceStatus(fridgeResponse);
    const freezerData = parseDeviceStatus(freezerResponse);

    return {
      success: true,
      oven: {
        status: ovenData?.state?.status?.value_localized || 'Unknown',
        temperature: ovenData?.state?.temperature?.[0]?.value_localized,
        targetTemperature: ovenData?.state?.targetTemperature?.[0]?.value_localized,
        remainingTime: ovenData?.state?.remainingTime,
        inUse: ovenData?.state?.status?.value_localized === 'In use'
      },
      refrigerator: {
        status: fridgeData?.state?.status?.value_localized || 'Unknown',
        temperature: fridgeData?.state?.temperature?.[0]?.value_localized,
        targetTemperature: fridgeData?.state?.targetTemperature?.[0]?.value_localized
      },
      freezer: {
        status: freezerData?.state?.status?.value_localized || 'Unknown',
        temperature: freezerData?.state?.temperature?.[0]?.value_localized,
        targetTemperature: freezerData?.state?.targetTemperature?.[0]?.value_localized
      }
    };
  } catch (error) {
    return { success: false, error: error.message, oven: null, refrigerator: null, freezer: null };
  }
}

/**
 * Collect data from HUUM Sauna MCP
 */
async function collectHUUMData() {
  try {
    const { server, responses } = await createMCPClient('./huum-mcp-wrapper.sh');

    await initializeMCP(server);

    const statusResponse = await callTool(server, responses, 'get_sauna_status', {}, 30);

    server.kill();

    if (statusResponse?.result?.content?.[0]?.text) {
      try {
        const data = JSON.parse(statusResponse.result.content[0].text);
        return {
          success: true,
          temperature: data.temperature,
          targetTemperature: data.targetTemperature,
          heaterOn: data.heaterOn || data.rawStatus?.statusCode === 230,
          doorOpen: data.rawStatus?.door === false,  // door: true means closed
          light: data.rawStatus?.light || 0,
          humidity: data.humidity
        };
      } catch (e) {}
    }

    return { success: false, error: 'Failed to parse response' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Collect data from Phyn Water MCP
 */
async function collectPhynData() {
  try {
    const { server, responses } = await createMCPClient('./phyn-mcp-wrapper.sh');

    await initializeMCP(server);

    // Get device status
    const statusResponse = await callTool(server, responses, 'get_device_status',
      { device_id: deviceIds.phyn.phynPlus }, 40);

    // Get YESTERDAY's consumption (today's data isn't finalized until tomorrow)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}/${String(yesterday.getMonth() + 1).padStart(2, '0')}/${String(yesterday.getDate()).padStart(2, '0')}`;

    const consumptionResponse = await callTool(server, responses, 'get_consumption',
      { device_id: deviceIds.phyn.phynPlus, duration: yesterdayStr }, 41);

    // Get monthly consumption
    const today = new Date();
    const monthStr = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}`;
    const monthlyResponse = await callTool(server, responses, 'get_consumption',
      { device_id: deviceIds.phyn.phynPlus, duration: monthStr }, 42);

    server.kill();

    let statusData = {};
    let dailyConsumption = 0;
    let monthlyConsumption = 0;

    if (statusResponse?.result?.content?.[0]?.text) {
      try {
        statusData = JSON.parse(statusResponse.result.content[0].text);
      } catch (e) {}
    }

    if (consumptionResponse?.result?.content?.[0]?.text) {
      try {
        const data = JSON.parse(consumptionResponse.result.content[0].text);
        dailyConsumption = data.water_consumption || 0;
      } catch (e) {}
    }

    if (monthlyResponse?.result?.content?.[0]?.text) {
      try {
        const data = JSON.parse(monthlyResponse.result.content[0].text);
        monthlyConsumption = data.water_consumption || 0;
      } catch (e) {}
    }

    return {
      success: true,
      pressure: statusData.pressure?.mean,
      flow: statusData.flow?.mean,
      temperature: statusData.temperature?.mean,
      valveStatus: statusData.sov_status?.v || 'Unknown',
      online: statusData.online_status?.v === 'online',
      dailyConsumption,
      monthlyConsumption
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Collect data from A.O. Smith Water Heater MCP
 */
async function collectAOSmithData() {
  try {
    const { server, responses } = await createMCPClient('./aosmith-mcp-wrapper.sh');

    await initializeMCP(server);

    // Get devices first to get junction_id
    const devicesResponse = await callTool(server, responses, 'get_devices', {}, 50);

    let junctionId = null;
    if (devicesResponse?.result?.content?.[0]?.text) {
      try {
        const data = JSON.parse(devicesResponse.result.content[0].text);
        // Try both junction_id (snake_case) and junctionId (camelCase)
        if (data.devices?.[0]?.junction_id) {
          junctionId = data.devices[0].junction_id;
        } else if (data.devices?.[0]?.junctionId) {
          junctionId = data.devices[0].junctionId;
        }
      } catch (e) {}
    }

    if (!junctionId) {
      server.kill();
      return { success: false, error: 'Could not get junction ID' };
    }

    // Get device status
    const statusResponse = await callTool(server, responses, 'get_device_status',
      { junction_id: junctionId }, 51);

    // Get energy usage
    const energyResponse = await callTool(server, responses, 'get_energy_usage',
      { junction_id: junctionId }, 52);

    server.kill();

    let statusData = {};
    let energyData = {};

    if (statusResponse?.result?.content?.[0]?.text) {
      try {
        statusData = JSON.parse(statusResponse.result.content[0].text);
      } catch (e) {}
    }

    if (energyResponse?.result?.content?.[0]?.text) {
      try {
        energyData = JSON.parse(energyResponse.result.content[0].text);
      } catch (e) {}
    }

    return {
      success: true,
      // Handle both possible response structures
      temperatureSetpoint: statusData.temperature?.current_setpoint || statusData.temperatureSetpoint,
      operationMode: statusData.mode?.current || statusData.operationMode,
      modeName: statusData.mode?.current || statusData.modeName,
      isOnline: statusData.online ?? statusData.isOnline,
      hotWaterStatus: statusData.hot_water_status || statusData.hotWaterStatus,
      lifetimeKwh: energyData.lifetimeKwh || 0,
      dailyUsage: energyData.dailyUsage || 0
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Collect data from all MCP servers in parallel
 */
export async function collectAllData() {
  const timestamp = new Date().toISOString();

  // Run all collectors in parallel
  const [lgData, mieleData, huumData, phynData, aosmithData] = await Promise.all([
    collectLGData().catch(e => ({ success: false, error: e.message })),
    collectMieleData().catch(e => ({ success: false, error: e.message })),
    collectHUUMData().catch(e => ({ success: false, error: e.message })),
    collectPhynData().catch(e => ({ success: false, error: e.message })),
    collectAOSmithData().catch(e => ({ success: false, error: e.message }))
  ]);

  // Collect any errors
  const errors = [];
  if (!lgData.success) errors.push(`LG: ${lgData.error}`);
  if (!mieleData.success) errors.push(`Miele: ${mieleData.error}`);
  if (!huumData.success) errors.push(`HUUM: ${huumData.error}`);
  if (!phynData.success) errors.push(`Phyn: ${phynData.error}`);
  if (!aosmithData.success) errors.push(`A.O. Smith: ${aosmithData.error}`);

  return {
    timestamp,
    laundry: {
      washer: lgData.washer,
      dryer: lgData.dryer
    },
    kitchen: {
      oven: mieleData.oven,
      refrigerator: mieleData.refrigerator,
      freezer: mieleData.freezer
    },
    sauna: {
      temperature: huumData.temperature,
      targetTemperature: huumData.targetTemperature,
      heaterOn: huumData.heaterOn,
      doorOpen: huumData.doorOpen
    },
    water: {
      pressure: phynData.pressure,
      flow: phynData.flow,
      temperature: phynData.temperature,
      valveStatus: phynData.valveStatus,
      online: phynData.online,
      dailyConsumption: phynData.dailyConsumption,
      monthlyConsumption: phynData.monthlyConsumption
    },
    waterHeater: {
      temperatureSetpoint: aosmithData.temperatureSetpoint,
      operationMode: aosmithData.operationMode,
      modeName: aosmithData.modeName,
      isOnline: aosmithData.isOnline,
      lifetimeKwh: aosmithData.lifetimeKwh,
      dailyUsage: aosmithData.dailyUsage
    },
    errors
  };
}
