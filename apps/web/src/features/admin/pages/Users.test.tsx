import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdminUserRow } from '@fraud/shared';
import { api } from '../../../api/client';
import { AdminUsersPage } from './Users';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<typeof import('../../../api/client')>()),
  api: vi.fn(),
}));
const mockedApi = vi.mocked(api);

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

const pending: AdminUserRow = {
  id: 7,
  fullName: 'Pending Person',
  email: 'pending@example.com',
  phone: '+255700000009',
  balance: 0,
  cardLast4: '4321',
  isApproved: false,
  isActive: true,
  status: 'pending',
  createdAt: '2026-10-29T10:00:00Z',
};

function show() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <AdminUsersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminUsersPage', () => {
  it('shows a pending user and approves it after confirmation', async () => {
    const calls: string[] = [];
    mockedApi.mockImplementation(async (path: string, init?: { method?: string }) => {
      calls.push(`${init?.method ?? 'GET'} ${path}`);
      if (path === 'auth/me') return { kind: 'admin', id: 1, name: 'Root Admin', email: 'root@x' };
      if (path === 'admin/users') return { items: [pending], page: 1, pageSize: 20, total: 1, totalPages: 1 };
      if (path === 'admin/users/7/approve') return { message: '✅ User approved successfully!' };
      throw new Error(`unexpected ${path}`);
    });
    show();
    expect(await screen.findByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('****4321')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Approve Pending Person?');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(await screen.findByText('User approved successfully!')).toBeInTheDocument();
    expect(calls).toContain('POST admin/users/7/approve');
  });
});
