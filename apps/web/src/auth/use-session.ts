import { useMemo, useSyncExternalStore } from 'react';
import {
  parseSession,
  sessionSnapshot,
  subscribeToSession,
  type Session,
} from './session';

/** Current session; re-renders when it changes, even from another tab. */
export function useSession(): Session | null {
  const raw = useSyncExternalStore(
    subscribeToSession,
    sessionSnapshot,
    sessionSnapshot,
  );
  return useMemo(() => parseSession(raw), [raw]);
}
