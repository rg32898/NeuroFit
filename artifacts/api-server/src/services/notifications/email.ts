import { config } from "../../config";
import { logger } from "../../lib/logger";
import {
  logNotification,
  type NotificationStatus,
} from "./notificationsRepo";

export type SendEmailInput = {
  userId: string;
  to: string;
  subject: string;
  html: string;
  /** Logical kind, e.g. 'trial_reminder' | 'receipt' | 'support_ack'. */
  kind: string;
  /** Stable template id, e.g. 'trial_reminder.v1'. */
  template?: string;
  /** Plain-text alternative body. Recommended; many providers will derive one. */
  text?: string;
  /**
   * FR-8.4: marketing emails MUST check an opt-in flag before sending.
   * Mark transactional sends (receipts, trial reminders, support acks) as
   * `marketing: false`. We hard-fail at this boundary to make it impossible
   * to ship a marketing campaign that bypasses opt-in.
   */
  marketing?: boolean;
  marketingOptIn?: boolean;
};

export type SendEmailResult = {
  status: NotificationStatus;
  channel: "email" | "log";
  provider: "resend" | "smtp" | "log";
  error?: string;
};

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * Vendor-neutral email send with three fallbacks, in order:
 *   1. Resend HTTP API     (if RESEND_API_KEY is set)
 *   2. SMTP via nodemailer (if SMTP_HOST is set)
 *   3. Log to stdout       (always; counts as 'logged' status)
 *
 * Never throws on transport failure — returns status='failed' instead so the
 * caller decides whether to retry. The notifications table records every
 * outcome for forensic replay.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  // FR-8.4 hard guard: marketing => must have explicit opt-in.
  if (input.marketing && !input.marketingOptIn) {
    logger.warn(
      { userId: input.userId, kind: input.kind },
      "email.marketing_blocked_no_optin",
    );
    await safeLog({
      userId: input.userId,
      kind: input.kind,
      channel: "log",
      template: input.template,
      recipient: input.to,
      status: "failed",
      error: "marketing_send_without_optin",
      payload: { subject: input.subject },
    });
    return {
      status: "failed",
      channel: "log",
      provider: "log",
      error: "marketing_send_without_optin",
    };
  }

  const from = config.FROM_EMAIL;

  // 1. Resend.
  if (config.RESEND_API_KEY) {
    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [input.to],
          subject: input.subject,
          html: input.html,
          text: input.text,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const err = `resend_http_${res.status}:${body.slice(0, 200)}`;
        logger.warn({ status: res.status, body }, "email.resend.failed");
        await safeLog({
          userId: input.userId,
          kind: input.kind,
          channel: "email",
          template: input.template,
          recipient: input.to,
          status: "failed",
          error: err,
          payload: { subject: input.subject, provider: "resend" },
        });
        return {
          status: "failed",
          channel: "email",
          provider: "resend",
          error: err,
        };
      }
      await safeLog({
        userId: input.userId,
        kind: input.kind,
        channel: "email",
        template: input.template,
        recipient: input.to,
        status: "sent",
        payload: { subject: input.subject, provider: "resend" },
      });
      return { status: "sent", channel: "email", provider: "resend" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn({ err: msg }, "email.resend.threw");
      await safeLog({
        userId: input.userId,
        kind: input.kind,
        channel: "email",
        template: input.template,
        recipient: input.to,
        status: "failed",
        error: `resend_threw:${msg.slice(0, 200)}`,
        payload: { subject: input.subject, provider: "resend" },
      });
      return {
        status: "failed",
        channel: "email",
        provider: "resend",
        error: msg,
      };
    }
  }

  // 2. SMTP via nodemailer.
  if (config.SMTP_HOST) {
    try {
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.default.createTransport({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        secure: config.SMTP_PORT === 465,
        auth:
          config.SMTP_USER && config.SMTP_PASS
            ? { user: config.SMTP_USER, pass: config.SMTP_PASS }
            : undefined,
      });
      await transporter.sendMail({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      });
      await safeLog({
        userId: input.userId,
        kind: input.kind,
        channel: "email",
        template: input.template,
        recipient: input.to,
        status: "sent",
        payload: { subject: input.subject, provider: "smtp" },
      });
      return { status: "sent", channel: "email", provider: "smtp" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn({ err: msg }, "email.smtp.failed");
      await safeLog({
        userId: input.userId,
        kind: input.kind,
        channel: "email",
        template: input.template,
        recipient: input.to,
        status: "failed",
        error: `smtp_threw:${msg.slice(0, 200)}`,
        payload: { subject: input.subject, provider: "smtp" },
      });
      return {
        status: "failed",
        channel: "email",
        provider: "smtp",
        error: msg,
      };
    }
  }

  // 3. Log fallback. In dev this is normal; in prod it means we're misconfigured.
  if (config.NODE_ENV === "production") {
    logger.warn(
      { kind: input.kind, to: input.to },
      "email.no_transport_configured_in_production",
    );
  } else {
    logger.info(
      { kind: input.kind, to: input.to, subject: input.subject },
      "email.dev.logged",
    );
  }
  await safeLog({
    userId: input.userId,
    kind: input.kind,
    channel: "log",
    template: input.template,
    recipient: input.to,
    status: "logged",
    payload: { subject: input.subject, htmlLength: input.html.length },
  });
  return { status: "logged", channel: "log", provider: "log" };
}

// Defensive wrapper — log writes must never block the transport's reply.
async function safeLog(input: Parameters<typeof logNotification>[0]) {
  try {
    await logNotification(input);
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      "notifications.log.write_failed",
    );
  }
}
