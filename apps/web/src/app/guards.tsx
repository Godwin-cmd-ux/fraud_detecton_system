import { useLanguage } from '../i18n';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useMe } from '../api/auth';
import { Spinner } from '../components/ui/Spinner';

function FullPageSpinner() {
  useLanguage();
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner />
    </div>
  );
}

/** Renders the outlet for a signed-in customer; otherwise sends to login (admins to their dashboard). */
export function RequireUser() {
  useLanguage();
  const me = useMe();
  const location = useLocation();
  if (me.isPending) return <FullPageSpinner />;
  if (!me.data) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (me.data.kind !== 'user') return <Navigate to="/admin/dashboard" replace />;
  return <Outlet />;
}

export function RequireAdmin() {
  useLanguage();
  const me = useMe();
  if (me.isPending) return <FullPageSpinner />;
  if (!me.data) return <Navigate to="/login" replace />;
  if (me.data.kind !== 'admin') return <Navigate to="/app/dashboard" replace />;
  return <Outlet />;
}

/** Public pages: a signed-in visitor goes straight to their dashboard. */
export function RedirectIfAuthed() {
  useLanguage();
  const me = useMe();
  if (me.isPending) return <FullPageSpinner />;
  if (me.data?.kind === 'user') return <Navigate to="/app/dashboard" replace />;
  if (me.data?.kind === 'admin') return <Navigate to="/admin/dashboard" replace />;
  return <Outlet />;
}
