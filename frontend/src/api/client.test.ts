import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, parseEventBlock, postStream, request } from "./client";

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

function mockFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseEventBlock", () => {
  it("reads the event name and JSON data", () => {
    expect(parseEventBlock('event: message.delta\ndata: {"content":"Hi"}')).toEqual({
      event: "message.delta",
      data: { content: "Hi" },
    });
  });

  it("returns null for a block without data", () => {
    expect(parseEventBlock("event: ping")).toBeNull();
  });
});

describe("postStream", () => {
  it("delivers events even when a block is split across chunks", async () => {
    mockFetch(
      new Response(
        streamOf([
          'event: message.started\ndata: {"user_message_id":"u1"}\n\nevent: message.del',
          'ta\ndata: {"content":"Sure"}\n\n',
          'event: message.completed\ndata: {"message_id":"a1","thread_status":"active","completion_reason":null}\n\n',
        ]),
      ),
    );

    const deltas: string[] = [];
    const done: string[] = [];

    await postStream("/threads/t1/messages", { content: "Hello" }, {
      onDelta: (content) => deltas.push(content),
      onDone: (payload) => done.push(payload.message_id),
      onError: () => {
        throw new Error("unexpected error event");
      },
    });

    expect(deltas).toEqual(["Sure"]);
    expect(done).toEqual(["a1"]);
  });

  it("reports message.error events to the caller", async () => {
    mockFetch(
      new Response(streamOf(['event: message.error\ndata: {"detail":"Message generation failed"}\n\n'])),
    );

    const errors: string[] = [];

    await postStream("/threads/t1/messages", { content: "Hello" }, {
      onDelta: () => undefined,
      onDone: () => undefined,
      onError: (detail) => errors.push(detail),
    });

    expect(errors).toEqual(["Message generation failed"]);
  });

  it("throws the server message when the request is rejected", async () => {
    mockFetch(
      new Response(JSON.stringify({ detail: "Thread is completed" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      postStream("/threads/t1/messages", { content: "Hello" }, {
        onDelta: () => undefined,
        onDone: () => undefined,
        onError: () => undefined,
      }),
    ).rejects.toMatchObject({ status: 409, message: "Thread is completed" });
  });
});

describe("request", () => {
  it("turns FastAPI validation errors into readable messages", async () => {
    mockFetch(
      new Response(
        JSON.stringify({
          detail: [{ loc: ["body", "title"], msg: "String should have at least 1 character" }],
        }),
        { status: 422, headers: { "Content-Type": "application/json" } },
      ),
    );

    const error = await request("POST", "/scenarios", {}).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 422,
      message: "title: String should have at least 1 character",
    });
  });

  it("falls back to the status text when the body is not JSON", async () => {
    mockFetch(new Response("<html>bad gateway</html>", { status: 502, statusText: "Bad Gateway" }));

    await expect(request("GET", "/threads")).rejects.toMatchObject({
      status: 502,
      message: "Bad Gateway",
    });
  });
});
