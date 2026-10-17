import type { StreamHandlers, StreamDone } from "./types";

const BASE = "/api/v1";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// FastAPI returns { detail: string } for app errors and a list of
// { loc, msg } items for validation errors (422).
async function errorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();

    if (typeof body.detail === "string") {
      return body.detail;
    }

    if (Array.isArray(body.detail)) {
      return body.detail
        .map((item: { loc?: unknown[]; msg?: string }) => {
          const field = item.loc?.slice(1).join(".");
          return field ? `${field}: ${item.msg}` : item.msg;
        })
        .join("; ");
    }
  } catch {
    // Not JSON; fall through to the status text.
  }

  return response.statusText || `Request failed (${response.status})`;
}

async function failIfNotOk(response: Response): Promise<void> {
  if (!response.ok) {
    throw new ApiError(response.status, await errorMessage(response));
  }
}

export async function request<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(BASE + path, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  await failIfNotOk(response);

  // 204 No Content has no body to parse.
  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export interface ServerEvent {
  event: string;
  data: Record<string, unknown>;
}

// Exported for tests. Parses one SSE block ("event: x\ndata: {...}").
export function parseEventBlock(block: string): ServerEvent | null {
  let event = "message";
  const dataLines: string[] = [];

  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).replace(/^ /, ""));
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  return { event, data: JSON.parse(dataLines.join("\n")) };
}

// POSTs (or PATCHes) and reads a server-sent event stream. The backend's chat endpoints
// use POST, so EventSource (GET only) cannot be used.
export async function postStream(
  path: string,
  body: unknown,
  handlers: StreamHandlers,
  method: "POST" | "PATCH" = "POST",
): Promise<void> {
  const response = await fetch(BASE + path, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  await failIfNotOk(response);

  if (!response.body) {
    throw new ApiError(response.status, "The server sent no reply");
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";

  const dispatch = (block: string) => {
    const parsed = parseEventBlock(block.replace(/\r\n/g, "\n"));
    if (!parsed) return;

    if (parsed.event === "message.delta") {
      handlers.onDelta(String(parsed.data.content ?? ""));
    } else if (parsed.event === "message.completed") {
      handlers.onDone(parsed.data as unknown as StreamDone);
    } else if (parsed.event === "message.error") {
      handlers.onError(String(parsed.data.detail ?? "Message generation failed"));
    }
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += value.replace(/\r\n/g, "\n");

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      dispatch(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");
    }
  }

  if (buffer.trim()) {
    dispatch(buffer);
  }
}
