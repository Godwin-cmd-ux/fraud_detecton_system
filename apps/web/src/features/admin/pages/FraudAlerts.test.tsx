import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../../../api/client';
import { FraudAlertsPage } from './FraudAlerts';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<typeof import('../../../api/client')>()),
  api: vi.fn(),
}));
const mockedApi = vi.mocked(api);
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it('marks a fraud alert reviewed only after confirmation and refreshes the list', async () => {
  let reviewed = false;
  mockedApi.mockImplementation(async (path, options) => {
    if (path === 'auth/me') return { kind: 'admin', id: 1, name: 'Admin' };
    if (path === 'admin/transactions/7/review') {
      expect(options?.method).toBe('POST');
      reviewed = true;
      return { message: 'Transaction marked reviewed.' };
    }
    if (path === 'admin/fraud-alerts') {
      expect(options?.query).toMatchObject({ reviewed: 'unreviewed', page: 1 });
      return {
        page: 1,
        totalPages: 1,
        total: reviewed ? 0 : 1,
        pageSize: 20,
        items: reviewed
          ? []
          : [
              {
                id: 7,
                transactionId: 'TXN-ALERT-7',
                createdAt: '2026-10-29T12:00:00Z',
                senderName: 'Amina',
                receiverName: 'Juma',
                amount: 100000,
                type: 'transfer',
                status: 'ABORTED',
                fraudScore: 85,
                riskLevel: 'HIGH',
                fraudPrediction: 'FRAUD',
                reviewedAt: null,
              },
            ],
      };
    }
    throw new Error(`Unexpected ${path}`);
  });
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <FraudAlertsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(await screen.findByText('TXN-ALERT-7')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Mark Reviewed' }));
  expect(reviewed).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(reviewed).toBe(true));
  expect(await screen.findByText('No Fraud Alerts')).toBeInTheDocument();
  expect(screen.getByText('Transaction marked reviewed.')).toBeInTheDocument();
});
