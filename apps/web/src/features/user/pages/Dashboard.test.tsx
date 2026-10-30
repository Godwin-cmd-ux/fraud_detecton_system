import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../api/client';
import type { UserDashboard } from '../../../api/types';
import { UserDashboardPage } from './Dashboard';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<typeof import('../../../api/client')>()),
  api: vi.fn(),
}));
const mockedApi = vi.mocked(api);

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

const dashboard = (balance: number | null): UserDashboard => ({
  user: { id: 1, fullName: 'Amina Hassan', email: 'amina@example.com', phone: '+255700000001', card: { number: '4400000000000366', expiry: '12/29', cvc: '123' }, location: 'Dar es Salaam', createdAt: '2026-01-01T00:00:00Z' },
  balance,
  stats: { total: 3, successful: 2, aborted: 1, pending: 0, successRate: 67 },
  fraud: { analyzed: 2, fraud: 1, legit: 1, avgScore: 40, maxScore: 60 },
  recent: [
    { id: 1, transactionId: 'TXN1', type: 'transfer', direction: 'sent', counterpartyName: 'Baraka Mushi', amount: 100, status: 'SUCCESS', fraudScore: 60, fraudPrediction: 'FRAUD', riskLevel: 'MEDIUM', message: null, location: null, createdAt: '2026-10-29T12:00:00Z' },
  ],
});

function show() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <UserDashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('UserDashboardPage', () => {
  it('masks the balance until the password is verified, then shows it', async () => {
    let revealed = false;
    mockedApi.mockImplementation(async (path: string) => {
      if (path === 'me/dashboard') return dashboard(revealed ? 1234.5 : null);
      if (path === 'me/verify-password') {
        revealed = true;
        return { ok: true };
      }
      throw new Error(`unexpected ${path}`);
    });
    show();
    expect(await screen.findByText('••••••••••••••••')).toBeInTheDocument();
    expect(screen.getByText('Click the balance amount to reveal')).toBeInTheDocument();
    expect(screen.getByText('Suspicious Activity')).toBeInTheDocument();
    expect(screen.getByText('Sent to Baraka Mushi')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /reveal balance/i }));
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByText('TSh 1,234.50')).toBeInTheDocument();
    expect(screen.getByText('Visible')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows the incorrect-password message', async () => {
    mockedApi.mockImplementation(async (path: string) => {
      if (path === 'me/dashboard') return dashboard(null);
      if (path === 'me/verify-password') {
        const { ApiError } = await vi.importActual<typeof import('../../../api/client')>('../../../api/client');
        throw new ApiError(401, 'INCORRECT_PASSWORD', 'Incorrect password');
      }
      throw new Error(`unexpected ${path}`);
    });
    show();
    fireEvent.click(await screen.findByRole('button', { name: /reveal balance/i }));
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(await screen.findByText('Incorrect password. Please try again.')).toBeInTheDocument();
  });
});
