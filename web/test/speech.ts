/*
 * Stand-ins for the browser's speech services, which happy-dom doesn't have.
 * A test installs what it needs and calls clearSpeech() when it's done.
 */

const g = globalThis as Record<string, unknown>;

/** Stands in for the browser's recogniser; the test speaks through it. */
export class FakeRecognizer {
  static last: FakeRecognizer | null = null;
  lang = "";
  interimResults = false;
  continuous = true;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  started = false;
  constructor() {
    FakeRecognizer.last = this;
  }
  start() {
    this.started = true;
  }
  stop() {
    this.onend?.();
  }
  abort() {
    this.onend?.();
  }
}

export function fakeRecognition() {
  g.webkitSpeechRecognition = FakeRecognizer;
}

export class FakeUtterance {
  lang = "";
  voice: unknown = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readonly text: string;

  constructor(text: string) {
    this.text = text;
  }
}

/** Installs a speaker with one Hindi voice; returns what it has been asked to say. */
export function fakeSynthesis(): FakeUtterance[] {
  const spoken: FakeUtterance[] = [];
  g.speechSynthesis = {
    speak: (u: FakeUtterance) => spoken.push(u),
    cancel: () => {
      spoken.length = 0;
    },
    getVoices: () => [{ lang: "hi-IN", name: "Hindi" }],
  };
  g.SpeechSynthesisUtterance = FakeUtterance;
  return spoken;
}

export function clearSpeech() {
  for (const name of ["webkitSpeechRecognition", "speechSynthesis", "SpeechSynthesisUtterance"]) {
    Reflect.deleteProperty(g, name);
  }
  FakeRecognizer.last = null;
}
