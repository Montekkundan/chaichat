Turbo scripts and workflow

This repo is a Turborepo monorepo. The Next.js app lives in `apps/www`.

Common commands

Use `--filter=www...` to run a task for the app and its local deps.

- Build the main app
```bash
bunx turbo run build --filter=www...
```

- Type-check the app
```bash
bunx turbo run check-types --filter=www...
```

- Biome check (read-only)
```bash
bunx turbo run check --filter=www...
```

- Biome check and write fixes
```bash
bunx turbo run check:unsafe --filter=www...
```

- Develop (single app)
```bash
bunx turbo dev --filter=www...
```

- Start www locally (via root script)
```bash
bun run dev        # uses turbo dev --filter=www...
```

- Start www locally (direct or from the app)
```bash
# from repo root
bunx turbo dev --filter=www

# or from the app directory
cd apps/www && bun run dev
```

- Develop all packages/apps (if you add more)
```bash
bunx turbo dev
```

Notes

- Environment variables for the app should be defined under `apps/www/.env*`.
- Caching: `dev` is non-cached; `build` and `check-types` use persistent caching.
- Remote caching (optional): set `TURBO_TEAM` and `TURBO_TOKEN` in your environment/CI to enable.
- CI recommendation:
```bash
bun install
bunx turbo run check-types build --filter=www...
```

Troubleshooting

- If `next.config.js` errors due to env validation during `build`, ensure required env vars exist or use `SKIP_ENV_VALIDATION=1` for local builds only.

Filter syntax (when to use `...`)

- Today (single app), `--filter=www` is fine.
- If you later add shared packages (e.g., `packages/tsconfig`, `packages/ui`, `packages/config`) that contribute to tasks you want built/typechecked alongside `www`, prefer `--filter=www...`.
- Reference:
  - `--filter=www` → only `www`.
  - `--filter=www...` → `www` and all of its dependencies.
  - `--filter=...www` → `www` and all packages that depend on it.
  - `--filter=...www...` → both dependencies and dependents.

Vercel build

- You do not need the `...` unless you want to include dependencies.
- Recommended build command at the repo root:
  ```bash
  turbo run build --filter=www
  ```
- Alternative: set Vercel project root to `apps/www` and use the app script directly (e.g., `bun run build` or `next build`).

