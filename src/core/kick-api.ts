import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { type KickChannelInfo } from "../types/channels";
import { type VideoInfo } from "../types/video";
import { DEFAULT_TIMEOUT_MS } from "./request-helper";
import { getSettings } from "./settings";

export const KICK_API_BASE = "https://kick.com";

const CLOUDFLARE_MESSAGE =
  "Request blocked by Cloudflare protection. Please try again later.";

const browser = puppeteer.use(StealthPlugin());

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const launch = () => {
  const { puppeteer: settings } = getSettings();
  return browser.launch({
    headless: settings?.headless ?? true,
    defaultViewport: null,
    args: [
      "--start-maximized",
      ...(settings?.args ?? []),
      ...(settings?.sandbox
        ? []
        : ["--no-sandbox", "--disable-setuid-sandbox"]),
    ],
  });
};

const parseBody = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const fetchJson = async <T>(
  url: string,
  label: string,
  isValidShape?: (data: Record<string, unknown>) => boolean,
): Promise<T> => {
  let status = 0;
  let data: unknown;
  let session: Awaited<ReturnType<typeof launch>> | null = null;

  try {
    session = await launch();
    const page = await session.newPage();
    const response = await page.goto(url, { timeout: DEFAULT_TIMEOUT_MS });
    status = response?.status() ?? 0;
    data = parseBody((await response?.text()) ?? "");
  } catch (error) {
    throw new Error(
      `Failed to fetch ${label}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    );
  } finally {
    await session?.close();
  }

  if (status === 403) {
    throw new Error(CLOUDFLARE_MESSAGE);
  }

  if (status < 200 || status >= 300) {
    throw new Error(`Failed to fetch ${label}: received status ${status}`);
  }

  if (!isRecord(data) || (isValidShape !== undefined && !isValidShape(data))) {
    throw new Error(
      `Unexpected ${label} response shape${status === 200 ? "; Kick may have served a challenge page" : ""}`,
    );
  }

  return data as T;
};

export const getChannelData = async (
  channel: string,
): Promise<KickChannelInfo> =>
  fetchJson<KickChannelInfo>(
    `${KICK_API_BASE}/api/v2/channels/${channel}`,
    "channel data",
    (data) => isRecord(data.chatroom) && typeof data.chatroom.id === "number",
  );

export const getVideoData = async (videoId: string): Promise<VideoInfo> =>
  fetchJson<VideoInfo>(
    `${KICK_API_BASE}/api/v1/video/${videoId}`,
    "video data",
    (data) => "id" in data || "uuid" in data,
  );
