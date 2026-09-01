import React from "react";
import nodemailer from "nodemailer";
import { render } from "@react-email/render";
import { c } from "./colors.js";
import { logger } from "./logger.js";
import {
  MfaVerificationEmail,
  PasswordResetEmail,
} from "../emails/index.js";

interface SendMailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) {
    return transporter;
  }

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && port) {
    transporter = nodemailer.createTransport({
      host,
      port: parseInt(port, 10),
      secure: port === "465",
      auth: user && pass ? { user, pass } : undefined,
    });
    logger.mailer.info(
      `SMTP client configured for ${c.cyan(`${host}:${port}`)}`
    );
  }

  return transporter;
}

/**
 * Sends an email using SMTP or logs to console outbox in development.
 *
 * Rules:
 * - In production: Always sends via SMTP.
 * - In development: If `USE_MAIL_IN_DEV === "true"`, sends via SMTP.
 *   Otherwise, logs to the dev console outbox.
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
}: SendMailParams): Promise<boolean> {
  const isDev = process.env.NODE_ENV === "development" || !process.env.NODE_ENV;
  const useMailInDev = process.env.USE_MAIL_IN_DEV === "true";
  const shouldSendRealMail = !isDev || useMailInDev;

  const from = process.env.SMTP_FROM || "noreply@iris.local";
  const activeTransporter = getTransporter();

  if (shouldSendRealMail && activeTransporter) {
    try {
      await activeTransporter.sendMail({
        from,
        to,
        subject,
        html,
        text,
      });
      logger.mailer.info(
        `Email sent successfully to ${c.cyan(to)} (${subject})`
      );
      return true;
    } catch (error) {
      logger.mailer.error(
        `Failed to send email to ${to}:`,
        error
      );
      return false;
    }
  }

  // Development Console Outbox Fallback
  console.log(`
${c.yellow(c.bold("========================================="))}
${c.yellow(c.bold("[DEV MAIL OUTBOX]"))}
${c.bold("To:")}      ${c.cyan(to)}
${c.bold("From:")}    ${c.dim(from)}
${c.bold("Subject:")} ${c.green(subject)}
-----------------------------------------
${text.trim()}
${c.yellow(c.bold("========================================="))}
`);

  return true;
}

/**
 * Sends a Multi-Factor Authentication login verification code email.
 *
 * @param to - Recipient email address.
 * @param code - 6-digit verification code.
 * @param validityMinutes - Validity window in minutes (default: 5).
 */
export async function sendMfaVerificationEmail(
  to: string,
  code: string,
  validityMinutes = 5
): Promise<boolean> {
  const emailElement = React.createElement(MfaVerificationEmail, {
    code,
    validityMinutes,
    appName: "IRIS",
  });

  const [html, text] = await Promise.all([
    render(emailElement),
    render(emailElement, { plainText: true }),
  ]);

  return sendEmail({
    to,
    subject: `IRIS - Login Verification Code (${code})`,
    html,
    text,
  });
}

/**
 * Sends a Password Reset email with an actionable reset link.
 *
 * @param to - Recipient email address.
 * @param resetUrl - Absolute URL to the password reset page.
 * @param validityMinutes - Validity window in minutes (default: 15).
 */
export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
  validityMinutes = 15
): Promise<boolean> {
  const emailElement = React.createElement(PasswordResetEmail, {
    resetUrl,
    validityMinutes,
    appName: "IRIS",
  });

  const [html, text] = await Promise.all([
    render(emailElement),
    render(emailElement, { plainText: true }),
  ]);

  return sendEmail({
    to,
    subject: "IRIS - Password Reset Request",
    html,
    text,
  });
}
