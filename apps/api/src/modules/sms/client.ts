import { createRequire } from 'node:module';
import type { Logger } from 'pino';

/**
 * Africa's Talking SMS client.
 *
 * The official SDK is CommonJS and ships without type declarations, so it is loaded through
 * `createRequire` and described by the small surface used here. Sending is best-effort: the same
 * way the ML client degrades when scoring is unavailable, a missing key or an SDK error returns
 * `null` so a notification can never fail the wallet operation that triggered it.
 */

const require = createRequire(import.meta.url);

interface SmsRecipient {
  number: string;
  status: string;
  messageId?: string;
  cost?: string;
  statusCode?: number;
}

interface SmsResponse {
  SMSMessageData: { Message: string; Recipients: SmsRecipient[] };
}

interface SmsService {
  send(options: { to: string[]; message: string; from?: string }): Promise<SmsResponse>;
}

type Sdk = (credentials: { apiKey: string; username: string }) => { SMS: SmsService };

export interface SmsConfig {
  apiKey: string;
  /** Your app username, or `sandbox` while using a sandbox app. */
  username: string;
  /** Optional alphanumeric sender id or short code. */
  senderId?: string;
}

export interface SendSmsInput {
  /** One number or several, in international format (+255...). */
  to: string | string[];
  message: string;
  from?: string;
}

export interface SendSmsResult {
  /** Provider summary, e.g. "Sent to 1/1 Total Cost: TZS 20.00". */
  summary: string;
  recipients: SmsRecipient[];
}

export interface SmsSender {
  send(input: SendSmsInput): Promise<SendSmsResult | null>;
}

/**
 * Numbers may be stored with spaces or dashes, and some were entered in the local `0XXXXXXXXX`
 * form. The gateway wants a bare international number, so a local number is expanded to +255.
 */
const normaliseNumber = (value: string): string => {
  const bare = value.trim().replace(/[\s-]/g, '');
  return /^0\d{9}$/.test(bare) ? `+255${bare.slice(1)}` : bare;
};

export class SmsClient implements SmsSender {
  private readonly sms: SmsService | null;

  constructor(
    private readonly config: SmsConfig,
    private readonly logger?: Logger,
  ) {
    this.sms = config.apiKey
      ? (require('africastalking') as Sdk)({ apiKey: config.apiKey, username: config.username }).SMS
      : null;
  }

  /** False when no API key is configured; callers then skip the notification entirely. */
  get enabled(): boolean {
    return this.sms !== null;
  }

  async send(input: SendSmsInput): Promise<SendSmsResult | null> {
    if (!this.sms) {
      this.logger?.warn('SMS not sent: AT_API_KEY is empty');
      return null;
    }

    const to = (Array.isArray(input.to) ? input.to : [input.to])
      .map(normaliseNumber)
      .filter((n) => n.length > 0);
    const message = input.message.trim();
    if (to.length === 0 || message.length === 0) {
      this.logger?.warn({ to, chars: message.length }, 'SMS not sent: empty recipient or message');
      return null;
    }

    const from = input.from?.trim() || this.config.senderId?.trim();
    try {
      const response = await this.sms.send({ to, message, ...(from ? { from } : {}) });
      this.logger?.info({ to, summary: response.SMSMessageData.Message }, 'SMS sent');
      return {
        summary: response.SMSMessageData.Message,
        recipients: response.SMSMessageData.Recipients,
      };
    } catch (error) {
      this.logger?.error({ err: error, to }, 'SMS send failed');
      return null;
    }
  }
}
