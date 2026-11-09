export interface PuppeteerSettings {
  sandbox?: boolean;
  headless?: boolean;
  args?: string[];
}

export interface GlobalSettings {
  puppeteer?: PuppeteerSettings;
  logger?: boolean;
}

const defaults: GlobalSettings = {
  puppeteer: {
    sandbox: true,
    headless: true,
    args: [],
  },
  logger: false,
};

let active: GlobalSettings = { ...defaults };

export const configure = (settings: Partial<GlobalSettings>) => {
  active = {
    ...active,
    ...settings,
    puppeteer: {
      ...active.puppeteer,
      ...settings.puppeteer,
    },
  };
};

export const getSettings = (): GlobalSettings => active;
