#!/usr/bin/env node

/**
 * Tesla Fleet API OAuth Setup Script
 *
 * This script handles the one-time OAuth authorization flow to get
 * refresh tokens for the Tesla Fleet API.
 *
 * Prerequisites:
 * 1. Register at https://developer.tesla.com
 * 2. Create an application with:
 *    - Allowed Origins: http://localhost:3000
 *    - Allowed Redirect URIs: http://localhost:3000/callback
 * 3. Add TESLA_CLIENT_ID and TESLA_CLIENT_SECRET to .env
 *
 * Usage:
 *   node tesla-setup.js
 */

import { createServer } from 'http';
import { URL } from 'url';
import crypto from 'crypto';
import axios from 'axios';
import { config } from 'dotenv';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import open from 'open';

// Load environment
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TESLA_AUTH_URL = 'https://auth.tesla.com';
const TESLA_API_URL = 'https://fleet-api.prd.na.vn.cloud.tesla.com';
const REDIRECT_URI = 'http://localhost:3000/callback';
const PARTNER_DOMAIN = 'winsthuang.github.io';
const PORT = 3000;

// Required scopes for energy monitoring (read-only)
const SCOPES = [
  'openid',
  'offline_access',
  'energy_device_data'
].join(' ');

// Validate environment
const CLIENT_ID = process.env.TESLA_CLIENT_ID;
const CLIENT_SECRET = process.env.TESLA_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('\n❌ Missing required environment variables!');
  console.error('\nPlease add these to your .env file:');
  console.error('  TESLA_CLIENT_ID=your_client_id');
  console.error('  TESLA_CLIENT_SECRET=your_client_secret');
  console.error('\nTo get these credentials:');
  console.error('  1. Go to https://developer.tesla.com');
  console.error('  2. Sign in with your Tesla account');
  console.error('  3. Create a new application');
  console.error('  4. Set Allowed Redirect URIs to: http://localhost:3000/callback');
  console.error('  5. Copy the Client ID and Client Secret');
  process.exit(1);
}

// Generate PKCE code verifier and challenge
function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
  return { verifier, challenge };
}

// Generate random state for CSRF protection
function generateState() {
  return crypto.randomBytes(16).toString('hex');
}

// Build authorization URL
function buildAuthUrl(state, codeChallenge) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  });

  return `${TESLA_AUTH_URL}/oauth2/v3/authorize?${params}`;
}

// Exchange authorization code for tokens
async function exchangeCodeForTokens(code, codeVerifier) {
  console.log('\n🔄 Exchanging authorization code for tokens...');

  try {
    const response = await axios.post(`${TESLA_AUTH_URL}/oauth2/v3/token`, {
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code: code,
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  } catch (error) {
    console.error('Token exchange failed:', error.response?.data || error.message);
    throw error;
  }
}

// Register with Tesla Fleet API (required before accessing data)
async function registerWithFleetAPI(accessToken) {
  console.log('\n📝 Registering with Tesla Fleet API...');
  console.log(`   Domain: ${PARTNER_DOMAIN}`);

  try {
    const response = await axios.post(`${TESLA_API_URL}/api/1/partner_accounts`, {
      domain: PARTNER_DOMAIN
    }, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Successfully registered with Fleet API');
    return true;
  } catch (error) {
    // 409 Conflict means already registered, which is fine
    if (error.response?.status === 409) {
      console.log('✅ Already registered with Fleet API');
      return true;
    }
    // 412 means we need to register - this shouldn't happen here but log it
    if (error.response?.status === 412) {
      console.log('⚠️  Registration required - attempting...');
      console.log('   Error:', error.response?.data?.error || error.message);
    }
    console.error('Fleet API registration note:', error.response?.data || error.message);
    // Don't fail - continue anyway and let the user know
    return false;
  }
}

// Discover energy site ID
async function discoverEnergySite(accessToken) {
  console.log('\n🔍 Discovering energy products...');

  try {
    const response = await axios.get(`${TESLA_API_URL}/api/1/products`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const products = response.data.response || [];
    const energySite = products.find(p =>
      p.energy_site_id && (p.resource_type === 'battery' || p.resource_type === 'solar')
    );

    if (energySite) {
      console.log(`✅ Found energy site: ${energySite.site_name || 'Unnamed'}`);
      console.log(`   Site ID: ${energySite.energy_site_id}`);
      console.log(`   Type: ${energySite.resource_type}`);
      return energySite.energy_site_id.toString();
    } else {
      console.log('⚠️  No Powerwall/Solar found on account');
      console.log('   Available products:', products.map(p => p.resource_type || 'unknown').join(', '));
      return null;
    }
  } catch (error) {
    // Handle 412 - need to register first
    if (error.response?.status === 412) {
      console.log('⚠️  Need to complete Fleet API registration first');
      console.log('   This is a one-time Tesla requirement for new apps.');
      console.log('   Error:', error.response?.data?.error || error.message);
    } else {
      console.error('Energy site discovery failed:', error.response?.data || error.message);
    }
    return null;
  }
}

// Save tokens to .env file
function updateEnvFile(tokens, siteId) {
  const envPath = join(__dirname, '.env');
  let envContent = '';

  if (existsSync(envPath)) {
    envContent = readFileSync(envPath, 'utf8');
  }

  // Helper to update or add env var
  const updateEnv = (key, value) => {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
  };

  // Update Tesla tokens
  updateEnv('TESLA_ACCESS_TOKEN', tokens.access_token);
  updateEnv('TESLA_REFRESH_TOKEN', tokens.refresh_token);
  updateEnv('TESLA_TOKEN_EXPIRY', (Date.now() + tokens.expires_in * 1000).toString());

  if (siteId) {
    updateEnv('TESLA_ENERGY_SITE_ID', siteId);
  }

  // Clean up any double newlines
  envContent = envContent.replace(/\n\n+/g, '\n\n').trim() + '\n';

  writeFileSync(envPath, envContent);
  console.log('\n✅ Updated .env file with Tesla credentials');
}

// Also save to token cache file
function saveTokenCache(tokens, siteId) {
  const cachePath = join(__dirname, '.tesla-tokens.json');
  const data = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry: Date.now() + tokens.expires_in * 1000,
    energy_site_id: siteId,
    updated: new Date().toISOString()
  };

  writeFileSync(cachePath, JSON.stringify(data, null, 2));
  console.log('✅ Saved token cache to .tesla-tokens.json');
}

// Main setup flow
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           Tesla Fleet API Setup                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\nThis will authorize the Home Controller to access your Tesla');
  console.log('Powerwall and Solar data (read-only).\n');

  // Generate PKCE and state
  const { verifier, challenge } = generatePKCE();
  const state = generateState();

  // Create HTTP server to receive callback
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:${PORT}`);

      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code');
        const returnedState = url.searchParams.get('state');
        const error = url.searchParams.get('error');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1>❌ Authorization Failed</h1>
                <p>Error: ${error}</p>
                <p>${url.searchParams.get('error_description') || ''}</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          server.close();
          reject(new Error(`Authorization failed: ${error}`));
          return;
        }

        if (returnedState !== state) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1>❌ Security Error</h1>
                <p>State mismatch - possible CSRF attack.</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          server.close();
          reject(new Error('State mismatch'));
          return;
        }

        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1>✅ Authorization Successful!</h1>
                <p>Exchanging tokens... Check the terminal for results.</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);

          try {
            // Exchange code for tokens
            const tokens = await exchangeCodeForTokens(code, verifier);

            console.log('\n✅ Successfully obtained tokens!');
            console.log(`   Access token expires in: ${Math.round(tokens.expires_in / 3600)} hours`);
            console.log('   Refresh token: Obtained (valid for ~90 days)');

            // Register with Fleet API
            await registerWithFleetAPI(tokens.access_token);

            // Discover energy site
            const siteId = await discoverEnergySite(tokens.access_token);

            // Save tokens
            updateEnvFile(tokens, siteId);
            saveTokenCache(tokens, siteId);

            console.log('\n════════════════════════════════════════════════════════════');
            console.log('Setup complete! You can now use the Tesla MCP server.');
            console.log('\nTest with:');
            console.log('  node test-tesla-mcp.cjs');
            console.log('\n⚠️  IMPORTANT: Refresh tokens expire after ~90 days.');
            console.log('   Run this setup script again before they expire.');
            console.log('════════════════════════════════════════════════════════════\n');

            server.close();
            resolve(tokens);
          } catch (error) {
            server.close();
            reject(error);
          }
        }
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body style="font-family: system-ui; padding: 40px; text-align: center;">
              <h1>Tesla Authorization Server</h1>
              <p>Waiting for callback...</p>
            </body>
          </html>
        `);
      }
    });

    server.listen(PORT, () => {
      console.log(`📡 Started callback server on port ${PORT}`);

      const authUrl = buildAuthUrl(state, challenge);

      console.log('\n🌐 Opening browser for Tesla authorization...\n');
      console.log('If the browser doesn\'t open automatically, visit:');
      console.log(`\n${authUrl}\n`);

      // Try to open browser
      open(authUrl).catch(() => {
        console.log('(Could not auto-open browser - please copy the URL above)');
      });
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`\n❌ Port ${PORT} is already in use.`);
        console.error('Please close any application using that port and try again.');
      }
      reject(error);
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      console.error('\n⏱️  Authorization timed out (5 minutes)');
      server.close();
      reject(new Error('Authorization timeout'));
    }, 5 * 60 * 1000);
  });
}

main().catch((error) => {
  console.error('\n❌ Setup failed:', error.message);
  process.exit(1);
});
