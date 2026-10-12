import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { HealthResponse } from '@psq/shared';
import { fetchHealth } from './api/client';

// Página provisional de la etapa 0: solo comprueba que web, API y base de datos
// se hablan. Se sustituirá por las pantallas de la etapa 1.
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
      <div className="ring" aria-hidden="true">
        <span className="play" />
      </div>
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
