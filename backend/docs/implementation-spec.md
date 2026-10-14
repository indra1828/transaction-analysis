# TA Coach — Coding Agent Implementation Specification

> **Audience:** Codex / Claude Code acting as a senior Python backend engineer.  
> **Project:** AI-powered managerial roleplay and Transactional Analysis (TA) communication coach.  
> **Primary deliverable:** A functioning, tested, documented FastAPI backend inside an existing project that already has a `src/` directory.  
> **Development approach:** Implement incrementally, confirm official documentation before using framework APIs, and do not overengineer.

## 0. Instructions to the coding agent — read first

1. **Inspect the existing repository before writing code.** Preserve existing code, project conventions, and installed dependencies where practical. Do not assume this repository is empty. The user has already created a `src/` directory; place the majority of backend application code there.
2. **Use only current official documentation to determine FastAPI, LangChain, LangGraph, and provider-specific API usage.** Do not improvise framework imports or rely on remembered/deprecated syntax.
   - FastAPI: <https://fastapi.tiangolo.com/>
   - LangChain documentation MCP: <https://docs.langchain.com/mcp>
   - LangChain Python docs: <https://docs.langchain.com/oss/python/langchain/overview>
   - LangGraph Python docs: <https://docs.langchain.com/oss/python/langgraph/overview>
   - LangGraph persistence: <https://docs.langchain.com/oss/python/langgraph/persistence>
   - LangGraph time travel: <https://docs.langchain.com/oss/python/langgraph/use-time-travel>
   - LangChain structured output: <https://docs.langchain.com/oss/python/langchain/structured-output>
   - FastAPI SSE: <https://fastapi.tiangolo.com/tutorial/server-sent-events/>
   - FastAPI bigger applications: <https://fastapi.tiangolo.com/tutorial/bigger-applications/>
   - FastAPI testing: <https://fastapi.tiangolo.com/tutorial/testing/>
3. **Documentation MCP:** If the coding environment has the official LangChain documentation MCP server configured, use it to look up applicable documentation *before* implementing LangChain/LangGraph code. The URL above is the documentation MCP endpoint, **not** a requirement to expose a runtime MCP server from TA Coach. If the MCP client/server connection is unavailable, inspect official LangChain documentation pages; explicitly report the limitation. Do not fabricate MCP tool names or configuration syntax; follow the instructions for the actual coding environment.
4. Look up and record relevant official reference links for each framework feature used (router/dependencies, streaming, structured output, graph state/checkpointing, etc.). Document key choices in `docs/implementation-notes.md`. Prefer stable, current APIs.
5. **Do not immediately implement the entire system in one unreviewable change.** Build working vertical slices in the milestone order below; after each milestone run the applicable tests and summarize what changed, which endpoints work, and how to verify them. Continue through the milestones if the task allows.
6. Type annotations, Pydantic request/response models, dependency injection, small composable functions, clear exceptions, and pytest tests are mandatory. Keep routes thin. Never put large LLM prompts in route handlers.
7. Never hardcode secrets. Use `.env.example` and environment-based settings. No actual credentials should be committed.
8. Favor **two focused workflows** over elaborate autonomous multi-agent collaboration. No RAG, vector database, Kafka, Celery, distributed microservices, or fine-tuning in the MVP.
9. **Be honest about completion.** If a feature is not implemented, list it in `docs/todo.md` and do not present it as working.

---

## 1. Product intent

This is an educational seminar demo for a **managerial audience at IIM Visakhapatnam**. The user plays a manager or colleague in a difficult workplace conversation. An AI character plays the other participant. A separate TA Evaluator gives constructive, context-grounded feedback about communication.

**Core learning outcome:** *The same situation can unfold differently depending on how we respond.*

### Important framing

Transactional Analysis (TA) is a framework for reflection, **not a personality test, psychiatric diagnosis, or validated hiring/performance assessment**. Don't infer fixed personality, motives, childhood history, or a life script from a short interaction. Ego state categories (Parent / Adult / Child) are **possible contextual interpretations**. Identify what was *actually said*, quote supporting messages, note uncertainty, and offer practical alternatives.

### Relevant TA concepts from the user's beginner guide

- **Ego states:** Parent, Adult, Child; possible Critical/Nurturing Parent and Free/Adapted Child cues.
- **Transactions:** complementary, crossed, possibly ulterior, or unclear. Ulterior intent cannot be confidently inferred from text alone.
- **Strokes:** positive/negative, conditional/unconditional recognition.
- **Active / reflective listening:** paraphrase, clarification, acknowledgement, open questions.
- **Assertiveness:** distinguish passive, aggressive, and assertive communication.
- **Conflict resolution:** facts vs assumptions, needs, options, agreement, follow-up.
- **Discounting, group dynamics, negotiation:** use only when transcript supports them.

If the provided `Transactional_Analysis_Beginners_Guide.docx` is present in the repository, treat it as the project's **domain reference**, extract concepts accurately, and avoid inventing TA doctrine. If it is not available, use the conceptual summary above without pretending to have read the original file. Do not build document RAG for this static guide.

---

## 2. User experience and modes

### A. Simulation mode (`simulation`)

1. User selects a predefined scenario or enters a custom scenario.
2. User selects **Simulation**.
3. Backend creates a conversation, freezes the scenario configuration, and generates the AI character's opening message.
4. User and AI conduct a natural, adaptive conversation (default suggested limit: 10 user turns, configurable). This should **not feel like a questionnaire**; the AI may challenge, clarify, acknowledge or negotiate according to context.
5. User ends the session, or the scenario reaches an appropriate natural stopping point. Do not force a stop just to label a user.
6. TA Evaluator analyzes the **whole transcript** and returns a structured report.
7. User may retry a selected prior user message to explore an **alternative branch**, then complete and compare both runs.

### B. Guided practice mode (`guided`)

1. User selects scenario and **Guided Practice**.
2. AI plays a character and presents the next message.
3. User submits a **candidate reply**. The TA Evaluator provides brief feedback **before** the character reacts.
4. User can **revise** the candidate reply multiple times, or **accept** it.
5. Only the **accepted** reply becomes canonical conversation history; then the AI character responds.
6. Continue until ended. A final full report is **not required** for the MVP; all turn-level feedback should be retained. Optionally show a non-scored session recap later.

**Mode is immutable per conversation.** Use the same conversation resource and mode-aware services/workflows; guided practice has additional turn endpoints because submitting a candidate, revising, and accepting are meaningfully distinct actions.

### Semantic clarification

- **Roleplay Agent** = the AI *character*, not the TA coach. It must not give unsolicited TA feedback while in character.
- **TA Evaluator** = a separate analysis workflow which must not modify the original transcript.
- Roleplay does **not** need to ask 5–10 predetermined questions. Set objectives and realistic boundaries, then let the dialogue adapt.
- The simulated character should not be unrealistically hostile, abusive, or stereotyped. Responses must remain contextually believable.

---

## 3. Technology and design defaults

- **Python:** use a currently supported release compatible with verified dependency versions.
- **API:** FastAPI, Pydantic v2, ASGI, OpenAPI.
- **AI:** LangChain Python for LLM integration, prompt templates and structured output; LangGraph `StateGraph` for explicit workflows and state.
- **Persistence:** PostgreSQL + SQLAlchemy 2.x + Alembic migrations; JSONB for scenario snapshots, feedback and reports. Keep the data-access layer sufficiently isolated to allow a fast SQLite test database where practical, noting dialect differences.
- **LLM model:** configurable through settings and provider adapter. Do not assume a particular provider, model, or key; choose the provider integration available in the repository, based on its current official docs. Support a deterministic **mock LLM** in tests.
- **Streaming:** SSE over a streaming POST response for character output. Follow current FastAPI SSE guidance and test real event frames.
- **Authentication:** retain an authentication boundary and `user_id` FK; for the initial local demo provide a clearly marked **development-only identity dependency**. Add real OIDC/OAuth login only when requested/needed. Do not claim OAuth2 is implemented if it is not. In production, verify tokens with a trusted identity provider and authorize ownership on every resource.
- **Frontend:** not required in the first backend milestone. APIs must be testable through HTTP clients and Swagger for non-streaming routes. A tiny demo UI can be added later, but do not let frontend development delay the backend.
- **Test/quality:** pytest, FastAPI TestClient/httpx as appropriate, Ruff, typing where practical, a small reproducible set of golden conversation fixtures.

### Architectural principles

- Thin `routes` -> `services` -> `db` repositories -> storage.
- `llm` contains prompt templates, model adapters, typed graph state, and LangGraph workflows.
- `models` contains SQLAlchemy ORM models; `schemas` contains Pydantic API and LLM output schemas. Avoid using ORM models as public response contracts.
- `utils` is for truly generic utilities, **not** a dumping ground for business logic.
- Explicit state transitions and ownership checks; keep LLM calls outside open database transactions.
- Explicit versioned prompts and evaluator schema. Save `prompt_version`, `evaluator_version`, `model_id` with evaluations where applicable.

---

## 4. Target backend layout

Follow this **conceptual structure**, adjusting filenames only where existing repository conventions make that necessary:

```text
backend/                         # If an existing backend root exists, work there
├── pyproject.toml
├── .env.example
├── alembic.ini
├── alembic/
│   └── versions/
├── docs/
│   ├── implementation-notes.md
│   ├── api-examples.md
│   └── todo.md
├── src/
│   ├── __init__.py
│   ├── main.py                # FastAPI app factory / lifespan / router registration
│   ├── core/
│   │   ├── config.py         # Validated settings
│   │   ├── security.py       # Current-user dependency, auth boundary
│   │   ├── exceptions.py
│   │   └── logging.py
│   ├── routes/
│   │   ├── health.py
│   │   ├── scenarios.py
│   │   ├── conversations.py
│   │   ├── messages.py
│   │   ├── turns.py
│   │   ├── evaluations.py
│   │   └── branches.py
│   ├── schemas/
│   │   ├── scenario.py
│   │   ├── conversation.py
│   │   ├── message.py
│   │   ├── turn.py
│   │   ├── evaluation.py
│   │   └── common.py
│   ├── models/                # SQLAlchemy ORM tables
│   │   ├── user.py
│   │   ├── scenario.py
│   │   ├── conversation.py
│   │   ├── message.py
│   │   ├── turn_attempt.py
│   │   ├── feedback.py
│   │   └── evaluation.py
│   ├── db/
│   │   ├── base.py
│   │   ├── session.py
│   │   └── repositories/
│   │       ├── scenarios.py
│   │       ├── conversations.py
│   │       ├── messages.py
│   │       ├── turns.py
│   │       └── evaluations.py
│   ├── services/
│   │   ├── scenario_service.py
│   │   ├── conversation_service.py
│   │   ├── message_service.py
│   │   ├── guided_turn_service.py
│   │   ├── evaluation_service.py
│   │   └── branch_service.py
│   ├── llm/
│   │   ├── providers.py
│   │   ├── state.py
│   │   ├── prompts/
│   │   │   ├── roleplay.py
│   │   │   ├── ta_feedback.py
│   │   │   ├── ta_report.py
│   │   │   └── scenario_generation.py
│   │   ├── graphs/
│   │   │   ├── roleplay_graph.py
│   │   │   └── evaluation_graph.py
│   │   └── outputs.py
│   └── utils/
│       └── ids.py
└── tests/
    ├── conftest.py
    ├── api/
    ├── services/
    ├── llm/
    └── fixtures/
```

If the repository root **already is** the backend, do not create an extra `backend/` folder. Do not create unused empty modules just to match the tree.

---

## 5. Domain model and state machine

### Tables

**`users`**
- `id` UUID primary key, `email` nullable during local demo, external identity issuer/subject fields for later OIDC.

**`scenarios`**
- `id` UUID or stable slug, `title`, `description`, `owner_user_id` nullable for built-in scenarios, `is_builtin`, `persona_config` JSONB, `objectives` JSONB, timestamps.
- For user-defined scenarios, validate maximum lengths and allowed domain. Store only safe, necessary information.

**`conversations`** (equivalent to user's proposed `threads`)
- `id` UUID, `user_id` FK, `scenario_id` nullable FK, `scenario_snapshot` JSONB, `mode` (`simulation`/`guided`), `status`, `max_user_turns`, `parent_conversation_id` nullable self-FK, `branched_from_message_id` nullable reference, `created_at`, `completed_at`, optimistic `version` or equivalent concurrency guard.
- Scenario snapshot is **immutable** after session creation. Include role, situation, objectives, persona and prompt/scenario version metadata.
- Use application conversation IDs as externally visible identifiers. Map LangGraph `thread_id` to the application conversation ID if checkpointing is employed, avoiding accidental collisions.

**`messages`**
- `id` UUID, `conversation_id` FK, `role` (`user`/`assistant`), `content`, `turn_number` or monotonic `sequence_no`, `status` (`complete`/`interrupted`/`failed` as necessary), `origin_message_id` nullable (if copied from parent branch), `client_message_id` nullable (unique **within a conversation** for user idempotency), timestamps.
- Canonical transcript includes **accepted user messages and completed AI responses**. Candidate responses are not canonical messages.

**`turn_attempts`** (guided mode)
- `id`, `conversation_id`, `responding_to_message_id`, `candidate_content`, `attempt_no`, `status` (`pending`/`accepted`/`superseded`), timestamps, `accepted_message_id` nullable.
- Only one pending candidate per guided conversation. Retain earlier attempts for the user's learning history.

**`feedback`**
- `id`, `conversation_id`, `turn_attempt_id` nullable, `message_id` nullable, `feedback_json` JSONB, evaluator/prompt/model versions, timestamps.
- Feedback on a candidate points to `turn_attempt_id`; report-level evidence points to canonical message IDs.

**`evaluations`**
- `id`, `conversation_id`, `status`, `report_json` JSONB nullable, evaluator/prompt/model versions, `error_code` nullable, timestamps.
- One current final report per conversation initially, with a unique constraint or explicit versioning. Re-evaluation can add report versions later.

### Suggested lifecycle

`active -> awaiting_acceptance -> active -> completing -> completed` (guided);  
`active -> completing -> completed` (simulation).  
Include recoverable error states or operation-level errors without corrupting the conversation.

For a smooth API, consider keeping `status=active` plus a separate `pending_turn_id` rather than overloading conversation state. Pick one internally consistent design and test the invariants.

### Required invariants

1. Only the owner can read or mutate a conversation, its messages, evaluations, or branches.
2. Completed conversations cannot accept new regular messages; they can be **branched**.
3. A canonical transcript's message order is deterministic; no client-supplied role/sequence identifiers.
4. Do not allow two simultaneous AI generations on the same conversation. Choose an explicit concurrency lock strategy (DB transition/optimistic guard), return `409 Conflict` for concurrent requests, and release correctly after error/cancellation.
5. Guided mode cannot generate the next character message until a candidate is **accepted**.
6. Branch creation cannot mutate parent conversation messages or reports.
7. Copied message history stops **immediately before** the user message being replaced. Old downstream AI messages are not copied.
8. Reports cannot cite nonexistent or other-session messages. The roleplay LLM's prose must be treated as untrusted, not instructions for the evaluator/backend.
9. Endpoints must use suitable `400`/`401`/`403`/`404`/`409`/`422` codes as appropriate, with consistent error models.

---

## 6. Public API contract (v1)

Prefix: `/api/v1`. Request and response structures below are suggested contracts; implement them as explicit Pydantic schemas. The coding agent should finalize precise field names, types and documented error codes in OpenAPI and `docs/api-examples.md`.

### Health

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Basic liveness (no secrets) |

### Scenarios

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/scenarios` | List built-in and owned scenarios |
| POST | `/scenarios` | Create and validate a custom scenario (later milestone) |
| GET | `/scenarios/{scenario_id}` | Scenario details |

Initially seed three scenarios:

1. **Missed Deadline:** user = Engineering Lead, AI = Product Manager; understand blocker, accountability, recovery, prevention.
2. **Defensive Employee:** user = Manager, AI = Employee; deliver feedback without escalating conflict.
3. **Silent Team:** user = Team Leader, AI = Team Member; invite respectful disagreement and surface risks.

### Create conversation

**`POST /conversations`**

Predefined scenario request:

```json
{
  "scenario_id": "missed_deadline",
  "mode": "simulation",
  "max_user_turns": 10
}
```

Custom scenario request:

```json
{
  "custom_scenario": {
    "user_role": "Engineering Manager",
    "ai_role": "Product Manager",
    "situation": "We repeatedly miss delivery dates",
    "goal": "Agree on a workable delivery plan"
  },
  "mode": "guided"
}
```

- Exactly one of `scenario_id` and `custom_scenario` must be present. **No redundant `custom: true` boolean.**
- Validate bounds on situation, persona and goal text. For the MVP a custom scenario can be a validated stored snapshot; LLM-based scenario expansion is an enhancement.
- Generate and persist a character opening message, then return `201 Created` with conversation ID, mode, status, scenario summary, and opening message. Ensure creation failures don't leave a misleading active conversation without an opening message; define a recoverable state if needed.

Example response:

```json
{
  "conversation_id": "<uuid>",
  "mode": "simulation",
  "status": "active",
  "opening_message": {
    "id": "<uuid>",
    "role": "assistant",
    "content": "We missed Friday's deadline. What happened?"
  }
}
```

### Retrieve conversation and history

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/conversations` | Paginated owned sessions |
| GET | `/conversations/{conversation_id}` | Metadata, mode, status and branch lineage |
| GET | `/conversations/{conversation_id}/messages` | Canonical ordered history |

Implement stable ordering, reasonable pagination, and authorization.

### Simulation-mode chat and SSE

**`POST /conversations/{conversation_id}/messages`**

```json
{
  "content": "The integration team delivered data late.",
  "client_message_id": "optional-client-generated-id"
}
```

- Only valid in `simulation` mode, while active.
- Save the user's canonical message, generate the AI character reply using conversation history and frozen scenario, then stream AI output via SSE.
- Use officially supported current FastAPI SSE APIs. If precise imports need verification, consult official docs before coding.
- Clearly define events and error semantics, for example:

```text
event: message.started
data: {"message_id":"<uuid>"}

event: message.delta
data: {"content":"I understand"}

event: message.completed
data: {"message_id":"<uuid>"}

event: turn.completed
data: {"conversation_status":"active"}
```

- Finalize the server's post-failure/stream-disconnection behavior: clients should be able to retrieve committed history and not accidentally duplicate their user request.
- Persist a completed assistant message as a single canonical record rather than writing a row per token. If interrupted, store an explicit interrupted state and avoid displaying it as a finalized response.
- A duplicate `client_message_id` must not trigger a second character turn. Define what repeat clients receive (e.g., a conflict with a retrievable prior result, or replay from stored result); implement and test it.

### Guided practice — explicit pending turn workflow

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/conversations/{id}/turns` | Submit a **candidate** user reply and receive structured feedback |
| POST | `/conversations/{id}/turns/{turn_id}/revise` | Replace current pending attempt with another candidate and receive fresh feedback |
| POST | `/conversations/{id}/turns/{turn_id}/accept` | Accept the candidate, persist canonical user message, then stream AI character response |

Candidate request:

```json
{"content": "You never give us enough time."}
```

Feedback response (synchronous, JSON is fine for MVP):

```json
{
  "turn_id": "<uuid>",
  "status": "pending",
  "feedback": {
    "observation": "The answer could be interpreted as blaming.",
    "strength": "You highlighted a real schedule constraint.",
    "improvement": "Describe the specific blocker and request a shared decision.",
    "suggested_response": "The timeline changed after scope increased. Can we revisit the priorities?",
    "ta_cues": ["possibly crossed transaction"]
  }
}
```

- `revise`: mark previous attempt superseded; create a new attempt with incremented attempt number. Decide whether the URL identifies a logical pending turn or an individual attempt, and keep it consistent. **Preferred:** treat `turn_id` as a stable logical turn and store revisions in `turn_attempts` with their own IDs if necessary. If implementing the simpler table, document how pending-turn identity stays stable.
- `accept`: atomically mark the selected attempt accepted and create the canonical user message; then generate/stream the character reply. Never accept the same turn twice. Handle network cancellation safely.
- If an AI reply was successfully generated after accept but the client disconnected, history retrieval should recover it without replaying the model blindly.

### Completion and final report

**`POST /conversations/{conversation_id}/complete`**

```json
{"reason": "user_requested"}
```

- Simulation: mark completing, run TA Evaluator over full canonical transcript, store validated report, mark completed. Synchronous JSON for MVP; asynchronous `202 Accepted`/job status is a later optimization.
- Guided: mark completed; do not produce a full final report in MVP (turn feedback is already saved). Reject completion while a pending candidate exists, or explicitly discard it after documented confirmation; choose a simple consistent policy.
- Also allow normal ending when scenario objectives have been addressed or a configured turn limit is reached, but do not automatically label personality or equate turns with understanding.

**`GET /conversations/{conversation_id}/evaluation`**

- Return report and status for simulation sessions; guided sessions may return `not_applicable` and provide turn feedback through the turns history API (add `GET /conversations/{id}/turns` if needed).

Suggested structured report:

```json
{
  "summary": "The dialogue escalated when the response shifted from delivery constraints to personal blame.",
  "strengths": [
    {
      "observation": "Identified a relevant blocker",
      "message_ids": ["<existing-user-message-id>"]
    }
  ],
  "improvements": [
    {
      "observation": "Used a broad accusation that could increase defensiveness",
      "message_ids": ["<existing-user-message-id>"],
      "ta_concept": "Possible crossed transaction",
      "certainty": "tentative",
      "suggested_response": "Let's identify what prevented delivery and agree on a recovery plan."
    }
  ],
  "turning_point_message_id": "<existing-user-message-id>",
  "objectives_met": ["Discussed the blocker"],
  "objectives_outstanding": ["Agreed recovery plan"]
}
```

- Validate referenced message IDs, suitable TA concepts, required evidence, and schema.
- Mark uncertain interpretations as uncertain. No psychological diagnosis or scientifically unvalidated numerical scores.

### Branching / retry earlier user message

**`POST /conversations/{conversation_id}/branches`**

```json
{
  "from_message_id": "<original-user-message-uuid>",
  "replacement_content": "Can we review what changed and agree on a recovery plan?",
  "branch_name": "A more constructive response"
}
```

Returns `201 Created` with `conversation_id` for **a new session**, `parent_conversation_id`, `branched_from_message_id`, mode, and status. The new session inherits scenario configuration and mode. For MVP, restrict branching to `simulation` conversations; document guided branching as future scope.

**Implement copy-on-branch:**

1. Verify user owns source conversation and message; chosen message has role `user` and belongs to source.
2. Copy complete historical messages strictly **before** selected user message, preserving order and provenance via `origin_message_id`.
3. Create new conversation and set `parent_conversation_id` and `branched_from_message_id`.
4. Insert the replacement as the new branch's next user message.
5. Generate a fresh AI response based **only** on the new branch prefix plus replacement.
6. Preserve the original conversation, downstream original messages and original report unchanged.
7. Return branch ID and optionally stream generated assistant response via a **dedicated branch continuation request** if doing LLM generation synchronously inside branch creation creates poor failure semantics. Pick and document one strategy. Preferred MVP: branch creation returns an active branch with revised user message and an explicit `POST /conversations/{branch_id}/continue` to generate the pending AI reply exactly once; this requires `awaiting_ai` state. Alternative: generate within branch creation with idempotent retries.
8. After the new branch completes, users can evaluate and compare its feedback to the original. A special comparison endpoint is optional; the frontend can fetch both reports.

**No in-place edits of an older canonical message.** Old downstream AI responses would no longer match changed context. Do not use LangGraph checkpoint time travel as a substitute for application-level lineage for the MVP.

---

## 7. LangGraph workflows and responsibilities

### Roleplay workflow

Inputs: immutable scenario snapshot, canonical history, new accepted user message (or initial scenario setup), current objective progress and turn budget.

Proposed steps:

```text
load_and_validate_context -> compose_persona_prompt -> generate_character_reply
                          -> derive_optional_goal_progress -> persist_output
```

For technical integrity, service-level persistence can happen **outside** the graph rather than inside LLM nodes. Choose one location for saving canonical messages; avoid double writes. The graph should be easy to mock and invoke in unit tests.

State example (refine using verified latest LangGraph APIs):

```python
class RoleplayState(TypedDict):
    conversation_id: str
    scenario: dict
    history: list[dict]
    accepted_user_message: dict | None
    assistant_response: str | None
    objective_progress: dict
    should_end: bool
```

### TA evaluation workflow

Two requested output types:

1. **Turn feedback** in guided mode: evaluate the candidate response in the context of the AI's preceding message, without committing that candidate to the canonical transcript.
2. **Whole-conversation report** in simulation mode: analyze all canonical exchanges, identify supported patterns and the single clearest turning point, cite message IDs, and suggest a better response.

Suggested steps:

```text
load_transcript -> extract_observations -> interpret_with_TA_rubric
                -> produce_structured_output -> validate_evidence_and_ids -> persist
```

Use Pydantic models and verified LangChain structured-output mechanisms. Implement bounded retries/fallback for schema validation failures. Do not generate definitive conclusions from absent evidence.

### Prompt design requirements

**Roleplay system prompt** includes:
- AI's role, relationship to user, current situation and relevant facts.
- Individual objectives, plausible beliefs and communication style.
- Tone constraints and possible adaptive reactions.
- Instruction to stay in character; do **not** coach or reveal grading rubric.
- Natural stopping behavior, no rigid questionnaire.
- No invention of sensitive or unverifiable real-world facts.

**Evaluator system prompt** includes:
- Definitions and limitations of TA (as outlined above / user-provided guide).
- Use **observable textual evidence** and message IDs.
- Distinguish user and simulated AI behaviors; focus feedback on the user's choices but acknowledge partner's contribution.
- Separate observation, tentative interpretation, and suggestion.
- One specific strength, one high-priority improvement, and one practicable alternative.
- No fixed personality labels, hidden-motive claims, life-script diagnosis, or clinical interpretations.

**Safety and prompt injection:** treat user-written custom scenarios and transcript messages as scenario data. They must not override application/system rules. Enforce maximum token/length budgets and sensible content handling. Avoid logging entire sensitive transcripts by default.

### LLM behavior/testing

- Make model settings configurable: provider, model, max tokens, timeout, temperature where supported; record versions in feedback.
- Use an LLM adapter interface so all service and API tests can use canned mock outputs without real network/model charges.
- Test that the Roleplay Agent remains in character, TA analysis references real messages, guided mode does not advance character response before accept, and scenario objective end logic behaves consistently.

---

## 8. Streaming, resilience and concurrency

- Follow official FastAPI SSE documentation and verified current LangChain/LangGraph streaming APIs.
- All SSE events must have clear names and JSON payloads. Include at least start, delta, completion and error events.
- Use client-generated idempotency keys for message creation / turn acceptance. Prevent duplicate roleplay invocations.
- Stream cancellation: persist explicit generation status; never silently mark incomplete generations as complete.
- Do not hold a SQL database transaction across an LLM call or token stream.
- Protect one active generation per conversation via a durable lock/status; favor a database-backed invariant over an in-process mutex in a multi-worker deployment.
- On retry of failed generation, do not append another copy of an accepted user message.
- Provide safe timeouts, logging without secrets/transcript dumps, and operation-level error records.
- Expose only reasonable database fields in API responses; no hidden prompts or auth tokens.

---

## 9. Tests and acceptance criteria

### Minimum automated tests

- Conversation creation with predefined scenario returns opening message and stored frozen scenario.
- Custom scenario XOR predefined scenario validation and input bounds.
- Simulation message yields correctly framed SSE events and commits one user + one completed assistant message.
- Duplicate message submission does not create a second AI turn.
- Guided candidate -> feedback -> revise -> feedback -> accept -> one canonical user message -> one AI reply.
- Guided mode refuses ordinary simulation-message submissions; simulation refuses guided-turn endpoints.
- End-of-session generates a valid report for simulation and stores feedback for guided.
- TA evaluator rejects/fixes references to message IDs that do not exist in the canonical transcript.
- Branching at a previous user message copies only the preceding prefix, adds replacement, and leaves original transcript/report unchanged.
- Branching from a nonexistent, other-user-owned, or assistant message is rejected.
- Cannot add user messages to completed conversations.
- Concurrent sends/accept calls do not create duplicate AI generations.
- DB rollback and retry behavior after model failures.
- Unauthorized users cannot access someone else's threads, reports, feedback or branches.

### Human-visible demo criteria

1. Choose **Missed Deadline**, **Simulation**, see the AI Product Manager opening line.
2. Complete 4–6 realistic exchanges with dynamic AI replies.
3. End and receive a readable TA analysis with **specific evidence and one turning point**.
4. Retry the highlighted response to create a branch; continue and see a different plausible trajectory.
5. Choose **Guided Practice**, get feedback on a draft response, revise it, and accept it to continue the scenario.
6. Show that original and revised conversations remain available; no fabricated personality label appears.

**Note:** LLM outputs are nondeterministic. Tests should validate schema, workflow, safety boundaries and mock outputs—not exact wording from a live model.

---

## 10. Incremental implementation plan

### Milestone 0 — repository audit and setup

- Inspect tree, existing `src`, dependencies and tooling.
- Verify current official documentation via FastAPI docs and LangChain docs MCP if available.
- Create settings, app entry point, database session, lint/test configuration, `.env.example`, README.
- Add `GET /health` and one basic test.

### Milestone 1 — persistent scenarios and conversations

- ORM models, Alembic migrations, repositories and services.
- Seed 3 scenarios, create conversation, freeze scenario, produce an opening message (mock-first, then actual model).
- Implement GET conversation and GET history.

### Milestone 2 — working simulation roleplay

- Roleplay graph, prompts, model adapter, state, streaming message endpoint.
- Persist messages, enforce one generation at a time, test idempotency and SSE.

### Milestone 3 — full-session TA report

- TA Evaluator graph, Pydantic report, `/complete`, `/evaluation`.
- Evidence validation and report-quality tests.

### Milestone 4 — fork-and-retry

- Branch endpoint, copy-on-branch, provenance, fresh roleplay continuation.
- Tests proving original report/history remain immutable.

### Milestone 5 — guided practice

- Candidate/revision/acceptance APIs; turn-level feedback, pending/accepted state invariants.
- Tests for repeated revisions, duplicate accept and model failures.

### Milestone 6 — custom scenarios and polish

- Store validated user scenarios. Optional LLM-assisted expansion with user review.
- Demo seed data, API examples, optional tiny frontend and authentication integration.
- README with local setup, diagrams, curl examples, SSE demo and limitations.

At each milestone: **show the modified files, describe design decisions, list official documentation used, run tests, and enumerate any unfinished behavior.**

---

## 11. Open design choices: choose sensible defaults, record them

Do not block the implementation for routine decisions. Implement documented defaults while preserving clear upgrade paths:

1. **App database:** Postgres in normal development; lightweight test DB as feasible.
2. **LangGraph persistence:** Use verified checkpointing if helpful, but database is source of truth for canonical user-visible transcripts and branching. Keep DB and checkpoint identifiers explicitly mapped. In-memory checkpointing is development-only, not durable production persistence.
3. **Branch continuation:** Prefer an explicit resumable pending-AI state to avoid partial writes when generating immediately during branch creation.
4. **Auth:** Development identity only for local demo, guarded by `APP_ENV=development`; real OIDC can be plugged in later.
5. **Scenario opening:** Generate once, persist once. Re-fetch, do not regenerate on reload.
6. **Reports:** Synchronous for MVP, evolution to an async job API when needed.
7. **Turn limit:** Suggested default 10 user turns; user can manually end, and system can suggest ending if goals have been met.
8. **Frontend:** defer until core endpoints and services are tested.

---

## 12. Required final output from coding agent

On each completed milestone, provide:

- File tree of changes and key abstractions.
- Exact commands to install/run/migrate/test.
- Endpoint table with at least one sample request/response and SSE example.
- Official documentation links consulted (FastAPI and LangChain/LangGraph, via MCP if configured).
- Tests executed, results and untested limitations.
- Next milestone, remaining TODOs and tradeoffs.

**Begin now with Milestone 0 and the existing repository audit.** Don't start by creating frontend, building a generic autonomous multi-agent platform, or wiring unnecessary infrastructure. Build the smallest coherent working vertical slice and grow it incrementally.
