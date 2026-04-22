import { createClient } from "./client/client";
import type { MessageData } from "./types/events.js";

export { createClient };
export { configure } from "./core/settings";

export type { MessageData };
export type { GlobalSettings, PuppeteerSettings } from "./core/settings";
