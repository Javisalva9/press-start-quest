# Press Start Quest

[English](README.md) · **Español**

App web instalable en el móvil (PWA) que importa tu biblioteca de juegos de PC,
la enriquece con duración, nota y portada, y cada día te propone qué jugar para
ir cerrando tu backlog.

> Estado: etapa 1 (Steam y catálogo) terminada. Siguiente: etapa 2,
> clasificación y progreso.

## Qué hace ya

- Inicio de sesión con Steam; la sesión se renueva sola durante 30 días.
- Importa la biblioteca de Steam (horas, última sesión, logros) y la lista de
  deseados, en segundo plano y con una pantalla de progreso.
- Enriquece cada juego con la tienda de Steam e IGDB: portada, nota, duración,
  géneros y temas. DLC, demos, Playtests, betas y bandas sonoras quedan fuera.
- Biblioteca con búsqueda, filtros y orden, y una ficha por juego, donde puedes
  poner la duración si IGDB no la sabe.
- Avisa si el perfil de Steam es privado, con los pasos para arreglarlo.
- Instalable en el móvil (PWA), en inglés y español, y usable sin conexión con
  los últimos datos cargados.

## Stack

| Parte         | Tecnología                                                             |
| ------------- | ---------------------------------------------------------------------- |
| Web           | React 19, Vite, TypeScript, React Router, TanStack Query, Tailwind CSS |
| API           | NestJS 12, TypeScript, Swagger                                         |
| Base de datos | PostgreSQL (Neon) con Prisma 7 y `@prisma/adapter-pg`                  |
| Compartido    | `packages/shared`: tipos y validaciones con zod                        |
| Calidad       | Vitest, oxlint, Prettier y GitHub Actions                              |
| Despliegue    | Render (API y web) y Neon (base de datos), plan gratuito               |

## Estructura

```text
press-start-quest/
├─ apps/
│  ├─ api/                NestJS, esquema y migraciones en prisma/
│  │  └─ src/
│  │     ├─ auth/  users/  sources/  library/
│  │     ├─ sync/         importación, enriquecimiento, deseados, logros
│  │     ├─ catalog/      reglas de clasificación y de metadatos
│  │     └─ providers/    clientes de Steam (Web API y tienda) e IGDB
│  └─ web/                React + Vite: pages/, components/, api/, locales/
├─ packages/shared/       tipos y esquemas zod comunes a web y API
└─ .github/workflows/     CI en cada pull request
```

## Arrancar en local

Requisitos: Node.js 24 (ver `.node-version`) y pnpm 12 (ver `packageManager`).

Recomendado: [gitleaks](https://github.com/gitleaks/gitleaks)
(`winget install Gitleaks.Gitleaks` en Windows). `pnpm install` deja puesto
un hook de pre-commit (lefthook) que lo usa para parar cualquier commit con un
secreto dentro; sin gitleaks solo avisa, y el CI hace la misma comprobación en
cada pull request.

```bash
pnpm install                              # instala todo y genera el cliente de Prisma
cp apps/api/.env.example apps/api/.env    # y rellena las variables
pnpm --filter @psq/api db:deploy          # aplica las migraciones a tu base de datos
pnpm dev                                  # API en :3000 y web en :5173
```

Entra en http://localhost:5173: la primera visita importa tu biblioteca.

- Web: http://localhost:5173
- API: http://localhost:3000/api/health
- Documentación de la API: http://localhost:3000/api/docs

## Scripts

| Comando                             | Qué hace                                                                |
| ----------------------------------- | ----------------------------------------------------------------------- |
| `pnpm dev`                          | Arranca shared, API y web en modo desarrollo                            |
| `pnpm build`                        | Compila los tres paquetes en orden                                      |
| `pnpm lint`                         | Pasa oxlint                                                             |
| `pnpm typecheck`                    | Comprueba los tipos de TypeScript                                       |
| `pnpm test`                         | Ejecuta los tests unitarios                                             |
| `pnpm format`                       | Formatea el código con Prettier                                         |
| `pnpm --filter @psq/api db:migrate` | Crea y aplica una migración en desarrollo                               |
| `pnpm --filter @psq/api db:deploy`  | Aplica las migraciones pendientes (lo que ejecuta Render)               |
| `pnpm --filter @psq/api db:studio`  | Abre Prisma Studio para ver la base de datos                            |
| `pnpm --filter @psq/web icons`      | Regenera los iconos de la app a partir de `apps/web/public/favicon.svg` |

## Cómo funciona la sincronización

`POST /api/sync` crea un trabajo y responde al momento; la web consulta su
progreso en `GET /api/sync/jobs/:id`. El trabajo tiene cuatro pasos:

1. **Biblioteca**: juegos y horas desde la Steam Web API, guardados en bloque;
   tras la primera sincronización, solo lo que cambia.
2. **Lista de deseados**: pasa a la vista «Lo quiero», con la prioridad de
   Steam.
3. **Enriquecimiento**: tienda de Steam (una petición cada 1,6 s, su límite) e
   IGDB (4 por segundo) para juegos nunca enriquecidos o de hace más de 30
   días. El catálogo es compartido: cada juego se consulta una sola vez para
   todos.
4. **Logros**: de los juegos jugados cuyas horas han cambiado.

## Idiomas

La web está en inglés (por defecto) y español, con
[react-i18next](https://react.i18next.com/). La primera vez usa el idioma del
móvil si es uno de los dos; si no, inglés.

- Ningún texto se escribe dentro de un componente: va en
  `apps/web/src/locales/en.json` y `es.json`, y el componente usa
  `t('clave.del.texto')`.
- oxlint (`react/jsx-no-literals`) marca el texto suelto en el JSX.
- TypeScript comprueba que cada clave existe en `en.json`.
- Un test falla si una clave o una variable `{{…}}` falta en alguno de los dos
  idiomas, así que el CI no deja fusionar una traducción a medias.

Este README también está en los dos idiomas (`README.md` y `README.es.md`): si
cambias uno, actualiza el otro en el mismo PR.

## Variables de entorno

Cada app tiene su `.env.example` con todas las variables y para qué sirven. Los
`.env` reales nunca se suben al repositorio. La API no arranca si falta una
obligatoria, y dice cuál.

| Variable                     | App | Para qué                                         |
| ---------------------------- | --- | ------------------------------------------------ |
| `DATABASE_URL`               | API | Conexión pooled a Neon (`sslmode=verify-full`)   |
| `DATABASE_URL_DIRECT`        | API | Conexión directa a Neon, para las migraciones    |
| `WEB_URL`                    | API | URL de la web: Steam devuelve ahí al usuario     |
| `CORS_ORIGIN`                | API | URLs de la web que pueden llamar a la API        |
| `JWT_SECRET`                 | API | Firma los tokens de acceso (48 bytes aleatorios) |
| `STEAM_API_KEY`              | API | Steam Web API                                    |
| `IGDB_CLIENT_ID` / `_SECRET` | API | IGDB, a través de una aplicación de Twitch       |
| `VITE_API_URL`               | Web | URL de la API en Render (vacía en local)         |
