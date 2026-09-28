import type { Page } from '@playwright/test';
type Segment = { text: string; final: boolean };
type Control = {
  stats(): { starts: number; stops: number; aborts: number; language?: string };
  results(parts: Segment[]): void;
  error(code: string): void;
  end(): void;
  remember(): void;
  late(parts: Segment[]): void;
};
declare global {
  interface Window {
    __speech: Control;
  }
}
export async function installSpeechFake(
  page: Page,
  options: {
    support?: 'standard' | 'prefixed' | 'none';
    autoStart?: boolean;
    autoEnd?: boolean;
    throws?: boolean;
  } = {},
) {
  await page.addInitScript((config) => {
    let starts = 0,
      stops = 0,
      aborts = 0;
    type ResultHandler =
      | ((event: {
          results: { isFinal: boolean; length: number; 0: { transcript: string } }[];
        }) => void)
      | null;
    const sessions: Fake[] = [];
    let remembered: ResultHandler = null;
    class Fake {
      lang = '';
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onresult: ResultHandler = null;
      onerror: ((event: { error: string }) => void) | null = null;
      constructor() {
        sessions.push(this);
      }
      start() {
        starts++;
        if (config.throws) throw Error('Synthetic start failure');
        if (config.autoStart !== false) queueMicrotask(() => this.onstart?.());
      }
      stop() {
        stops++;
        if (config.autoEnd !== false) this.onend?.();
      }
      abort() {
        aborts++;
      }
    }
    const event = (parts: Segment[]) => ({
      results: parts.map((part) => ({
        isFinal: part.final,
        length: 1,
        0: { transcript: part.text },
      })),
    });
    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      value: config.support === 'none' || config.support === 'prefixed' ? undefined : Fake,
    });
    Object.defineProperty(window, 'webkitSpeechRecognition', {
      configurable: true,
      value: config.support === 'prefixed' ? Fake : undefined,
    });
    window.__speech = {
      stats: () => ({ starts, stops, aborts, language: sessions.at(-1)?.lang }),
      results: (parts) => sessions.at(-1)?.onresult?.(event(parts)),
      error: (code) => sessions.at(-1)?.onerror?.({ error: code }),
      end: () => sessions.at(-1)?.onend?.(),
      remember: () => {
        remembered = sessions.at(-1)?.onresult ?? null;
      },
      late: (parts) => remembered?.(event(parts)),
    };
  }, options);
}
