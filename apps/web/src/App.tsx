import { useEffect, useState } from 'react';
import type { HealthResponse } from '@psq/shared';
import { fetchHealth } from './api/client';

// Página provisional de la etapa 0: solo comprueba que web, API y base de datos
// se hablan. Los textos pasarán a es.json / en.json en la etapa 1.
type State =
  | { kind: 'loading' }
  | { kind: 'ok'; health: HealthResponse }
  | { kind: 'error'; message: string };

export default function App() {
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

  return (
    <main className="screen">
      <div className="ring" aria-hidden="true">
        <span className="play" />
      </div>
      <h1>Press Start Quest</h1>
      <p className="lead">
        Esqueleto en marcha. Las pantallas llegan en la etapa 1.
      </p>

      <dl className="status" aria-live="polite">
        <div>
          <dt>API</dt>
          <dd data-state={state.kind === 'ok' ? 'up' : state.kind}>
            {state.kind === 'loading' && 'Despertando…'}
            {state.kind === 'ok' && 'Responde'}
            {state.kind === 'error' && 'Sin respuesta'}
          </dd>
        </div>
        <div>
          <dt>Base de datos</dt>
          <dd
            data-state={
              state.kind === 'ok' ? state.health.database : state.kind
            }
          >
            {state.kind === 'loading' && '—'}
            {state.kind === 'ok' &&
              (state.health.database === 'up' ? 'Conectada' : 'Caída')}
            {state.kind === 'error' && '—'}
          </dd>
        </div>
      </dl>

      {state.kind === 'error' && (
        <p className="hint">
          {state.message}. Comprueba que la API está arrancada y que
          VITE_API_URL apunta a ella.
        </p>
      )}
    </main>
  );
}
