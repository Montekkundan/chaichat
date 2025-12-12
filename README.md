# ChaiChat

> Modern AI-powered chat assistant for experimenting with different AI models. Test, experiment, and explore AI without friction.

## Features

* **Next.js 15 / App Router** – React 19, Server & Client components, edge-ready.
* **Convex** realtime database – optimistic writes, branching chats, Dexie offline cache.
* **AI-SDK** integrations with multiple providers (OpenAI, Anthropic, Google, etc.) with resumable streaming.
* **BYOK (Bring Your Own Key)** – All models require your own API keys for maximum privacy and control.
* **Optional Login** – Use locally without account, or sign in to sync API keys and chats across devices.
* **Local-First** – Non-logged users store API keys and chats locally, with optional cloud sync when signed in.
* File & image uploads via **uploadthing**.
* Dark / light themes, animated UI (Framer Motion).
* Fully typed (`strict` TS) and linted (Biome).

---

## Philosophy

ChaiChat is designed for **frictionless AI experimentation**. You can:

1. **Start immediately** – No signup required, just add your API keys locally
2. **Test any model** – All major AI providers supported with your own keys  
3. **Stay private** – Your keys stay on your device or encrypted in your account
4. **Upgrade when ready** – Optional login provides cloud sync and cross-device access

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
| `CLERK_SECRET_KEY` & `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk auth keys for optional login |
| `REDIS_URL`              | Optional – resumable-stream production store |
| `NEXT_PUBLIC_APP_URL`    | Full origin (e.g. `https://myapp.com`) – used in OG tags |

> See `src/env.js` for the validated schema.

## API Keys

ChaiChat requires **your own API keys** for all AI models:

- **OpenAI** – For GPT-4o and other OpenAI models
- **Anthropic** – For Claude models  
- **Google** – For Gemini models
- **Mistral** – For Mistral models

### Storage Options:

- **Not logged in**: Keys stored in browser localStorage/sessionStorage
- **Logged in**: Keys synced securely to Convex for cross-device access

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
