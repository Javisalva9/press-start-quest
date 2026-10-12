import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useMe } from '../api/me';
import { useSession } from '../auth/use-session';

/** Wraps every screen that needs a signed-in user. */
export function ProtectedLayout() {
  const session = useSession();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const me = useMe({ enabled: session !== null });
  const { pathname } = useLocation();

  // The language saved in the profile wins over the device's one.
  const locale = me.data?.locale;
  useEffect(() => {
    if (locale && locale !== i18n.language) {
      void i18n.changeLanguage(locale);
    }
  }, [locale, i18n]);

  // Signed out (here or in another tab): forget the previous user's data.
  useEffect(() => {
    if (!session) {
      queryClient.clear();
    }
  }, [session, queryClient]);

  if (!session) {
    return <Navigate to="/login" replace />;
  }
  // Never synced: the library is empty, so the first stop is the import.
  if (me.data?.lastSyncAt === null && pathname !== '/sync') {
    return <Navigate to="/sync" replace />;
  }
  return <Outlet />;
}
