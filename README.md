# Press Start Quest

App web instalable en el móvil (PWA) que importa tu biblioteca de juegos de PC,
la enriquece con duración, nota y portada, y cada día te propone qué jugar para
ir cerrando tu backlog.

> Estado: etapa 0 (preparación). El esqueleto compila, tiene tests y CI; las
> funcionalidades llegan a partir de la etapa 1.

## Stack

| Parte         | Tecnología                                               |
| ------------- | -------------------------------------------------------- |
| Web           | React 19, Vite, TypeScript                               |
| API           | NestJS 12, TypeScript, Swagger                           |
| Base de datos | PostgreSQL (Neon) con Prisma 7 y `@prisma/adapter-pg`    |
| Compartido    | `packages/shared`: tipos y validaciones con zod          |
| Calidad       | Vitest, oxlint, Prettier y GitHub Actions                |
| Despliegue    | Render (API y web) y Neon (base de datos), plan gratuito |

## Estructura

```text
press-start-quest/
├─ apps/
│  ├─ api/                NestJS: módulos en src/, esquema en prisma/
│  └─ web/                React + Vite
├─ packages/shared/       tipos y esquemas zod comunes a web y API
└─ .github/workflows/     CI en cada pull request
```

## Arrancar en local

Requisitos: Node.js 24 (ver `.node-version`) y pnpm 12 (ver `packageManager`).

```bash
pnpm install                         # instala todo y genera el cliente de Prisma
cp apps/api/.env.example apps/api/.env   # y rellena las variables
pnpm dev                             # API en :3000 y web en :5173
```

- Web: http://localhost:5173
- API: http://localhost:3000/api/health
- Documentación de la API: http://localhost:3000/api/docs

## Scripts

| Comando                             | Qué hace                                     |
| ----------------------------------- | -------------------------------------------- |
| `pnpm dev`                          | Arranca shared, API y web en modo desarrollo |
| `pnpm build`                        | Compila los tres paquetes en orden           |
| `pnpm lint`                         | Pasa oxlint                                  |
| `pnpm typecheck`                    | Comprueba los tipos de TypeScript            |
| `pnpm test`                         | Ejecuta los tests unitarios                  |
| `pnpm format`                       | Formatea el código con Prettier              |
| `pnpm --filter @psq/api db:migrate` | Crea y aplica una migración en desarrollo    |

## Variables de entorno

Cada app tiene su `.env.example` con todas las variables y para qué sirven. Los
`.env` reales nunca se suben al repositorio.
