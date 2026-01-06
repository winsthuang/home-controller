#!/usr/bin/env node

import axios from 'axios';
import dotenv from 'dotenv';
import { readFileSync, writeFileSync } from 'fs';
import { createServer } from 'http';
import { parse } from 'url';
import { exec } from 'child_process';

dotenv.config();

const CLIENT_ID = process.env.MIELE_CLIENT_ID;
const CLIENT_SECRET = process.env.MIELE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3000/callback';
// Try legacy endpoint for US accounts
const AUTH_BASE_URL = 'https://api.mcs3.miele.com/thirdparty';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Error: MIELE_CLIENT_ID and MIELE_CLIENT_SECRET must be set in .env file');
  process.exit(1);
}

console.log('Miele OAuth Authentication');
console.log('=========================\n');

// Step 1: Generate authorization URL
const authUrl = new URL(`${AUTH_BASE_URL}/login`);
authUrl.searchParams.append('client_id', CLIENT_ID);
authUrl.searchParams.append('response_type', 'code');
authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
// No scope parameter - Miele doesn't require it
authUrl.searchParams.append('state', Math.random().toString(36).substring(7));

console.log('Step 1: Opening browser for authentication...');
console.log('URL:', authUrl.toString());
console.log('\nIf the browser doesn\'t open, please copy and paste the URL above.\n');

// Open browser
const platform = process.platform;
const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
exec(`${command} "${authUrl.toString()}"`);

// Step 2: Start local server to receive callback
const server = createServer(async (req, res) => {
  const parsedUrl = parse(req.url, true);

  if (parsedUrl.pathname === '/callback') {
    const code = parsedUrl.query.code;

    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<h1>Error: No authorization code received</h1>');
      server.close();
      process.exit(1);
    }

    console.log('\nStep 2: Authorization code received!');
    console.log('Step 3: Exchanging code for access token...\n');

    try {
      // Exchange authorization code for access token
      const tokenResponse = await axios.post(
        `${AUTH_BASE_URL}/token`,
        new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: REDIRECT_URI,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const { access_token, refresh_token, expires_in } = tokenResponse.data;

      console.log('Success! Access token received.');
      console.log(`Token expires in: ${expires_in} seconds (${Math.floor(expires_in / 3600)} hours)\n`);

      // Update .env file
      let envContent = readFileSync('.env', 'utf-8');
      envContent = envContent.replace(
        /MIELE_ACCESS_TOKEN=.*/,
        `MIELE_ACCESS_TOKEN=${access_token}`
      );
      envContent = envContent.replace(
        /MIELE_REFRESH_TOKEN=.*/,
        `MIELE_REFRESH_TOKEN=${refresh_token}`
      );
      writeFileSync('.env', envContent);

      console.log('Step 4: Tokens saved to .env file!');
      console.log('\nYou can now run: npm start');

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <head><title>Authentication Successful</title></head>
          <body style="font-family: Arial; padding: 50px; text-align: center;">
            <h1 style="color: green;">✓ Authentication Successful!</h1>
            <p>Your Miele access token has been saved.</p>
            <p>You can close this window and return to your terminal.</p>
          </body>
        </html>
      `);

      setTimeout(() => {
        server.close();
        process.exit(0);
      }, 1000);
    } catch (error) {
      console.error('Error exchanging code for token:', error.response?.data || error.message);

      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <head><title>Authentication Failed</title></head>
          <body style="font-family: Arial; padding: 50px; text-align: center;">
            <h1 style="color: red;">✗ Authentication Failed</h1>
            <p>Error: ${error.message}</p>
            <p>Check the terminal for more details.</p>
          </body>
        </html>
      `);

      setTimeout(() => {
        server.close();
        process.exit(1);
      }, 2000);
    }
  }
});

server.listen(3000, () => {
  console.log('Waiting for authentication callback on http://localhost:3000/callback ...\n');
});

// Handle timeout
setTimeout(() => {
  console.log('\nAuthentication timeout. Please try again.');
  server.close();
  process.exit(1);
}, 5 * 60 * 1000); // 5 minute timeout
