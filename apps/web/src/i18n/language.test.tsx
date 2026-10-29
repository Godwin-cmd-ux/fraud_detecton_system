import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import Register from '../features/auth/pages/Register';
import { AdminTransactionsPage } from '../features/admin/pages/Transactions';
import { LanguageSwitcher } from './LanguageSwitcher';
import { getLanguage, getLocale, LANGUAGE_STORAGE_KEY, setLanguage, translate } from './index';
import { localizeValidity } from './validation';

vi.mock('../api/client', async (original) => ({
  ...(await original<typeof import('../api/client')>()),
  api: vi.fn(),
}));
const mockedApi = vi.mocked(api);
afterEach(() => {
  cleanup();
  setLanguage('en');
  localStorage.clear();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

it('switches signup language without losing entered data, answers, or refetching questions', async () => {
  mockedApi.mockResolvedValue([
    { key: 'mother_maiden', text: "What is your mother's maiden name?" },
  ]);
  render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>,
  );
  const question = await screen.findByLabelText("What is your mother's maiden name?");
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Dashboard' } });
  fireEvent.change(question, { target: { value: 'My private answer' } });
  fireEvent.change(screen.getByLabelText('Card number'), { target: { value: '1234567890123456' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'sw' } });
  expect(screen.getByRole('heading', { name: 'Fungua akaunti' })).toBeInTheDocument();
  expect(screen.getByLabelText('Jina kamili')).toHaveValue('Dashboard');
  expect(screen.getByLabelText('Namba ya kadi')).toHaveValue('1234 5678 9012 3456');
  expect(screen.getByLabelText('Jina la ukoo la mama yako kabla ya kuolewa ni lipi?')).toHaveValue(
    'My private answer',
  );
  expect(document.documentElement.lang).toBe('sw');
  expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('sw');
  expect(mockedApi).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByRole('combobox', { name: 'Lugha' }), { target: { value: 'en' } });
  expect(screen.getByLabelText('Full name')).toHaveValue('Dashboard');
  expect(document.documentElement.lang).toBe('en');
});

it('keeps API filter values in English while translating their displayed labels', async () => {
  setLanguage('sw');
  mockedApi.mockImplementation(async (path) =>
    path === 'auth/me'
      ? { kind: 'admin', id: 1, name: 'Success', email: 'admin@example.com' }
      : { items: [], total: 0, page: 1, totalPages: 0, pageSize: 20 },
  );
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <LanguageSwitcher />
        <AdminTransactionsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const status = await screen.findByRole('combobox', { name: 'Hali' });
  expect(screen.getByRole('option', { name: 'UMEFANIKIWA' })).toHaveValue('SUCCESS');
  fireEvent.change(status, { target: { value: 'SUCCESS' } });
  await waitFor(() =>
    expect(mockedApi).toHaveBeenCalledWith('admin/transactions', {
      query: { page: 1, status: 'SUCCESS' },
    }),
  );
  expect(await screen.findByText('Success', { exact: true })).toBeInTheDocument();
});

it('translates dynamic security messages while preserving names, amounts, and transaction IDs', () => {
  setLanguage('sw');
  expect(translate('Transaction successful! You sent TSh 100,000.00 to Amina $& Hassan')).toBe(
    'Muamala umefanikiwa! Umetuma TSh 100,000.00 kwa Amina $& Hassan',
  );
  expect(translate('Transaction TXN123 marked as reviewed')).toBe(
    'Muamala TXN123 umewekewa alama ya kukaguliwa',
  );
  expect(
    translate(
      '❌ TRANSACTION BLOCKED\n\nYou have sent money to 3 different recipients in the last 5 minutes.',
    ),
  ).toBe('❌ MUAMALA UMEZUIWA\n\nUmetuma pesa kwa wapokeaji 3 tofauti katika dakika 5 zilizopita.');
  expect(translate('Amount (TSh) *')).toBe('Kiasi (TSh) *');
  expect(translate('Full name must be at least 3 characters\nPasswords do not match')).toBe(
    'Jina kamili lazima liwe na angalau vibambo 3\nManenosiri hayafanani',
  );
  expect(translate('Unrecognized message')).toBe('Unrecognized message');
  expect(translate('constructor')).toBe('constructor');
  expect(translate('  Transaction successful! You sent TSh 1,000.00 to Amina $& Hassan  ')).toBe(
    '  Muamala umefanikiwa! Umetuma TSh 1,000.00 kwa Amina $& Hassan  ',
  );
  expect(translate(123)).toBe(123);
  setLanguage('en');
  expect(translate('Sign in')).toBe('Sign in');
});

it('synchronizes another tab changing or clearing the stored language', () => {
  render(<LanguageSwitcher />);
  localStorage.setItem(LANGUAGE_STORAGE_KEY, 'sw');
  act(() =>
    window.dispatchEvent(
      new StorageEvent('storage', { key: LANGUAGE_STORAGE_KEY, newValue: 'sw' }),
    ),
  );
  expect(screen.getByRole('combobox', { name: 'Lugha' })).toHaveValue('sw');
  expect(getLocale()).toBe('sw-TZ');
  localStorage.removeItem(LANGUAGE_STORAGE_KEY);
  act(() =>
    window.dispatchEvent(
      new StorageEvent('storage', { key: LANGUAGE_STORAGE_KEY, newValue: null }),
    ),
  );
  expect(screen.getByRole('combobox', { name: 'Language' })).toHaveValue('en');
});

it('still switches language when browser storage is unavailable', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Blocked', 'SecurityError');
  });
  expect(() => setLanguage('sw')).not.toThrow();
  expect(getLanguage()).toBe('sw');
  expect(translate('Sign in')).toBe('Ingia');
});

it('localizes native required-field feedback and clears it for English', () => {
  const input = document.createElement('input');
  input.required = true;
  setLanguage('sw');
  localizeValidity(input);
  expect(input.validationMessage).toBe('Tafadhali jaza sehemu hii.');
  setLanguage('en');
  localizeValidity(input);
  expect(input.validity.customError).toBe(false);
});
