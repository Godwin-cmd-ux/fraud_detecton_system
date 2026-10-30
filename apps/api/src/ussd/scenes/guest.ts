import { defineScene, choose } from '../machine';
import { isValidEmail, registerViaUssd } from '../register';
import { PIN_POLICY, hashPin, isWellFormedPin } from '../pin';
import bcrypt from 'bcryptjs';

/**
 * Screens for a number the system does not know yet, plus the registration workflow. Everything is
 * created through `registerViaUssd`, which applies the same uniqueness rules as the web form and
 * leaves the account pending administrator approval — USSD never bypasses the approval step.
 */

const ABOUT = [
  'FRAUD DETECTION SYSTEM',
  'A wallet with real-time',
  'fraud monitoring.',
  'Dial this code to send',
  'money, withdraw and',
  'check your balance.',
  '0. Back',
].join('\n');

defineScene(
  'guest.main',
  async (c) =>
    choose(
      c,
      () => 'WELCOME\n1. Register\n2. About\n0. Exit',
      {
        '1': async () => ({
          text: 'REGISTER 1/3\nEnter full name\n0. Cancel',
          scene: 'guest.reg.name',
          clearData: true,
        }),
        '2': async () => ({ text: ABOUT, scene: 'guest.about' }),
      },
    ),
);

defineScene('guest.about', async () => ({ text: ABOUT }));

defineScene('guest.pending', async (c) => {
  if (c.input === '') return { text: 'REGISTRATION RECEIVED\nAwaiting admin approval.\nTry again later.' };
  return { text: 'REGISTRATION RECEIVED\nAwaiting admin approval.\nTry again later.' };
});

defineScene('guest.suspended', async () => ({
  text: 'ACCOUNT SUSPENDED\nContact support through\nthe web application.',
  end: true,
}));

defineScene('guest.blocked', async () => ({
  text: 'ADMIN ACCOUNT DISABLED\nContact the system owner.',
  end: true,
}));

defineScene(
  'guest.reg.name',
  async (c) => {
    if (c.input === '') return { text: 'REGISTER 1/3\nEnter full name\n0. Cancel' };
    if (c.input.trim().length < 3) return { text: 'Name too short.\nEnter full name' };
    return {
      text: 'REGISTER 2/3\nEnter email address\n0. Cancel',
      scene: 'guest.reg.email',
      data: { name: c.input.trim() },
    };
  },
);

defineScene(
  'guest.reg.email',
  async (c) => {
    const prompt = 'REGISTER 2/3\nEnter email address\n0. Cancel';
    if (c.input === '') return { text: prompt };
    if (!isValidEmail(c.input)) return { text: `Invalid email.\n${prompt}` };
    // The card is issued by the server, so the keypad flow no longer asks for one.
    return {
      text: `REGISTER 3/3\nSet ${PIN_POLICY.length}-digit PIN\n0. Cancel`,
      scene: 'guest.reg.pin',
      data: { email: c.input.trim().toLowerCase() },
    };
  },
);

defineScene('guest.reg.pin', async (c) => {
  const ask = `REGISTER 3/3\nSet ${PIN_POLICY.length}-digit PIN\n0. Cancel`;
  if (c.input === '') return { text: ask };
  if (!isWellFormedPin(c.input)) return { text: `PIN must be ${PIN_POLICY.length} digits.\n0. Cancel` };
  return {
    text: 'Confirm your PIN\n0. Cancel',
    scene: 'guest.reg.pinConfirm',
    data: { pinh: await hashPin(c.input) },
  };
});

defineScene('guest.reg.pinConfirm', async (c) => {
  if (c.input === '') return { text: 'Confirm your PIN\n0. Cancel' };
  const stored = c.state.data.pinh ?? '';
  const match = stored ? await bcrypt.compare(c.input, stored) : false;
  if (!match) {
    return { text: 'PINs do not match.\nEnter new PIN', scene: 'guest.reg.pin', data: { pinh: '' } };
  }
  const data = c.state.data;
  return {
    text: [
      'CONFIRM DETAILS',
      data.name ?? '',
      data.email ?? '',
      c.phone,
      'Card issued on approval',
      '1. Submit  0. Cancel',
    ].join('\n'),
    scene: 'guest.reg.review',
  };
});

defineScene('guest.reg.review', async (c) => {
  const data = c.state.data;
  if (c.input !== '1') return { text: 'Registration cancelled.', end: true, clearData: true };

  const created = await registerViaUssd(c.db, {
    fullName: data.name ?? '',
    email: data.email ?? '',
    phone: c.phone,
    pinHash: data.pinh ?? '',
  });

  void created;
  return {
    text: [
      'REGISTRATION SUBMITTED',
      'Your account is pending',
      'admin approval. You will be',
      'able to transact once it is',
      'approved.',
      'Web password: your phone',
      'number. Change it on the',
      'dashboard after signing in.',
    ].join('\n'),
    end: true,
    clearData: true,
  };
});
