import { config } from "../../config";
import { logger } from "../../lib/logger";
import {
  deletePushTokens,
  findPushTokensForUser,
  logNotification,
  touchPushTokens,
  type NotificationStatus,
} from "./notificationsRepo";

export type SendPushInput = {
  userId: string;
  title: string;
  body: string;
  /** Logical kind, e.g. 'trial_reminder' | 'workout_ready'. */
  kind: string;
  template?: string;
  /** Optional structured payload delivered to the app. */
  data?: Record<string, unknown>;
  /**
   * FR-8.4: marketing pushes MUST check an opt-in flag before sending.
   * Mark transactional sends (receipts, trial reminders, support acks) as
   * `marketing: false` (or omit the flag). We hard-fail at this boundary
   * so it's impossible to ship a marketing campaign that bypasses opt-in.
   */
  marketing?: boolean;
  marketingOptIn?: boolean;
};

export type SendPushResult = {
  status: NotificationStatus;
  channel: "push" | "log";
  provider: "expo" | "log";
  tokensTried: number;
  error?: string;
};

const EXPO_ENDPOINT = "https://exp.host/--/api/v2/push/send";

/** Expo's per-message ticket from the /push/send response. */
type ExpoTicket =
  | { status: "ok"; id: string }
  | {
      status: "error";
      message: string;
      details?: { error?: string };
    };

/**
 * Vendor-neutral push send. Two fallbacks:
 *   1. Expo Push HTTP v2  (if EXPO_ACCESS_TOKEN is set AND user has tokens)
 *   2. Log to stdout      (always; counts as 'logged' status)
 *
 * Side effect: parses Expo's per-message receipts and removes any token Expo
 * flagged as DeviceNotRegistered. This keeps push_tokens from accumulating
 * dead endpoints over time.
 */
export async function sendPush(input: SendPushInput): Promise<SendPushResult> {
  // FR-8.4 hard guard: marketing => must have explicit opt-in.
  if (input.marketing && !input.marketingOptIn) {
    logger.warn(
      { userId: input.userId, kind: input.kind },
      "push.marketing_blocked_no_optin",
    );
    await safeLog({
      userId: input.userId,
      kind: input.kind,
      channel: "log",
      template: input.template,
      recipient: null,
      status: "failed",
      error: "marketing_send_without_optin",
      payload: { title: input.title },
    });
    return {
      status: "failed",
      channel: "log",
      provider: "log",
      tokensTried: 0,
      error: "marketing_send_without_optin",
    };
  }

  const tokens = await findPushTokensForUser(input.userId);

  if (tokens.length === 0) {
    logger.info(
      { userId: input.userId, kind: input.kind },
      "push.no_tokens_registered",
    );
    await safeLog({
      userId: input.userId,
      kind: input.kind,
      channel: "log",
      template: input.template,
      recipient: null,
      status: "logged",
      payload: { reason: "no_tokens", title: input.title },
    });
    return {
      status: "logged",
      channel: "log",
      provider: "log",
      tokensTried: 0,
    };
  }

  if (!config.EXPO_ACCESS_TOKEN) {
    logger.info(
      { userId: input.userId, kind: input.kind, tokens: tokens.length },
      "push.dev.logged",
    );
    await safeLog({
      userId: input.userId,
      kind: input.kind,
      channel: "log",
      template: input.template,
      recipient: tokens[0]!.token,
      status: "logged",
      payload: { title: input.title, body: input.body, tokens: tokens.length },
    });
    return {
      status: "logged",
      channel: "log",
      provider: "log",
      tokensTried: tokens.length,
    };
  }

  const messages = tokens.map((t) => ({
    to: t.token,
    title: input.title,
    body: input.body,
    data: input.data,
    sound: "default",
  }));

  try {
    const res = await fetch(EXPO_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.EXPO_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const err = `expo_http_${res.status}:${text.slice(0, 200)}`;
      logger.warn({ status: res.status, body: text }, "push.expo.failed");
      await safeLog({
        userId: input.userId,
        kind: input.kind,
        channel: "push",
        template: input.template,
        recipient: tokens[0]!.token,
        status: "failed",
        error: err,
        payload: { title: input.title, tokens: tokens.length },
      });
      return {
        status: "failed",
        channel: "push",
        provider: "expo",
        tokensTried: tokens.length,
        error: err,
      };
    }

    // Parse per-token tickets to prune dead endpoints. Expo wraps the array
    // in { data: [...] }. Keep the cleanup best-effort — never block the
    // success reply on a stats / cleanup write.
    const json = (await res.json().catch(() => ({}))) as {
      data?: ExpoTicket[];
    };
    const tickets = json.data ?? [];
    const deadTokens: string[] = [];
    const liveTokens: string[] = [];
    tickets.forEach((ticket, i) => {
      const tokenValue = tokens[i]?.token;
      if (!tokenValue) return;
      if (
        ticket.status === "error" &&
        ticket.details?.error === "DeviceNotRegistered"
      ) {
        deadTokens.push(tokenValue);
      } else if (ticket.status === "ok") {
        liveTokens.push(tokenValue);
      }
    });
    if (deadTokens.length > 0) {
      await deletePushTokens(deadTokens).catch((e) =>
        logger.warn({ err: String(e) }, "push.cleanup.failed"),
      );
      logger.info(
        { count: deadTokens.length, userId: input.userId },
        "push.expo.pruned_dead_tokens",
      );
    }
    if (liveTokens.length > 0) {
      await touchPushTokens(liveTokens).catch((e) =>
        logger.warn({ err: String(e) }, "push.touch.failed"),
      );
    }

    await safeLog({
      userId: input.userId,
      kind: input.kind,
      channel: "push",
      template: input.template,
      recipient: tokens[0]!.token,
      status: "sent",
      payload: {
        title: input.title,
        tokens: tokens.length,
        live: liveTokens.length,
        dead: deadTokens.length,
      },
    });
    return {
      status: "sent",
      channel: "push",
      provider: "expo",
      tokensTried: tokens.length,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ err: msg }, "push.expo.threw");
    await safeLog({
      userId: input.userId,
      kind: input.kind,
      channel: "push",
      template: input.template,
      recipient: tokens[0]!.token,
      status: "failed",
      error: `expo_threw:${msg.slice(0, 200)}`,
      payload: { title: input.title, tokens: tokens.length },
    });
    return {
      status: "failed",
      channel: "push",
      provider: "expo",
      tokensTried: tokens.length,
      error: msg,
    };
  }
}

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
