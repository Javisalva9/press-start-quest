import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { HealthResponse } from '@psq/shared';
import { fetchHealth } from './api/client';

// Stage 0 placeholder page: it only checks that web, API and database can talk
// to each other. It will be replaced by the stage 1 screens.
type State =
  | { kind: 'loading' }
  | { kind: 'ok'; health: HealthResponse }
  | { kind: 'error'; message: string };

export default function App() {
  const { t } = useTranslation();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    fetchHealth()
      .then((health) => setState({ kind: 'ok', health }))
      .catch((error: unknown) =>
        setState({
          kind: 'error',
          message: error instanceof Error ? error.message : String(error),
        }),
      );
  }, []);

  const apiState = state.kind === 'ok' ? 'up' : state.kind;
  const databaseState = state.kind === 'ok' ? state.health.database : null;

  return (
    <main className="screen">
      {/* Decorative: the app name is right below, in the heading. */}
      <img
        className="logo"
        src="/favicon.svg"
        alt=""
        width={112}
        height={112}
      />
      <h1>{t('app.name')}</h1>
      <p className="lead">{t('health.lead')}</p>

      <dl className="status" aria-live="polite">
        <div>
          <dt>{t('health.api')}</dt>
          <dd data-state={apiState}>{t(`health.apiState.${apiState}`)}</dd>
        </div>
        <div>
          <dt>{t('health.database')}</dt>
          <dd data-state={databaseState ?? state.kind}>
            {databaseState ? t(`health.databaseState.${databaseState}`) : '—'}
          </dd>
        </div>
      </dl>

      {state.kind === 'error' && (
        <p className="hint">{t('health.hint', { message: state.message })}</p>
      )}
    </main>
  );
}
