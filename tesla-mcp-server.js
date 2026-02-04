#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import dotenv from 'dotenv';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Tesla API configuration
// Try Owner API first (doesn't require partner registration), fall back to Fleet API
const TESLA_OWNER_API_URL = 'https://owner-api.teslamotors.com';
const TESLA_FLEET_API_URL = 'https://fleet-api.prd.na.vn.cloud.tesla.com';
const TESLA_AUTH_URL = 'https://auth.tesla.com/oauth2/v3/token';

// Start with Owner API, switch to Fleet API if needed
let TESLA_API_BASE_URL = TESLA_OWNER_API_URL;

// Environment variables
const TESLA_CLIENT_ID = process.env.TESLA_CLIENT_ID;
const TESLA_CLIENT_SECRET = process.env.TESLA_CLIENT_SECRET;
let TESLA_REFRESH_TOKEN = process.env.TESLA_REFRESH_TOKEN;
let TESLA_ACCESS_TOKEN = process.env.TESLA_ACCESS_TOKEN;
let TESLA_TOKEN_EXPIRY = process.env.TESLA_TOKEN_EXPIRY ? parseInt(process.env.TESLA_TOKEN_EXPIRY) : null;
let TESLA_ENERGY_SITE_ID = process.env.TESLA_ENERGY_SITE_ID;

// Token file for persistence
const TOKEN_FILE = join(__dirname, '.tesla-tokens.json');

// Validate credentials
if (!TESLA_CLIENT_ID || !TESLA_CLIENT_SECRET) {
  console.error('Error: TESLA_CLIENT_ID and TESLA_CLIENT_SECRET must be set in .env file');
  console.error('Visit https://developer.tesla.com to create an application');
  process.exit(1);
}

if (!TESLA_REFRESH_TOKEN) {
  console.error('Error: TESLA_REFRESH_TOKEN must be set in .env file');
  console.error('Run "node tesla-setup.js" to generate tokens');
  process.exit(1);
}

// Load cached tokens if available
function loadCachedTokens() {
  try {
    if (existsSync(TOKEN_FILE)) {
      const data = JSON.parse(readFileSync(TOKEN_FILE, 'utf8'));
      if (data.access_token && data.expiry && Date.now() < data.expiry) {
        TESLA_ACCESS_TOKEN = data.access_token;
        TESLA_TOKEN_EXPIRY = data.expiry;
        if (data.refresh_token) {
          TESLA_REFRESH_TOKEN = data.refresh_token;
        }
        if (data.energy_site_id) {
          TESLA_ENERGY_SITE_ID = data.energy_site_id;
        }
        console.error('[Tesla MCP] Loaded cached tokens');
        return true;
      }
    }
  } catch (error) {
    console.error('[Tesla MCP] Error loading cached tokens:', error.message);
  }
  return false;
}

// Save tokens to cache
function saveCachedTokens() {
  try {
    writeFileSync(TOKEN_FILE, JSON.stringify({
      access_token: TESLA_ACCESS_TOKEN,
      refresh_token: TESLA_REFRESH_TOKEN,
      expiry: TESLA_TOKEN_EXPIRY,
      energy_site_id: TESLA_ENERGY_SITE_ID,
      updated: new Date().toISOString()
    }, null, 2));
    console.error('[Tesla MCP] Saved tokens to cache');
  } catch (error) {
    console.error('[Tesla MCP] Error saving tokens:', error.message);
  }
}

// Refresh access token using refresh token
async function refreshAccessToken() {
  console.error('[Tesla MCP] Refreshing access token...');

  try {
    const response = await axios.post(TESLA_AUTH_URL, {
      grant_type: 'refresh_token',
      client_id: TESLA_CLIENT_ID,
      client_secret: TESLA_CLIENT_SECRET,
      refresh_token: TESLA_REFRESH_TOKEN
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const data = response.data;

    TESLA_ACCESS_TOKEN = data.access_token;
    // Token typically expires in 8 hours, refresh 10 minutes early
    TESLA_TOKEN_EXPIRY = Date.now() + ((data.expires_in || 28800) - 600) * 1000;

    // Tesla may return a new refresh token
    if (data.refresh_token) {
      TESLA_REFRESH_TOKEN = data.refresh_token;
      console.error('[Tesla MCP] Received new refresh token');
    }

    saveCachedTokens();
    console.error('[Tesla MCP] Access token refreshed successfully');

    return true;
  } catch (error) {
    console.error('[Tesla MCP] Token refresh failed:', error.response?.data || error.message);

    // Check if refresh token is expired (3 months)
    if (error.response?.status === 401 || error.response?.data?.error === 'invalid_grant') {
      console.error('[Tesla MCP] CRITICAL: Refresh token may be expired. Run "node tesla-setup.js" to re-authenticate.');
    }

    throw new Error(`Token refresh failed: ${error.response?.data?.error_description || error.message}`);
  }
}

// Ensure we have a valid access token
async function ensureAuthenticated() {
  // Try loading cached tokens first
  if (!TESLA_ACCESS_TOKEN || !TESLA_TOKEN_EXPIRY) {
    loadCachedTokens();
  }

  // Check if token is expired or will expire soon
  if (!TESLA_ACCESS_TOKEN || !TESLA_TOKEN_EXPIRY || Date.now() >= TESLA_TOKEN_EXPIRY) {
    await refreshAccessToken();
  }
}

// Make authenticated API request with auto-retry on 401
async function apiRequest(method, endpoint, data = null, retryCount = 0) {
  await ensureAuthenticated();

  // Use Fleet API (we've registered with it)
  const baseUrl = TESLA_FLEET_API_URL;
  const url = `${baseUrl}${endpoint}`;

  try {
    const config = {
      method,
      url,
      headers: {
        'Authorization': `Bearer ${TESLA_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    // Handle 401 Unauthorized - try refreshing token
    if (error.response?.status === 401 && retryCount < 1) {
      console.error('[Tesla MCP] Got 401, refreshing token and retrying...');
      TESLA_ACCESS_TOKEN = null;
      TESLA_TOKEN_EXPIRY = null;
      return apiRequest(method, endpoint, data, retryCount + 1);
    }

    // Handle rate limiting
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'] || 60;
      throw new Error(`Rate limited. Retry after ${retryAfter} seconds.`);
    }

    throw error;
  }
}

// Get energy site ID (auto-discover if not set)
async function getEnergySiteId() {
  if (TESLA_ENERGY_SITE_ID) {
    return TESLA_ENERGY_SITE_ID;
  }

  console.error('[Tesla MCP] Auto-discovering energy site ID...');

  const response = await apiRequest('GET', '/api/1/products');

  // Find energy site (Powerwall)
  const energySite = response.response?.find(product =>
    product.energy_site_id && (product.resource_type === 'battery' || product.resource_type === 'solar')
  );

  if (!energySite) {
    throw new Error('No Tesla energy products found on account. Make sure Powerwall/Solar is linked to your Tesla account.');
  }

  TESLA_ENERGY_SITE_ID = energySite.energy_site_id.toString();
  console.error(`[Tesla MCP] Found energy site: ${TESLA_ENERGY_SITE_ID}`);

  saveCachedTokens();

  return TESLA_ENERGY_SITE_ID;
}

// Calculate refresh token expiry warning
function getRefreshTokenWarning() {
  // Tesla refresh tokens expire after ~90 days
  // We don't know exact expiry, so warn if token file is old
  try {
    if (existsSync(TOKEN_FILE)) {
      const data = JSON.parse(readFileSync(TOKEN_FILE, 'utf8'));
      if (data.updated) {
        const tokenAge = Date.now() - new Date(data.updated).getTime();
        const daysOld = Math.floor(tokenAge / (86400 * 1000));
        const daysRemaining = 90 - daysOld;

        if (daysRemaining <= 14) {
          return {
            warning: true,
            message: `Refresh token may expire in ~${daysRemaining} days. Run "node tesla-setup.js" to renew.`,
            daysRemaining
          };
        }
      }
    }
  } catch (e) {}
  return { warning: false };
}

// Create MCP server
const server = new Server(
  {
    name: 'tesla-energy',
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
        name: 'get_energy_sites',
        description: 'Get all Tesla energy products (Powerwall, Solar) linked to your account',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_live_status',
        description: 'Get current status of a Powerwall/Solar system (battery level, power flow, grid status)',
        inputSchema: {
          type: 'object',
          properties: {
            site_id: {
              type: 'string',
              description: 'Energy site ID (optional - auto-discovered if not provided)',
            },
          },
        },
      },
      {
        name: 'get_energy_history',
        description: 'Get historical energy data (solar production, battery usage, grid import/export)',
        inputSchema: {
          type: 'object',
          properties: {
            site_id: {
              type: 'string',
              description: 'Energy site ID (optional - auto-discovered if not provided)',
            },
            period: {
              type: 'string',
              description: 'Time period: "day", "week", "month", "year"',
              enum: ['day', 'week', 'month', 'year'],
              default: 'day'
            },
            end_date: {
              type: 'string',
              description: 'End date in YYYY-MM-DD format (optional, defaults to today)',
            },
          },
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
      case 'get_energy_sites': {
        const response = await apiRequest('GET', '/api/1/products');

        // Filter to energy products only
        const energyProducts = (response.response || []).filter(product =>
          product.energy_site_id || product.resource_type === 'battery' || product.resource_type === 'solar'
        );

        const sites = energyProducts.map(product => ({
          energy_site_id: product.energy_site_id?.toString(),
          site_name: product.site_name,
          resource_type: product.resource_type,
          gateway_id: product.gateway_id,
          energy_left: product.energy_left,
          total_pack_energy: product.total_pack_energy,
          percentage_charged: product.percentage_charged,
          battery_power: product.battery_power,
          components: product.components,
        }));

        // Include token health warning
        const tokenWarning = getRefreshTokenWarning();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                site_count: sites.length,
                sites,
                token_health: tokenWarning.warning ? tokenWarning : { status: 'ok' }
              }, null, 2),
            },
          ],
        };
      }

      case 'get_live_status': {
        const siteId = args.site_id || await getEnergySiteId();

        const response = await apiRequest('GET', `/api/1/energy_sites/${siteId}/live_status`);
        const data = response.response;

        // Calculate derived metrics
        const selfPowered = data.solar_power > 0
          ? Math.min(100, Math.round((data.solar_power - (data.grid_power > 0 ? data.grid_power : 0)) / data.load_power * 100))
          : 0;

        const status = {
          site_id: siteId,
          timestamp: data.timestamp || new Date().toISOString(),

          // Battery status
          battery: {
            level: data.percentage_charged,
            power: data.battery_power,  // Negative = discharging, Positive = charging
            status: data.battery_power > 100 ? 'charging' : data.battery_power < -100 ? 'discharging' : 'standby',
            energy_left: data.energy_left,
            total_capacity: data.total_pack_energy
          },

          // Power flow (in Watts)
          power: {
            solar: data.solar_power || 0,
            battery: data.battery_power || 0,
            grid: data.grid_power || 0,  // Negative = exporting, Positive = importing
            home: data.load_power || 0,
            generator: data.generator_power || 0
          },

          // Grid status
          grid: {
            status: data.grid_status,
            connected: data.grid_status === 'Active' || data.grid_status === 'SystemGridConnected',
            services_active: data.grid_services_active
          },

          // Computed metrics
          metrics: {
            self_powered_percentage: selfPowered,
            exporting_to_grid: (data.grid_power || 0) < -100,
            importing_from_grid: (data.grid_power || 0) > 100
          },

          // Storm watch / backup reserve
          backup_reserve: data.backup_reserve_percent,
          storm_mode_active: data.storm_mode_active
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

      case 'get_energy_history': {
        const siteId = args.site_id || await getEnergySiteId();
        const period = args.period || 'day';

        // Build date range
        let endDate = args.end_date ? new Date(args.end_date) : new Date();
        endDate.setHours(23, 59, 59, 999);

        // Calculate start date based on period
        let startDate = new Date(endDate);
        switch (period) {
          case 'day':
            startDate.setDate(startDate.getDate() - 1);
            break;
          case 'week':
            startDate.setDate(startDate.getDate() - 7);
            break;
          case 'month':
            startDate.setMonth(startDate.getMonth() - 1);
            break;
          case 'year':
            startDate.setFullYear(startDate.getFullYear() - 1);
            break;
        }

        // Use calendar_history endpoint - Tesla requires full ISO timestamps
        const params = new URLSearchParams({
          kind: 'energy',
          period: period,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString()
        });

        const response = await apiRequest('GET', `/api/1/energy_sites/${siteId}/calendar_history?${params}`);
        const data = response.response;

        // Process time series data
        const timeSeries = (data.time_series || []).map(entry => ({
          timestamp: entry.timestamp,
          solar_energy: entry.solar_energy_exported || 0,  // kWh generated
          battery_energy_charged: entry.battery_energy_imported || 0,
          battery_energy_discharged: entry.battery_energy_exported || 0,
          grid_energy_imported: entry.grid_energy_imported || 0,
          grid_energy_exported: entry.grid_energy_exported || 0,
          home_energy: entry.consumer_energy_imported_from_grid +
                       entry.consumer_energy_imported_from_solar +
                       entry.consumer_energy_imported_from_battery || 0
        }));

        // Calculate totals (sum is in Wh, convert to kWh)
        const totalsWh = timeSeries.reduce((acc, entry) => ({
          solar_production: acc.solar_production + entry.solar_energy,
          grid_import: acc.grid_import + entry.grid_energy_imported,
          grid_export: acc.grid_export + entry.grid_energy_exported,
          battery_charged: acc.battery_charged + entry.battery_energy_charged,
          battery_discharged: acc.battery_discharged + entry.battery_energy_discharged,
          home_consumption: acc.home_consumption + entry.home_energy
        }), {
          solar_production: 0,
          grid_import: 0,
          grid_export: 0,
          battery_charged: 0,
          battery_discharged: 0,
          home_consumption: 0
        });

        // Convert from Wh to kWh and round
        const totals = {};
        Object.keys(totalsWh).forEach(key => {
          totals[key] = Math.round(totalsWh[key] / 10) / 100;  // Wh -> kWh with 2 decimal places
        });

        // Calculate self-powered percentage
        const selfPowered = totals.home_consumption > 0
          ? Math.round((1 - totals.grid_import / totals.home_consumption) * 100)
          : 0;

        // Net grid position
        const netGrid = totals.grid_export - totals.grid_import;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                site_id: siteId,
                period,
                start_date: startDate.toISOString().split('T')[0],
                end_date: endDate.toISOString().split('T')[0],

                totals: {
                  ...totals,
                  net_grid: netGrid,  // Positive = net exporter, Negative = net importer
                  self_powered_percentage: Math.max(0, Math.min(100, selfPowered))
                },

                summary: {
                  solar_value_estimate: totals.solar_production * 0.20,  // Estimated at $0.20/kWh
                  grid_import_cost_estimate: totals.grid_import * 0.20,
                  net_position: netGrid >= 0 ? 'net_exporter' : 'net_importer'
                },

                time_series: timeSeries
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
  // Load cached tokens on startup
  loadCachedTokens();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Tesla Energy MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
