export type SpeechResults = ArrayLike<{
  isFinal: boolean;
  length: number;
  [index: number]: { transcript: string };
}>;
export type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: { results: SpeechResults }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type SpeechConstructor = new () => BrowserSpeechRecognition;
export function speechConstructor(): SpeechConstructor | null {
  if (typeof window === 'undefined' || !window.isSecureContext) return null;
  const browser = window as Window & {
    SpeechRecognition?: SpeechConstructor;
    webkitSpeechRecognition?: SpeechConstructor;
  };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition ?? null;
}

export function speechText(results: SpeechResults, limit: number) {
  const final: string[] = [],
    interim: string[] = [];
  for (let i = 0; i < Math.min(results.length, 100); i++) {
    const result = results[i];
    if (result?.length && typeof result[0]?.transcript === 'string')
      (result.isFinal ? final : interim).push(result[0].transcript.trim().slice(0, limit + 1));
  }
  const confirmed = final.join(' ').trim();
  return {
    final: confirmed.slice(0, limit),
    interim: interim.join(' ').trim().slice(0, limit),
    limited: confirmed.length > limit || results.length > 100,
  };
}

export function appendDictation(value: string, transcript: string, limit: number): string | null {
  const speech = transcript.trim();
  if (!speech) return null;
  const combined = value ? `${value}${/\s$/.test(value) ? '' : '\n'}${speech}` : speech;
  return combined.length <= limit ? combined : null;
}

export function speechError(code: string) {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone or speech access was blocked. Allow it in your browser’s site settings, then try again—or type your question.';
    case 'audio-capture':
      return 'No microphone is available. Check your microphone connection and device settings.';
    case 'network':
      return 'The browser’s speech service could not connect. Check your connection or use your device’s keyboard microphone.';
    case 'no-speech':
      return 'No clear speech was detected. Try again and speak near the microphone.';
    case 'language-not-supported':
      return 'This speech language is not supported by your browser. Choose another language or type your question.';
    case 'aborted':
      return 'Dictation stopped. Review any captured text before using it.';
    default:
      return 'Dictation could not finish. Review any captured text, or try typing your question.';
  }
}
