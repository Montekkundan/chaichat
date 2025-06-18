# ChaiChat

> Modern AI-powered chat app built with Next.js 15, Convex, **AI-SDK**, and the T3 stack.

## Features

* **Next.js 15 / App Router** – React 19, Server & Client components, edge-ready.
* **Convex** realtime database – optimistic writes, branching chats, Dexie offline cache.
* **AI-SDK** integrations (OpenAI GPT-4o, Gemini Flash, Claude, etc.) with resumable streaming.
* File & image uploads via **uploadthing**.
* Anonymous rate-limited usage with **hCaptcha** gate.
* **PostHog** analytics & error capture.
* Dark / light themes, animated UI (Framer Motion).
* Fully typed (`strict` TS) and linted (Biome).

---

## Project structure (high-level)

```
convex/              – Convex functions & schema
public/              – static assets (place og.png here!)
src/app/             – Next.js routes & layouts
src/components/      – UI & feature components
src/lib/             – shared utilities (AI models, providers, config, …)
src/styles/          – Tailwind & global CSS
tsconfig.json        – strict TS config
```

---

## Quick start

1. **Clone & install**

   ```bash
   git clone <repo>
   cd chaichat
   bun install   # or pnpm / npm / yarn
   ```

2. **Environment variables** – copy & fill:

   ```bash
   cp .env.example .env.local
   # edit .env.local with your own keys
   ```

3. **Run dev server**

   ```bash
   bun run dev      # next dev --turbo
   bun run dev:convex  # (separate terminal) Convex local
   ```

4. Visit `http://localhost:3000`.

---

## Required environment variables

| Key | Description |
|-----|-------------|
| `NEXT_PUBLIC_CONVEX_URL` | Convex deployment URL (from `convex dashboard`) |
| `CONVEX_DEPLOYMENT`      | Convex deployment ID (dev / prod) |
| `CLERK_SECRET_KEY` & `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk auth keys (or skip if not using auth) |
| `OPENAI_API_KEY`         | For GPT-4o & other OpenAI models |
| `REDIS_URL`              | Optional – resumable-stream production store |
| `HCAPTCHA_SECRET_KEY` & `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` | Required to gate anonymous messages |
| `NEXT_PUBLIC_POSTHOG_KEY` & `NEXT_PUBLIC_POSTHOG_HOST` | Enable analytics / error capture |
| `NEXT_PUBLIC_APP_URL`    | Full origin (e.g. `https://myapp.com`) – used in OG tags |

> See `src/env.js` for the validated schema.

---

## Open-Graph image

Place `public/images/og.png` (1200×630) – it will be used for Twitter / OG tags set in `src/app/layout.tsx`.

---

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev`    | Next.js dev server |
| `bun run dev:convex` | Convex local dev |
| `bun run build`  | `next build` + Convex deploy hook |
| `bun run preview`| Start production server |
| `bun run check`  | Lint & type-check |

---

## License

MIT – © 20XX Your Name
