import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { emailLogger } from '../utils/logger.js';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
});

export type EmailAttachment = { 
  filename: string; 
  content?: Buffer | string; 
  path?: string;
  contentType?: string;
  cid?: string; // For inline attachments
};

export async function sendEmail(opts: {
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}) {
  emailLogger.info(`📧 Preparing to send email...`);
  emailLogger.info(`From: ${opts.from}`);
  emailLogger.info(`To: ${opts.to}`);
  emailLogger.info(`Subject: ${opts.subject}`);
  emailLogger.info(`ReplyTo: ${opts.replyTo || 'Not set'}`);
  emailLogger.info(`Attachments: ${opts.attachments?.length || 0}`);
  
  try {
    const info = await transporter.sendMail({
      from: opts.from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      replyTo: opts.replyTo,
      attachments: opts.attachments,
    });
    
    emailLogger.info(`✅ Email sent successfully!`);
    emailLogger.info(`MessageId: ${info.messageId}`);
    emailLogger.info(`Response: ${info.response}`);
    
    return { messageId: info.messageId };
  } catch (error: any) {
    emailLogger.error(`❌ Failed to send email: ${error.message}`);
    emailLogger.error(`Error details: ${JSON.stringify(error, null, 2)}`);
    throw error;
  }
}
