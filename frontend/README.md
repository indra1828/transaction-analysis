# TA Coach frontend

React app for the TA Coach backend. Pick a scenario, rehearse it with an AI character (free conversation or guided, reply by reply), then read a tentative Transactional Analysis report. Visual design follows `../DESIGN.md`: a light, cream-canvas theme with coral accents.

## Stack

- React 19, TypeScript, Vite
- Tailwind CSS v4 for all styling (no component library)
- React Router for pages
- Vitest for unit tests

## Run it

Start the backend first (see `../backend/README.md`), then:

```bash
npm install
npm run dev
```

Open <http://localhost:5173>.

The Vite dev server proxies `/api`, `/docs` and `/openapi.json` to the backend on `127.0.0.1:8000`, so the session cookie stays on the app's origin and no CORS setup is needed.

### Backend settings for the app

Add this to the backend's `src/.env`:

```text
FRONTEND_URL=http://localhost:5173
```

Google sign-in returns to the backend, which then redirects to `FRONTEND_URL`. Because the dev proxy keeps the browser's host, the callback URL is `http://localhost:5173/api/v1/auth/google/callback`. Register that URL in your Google OAuth client.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload and the API proxy |
| `npm run build` | Type-check (`tsc -b`) and production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Unit tests (Vitest) |
| `npm run lint` | Linter (oxlint) |
| `npm run test:e2e` | Live browser-level tests against a running backend and real model (see below) |

### Live end-to-end tests

`src/e2e/live.test.tsx` mounts the real app and drives it against a running backend. It makes real model calls, so it is skipped unless both variables are set:

```bash
E2E_BASE=http://127.0.0.1:8000 E2E_COOKIE=<signed ta_coach_session value> npm run test:e2e
```

Use a throwaway database for these runs. The cookie must be signed with the backend's `SESSION_SECRET` for a user that exists in that database.

## Structure

```text
src/
  api/          HTTP client, SSE reader, typed endpoint functions, backend types
  auth/         AuthProvider, useAuth, RequireAuth route guard
  components/   Shared UI: Button, Field, Card, Badge, Alert, AppShell, ...
  hooks/        useAsync: data loading with reload
  lib/          Formatting labels and scenario validation
  pages/        One file per route; thread/ holds the conversation screen
  index.css     Tailwind theme tokens taken from DESIGN.md
```

### Routes

| Path | Page |
| --- | --- |
| `/login` | Sign in with Google |
| `/` | Scenarios and your conversations |
| `/scenarios/new` | Draft a scenario with the assistant, or write one |
| `/scenarios/:id` | Scenario details and start a conversation |
| `/threads/:id` | Conversation: simulation chat or guided drafting |
| `/threads/:id/report` | TA report (created on demand if missing) |
| `/threads/:id/compare` | Branch compared with the original conversation |

### Chat streaming

The backend streams replies with server-sent events over `POST`, which `EventSource` cannot do. `api/client.ts` reads the stream with `fetch` and dispatches `message.delta`, `message.completed` and `message.error`. After each streamed reply the page reloads the saved history, because the backend removes the learner's message again when a reply fails.

## Design notes

- Colours, radii and font stacks are defined once in `src/index.css` under `@theme` and used as Tailwind classes such as `bg-canvas`, `text-ink` and `rounded-lg`.
- Headings use Cormorant Garamond (weight 500) and text uses Inter. Both load from Google Fonts in `index.html`. These are the open substitutes DESIGN.md names for the licensed Copernicus and StyreneB. If you license those fonts, self-host them and add `@font-face` rules in `index.css`; the theme already lists them first.
- Hover styles are limited to links, as DESIGN.md asks. Buttons change only on press and disabled states.

## Limitations

- Sign-in needs a real Google account, so the signed-in screens were not exercised end to end in a browser here. The API proxy and the anonymous responses were checked with live requests.
- A render error shows a "Something went wrong" screen with a reload button. API errors show inline messages on the page that made the request.
- Sessions that expire mid-use show the error on the page that made the request; the user then signs in again.
