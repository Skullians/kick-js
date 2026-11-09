import { beforeEach, describe, expect, it, vi } from "vitest";

type Reply = { status: number; body: string } | Error;

const state = vi.hoisted(() => ({
  reply: { status: 200, body: "{}" } as Reply,
  urls: [] as string[],
}));

vi.mock("puppeteer-extra-plugin-stealth", () => ({
  default: () => ({ name: "stealth" }),
}));

const page = {
  goto: (url: string) => {
    state.urls.push(url);
    const reply = state.reply;
    if (reply instanceof Error) return Promise.reject(reply);
    return Promise.resolve({
      status: () => reply.status,
      text: () => Promise.resolve(reply.body),
    });
  },
};

vi.mock("puppeteer-extra", () => ({
  default: {
    use: () => ({
      launch: () =>
        Promise.resolve({
          newPage: () => Promise.resolve(page),
          close: () => Promise.resolve(),
        }),
    }),
  },
}));

import { getChannelData, getVideoData } from "./kick-api";

const reply = (status: number, data: unknown) => {
  state.reply = {
    status,
    body: typeof data === "string" ? data : JSON.stringify(data),
  };
};

describe("getChannelData", () => {
  beforeEach(() => {
    state.urls.length = 0;
    reply(200, {});
  });

  it("fetches and returns valid channel data", async () => {
    const payload = { id: 1, slug: "xqc", chatroom: { id: 51082 } };
    reply(200, payload);

    const result = await getChannelData("xqc");

    expect(result).toEqual(payload);
    expect(state.urls).toEqual(["https://kick.com/api/v2/channels/xqc"]);
  });

  it("throws the Cloudflare message on 403", async () => {
    reply(403, "blocked");

    await expect(getChannelData("xqc")).rejects.toThrow(
      "Request blocked by Cloudflare protection",
    );
  });

  it("includes the status for other non-2xx responses", async () => {
    reply(500, "oops");

    await expect(getChannelData("xqc")).rejects.toThrow(
      "Failed to fetch channel data: received status 500",
    );
  });

  it("rejects HTML bodies served with a 200 (challenge pages)", async () => {
    reply(200, "<html>Just a moment...</html>");

    await expect(getChannelData("xqc")).rejects.toThrow(
      /Unexpected channel data response shape; Kick may have served a challenge page/,
    );
  });

  it("validates that chatroom.id exists for channel payloads", async () => {
    reply(200, { id: 1 });

    await expect(getChannelData("xqc")).rejects.toThrow(
      "Unexpected channel data response shape",
    );
  });

  it("wraps network failures with the fetch label", async () => {
    state.reply = new Error("ECONNRESET");

    await expect(getChannelData("xqc")).rejects.toThrow(
      /Failed to fetch channel data: .*ECONNRESET/,
    );
  });
});

describe("getVideoData", () => {
  it("accepts payloads identified by uuid alone", async () => {
    state.urls.length = 0;
    reply(200, { uuid: "abc-123" });

    const result = await getVideoData("abc-123");

    expect(result).toEqual({ uuid: "abc-123" });
    expect(state.urls).toEqual(["https://kick.com/api/v1/video/abc-123"]);
  });

  it("rejects unrecognizable video payloads", async () => {
    reply(200, { unrelated: true });

    await expect(getVideoData("xyz")).rejects.toThrow(
      "Unexpected video data response shape",
    );
  });
});
