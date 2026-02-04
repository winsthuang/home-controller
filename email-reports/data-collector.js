// Data Collector Module
// Collects data from all MCP servers using JSON-RPC protocol

import { spawn } from 'child_process';
import { paths, deviceIds, alertThresholds } from './config.js';
import { calculateBatteryDischargeRate, getYesterday } from './history-store.js';

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
 * @param {Object} server - MCP server process
 * @param {Array} responses - Responses array
 * @param {string} toolName - Tool name to call
 * @param {Object} args - Tool arguments
 * @param {number} requestId - Request ID
 * @param {number} timeout - Timeout in milliseconds (default: 10000)
 */
async function callTool(server, responses, toolName, args = {}, requestId, timeout = 10000) {
  const startLen = responses.length;

  const request = {
    jsonrpc: "2.0",
    id: requestId,
    method: "tools/call",
    params: { name: toolName, arguments: args }
  };

  server.stdin.write(JSON.stringify(request) + '\n');

  // Wait for response
  const maxWait = timeout;
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
 * Parse and validate JSON response from MCP tool
 * @param {Object} response - MCP response object
 * @param {string} integration - Integration name for logging
 * @param {string} operation - Operation name for logging
 * @returns {Object} - { success: boolean, data?: any, error?: string }
 */
function parseAndValidateResponse(response, integration, operation) {
  if (!response?.result?.content?.[0]?.text) {
    console.error(`[${integration}] ${operation}: No response content received`);
    return { success: false, error: 'No response content' };
  }

  const responseText = response.result.content[0].text;

  // Log raw response for debugging (truncated for readability)
  const preview = responseText.length > 200 ? responseText.substring(0, 200) + '...' : responseText;
  console.error(`[${integration}] ${operation} raw response: ${preview}`);

  try {
    const data = JSON.parse(responseText);

    // Check for GraphQL errors (common in AO Smith API)
    if (data.error || data.errors) {
      const errorMsg = data.message || data.error || (data.errors?.[0]?.message) || 'Unknown GraphQL error';
      console.error(`[${integration}] ${operation}: GraphQL error - ${errorMsg}`);
      return { success: false, error: `GraphQL error: ${errorMsg}` };
    }

    // Success
    return { success: true, data };
  } catch (parseError) {
    console.error(`[${integration}] ${operation}: JSON parse failed - ${parseError.message}`);
    console.error(`[${integration}] ${operation}: Failed text: ${responseText}`);
    return { success: false, error: `Parse error: ${parseError.message}` };
  }
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
    let fixtureBreakdown = null;

    if (statusResponse?.result?.content?.[0]?.text) {
      try {
        statusData = JSON.parse(statusResponse.result.content[0].text);
      } catch (e) {}
    }

    if (consumptionResponse?.result?.content?.[0]?.text) {
      try {
        const data = JSON.parse(consumptionResponse.result.content[0].text);
        dailyConsumption = data.water_consumption || 0;

        // Extract fixture breakdown if available
        if (data.fixtures && Array.isArray(data.fixtures)) {
          fixtureBreakdown = data.fixtures;
        }
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
      signalStrength: statusData.signal_strength || null,
      autoShutoff: statusData.auto_shutoff_enable || false,
      dailyConsumption,
      monthlyConsumption,
      fixtureBreakdown: fixtureBreakdown  // NEW: Fixture-level data
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Collect data from A.O. Smith Water Heater MCP
 * Includes retry logic and comprehensive error handling
 */
async function collectAOSmithData(retryCount = 0) {
  const MAX_RETRIES = 1;
  const RETRY_DELAY_MS = 5000;
  const TIMEOUT_MS = 20000; // Increased timeout for GraphQL API

  try {
    console.error(`[AO Smith] Starting data collection (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);

    const { server, responses } = await createMCPClient('./aosmith-mcp-wrapper.sh');

    await initializeMCP(server);

    // Get devices first to get junction_id
    console.error('[AO Smith] Requesting device list...');
    const devicesResponse = await callTool(server, responses, 'get_devices', {}, 50, TIMEOUT_MS);

    if (!devicesResponse) {
      server.kill();
      const error = 'get_devices request timed out after 20s';
      console.error(`[AO Smith] ERROR: ${error}`);

      // Retry on timeout
      if (retryCount < MAX_RETRIES) {
        console.error(`[AO Smith] Retrying after ${RETRY_DELAY_MS}ms...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        return collectAOSmithData(retryCount + 1);
      }

      return { success: false, error };
    }

    // Parse and validate devices response
    const devicesResult = parseAndValidateResponse(devicesResponse, 'AO Smith', 'get_devices');
    if (!devicesResult.success) {
      server.kill();

      // Retry on transient errors (auth failures, network issues)
      if (retryCount < MAX_RETRIES && !devicesResult.error.includes('Parse error')) {
        console.error(`[AO Smith] Retrying after ${RETRY_DELAY_MS}ms...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        return collectAOSmithData(retryCount + 1);
      }

      return { success: false, error: devicesResult.error };
    }

    // Extract junction ID
    const data = devicesResult.data;

    // Validate response structure
    if (!data.devices || !Array.isArray(data.devices)) {
      server.kill();
      const error = `Invalid API response structure. Expected devices array, got: ${typeof data.devices}`;
      console.error(`[AO Smith] ERROR: ${error}`);
      return { success: false, error };
    }

    if (data.devices.length === 0) {
      server.kill();
      const error = 'No water heaters found on account';
      console.error(`[AO Smith] ERROR: ${error}`);
      return { success: false, error };
    }

    // Try both junction_id (snake_case) and junctionId (camelCase)
    let junctionId = data.devices[0].junction_id || data.devices[0].junctionId;

    if (!junctionId) {
      server.kill();
      const error = 'Device object missing junction_id field';
      console.error(`[AO Smith] ERROR: ${error}`);
      console.error(`[AO Smith] Device structure: ${JSON.stringify(data.devices[0])}`);
      return { success: false, error };
    }

    console.error(`[AO Smith] Found junction ID: ${junctionId}`);

    // Get device status
    console.error('[AO Smith] Requesting device status...');
    const statusResponse = await callTool(server, responses, 'get_device_status',
      { junction_id: junctionId }, 51, TIMEOUT_MS);

    if (!statusResponse) {
      server.kill();
      return { success: false, error: 'get_device_status request timed out after 20s' };
    }

    const statusResult = parseAndValidateResponse(statusResponse, 'AO Smith', 'get_device_status');
    if (!statusResult.success) {
      server.kill();
      return { success: false, error: `Status error: ${statusResult.error}` };
    }

    const statusData = statusResult.data;

    // Get energy usage
    console.error('[AO Smith] Requesting energy usage...');
    const energyResponse = await callTool(server, responses, 'get_energy_usage',
      { junction_id: junctionId }, 52, TIMEOUT_MS);

    if (!energyResponse) {
      server.kill();
      return { success: false, error: 'get_energy_usage request timed out after 20s' };
    }

    const energyResult = parseAndValidateResponse(energyResponse, 'AO Smith', 'get_energy_usage');
    if (!energyResult.success) {
      server.kill();
      return { success: false, error: `Energy error: ${energyResult.error}` };
    }

    const energyData = energyResult.data;

    // Extract 7-day graph data if available
    let graphData = [];
    if (energyData.graphData && Array.isArray(energyData.graphData)) {
      graphData = energyData.graphData.map(d => ({
        date: d.date,
        kwh: d.kwh || 0
      }));
      console.error(`[AO Smith] Got ${graphData.length} days of graph data`);
    }

    server.kill();

    const result = {
      success: true,
      // Handle both possible response structures
      temperatureSetpoint: statusData.temperature?.current_setpoint || statusData.temperatureSetpoint,
      operationMode: statusData.mode?.current || statusData.operationMode,
      modeName: statusData.mode?.current || statusData.modeName,
      isOnline: statusData.online ?? statusData.isOnline,
      hotWaterStatus: statusData.hot_water_status || statusData.hotWaterStatus,
      lifetimeKwh: energyData.lifetimeKwh || 0,
      dailyUsage: energyData.dailyUsage || 0,
      graphData: graphData  // NEW: 7-day energy pattern
    };

    console.error(`[AO Smith] Data collection successful. Daily usage: ${result.dailyUsage} kWh`);

    return result;
  } catch (error) {
    console.error(`[AO Smith] Unexpected error: ${error.message}`);
    console.error(`[AO Smith] Stack trace: ${error.stack}`);

    // Retry on unexpected errors
    if (retryCount < MAX_RETRIES) {
      console.error(`[AO Smith] Retrying after ${RETRY_DELAY_MS}ms...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      return collectAOSmithData(retryCount + 1);
    }

    return { success: false, error: error.message };
  }
}

/**
 * Collect data from Tesla Energy MCP (Powerwall/Solar)
 */
async function collectTeslaData(retryCount = 0) {
  const MAX_RETRIES = 1;
  const RETRY_DELAY_MS = 5000;
  const TIMEOUT_MS = 30000;

  try {
    console.error(`[Tesla] Starting data collection (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);

    const { server, responses } = await createMCPClient('./tesla-mcp-wrapper.sh');

    await initializeMCP(server);

    // Get live status first (will auto-discover site_id)
    console.error('[Tesla] Requesting live status...');
    const liveStatusResponse = await callTool(server, responses, 'get_live_status', {}, 70, TIMEOUT_MS);

    if (!liveStatusResponse) {
      server.kill();
      const error = 'get_live_status request timed out';
      console.error(`[Tesla] ERROR: ${error}`);

      if (retryCount < MAX_RETRIES) {
        console.error(`[Tesla] Retrying after ${RETRY_DELAY_MS}ms...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        return collectTeslaData(retryCount + 1);
      }

      return { success: false, error };
    }

    const liveResult = parseAndValidateResponse(liveStatusResponse, 'Tesla', 'get_live_status');
    if (!liveResult.success) {
      server.kill();

      if (retryCount < MAX_RETRIES && !liveResult.error.includes('Parse error')) {
        console.error(`[Tesla] Retrying after ${RETRY_DELAY_MS}ms...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        return collectTeslaData(retryCount + 1);
      }

      return { success: false, error: liveResult.error };
    }

    const liveData = liveResult.data;
    const siteId = liveData.site_id;

    // Get yesterday's energy history
    console.error('[Tesla] Requesting energy history...');
    const historyResponse = await callTool(server, responses, 'get_energy_history',
      { site_id: siteId, period: 'day' }, 71, TIMEOUT_MS);

    let historyData = null;
    if (historyResponse) {
      const historyResult = parseAndValidateResponse(historyResponse, 'Tesla', 'get_energy_history');
      if (historyResult.success) {
        historyData = historyResult.data;
      } else {
        console.error(`[Tesla] History request failed: ${historyResult.error}`);
      }
    }

    server.kill();

    const result = {
      success: true,
      siteId: siteId,

      // Current battery status
      batteryLevel: liveData.battery?.level,
      batteryPower: liveData.battery?.power,
      batteryStatus: liveData.battery?.status,
      batteryCapacity: liveData.battery?.total_capacity,

      // Current power flow (Watts)
      solarPower: liveData.power?.solar || 0,
      gridPower: liveData.power?.grid || 0,
      homePower: liveData.power?.home || 0,

      // Grid status
      gridConnected: liveData.grid?.connected,
      gridStatus: liveData.grid?.status,

      // Self-powered percentage (real-time)
      selfPoweredPercentage: liveData.metrics?.self_powered_percentage,
      exportingToGrid: liveData.metrics?.exporting_to_grid,
      importingFromGrid: liveData.metrics?.importing_from_grid,

      // Backup reserve
      backupReserve: liveData.backup_reserve,
      stormModeActive: liveData.storm_mode_active,

      // Energy totals for yesterday (kWh) - from history
      solarProduction: historyData?.totals?.solar_production || 0,
      gridImport: historyData?.totals?.grid_import || 0,
      gridExport: historyData?.totals?.grid_export || 0,
      homeConsumption: historyData?.totals?.home_consumption || 0,
      netGrid: historyData?.totals?.net_grid || 0,
      historySelfPowered: historyData?.totals?.self_powered_percentage || null,

      // Value estimates
      solarValue: historyData?.summary?.solar_value_estimate || 0,
      gridCost: historyData?.summary?.grid_import_cost_estimate || 0
    };

    console.error(`[Tesla] Data collection successful. Solar: ${result.solarProduction} kWh, Battery: ${result.batteryLevel}%`);

    return result;
  } catch (error) {
    console.error(`[Tesla] Unexpected error: ${error.message}`);

    if (retryCount < MAX_RETRIES) {
      console.error(`[Tesla] Retrying after ${RETRY_DELAY_MS}ms...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      return collectTeslaData(retryCount + 1);
    }

    return { success: false, error: error.message };
  }
}

/**
 * Collect data from Tedee Smart Lock MCP
 */
async function collectTedeeData() {
  try {
    const { server, responses } = await createMCPClient('./tedee-mcp-wrapper.sh');

    await initializeMCP(server);

    // Get device list first (has names)
    const devicesResponse = await callTool(server, responses, 'get_devices', {}, 59);
    let deviceNames = {};
    if (devicesResponse?.result?.content?.[0]?.text) {
      try {
        const data = JSON.parse(devicesResponse.result.content[0].text);
        (data.locks || []).forEach(lock => {
          deviceNames[lock.id] = lock.name;
        });
      } catch (e) {}
    }

    // Sync all locks to get current status
    const syncResponse = await callTool(server, responses, 'sync_all_locks', {}, 60);

    let locks = [];
    if (syncResponse?.result?.content?.[0]?.text) {
      try {
        const data = JSON.parse(syncResponse.result.content[0].text);
        locks = (data.locks || []).map(lock => ({
          ...lock,
          name: deviceNames[lock.id] || lock.name || `Lock ${lock.id}`
        }));
      } catch (e) {}
    }

    // Get activity logs for each lock to count lock/unlock events and sources
    let totalLocks = 0;
    let totalUnlocks = 0;

    // Activity breakdown by source
    const activityBreakdown = {
      locksBySource: { manual: 0, app: 0, autoLock: 0 },
      unlocksBySource: { manual: 0, app: 0, autoUnlock: 0 }
    };

    for (let i = 0; i < locks.length; i++) {
      const lock = locks[i];
      const activityResponse = await callTool(server, responses, 'get_activity_log',
        { lock_id: lock.id, count: 200 }, 61 + i);

      if (activityResponse?.result?.content?.[0]?.text) {
        try {
          const data = JSON.parse(activityResponse.result.content[0].text);
          const activities = data.activities || [];

          // Filter to last 24 hours
          const oneDayAgo = new Date();
          oneDayAgo.setDate(oneDayAgo.getDate() - 1);

          for (const activity of activities) {
            const activityDate = new Date(activity.date);
            if (activityDate >= oneDayAgo) {
              // Track event counts
              if (activity.event_code === 1) totalLocks++;  // Lock event
              if (activity.event_code === 2) totalUnlocks++;  // Unlock event

              // Track sources (source_code: 1=Manual button, 2=Manual, 5=Auto-unlock, 6=Auto-lock, 9=App)
              if (activity.event_code === 1) { // Lock event
                if (activity.source_code === 2 || activity.source_code === 1) {
                  activityBreakdown.locksBySource.manual++;
                } else if (activity.source_code === 9) {
                  activityBreakdown.locksBySource.app++;
                } else if (activity.source_code === 6) {
                  activityBreakdown.locksBySource.autoLock++;
                }
              } else if (activity.event_code === 2) { // Unlock event
                if (activity.source_code === 2 || activity.source_code === 1) {
                  activityBreakdown.unlocksBySource.manual++;
                } else if (activity.source_code === 9) {
                  activityBreakdown.unlocksBySource.app++;
                } else if (activity.source_code === 5) {
                  activityBreakdown.unlocksBySource.autoUnlock++;
                }
              }
            }
          }
        } catch (e) {}
      }
    }

    server.kill();

    return {
      success: true,
      locks: locks.map(lock => ({
        id: lock.id,
        name: lock.name,
        isConnected: lock.is_connected,
        lockState: lock.lock_state,
        lockStateCode: lock.lock_state_code,
        doorState: lock.door_state,
        batteryLevel: lock.battery_level,
        isCharging: lock.is_charging
      })),
      lockCount: locks.length,
      todayLocks: totalLocks,
      todayUnlocks: totalUnlocks,
      activityBreakdown: activityBreakdown  // NEW: Activity sources breakdown
    };
  } catch (error) {
    return { success: false, error: error.message, locks: [], lockCount: 0, todayLocks: 0, todayUnlocks: 0 };
  }
}

/**
 * Collect data from all MCP servers in parallel
 */
export async function collectAllData() {
  const timestamp = new Date().toISOString();

  // Run all collectors in parallel
  const [lgData, mieleData, huumData, phynData, aosmithData, tedeeData, teslaData] = await Promise.all([
    collectLGData().catch(e => ({ success: false, error: e.message })),
    collectMieleData().catch(e => ({ success: false, error: e.message })),
    collectHUUMData().catch(e => ({ success: false, error: e.message })),
    collectPhynData().catch(e => ({ success: false, error: e.message })),
    collectAOSmithData().catch(e => ({ success: false, error: e.message })),
    collectTedeeData().catch(e => ({ success: false, error: e.message, locks: [], lockCount: 0, todayLocks: 0, todayUnlocks: 0 })),
    collectTeslaData().catch(e => ({ success: false, error: e.message }))
  ]);

  // Collect any errors
  const errors = [];
  if (!lgData.success) errors.push(`LG: ${lgData.error}`);
  if (!mieleData.success) errors.push(`Miele: ${mieleData.error}`);
  if (!huumData.success) errors.push(`HUUM: ${huumData.error}`);
  if (!phynData.success) errors.push(`Phyn: ${phynData.error}`);
  if (!aosmithData.success) errors.push(`A.O. Smith: ${aosmithData.error}`);
  if (!tedeeData.success) errors.push(`Tedee: ${tedeeData.error}`);
  if (!teslaData.success) errors.push(`Tesla: ${teslaData.error}`);

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
      signalStrength: phynData.signalStrength,
      autoShutoff: phynData.autoShutoff,
      dailyConsumption: phynData.dailyConsumption,
      monthlyConsumption: phynData.monthlyConsumption,
      fixtureBreakdown: phynData.fixtureBreakdown  // NEW
    },
    waterHeater: {
      temperatureSetpoint: aosmithData.temperatureSetpoint,
      operationMode: aosmithData.operationMode,
      modeName: aosmithData.modeName,
      isOnline: aosmithData.isOnline,
      lifetimeKwh: aosmithData.lifetimeKwh,
      dailyUsage: aosmithData.dailyUsage,
      graphData: aosmithData.graphData  // NEW
    },
    smartLocks: {
      locks: tedeeData.locks || [],
      lockCount: tedeeData.lockCount || 0,
      todayLocks: tedeeData.todayLocks || 0,
      todayUnlocks: tedeeData.todayUnlocks || 0,
      activityBreakdown: tedeeData.activityBreakdown
    },
    tesla: {
      // Current status
      batteryLevel: teslaData.batteryLevel,
      batteryPower: teslaData.batteryPower,
      batteryStatus: teslaData.batteryStatus,
      solarPower: teslaData.solarPower,
      gridPower: teslaData.gridPower,
      homePower: teslaData.homePower,
      gridConnected: teslaData.gridConnected,
      selfPoweredPercentage: teslaData.selfPoweredPercentage,
      exportingToGrid: teslaData.exportingToGrid,
      importingFromGrid: teslaData.importingFromGrid,
      backupReserve: teslaData.backupReserve,
      stormModeActive: teslaData.stormModeActive,

      // Daily totals (kWh)
      solarProduction: teslaData.solarProduction || 0,
      gridImport: teslaData.gridImport || 0,
      gridExport: teslaData.gridExport || 0,
      homeConsumption: teslaData.homeConsumption || 0,
      netGrid: teslaData.netGrid || 0,
      historySelfPowered: teslaData.historySelfPowered,

      // Value estimates
      solarValue: teslaData.solarValue || 0,
      gridCost: teslaData.gridCost || 0
    },
    errors
  };
}

/**
 * Analyze collected data and generate maintenance alerts
 * @param {Object} currentData - Current data from collectAllData()
 * @param {Object} history - History object from loadHistory()
 * @returns {Array} - Array of alert objects
 */
export function generateMaintenanceAlerts(currentData, history) {
  const alerts = [];

  // 1. BATTERY ALERTS
  if (currentData.smartLocks?.locks) {
    for (const lock of currentData.smartLocks.locks) {
      if (lock.batteryLevel < alertThresholds.battery.critical) {
        const dischargeRate = calculateBatteryDischargeRate(lock.id, history);
        const daysRemaining = Math.floor(lock.batteryLevel / dischargeRate * 7);
        const depletionDate = new Date(Date.now() + daysRemaining * 86400000);

        alerts.push({
          severity: 'critical',
          category: 'battery',
          device: lock.name,
          message: `Battery at ${lock.batteryLevel}% (URGENT)`,
          detail: `Discharge rate: ${dischargeRate.toFixed(1)}% per week`,
          action: `Replace batteries within ${daysRemaining} days`,
          estimate: `Estimated depletion: ${depletionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
        });
      } else if (lock.batteryLevel <= alertThresholds.battery.warning) {
        alerts.push({
          severity: 'warning',
          category: 'battery',
          device: lock.name,
          message: `Battery at ${lock.batteryLevel}%`,
          action: 'Plan replacement within 1-2 weeks'
        });
      }
    }
  }

  // 2. WATER PRESSURE ALERTS
  if (currentData.water?.pressure) {
    const yesterday = getYesterday();
    if (yesterday?.waterPressure) {
      const pressureDrop = yesterday.waterPressure - currentData.water.pressure;
      if (Math.abs(pressureDrop) >= alertThresholds.waterPressure.dropThreshold) {
        alerts.push({
          severity: 'warning',
          category: 'pressure',
          device: 'Water System',
          message: `Pressure ${pressureDrop > 0 ? 'dropped' : 'increased'} from ${yesterday.waterPressure.toFixed(1)} to ${currentData.water.pressure.toFixed(1)} PSI`,
          change: `${pressureDrop > 0 ? '-' : '+'}${Math.abs(pressureDrop / yesterday.waterPressure * 100).toFixed(1)}% in past 24 hours`,
          possible: pressureDrop > 0 ? 'Minor leak or valve issue' : 'Pressure regulator issue',
          action: 'Monitor for further changes'
        });
      }
    }

    // Check if pressure is outside normal range
    if (currentData.water.pressure < alertThresholds.waterPressure.normalMin) {
      alerts.push({
        severity: 'warning',
        category: 'pressure',
        device: 'Water System',
        message: `Pressure below normal (${currentData.water.pressure.toFixed(1)} PSI)`,
        detail: `Normal range: ${alertThresholds.waterPressure.normalMin}-${alertThresholds.waterPressure.normalMax} PSI`,
        action: 'Check well pump and pressure tank'
      });
    } else if (currentData.water.pressure > alertThresholds.waterPressure.normalMax) {
      alerts.push({
        severity: 'warning',
        category: 'pressure',
        device: 'Water System',
        message: `Pressure above normal (${currentData.water.pressure.toFixed(1)} PSI)`,
        detail: `Normal range: ${alertThresholds.waterPressure.normalMin}-${alertThresholds.waterPressure.normalMax} PSI`,
        action: 'Check pressure regulator'
      });
    }
  }

  // 3. TEMPERATURE ALERTS - Freezer
  if (currentData.kitchen?.freezer?.temperature !== undefined) {
    const yesterday = getYesterday();
    const freezerTemp = parseFloat(currentData.kitchen.freezer.temperature);

    if (yesterday?.freezerTemp) {
      const tempChange = Math.abs(freezerTemp - yesterday.freezerTemp);
      if (tempChange >= alertThresholds.temperature.fluctuationThreshold) {
        alerts.push({
          severity: 'warning',
          category: 'temperature',
          device: 'Freezer',
          message: `Temperature fluctuated ${tempChange.toFixed(1)}°C`,
          normal: `${alertThresholds.temperature.freezerMin}°C to ${alertThresholds.temperature.freezerMax}°C`,
          measured: `${yesterday.freezerTemp.toFixed(1)}°C to ${freezerTemp.toFixed(1)}°C`,
          action: 'Check door seal and defrost cycle'
        });
      }
    }

    // Check if temperature is outside normal range
    if (freezerTemp > alertThresholds.temperature.freezerMax || freezerTemp < alertThresholds.temperature.freezerMin) {
      alerts.push({
        severity: 'warning',
        category: 'temperature',
        device: 'Freezer',
        message: `Temperature outside normal range (${freezerTemp.toFixed(1)}°C)`,
        detail: `Normal range: ${alertThresholds.temperature.freezerMin}°C to ${alertThresholds.temperature.freezerMax}°C`,
        action: 'Check appliance settings and door seal'
      });
    }
  }

  // 4. TEMPERATURE ALERTS - Refrigerator
  if (currentData.kitchen?.refrigerator?.temperature !== undefined) {
    const yesterday = getYesterday();
    const fridgeTemp = parseFloat(currentData.kitchen.refrigerator.temperature);

    if (yesterday?.fridgeTemp) {
      const tempChange = Math.abs(fridgeTemp - yesterday.fridgeTemp);
      if (tempChange >= alertThresholds.temperature.fluctuationThreshold) {
        alerts.push({
          severity: 'warning',
          category: 'temperature',
          device: 'Refrigerator',
          message: `Temperature fluctuated ${tempChange.toFixed(1)}°C`,
          normal: `${alertThresholds.temperature.fridgeMin}°C to ${alertThresholds.temperature.fridgeMax}°C`,
          measured: `${yesterday.fridgeTemp.toFixed(1)}°C to ${fridgeTemp.toFixed(1)}°C`,
          action: 'Check door seal and temperature settings'
        });
      }
    }

    // Check if temperature is outside normal range
    if (fridgeTemp > alertThresholds.temperature.fridgeMax || fridgeTemp < alertThresholds.temperature.fridgeMin) {
      alerts.push({
        severity: 'warning',
        category: 'temperature',
        device: 'Refrigerator',
        message: `Temperature outside normal range (${fridgeTemp.toFixed(1)}°C)`,
        detail: `Normal range: ${alertThresholds.temperature.fridgeMin}°C to ${alertThresholds.temperature.fridgeMax}°C`,
        action: 'Check appliance settings and door seal'
      });
    }
  }

  // 5. SYSTEM HEALTH ALERTS
  if (currentData.smartLocks?.locks) {
    for (const lock of currentData.smartLocks.locks) {
      if (!lock.isConnected) {
        alerts.push({
          severity: 'warning',
          category: 'connectivity',
          device: lock.name,
          message: 'Lock offline',
          action: 'Check bridge connection and power'
        });
      }
    }
  }

  if (currentData.water?.signalStrength && currentData.water.signalStrength < -70) {
    alerts.push({
      severity: 'info',
      category: 'connectivity',
      device: 'Water Monitor',
      message: `Weak WiFi signal (${currentData.water.signalStrength} dBm)`,
      action: 'Consider moving router or adding WiFi extender'
    });
  }

  return alerts;
}
