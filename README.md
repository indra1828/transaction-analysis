# samvada.ai

Practise difficult workplace conversations with an AI character, then get a tentative Transactional Analysis review of how your words landed.

## What it does

- **Scenarios:** pick a built-in scenario or create your own in a few answers. The assistant writes the character's opening line and when the conversation ends.
- **Simulation:** talk freely with the character. Edit any of your messages to try another wording.
- **Guided practice:** draft each reply, get short feedback, then send it.
- **Report:** when you finish, a report covers your words, how you led, and what to try next.

## Built with

- **Backend:** Python, FastAPI, SQLAlchemy, LangChain and LangGraph (Deep Agents), Groq
- **Frontend:** React, TypeScript, Vite, Tailwind CSS, React Router

## Project layout

```text
backend/    FastAPI API, LLM workflows, database   (see backend/README.md)
frontend/   React web app                          (see frontend/README.md)
```

## Quick start

You need Python 3.11+, [uv](https://docs.astral.sh/uv/), and a current Node.js (22 LTS recommended).

1. **Backend**

   ```bash
   cd backend
   cp .env.example src/.env   # then fill in your keys
   uv sync
   uv run uvicorn main:app --app-dir src --reload
   ```

2. **Frontend** (in a second terminal)

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. Open <http://localhost:5173> and sign in with Google.

The Google sign-in needs a redirect URI of `http://localhost:5173/api/v1/auth/google/callback` in your Google OAuth client. The backend setup is covered in `backend/README.md`.

## Running the tests

```bash
cd backend && uv run pytest
cd frontend && npm test
```

## Documentation

- [Backend guide](backend/README.md): setup, API endpoints, LLM design, and behaviour notes
- [Frontend guide](frontend/README.md): routes, scripts, design notes, and live browser tests
- [Backend specification](backend/docs/implementation-spec.md): the original design the code was built from

## Status

This is a working prototype for a seminar demo. Known limits are listed in the backend and frontend guides.