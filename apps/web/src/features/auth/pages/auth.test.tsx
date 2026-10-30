import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../../../api/client';
import { Login } from './Login';
import { ForgotPassword } from './ForgotPassword';
import { ResetPassword } from './ResetPassword';
import { Register } from './Register';
import { AdminSignup } from './AdminSignup';

vi.mock('../../../api/client', async (original) => ({ ...await original<typeof import('../../../api/client')>(), api: vi.fn() }));
const mockedApi = vi.mocked(api);
const questions = [{ key: 'mother', text: 'Mother name?' }, { key: 'school', text: 'First school?' }, { key: 'city', text: 'Birth city?' }];

afterEach(() => { cleanup(); vi.resetAllMocks(); vi.useRealTimers(); });
function show(page: ReactNode, path = '/') {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[path]}><Routes>
      <Route path="/" element={page} />
      <Route path="/reset-password/:token" element={page} />
      <Route path="/app/dashboard" element={<p>Wallet dashboard</p>} />
      <Route path="/admin/dashboard" element={<p>Admin dashboard</p>} />
    </Routes></MemoryRouter>
  </QueryClientProvider>);
}
function fill(label: string, value: string) { fireEvent.change(screen.getByLabelText(label), { target: { value } }); }

describe('Login', () => {
  it('clears the identifier and changes the label when switching roles', () => {
    show(<Login />);
    fill('Email, Phone or Card Number', 'someone@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Admin' }));
    expect(screen.getByLabelText('Username or Email')).toHaveValue('');
  });
  it('shows and hides the password with the eye toggle', () => {
    show(<Login />); fill('Password', 'secret123');
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });
  it('renders failed credentials and preserves the submitted role', async () => {
    mockedApi.mockRejectedValue(new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid password. 2 attempts remaining', { attemptsRemaining: '2' }));
    show(<Login />); fill('Email, Phone or Card Number', 'user@example.com'); fill('Password', 'badpassword');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('2 attempts remaining');
    expect(mockedApi).toHaveBeenCalledWith('/auth/login', { method: 'POST', body: { role: 'user', login: 'user@example.com', password: 'badpassword' } });
  });
  it('locks the form and reenables it after the deadline', async () => {
    mockedApi.mockRejectedValue(new ApiError(423, 'LOCKED', 'Account locked', { minutesRemaining: '0.0166666667' }));
    show(<Login />); fill('Email, Phone or Card Number', 'user@example.com'); fill('Password', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('button', { name: 'Account Locked - Please wait' })).toBeDisabled();
    expect(screen.getByLabelText('Password')).toBeDisabled();
    vi.useFakeTimers();
    await act(async () => { vi.advanceTimersByTime(2500); });
    vi.useRealTimers();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled(), { timeout: 4000 });
  });
  it('redirects successful admins to their dashboard', async () => {
    mockedApi.mockResolvedValue({ kind: 'admin', id: 1, name: 'Admin', email: 'admin@example.com' });
    show(<Login />); fireEvent.click(screen.getByRole('button', { name: 'Admin' }));
    fill('Username or Email', 'admin'); fill('Password', 'Password1!');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Admin dashboard')).toBeInTheDocument();
  });
});

describe('Recovery', () => {
  it('does not request a token with fewer than three answers', async () => {
    mockedApi.mockResolvedValue({ questions });
    show(<ForgotPassword />); fill('Email', 'user@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByLabelText('Mother name?');
    fill('Mother name?', 'a'); fill('First school?', 'b');
    fireEvent.click(screen.getByRole('button', { name: 'Verify answers' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('at least 3');
    expect(mockedApi).toHaveBeenCalledTimes(1);
  });
  it('shows a session-expired response without losing the recovery controls', async () => {
    mockedApi.mockResolvedValueOnce({ questions }).mockRejectedValueOnce(new ApiError(400, 'SESSION_EXPIRED', 'Your session has expired'));
    show(<ForgotPassword />); fill('Email', 'user@example.com'); fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByLabelText('Mother name?');
    fill('Mother name?', 'a'); fill('First school?', 'b'); fill('Birth city?', 'c');
    fireEvent.click(screen.getByRole('button', { name: 'Verify answers' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('session has expired');
    expect(screen.getByRole('button', { name: 'Use another email' })).toBeEnabled();
  });
  it('hides reset form for expired tokens', async () => {
    mockedApi.mockResolvedValue({ valid: true, userName: 'Amina', expiresAt: new Date(Date.now() - 10000).toISOString() });
    show(<ResetPassword />, '/reset-password/token');
    expect(await screen.findByText('This reset link has expired.')).toBeInTheDocument();
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request new reset' })).toHaveAttribute('href', '/forgot-password');
  });
  it('submits the route token and clears the form on success', async () => {
    const token = 'a'.repeat(64);
    mockedApi.mockResolvedValueOnce({ valid: true, userName: 'Amina', expiresAt: new Date(Date.now() + 300000).toISOString() })
      .mockResolvedValueOnce({ message: 'Password changed' });
    show(<ResetPassword />, `/reset-password/${token}`);
    await screen.findByLabelText('New password'); fill('New password', 'secret123'); fill('Confirm password', 'secret123');
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(await screen.findByText('Password changed')).toBeInTheDocument();
    expect(mockedApi).toHaveBeenLastCalledWith('/auth/reset-password', { method: 'POST', body: { token, password: 'secret123', confirmPassword: 'secret123' } });
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  });
});

describe('Account creation', () => {
  it('requires confirmation and sends normalized registration data', async () => {
    mockedApi.mockResolvedValueOnce(questions).mockResolvedValueOnce({ message: 'Pending approval' });
    show(<Register />); await screen.findByLabelText('Mother name?');
    fill('Full name', 'Amina Hassan'); fill('Email', 'amina@example.com'); fill('Phone number', '+255 712 345 678');
    fill('Password', 'secret123'); fill('Confirm password', 'secret123');
    fill('Mother name?', 'a'); fill('First school?', 'b'); fill('Birth city?', 'c');
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument(); expect(mockedApi).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm registration' }));
    expect(await screen.findByText('Pending approval')).toBeInTheDocument();
    // The card is issued by the server, so no card number is submitted.
    expect(mockedApi).toHaveBeenLastCalledWith('/auth/register', { method: 'POST', body: expect.objectContaining({ phone: '+255712345678' }) });
    expect(mockedApi.mock.calls.at(-1)?.[1]).not.toHaveProperty('body.cardNumber');
  });
  it('shows the setup key only when an admin already exists', async () => {
    mockedApi.mockResolvedValue({ firstAdmin: false });
    show(<AdminSignup />);
    expect(await screen.findByLabelText('Admin setup key')).toBeRequired();
    expect(screen.queryByText(/First Time Setup/)).not.toBeInTheDocument();
  });
});
