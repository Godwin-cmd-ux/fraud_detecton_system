import { createBrowserRouter, Navigate } from 'react-router';
import { RedirectIfAuthed, RequireAdmin, RequireUser } from './guards';
// Auth pages are contributed separately (see docs/codex-auth-handoff.md) and use default exports.
import LandingPage from '../features/auth/pages/Landing';
import LoginPage from '../features/auth/pages/Login';
import RegisterPage from '../features/auth/pages/Register';
import AdminSignupPage from '../features/auth/pages/AdminSignup';
import ForgotPasswordPage from '../features/auth/pages/ForgotPassword';
import ResetPasswordPage from '../features/auth/pages/ResetPassword';
import { UserLayout } from '../features/user/UserLayout';
import { UserDashboardPage } from '../features/user/pages/Dashboard';
import { SendPage } from '../features/user/pages/Send';
import { WithdrawPage } from '../features/user/pages/Withdraw';
import { UserTransactionsPage } from '../features/user/pages/Transactions';
import { AdminLayout } from '../features/admin/AdminLayout';
import { AdminDashboardPage } from '../features/admin/pages/Dashboard';
import { AdminUsersPage } from '../features/admin/pages/Users';
import { CreateUserPage } from '../features/admin/pages/CreateUser';
import { ApprovalsPage } from '../features/admin/pages/Approvals';
import { AddBalancePage } from '../features/admin/pages/AddBalance';
import { BalanceAdjustmentsPage } from '../features/admin/pages/BalanceAdjustments';
import { AdminTransactionsPage } from '../features/admin/pages/Transactions';
import { TransactionDetailsPage } from '../features/admin/pages/TransactionDetails';
import { FraudAlertsPage } from '../features/admin/pages/FraudAlerts';
import { FraudOverviewPage } from '../features/admin/pages/FraudOverview';

export const router = createBrowserRouter([
  {
    element: <RedirectIfAuthed />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/admin-signup', element: <AdminSignupPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password/:token', element: <ResetPasswordPage /> },
    ],
  },
  {
    element: <RequireUser />,
    children: [
      {
        path: '/app',
        element: <UserLayout />,
        children: [
          { index: true, element: <Navigate to="/app/dashboard" replace /> },
          { path: 'dashboard', element: <UserDashboardPage /> },
          { path: 'send', element: <SendPage /> },
          { path: 'withdraw', element: <WithdrawPage /> },
          { path: 'transactions', element: <UserTransactionsPage /> },
        ],
      },
    ],
  },
  {
    element: <RequireAdmin />,
    children: [
      {
        path: '/admin',
        element: <AdminLayout />,
        children: [
          { index: true, element: <Navigate to="/admin/dashboard" replace /> },
          { path: 'dashboard', element: <AdminDashboardPage /> },
          { path: 'users', element: <AdminUsersPage /> },
          { path: 'users/new', element: <CreateUserPage /> },
          { path: 'approvals', element: <ApprovalsPage /> },
          { path: 'users/:id/balance', element: <AddBalancePage /> },
          { path: 'balance-adjustments', element: <BalanceAdjustmentsPage /> },
          { path: 'transactions', element: <AdminTransactionsPage /> },
          { path: 'transactions/:id', element: <TransactionDetailsPage /> },
          { path: 'fraud-alerts', element: <FraudAlertsPage /> },
          { path: 'fraud-overview', element: <FraudOverviewPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
