// Email Reports Configuration
// Loads and validates environment variables

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Load .env from project root
config({ path: join(projectRoot, '.env') });

// Required environment variables for email reports
const EMAIL_REQUIRED = [
  'GMAIL_USER',
  'GMAIL_APP_PASSWORD',
  'REPORT_RECIPIENT'
];

// Required for MCP data collection
const MCP_REQUIRED = [
  'MIELE_ACCESS_TOKEN',
  'THINQ_PAT',
  'HUUM_USERNAME',
  'HUUM_PASSWORD',
  'PHYN_USERNAME',
  'PHYN_PASSWORD',
  'AOSMITH_EMAIL',
  'AOSMITH_PASSWORD',
  'TESLA_CLIENT_ID',
  'TESLA_CLIENT_SECRET',
  'TESLA_REFRESH_TOKEN'
];

/**
 * Validate that all required environment variables are set
 * @param {boolean} strict - If true, fail on missing MCP vars. If false, warn only.
 * @returns {{ valid: boolean, missing: string[], warnings: string[] }}
 */
export function validateEnvironment(strict = false) {
  const missing = [];
  const warnings = [];

  // Email vars are always required
  for (const envVar of EMAIL_REQUIRED) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  // MCP vars - warn or fail depending on strict mode
  for (const envVar of MCP_REQUIRED) {
    if (!process.env[envVar]) {
      if (strict) {
        missing.push(envVar);
      } else {
        warnings.push(envVar);
      }
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings
  };
}

// Export configuration
export const emailConfig = {
  user: process.env.GMAIL_USER,
  appPassword: process.env.GMAIL_APP_PASSWORD,
  recipient: process.env.REPORT_RECIPIENT
};

export const paths = {
  projectRoot,
  dataDir: join(projectRoot, 'data'),
  logsDir: join(projectRoot, 'logs'),
  historyFile: join(projectRoot, 'data', 'history.json')
};

// Device IDs (from CLAUDE.md)
export const deviceIds = {
  lg: {
    washer: '211e423487fc7b59e4b2aa8eecd763f09365f92db4137992496a776f17cb5112',
    dryer: '930ce551cecf46404810aed03560471f42cb50ab86af8378e209aab1d2a4b9a1'
  },
  miele: {
    oven: '000192190778',
    refrigerator: '000712269805',
    freezer: '000712335856'
  },
  phyn: {
    phynPlus: '28F53743B8D8'
  }
};

// History settings
export const historySettings = {
  maxDays: 84,  // 12 weeks
  pruneThreshold: 90  // Start pruning at 90 days
};

// Cost tracking configuration
export const costConfig = {
  waterCostPerGallon: 0,      // FREE (well water)
  electricityCostPerKwh: 0.20,  // $0.20/kWh
  solarValuePerKwh: 0.20,     // Value of solar generation (avoided grid cost)
  projectionDaysInMonth: 30
};

// Alert thresholds (standard sensitivity)
export const alertThresholds = {
  battery: {
    critical: 15,   // % - urgent replacement needed
    warning: 20,    // % - plan replacement soon
    lowCharge: 40   // % - monitor if not charging
  },
  waterPressure: {
    normalMin: 50,  // PSI
    normalMax: 70,  // PSI
    dropThreshold: 10  // PSI - significant drop in 24h
  },
  temperature: {
    fridgeMin: 1,   // °C
    fridgeMax: 5,   // °C
    freezerMin: -20,  // °C
    freezerMax: -16,  // °C
    fluctuationThreshold: 2  // °C change in 24h
  }
};

// EPA water usage benchmarks (for comparison, not cost)
export const benchmarks = {
  dailyWaterPerPerson: 80,  // gallons
  householdSize: 2  // adjust to your household
};
