import type { SendSmsInput, SmsSender } from '../modules/sms/client';
import { normalizePhone } from './phone';

/** Buffer wallet receipts so an outer USSD rollback cannot announce a successful payment. */
export function bufferUssdSms(sender: SmsSender | undefined) {
  const pending: SendSmsInput[] = [];
  const sms: SmsSender | undefined = sender
    ? {
        async send(input) {
          pending.push(input);
          return null;
        },
      }
    : undefined;

  return {
    sms,
    discard: () => {
      pending.length = 0;
    },
    /** Called after commit, without waiting for the provider inside the USSD request. */
    dispatch(phone: string, response: string): void {
      if (!sender) return;
      const callerHasReceipt = pending.some((notice) =>
        (Array.isArray(notice.to) ? notice.to : [notice.to]).some(
          (recipient) => normalizePhone(recipient) === phone,
        ),
      );
      if (!callerHasReceipt) {
        // Copy only the server's screen, never cumulative gateway input (which can contain PINs).
        pending.push({ to: phone, message: `USSD\n${response.replace(/^(CON|END) /, '')}` });
      }
      for (const notice of pending) {
        void Promise.resolve()
          .then(() => sender.send(notice))
          .catch(() => undefined);
      }
      pending.length = 0;
    },
  };
}
