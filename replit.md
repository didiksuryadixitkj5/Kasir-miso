# Kasir Miso

Aplikasi kasir mobile untuk warung dan usaha kuliner kecil.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/kasir-miso run dev` — run the Expo mobile app through its managed workflow
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/kasir-miso/app/` — Expo Router screens for the mobile app
- `artifacts/kasir-miso/components/` — reusable kasir UI components
- `artifacts/kasir-miso/context/` — local persisted business and theme state
- `artifacts/kasir-miso/constants/colors.ts` — mobile semantic color tokens
- `artifacts/kasir-miso/app.json` — Expo app identity and native configuration

## Architecture decisions

- Data entered in the mobile app is persisted locally with AsyncStorage so the kasir remains usable offline.
- The Expo app is kept as a frontend-first artifact; server-backed features can be added through the shared API later.
- Expo package versions are kept aligned with the installed SDK before starting Metro.

## Product

Kasir Miso membantu pemilik warung mencatat pesanan meja, mengelola antrean dapur,
melihat riwayat dan laporan, serta mengatur stok, biaya, staf, dan profil bisnis.

## User preferences

-

## Gotchas

- Gunakan workflow Expo yang dikelola Project untuk menjalankan pratinjau, bukan menjalankan Expo server secara manual.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
