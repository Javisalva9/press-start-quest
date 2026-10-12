import { createBrowserRouter, Navigate } from 'react-router';
import { ProtectedLayout } from './components/ProtectedLayout';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SteamCallbackPage from './pages/SteamCallbackPage';
import SyncPage from './pages/SyncPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  // Must match the return URL the API gives Steam (WEB_URL + this path).
  { path: '/auth/steam/callback', element: <SteamCallbackPage /> },
  {
    element: <ProtectedLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'sync', element: <SyncPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
