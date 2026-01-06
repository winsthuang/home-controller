// Email Sender Module
// Sends emails via Gmail SMTP using nodemailer

import nodemailer from 'nodemailer';
import { emailConfig } from './config.js';

// Retry settings
const MAX_RETRIES = 3;
const RETRY_DELAYS = [5000, 15000, 45000];  // 5s, 15s, 45s

/**
 * Create nodemailer transporter
 */
function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: emailConfig.user,
      pass: emailConfig.appPassword
    }
  });
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Send email with retry logic
 */
export async function sendEmail({ subject, html, text }) {
  const transporter = createTransporter();

  const mailOptions = {
    from: `Home Controller <${emailConfig.user}>`,
    to: emailConfig.recipient,
    subject: subject,
    html: html,
    text: text || 'Please view this email in an HTML-capable email client.'
  };

  let lastError = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`Email sent successfully: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      lastError = error;
      console.error(`Email send attempt ${attempt + 1} failed:`, error.message);

      if (attempt < MAX_RETRIES - 1) {
        const delay = RETRY_DELAYS[attempt];
        console.log(`Retrying in ${delay / 1000} seconds...`);
        await sleep(delay);
      }
    }
  }

  return {
    success: false,
    error: lastError?.message || 'Failed to send email after all retries'
  };
}

/**
 * Verify SMTP connection
 */
export async function verifyConnection() {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('SMTP connection verified successfully');
    return { success: true };
  } catch (error) {
    console.error('SMTP connection failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send test email
 */
export async function sendTestEmail() {
  const subject = '🧪 Home Controller - Test Email';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: sans-serif; padding: 20px; }
        .container { max-width: 500px; margin: 0 auto; background: #f0f0f0; padding: 20px; border-radius: 8px; }
        h1 { color: #667eea; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>✅ Test Successful!</h1>
        <p>Your Home Controller email reporting is configured correctly.</p>
        <p><strong>Sent at:</strong> ${new Date().toLocaleString()}</p>
        <p>You will receive:</p>
        <ul>
          <li>📧 Daily reports at 10:00 PM</li>
          <li>📊 Weekly summaries on Saturday at 8:00 AM</li>
        </ul>
      </div>
    </body>
    </html>
  `;

  return sendEmail({ subject, html });
}
