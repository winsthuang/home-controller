#!/usr/bin/env node

// Email Report - Main Entry Point
// Usage: node email-report.js [daily|weekly] [--test]

import { existsSync, mkdirSync, appendFileSync } from 'fs';
import { validateEnvironment, paths } from './config.js';
import { collectAllData } from './data-collector.js';
import { addDailyStats, loadHistory } from './history-store.js';
import { generateDailyReport, generateWeeklyReport, generatePlainText } from './html-templates.js';
import { sendEmail, verifyConnection, sendTestEmail } from './email-sender.js';

// Parse command line arguments
const args = process.argv.slice(2);
const reportType = args.find(a => a === 'daily' || a === 'weekly') || 'daily';
const isTest = args.includes('--test');
const isSendTest = args.includes('--send-test');
const isVerify = args.includes('--verify');

/**
 * Log message to console and file
 */
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] [${level}] ${message}`;

  console.log(entry);

  // Ensure logs directory exists
  if (!existsSync(paths.logsDir)) {
    mkdirSync(paths.logsDir, { recursive: true });
  }

  // Append to log file
  const logFile = `${paths.logsDir}/email-reports.log`;
  appendFileSync(logFile, entry + '\n');
}

/**
 * Main function
 */
async function main() {
  log(`Starting ${reportType} report generation...`);

  // Handle special commands
  if (isVerify) {
    log('Verifying SMTP connection...');
    const result = await verifyConnection();
    if (result.success) {
      log('SMTP connection verified successfully');
      process.exit(0);
    } else {
      log(`SMTP verification failed: ${result.error}`, 'ERROR');
      process.exit(1);
    }
  }

  if (isSendTest) {
    log('Sending test email...');
    const result = await sendTestEmail();
    if (result.success) {
      log(`Test email sent successfully: ${result.messageId}`);
      process.exit(0);
    } else {
      log(`Test email failed: ${result.error}`, 'ERROR');
      process.exit(1);
    }
  }

  // Validate environment
  const envCheck = validateEnvironment(false);
  if (!envCheck.valid) {
    log(`Missing required environment variables: ${envCheck.missing.join(', ')}`, 'ERROR');
    process.exit(1);
  }

  if (envCheck.warnings.length > 0) {
    log(`Warning: Missing MCP credentials: ${envCheck.warnings.join(', ')}`, 'WARN');
  }

  try {
    // Step 1: Collect data from all MCP servers
    log('Collecting data from MCP servers...');
    const data = await collectAllData();

    if (data.errors.length > 0) {
      log(`Data collection completed with ${data.errors.length} error(s): ${data.errors.join('; ')}`, 'WARN');
    } else {
      log('Data collection completed successfully');
    }

    // Step 2: Save today's stats to history
    log('Saving stats to history...');
    addDailyStats(data);

    // Step 3: Load history for comparisons
    const history = loadHistory();
    log(`Loaded ${history.dailyStats.length} days of history`);

    // Step 4: Generate report HTML
    log(`Generating ${reportType} report...`);
    let html, plainText, subject;

    const now = new Date();
    if (reportType === 'weekly') {
      html = generateWeeklyReport(data, history);
      plainText = generatePlainText(data, 'weekly');

      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      const dateRange = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

      subject = `📊 Weekly Home Summary - ${dateRange}`;
    } else {
      html = generateDailyReport(data, history);
      plainText = generatePlainText(data, 'daily');

      const dateStr = now.toLocaleDateString('en-US', {
        weekday: 'long', month: 'short', day: 'numeric'
      });

      // Add alert indicator to subject if there are errors
      const alertIndicator = data.errors.length > 0 ? '⚠️ ' : '';
      subject = `${alertIndicator}🏠 Home Status - ${dateStr}`;
    }

    // Step 5: Send or display
    if (isTest) {
      log('TEST MODE - Not sending email');
      console.log('\n' + '='.repeat(60));
      console.log('SUBJECT:', subject);
      console.log('='.repeat(60));
      console.log('\nPLAIN TEXT VERSION:');
      console.log('-'.repeat(40));
      console.log(plainText);
      console.log('\n' + '='.repeat(60));
      console.log('HTML saved to: /tmp/home-report-preview.html');

      // Save HTML to temp file for preview
      const { writeFileSync } = await import('fs');
      writeFileSync('/tmp/home-report-preview.html', html);

      log('Test completed - email not sent');
    } else {
      log('Sending email...');
      const result = await sendEmail({ subject, html, text: plainText });

      if (result.success) {
        log(`Email sent successfully: ${result.messageId}`);
      } else {
        log(`Email send failed: ${result.error}`, 'ERROR');
        process.exit(1);
      }
    }

    log(`${reportType} report completed successfully`);
    process.exit(0);

  } catch (error) {
    log(`Fatal error: ${error.message}`, 'ERROR');
    console.error(error.stack);
    process.exit(2);
  }
}

// Run main function
main();
