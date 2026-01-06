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
  'AOSMITH_PASSWORD'
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
