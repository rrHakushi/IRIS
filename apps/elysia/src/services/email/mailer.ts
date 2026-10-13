import React from 'react'
import nodemailer, { type Transporter } from 'nodemailer'
import { render } from '@react-email/render'
import { LogFactory, c } from '@Iris/logger'
import { MfaVerificationEmail, PasswordResetEmail } from '../../emails/index'

const logger = new LogFactory('Mailer')

export interface SendMailParams {
  to: string
  subject: string
  html: string
  text: string
}

let transporter: Transporter | null = null

export function getTransporter(): Transporter | null {
  if (transporter) {
    return transporter
  }

  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (host && port) {
    transporter = nodemailer.createTransport({
      host,
      port: parseInt(port, 10),
      secure: port === '465',
      auth: user && pass ? { user, pass } : undefined,
    })
    logger.info(`SMTP client configured for ${c.cyan(`${host}:${port}`)}`)
  }

  return transporter
}

/**
 * Sends an email using SMTP or logs to console outbox in development.
 *
 * Rules:
 * - In production: Always sends via SMTP.
 * - In development: If `USE_MAIL_IN_DEV === "true"`, sends via SMTP.
 *   Otherwise, logs to the dev console outbox.
 */
export async function sendDirectMail({
  to,
  subject,
  html,
  text,
}: SendMailParams): Promise<boolean> {
  const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV
  const useMailInDev = process.env.USE_MAIL_IN_DEV === 'true'
  const shouldSendRealMail = !isDev || useMailInDev

  const from = process.env.SMTP_FROM || 'noreply@iris.local'
  const activeTransporter = getTransporter()

  if (shouldSendRealMail && activeTransporter) {
    try {
      await activeTransporter.sendMail({
        from,
        to,
        subject,
        html,
        text,
      })
      logger.info(`Email dispatched successfully to ${c.cyan(to)} (${subject})`)
      return true
    } catch (error: any) {
      logger.error(`Failed to dispatch email to ${to}:`, error?.message || error)
      return false
    }
  }

  // Development Console Outbox Fallback
  console.log(`
${c.yellow(c.bold('========================================='))}
${c.yellow(c.bold('[DEV MAIL OUTBOX]'))}
${c.bold('To:')}      ${c.cyan(to)}
${c.bold('From:')}    ${c.dim(from)}
${c.bold('Subject:')} ${c.green(subject)}
-----------------------------------------
${text.trim()}
${c.yellow(c.bold('========================================='))}
`)

  return true
}

/**
 * Direct renderer and dispatcher for Multi-Factor Authentication login/setup verification email.
 */
export async function sendMfaVerificationEmailDirect({
  to,
  code,
  validityMinutes = 5,
  appName = 'IRIS',
}: {
  to: string
  code: string
  validityMinutes?: number
  appName?: string
}): Promise<boolean> {
  const emailElement = React.createElement(MfaVerificationEmail, {
    code,
    validityMinutes,
    appName,
  })

  const [html, text] = await Promise.all([
    render(emailElement),
    render(emailElement, { plainText: true }),
  ])

  return await sendDirectMail({
    to,
    subject: `${appName} - Verification Code (${code})`,
    html,
    text,
  })
}

/**
 * Direct renderer and dispatcher for Password Reset email with reset link.
 */
export async function sendPasswordResetEmailDirect({
  to,
  resetUrl,
  validityMinutes = 15,
  appName = 'IRIS',
}: {
  to: string
  resetUrl: string
  validityMinutes?: number
  appName?: string
}): Promise<boolean> {
  const emailElement = React.createElement(PasswordResetEmail, {
    resetUrl,
    validityMinutes,
    appName,
  })

  const [html, text] = await Promise.all([
    render(emailElement),
    render(emailElement, { plainText: true }),
  ])

  return await sendDirectMail({
    to,
    subject: `${appName} - Password Reset Request`,
    html,
    text,
  })
}
