import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../api/client';
import type { SendContext } from '../../../api/types';
import { SendPage } from './Send';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<typeof import('../../../api/client')>()),
  api: vi.fn(),
}));
const mockedApi = vi.mocked(api);

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

const context: SendContext = {
  balance: 5_000_000,
  recipients: [{ id: 2, fullName: 'Baraka Mushi', email: 'baraka@example.com', phone: '+255700000004' }],
  locations: ['Dar es Salaam', 'Mwanza', 'Arusha', 'Dodoma', 'Mbeya', 'Morogoro', 'Tanga', 'Moshi', 'Zanzibar', 'Kigoma'],
  defaultLocation: 'Dar es Salaam',
  largeVolume: { count: 2, totalAmount: 4_500_000, blocked: false },
  receivers: { unique: 1, blocked: false },
  senders: { unique: 0, blocked: false },
};

function show() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <SendPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SendPage', () => {
  it('replaces the form with the blocked panel when the transfer is blocked', async () => {
    mockedApi.mockImplementation(async (path: string, init?: { body?: unknown }) => {
      if (path === 'auth/me') return { kind: 'user', id: 1, name: 'Amina Hassan', email: 'a@x' };
      if (path === 'me/send/context') return context;
      if (path === 'me/transfers') {
        expect(init?.body).toMatchObject({ receiverId: 2, amount: 100000, location: 'Dar es Salaam' });
        return {
          outcome: 'blocked',
          reason: 'Multiple failed withdrawal attempts detected',
          message: '❌ Transaction BLOCKED due to fraud detection.\n\nReason: Multiple failed withdrawal attempts detected\nRisk Score: 85%\nRisk Level: HIGH',
          riskScore: 85,
          riskLevel: 'HIGH',
          transactionId: 'TXN1',
        };
      }
      throw new Error(`unexpected ${path}`);
    });
    show();
    expect(await screen.findByText('Limit is 3 transactions totaling 10,000,000 TSh.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Select Receiver *'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Amount (TSh) *'), { target: { value: '100000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Money' }));
    expect(await screen.findByText(/You are about to send TSh 100,000.00/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('🚫 TRANSACTION BLOCKED')).toBeInTheDocument();
    expect(screen.getByText(/Risk Score: 85%/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Amount (TSh) *')).not.toBeInTheDocument();
  });

  it('shows the success banner with the review warning', async () => {
    mockedApi.mockImplementation(async (path: string) => {
      if (path === 'auth/me') return { kind: 'user', id: 1, name: 'Amina Hassan', email: 'a@x' };
      if (path === 'me/send/context') return context;
      if (path === 'me/transfers') {
        return {
          outcome: 'success',
          message: 'Transaction successful! You sent TSh 100,000.00 to Baraka Mushi',
          transactionId: 'TXN1',
          newBalance: 4_900_000,
          riskScore: 55,
          riskLevel: 'MEDIUM',
          flaggedForReview: true,
          locationWarning: '⚠️ Location changed from Dar es Salaam to Mwanza (843 km away) in 5 minutes',
        };
      }
      throw new Error(`unexpected ${path}`);
    });
    show();
    fireEvent.change(await screen.findByLabelText('Select Receiver *'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Amount (TSh) *'), { target: { value: '100000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Money' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));

    expect(await screen.findByText(/Transaction successful! You sent TSh 100,000.00 to Baraka Mushi/)).toBeInTheDocument();
    expect(screen.getByText('⚠️ This transaction was flagged for review. Please monitor your account.')).toBeInTheDocument();
    expect(screen.getByText('🚨 Location Change Detected')).toBeInTheDocument();
  });

  it('refuses client-side when the amount exceeds the balance', async () => {
    mockedApi.mockImplementation(async (path: string) => {
      if (path === 'auth/me') return { kind: 'user', id: 1, name: 'Amina Hassan', email: 'a@x' };
      if (path === 'me/send/context') return context;
      throw new Error(`unexpected ${path}`);
    });
    show();
    fireEvent.change(await screen.findByLabelText('Select Receiver *'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Amount (TSh) *'), { target: { value: '6000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Money' }));
    expect(await screen.findByText(/Insufficient balance. Your balance is TSh 5,000,000.00/)).toBeInTheDocument();
    expect(mockedApi).not.toHaveBeenCalledWith('me/transfers', expect.anything());
  });
});
