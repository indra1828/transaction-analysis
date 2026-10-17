# TA Coach Backend

FastAPI backend for an AI roleplay coach. A user practices a difficult workplace conversation with an AI character, then gets a Transactional Analysis (TA) communication report. Two modes:

- **Simulation:** free conversation, then a full-transcript TA report. Users can branch from an earlier message to try a different reply.
- **Guided:** each reply is drafted, gets feedback, can be revised, and only the accepted version is sent. The AI replies after acceptance.

The original design spec is in [`docs/implementation-spec.md`](docs/implementation-spec.md). It describes the target design, which differs from what is built in a few places (see [Differences from the spec](#differences-from-the-spec)).

## Setup

Requires Python 3.11+ and [uv](https://docs.astral.sh/uv/).

```bash
uv sync
```

Create `src/.env` (loaded automatically by `src/main.py`):

| Variable | Required | Purpose |
| --- | --- | --- |
| `SESSION_SECRET` | yes | Signs the session cookie |
| `GOOGLE_CLIENT_ID` | yes | Google OAuth client |
| `GOOGLE_CLIENT_SECRET` | yes | Google OAuth client |
| `GROQ_API_KEY` | yes | LLM provider key |
| `LLM_MODEL` | no | Groq model ID, defaults to `openai/gpt-oss-120b` |
| `DATABASE_URL` | no | Defaults to `sqlite:///./conversation.db` (relative to where you start the server) |
| `MAX_TURNS` | no | Default turn limit per thread, default `20` |
| `COOKIE_SECURE` | no | Set `true` behind HTTPS |
| `FRONTEND_URL` | no | Where to send the browser after Google sign-in. Defaults to `/docs`. Set to `http://localhost:5173` for the React app |

Do not commit `.env`. A template is in `.env.example`: copy it to `src/.env` and fill in the values.

## Run

```bash
uv run uvicorn main:app --app-dir src --reload
```

On startup the app creates the tables (`init_db`) and seeds three public scenarios. Open the interactive docs at <http://127.0.0.1:8000/docs>.

## Test

```bash
uv run pytest
```

## Authentication

Every endpoint except `/health` requires a session. Log in through Google:

1. Open <http://127.0.0.1:8000/api/v1/auth/google/login> in a browser.
2. After the callback you are redirected to `/docs`, and the browser holds a `ta_coach_session` cookie.
3. Check who you are with `GET /api/v1/auth/me`. Log out with `POST /api/v1/auth/logout`.

Sessions are stored on the server (`auth_sessions` table) and last 30 minutes (`SESSION_LIFETIME` in `src/oauth/sessions.py`). The browser cookie holds only a random id. Logout deletes the session, so a copied cookie stops working straight away.

For curl, copy the `ta_coach_session` cookie value from the browser's dev tools and pass it on each request:

```bash
export BASE=http://127.0.0.1:8000/api/v1
export COOKIE="ta_coach_session=PASTE_VALUE_HERE"
```

Users only see their own threads. Public scenarios are visible to everyone.

## End-to-end walkthrough

These examples use curl. `-N` disables buffering so you can watch the SSE stream.

### 1. Pick a scenario

```bash
curl -s "$BASE/scenarios" -H "Cookie: $COOKIE"
```

Scenario IDs are UUIDs, so copy the `id` of the one you want. The three seeded scenarios are *Missed Deadline*, *Defensive Employee*, and *Silent Team*.

To create your own, use `POST /scenarios` with `{"title": "...", "config": {...}}`, or draft one with the LLM via `POST /scenarios/draft` (nothing is saved until you call `POST /scenarios`). Change a scenario you created with `PATCH /scenarios/{id}` (send only the fields to change, such as `{"config": {"opening_line": "..."}}`), and delete it with `DELETE /scenarios/{id}`, which also deletes its conversations and reports.

### 2. Start a simulation thread

```bash
export SCENARIO_ID="<id from step 1>"
curl -s -X POST "$BASE/threads" \
  -H "Cookie: $COOKIE" -H "Content-Type: application/json" \
  -d "{\"scenario_id\": \"$SCENARIO_ID\", \"mode\": \"simulation\"}"
```

Returns `201` with the thread and the AI's `opening_message`. Save the thread `id`:

```bash
export THREAD="<thread id>"
```

The scenario is copied into the thread when it starts, so later edits to the scenario do not change this conversation.

### 3. Exchange messages (SSE)

```bash
curl -N -X POST "$BASE/threads/$THREAD/messages" \
  -H "Cookie: $COOKIE" -H "Content-Type: application/json" \
  -d '{"content": "Let me understand what happened with the report first."}'
```

The response is a server-sent event stream:

```text
event: message.started
data: {"user_message_id":"<uuid>"}

event: message.delta
data: {"content":"Honestly, the requirements kept changing"}

event: message.completed
data: {"message_id":"<uuid>","thread_status":"active","completion_reason":null}
```

On failure you get `event: message.error` with a `detail` field. The user message is removed again, so you can retry the same text.

`completion_reason` is `scenario_completed` (the AI reached a stopping condition) or `max_turns` (the user hit the limit). Only `max_turns` sets `thread_status` to `completed`. After `scenario_completed` the thread stays `active`, and the learner decides whether to finish (`/complete`) or keep talking.

Repeat step 3 for as many exchanges as you like. History is available at `GET /threads/{id}/messages`.

### 4. Finish and read the TA report

```bash
curl -s -X POST "$BASE/threads/$THREAD/complete" -H "Cookie: $COOKIE"
curl -s "$BASE/threads/$THREAD/evaluation" -H "Cookie: $COOKIE"
```

`complete` runs the evaluator over the whole transcript and returns the stored report. Calling it again returns the same report. You need at least one user message and no reply in progress.

The report contains the summary, ego-state cues, transactions, the objectives (`achieved`, `partly_achieved`, `missed`) with evidence, one `turning_point`, strengths, improvements, alternatives, and a caveat. Every cue and transaction refers to message IDs in the transcript.

### 5. Branch from an earlier message

Pick the `id` of one of your own user messages from `GET /threads/{id}/messages`, then:

```bash
curl -s -X POST "$BASE/threads/$THREAD/branches" \
  -H "Cookie: $COOKIE" -H "Content-Type: application/json" \
  -d '{"message_id": "<user message id>", "content": "Can we review what changed and agree on a recovery plan?"}'
```

This creates a new thread (`201`) with the history before that message, plus your replacement. The original thread is not changed. Generate the AI's reply to the branch, then complete it:

```bash
export BRANCH="<branch id>"
curl -N -X POST "$BASE/threads/$BRANCH/continue" -H "Cookie: $COOKIE"
curl -s -X POST "$BASE/threads/$BRANCH/complete" -H "Cookie: $COOKIE"
curl -s "$BASE/threads/$BRANCH/comparison" -H "Cookie: $COOKIE"
```

`comparison` returns both reports and, per objective, how the status changed (`objective_changes`). It requires both threads to be completed.

### 6. Guided practice

Create the thread with `"mode": "guided"`, then:

```bash
# Draft a reply and get feedback (201). The AI does not respond yet.
curl -s -X POST "$BASE/threads/$GTHREAD/turns" \
  -H "Cookie: $COOKIE" -H "Content-Type: application/json" \
  -d '{"content": "You never give us enough time."}'

# Revise the draft (keeps earlier attempts in revisions)
curl -s -X POST "$BASE/threads/$GTHREAD/turns/$TURN/revise" \
  -H "Cookie: $COOKIE" -H "Content-Type: application/json" \
  -d '{"content": "The scope grew after the estimate. Can we revisit priorities?"}'

# Accept the latest draft: it becomes a user message and the AI replies (SSE)
curl -N -X POST "$BASE/threads/$GTHREAD/turns/$TURN/accept" -H "Cookie: $COOKIE"

# Review all turns with their feedback
curl -s "$BASE/threads/$GTHREAD/turns" -H "Cookie: $COOKIE"
```

Rules:

- Only one turn can be in draft at a time. Creating a turn while one is open returns `409`.
- An accepted turn cannot be revised or accepted again (`409`).
- Simulation endpoints (`POST /threads/{id}/messages`, `/continue`) refuse guided threads, and the guided turn endpoints refuse simulation threads.
- `POST /threads/{id}/complete` also works on guided threads. It runs the same evaluator over the transcript. The spec asked for guided threads to skip the final report, and the code doesn't enforce that.

## Endpoints

All paths are under `/api/v1`, except `/health`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness check |
| GET | `/auth/google/login` | Start Google sign-in |
| GET | `/auth/google/callback` | OAuth callback (sets session) |
| GET | `/auth/me` | Current user |
| POST | `/auth/logout` | Clear session |
| GET | `/scenarios` | List public and own scenarios |
| GET | `/scenarios/{id}` | One scenario |
| POST | `/scenarios` | Save a private scenario |
| POST | `/scenarios/draft` | Draft a scenario with the LLM (not saved) |
| PATCH | `/scenarios/{id}` | Change your own scenario; built-in ones are refused |
| DELETE | `/scenarios/{id}` | Delete your own scenario with its conversations and reports |
| POST | `/threads` | Start a thread (`simulation` or `guided`) |
| GET | `/threads` | Your threads, newest first |
| GET | `/threads/{id}` | One thread |
| GET | `/threads/{id}/messages` | Full ordered transcript |
| POST | `/threads/{id}/messages` | Send a message, stream the reply (SSE, simulation) |
| POST | `/threads/{id}/continue` | Stream the reply to the latest user message (simulation) |
| POST | `/threads/{id}/branches` | Branch from one of your user messages |
| POST | `/threads/{id}/complete` | Generate or return the TA report |
| GET | `/threads/{id}/evaluation` | Read the stored report |
| GET | `/threads/{id}/comparison` | Compare a branch with its original |
| GET | `/threads/{id}/turns` | Guided turns with their revisions |
| POST | `/threads/{id}/turns` | Submit a draft (guided) |
| POST | `/threads/{id}/turns/{turn_id}/revise` | Add a revision to an open turn |
| POST | `/threads/{id}/turns/{turn_id}/accept` | Accept the latest revision, stream the reply (SSE) |

Interactive docs at `/docs` list request and response schemas.

## Server-sent events

Streaming endpoints (`messages`, `continue`, `turns/{id}/accept`) emit:

| Event | Data | Meaning |
| --- | --- | --- |
| `message.started` | `user_message_id` | Request accepted, reply generation started |
| `message.delta` | `content` | A chunk of the AI reply |
| `message.completed` | `message_id`, `thread_status`, `completion_reason` | Reply saved |
| `message.error` | `detail` | Failed, or another reply is already running |

Errors that happen before streaming starts (not found, wrong mode, thread completed, busy) return normal HTTP errors such as `404` or `409`.

## Behaviour to know about

- **One reply at a time per thread.** A database lock on the thread rejects a second generation with `409`. The lock expires after 120 seconds, so a crashed request cannot block a thread forever.
- **Failed replies are rolled back.** If the model fails, the stream drops, or the reply is empty, the user message is deleted so the client can retry without duplicates.
- **Completion.** A simulation thread completes automatically only when the user reaches `max_turns`. When the AI signals a stopping condition, the reply reports `scenario_completed` and the thread stays open, so the learner can keep talking. The AI's stop signal is ignored until the learner has sent 8 messages, so a scene cannot end early. You can call `/complete` at any time.
- **Reports are stored once.** `complete` on a thread that already has a report returns it unchanged.

## Differences from the spec

The spec is the target design. Current code differs as follows:

- The resource is named `threads`, not `conversations`.
- No `client_message_id`, so a repeated send is not deduplicated by ID. The lock and rollback prevent most duplicate replies, but not a retry that arrives after a successful reply.
- No migrations (Alembic). Tables are created with `create_all` at startup, so schema changes need a fresh database or manual migration.
- The report has no version fields (`prompt_version`, `evaluator_version`, `model_id`) or status.
- Development login is Google OAuth only. There is no dev-only identity bypass.
- No `docs/api-examples.md` or `docs/todo.md` yet.

## Project layout

```text
src/
  main.py          app, router registration, lifespan (create tables, seed)
  routes/          HTTP handlers: scenario, thread, turn, oauth
  services/        thread logic shared by routes (locking, streaming, history)
  models/          Pydantic request, response, and LLM output schemas
  db/              SQLAlchemy models (db.py), session, seed data
  llm/             LLM workflows (see below)
  oauth/           Google client and current-user dependency
tests/             pytest suite
docs/              implementation spec
../frontend/       React app (separate project, see its README)
```

## LLM layer

Every LLM call goes through a Deep Agent (`deepagents`) built by `build_agent` in `src/llm/model.py`. Each agent makes one model call and has no tools: the built-in file tools and subagent tool are hidden by a harness profile registered in `model.py`.

```text
src/llm/
  model.py              Groq model (get_llm) and build_agent, shared by all workflows
  formatting_util.py    all parsing and response formatting: scenario and
                        transcript text, streamed text, end-marker handling,
                        structured output checks, evidence grounding
  roleplay.py           character opening line and streamed replies
  evaluator.py          whole-conversation TA report and guided turn feedback
  scenario.py           scenario draft from a description
  prompts/              one prompt per file (system prompts and the TA rules)
```

Prompts are plain strings with XML-style sections (`<role>`, `<rules>`, `<task>`). Scenario and transcript text go into the user message inside tags, so the prompts stay static apart from `{placeholder}` fields that the workflow fills in.

To add a workflow: write its prompt in `prompts/`, call `build_agent(prompt, response_format=Schema)` for structured output (or without `response_format` for text), and parse the result with `formatting_util`.
