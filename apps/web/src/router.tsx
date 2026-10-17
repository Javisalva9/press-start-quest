import { createBrowserRouter, Navigate } from 'react-router';
import { ProtectedLayout } from './components/ProtectedLayout';
import AddGamePage from './pages/AddGamePage';
import GamePage from './pages/GamePage';
import HomePage from './pages/HomePage';
import LibraryPage from './pages/LibraryPage';
import LoginPage from './pages/LoginPage';
import SteamCallbackPage from './pages/SteamCallbackPage';
import SyncPage from './pages/SyncPage';
import ReviewPage from './pages/ReviewPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  // Must match the return URL the API gives Steam (WEB_URL + this path).
  { path: '/auth/steam/callback', element: <SteamCallbackPage /> },
  {
    element: <ProtectedLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'sync', element: <SyncPage /> },
      { path: 'library', element: <LibraryPage /> },
      { path: 'library/add', element: <AddGamePage /> },
      { path: 'library/:id', element: <GamePage /> },
      { path: 'review', element: <ReviewPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
