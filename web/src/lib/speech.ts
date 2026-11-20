import type { Language } from "@shared/profile";
import { useCallback, useEffect, useRef, useState } from "react";

/** Indian English and Hindi, so "agarbatti" and "AQI" both come through. */
const SPEECH_LANG: Record<Language, string> = { en: "en-IN", hi: "hi-IN" };

/** The slice of the Web Speech recogniser this app uses; TypeScript ships only its events. */
type Recognizer = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

type RecognizerClass = new () => Recognizer;

declare global {
  var SpeechRecognition: RecognizerClass | undefined;
  /** Chrome and Safari still ship the recogniser under its prefixed name. */
  var webkitSpeechRecognition: RecognizerClass | undefined;
}

function recognizerClass(): RecognizerClass | null {
  return globalThis.SpeechRecognition ?? globalThis.webkitSpeechRecognition ?? null;
}

/** Why dictation stopped, in words the page can explain. */
export type DictationError = "blocked" | "silence" | "failed";

function errorOf(code: string): DictationError {
  if (code === "not-allowed" || code === "service-not-allowed") return "blocked";
  if (code === "no-speech") return "silence";
  return "failed";
}

/**
 * Speech to text through the browser's own recogniser. `onText` gets the
 * words so far, so the question box fills in as the person speaks.
 */
export function useDictation(lang: Language, onText: (text: string) => void) {
  const [Recognition] = useState(recognizerClass);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<DictationError | null>(null);
  const active = useRef<Recognizer | null>(null);
  const said = useRef(onText);
  said.current = onText;

  useEffect(() => () => active.current?.abort(), []);

  const start = useCallback(() => {
    if (!Recognition) return;
    active.current?.abort();
    const recognizer = new Recognition();
    recognizer.lang = SPEECH_LANG[lang];
    recognizer.interimResults = true;
    recognizer.continuous = false;
    recognizer.onresult = (e) => {
      const text = Array.from(e.results, (result) => result[0]?.transcript ?? "").join("");
      said.current(text);
    };
    recognizer.onerror = (e) => {
      if (e.error !== "aborted") setError(errorOf(e.error));
    };
    recognizer.onend = () => {
      setListening(false);
      if (active.current === recognizer) active.current = null;
    };
    active.current = recognizer;
    setError(null);
    setListening(true);
    recognizer.start();
  }, [Recognition, lang]);

  const stop = useCallback(() => active.current?.stop(), []);

  return { supported: Recognition !== null, listening, error, start, stop };
}

function voiceFor(lang: Language): SpeechSynthesisVoice | null {
  const wanted = SPEECH_LANG[lang].toLowerCase();
  const voices = speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang.toLowerCase() === wanted) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(lang)) ??
    null
  );
}

/**
 * Reads text aloud one piece at a time; some browsers cut a single long
 * utterance off after about fifteen seconds.
 */
/** Read-aloud for answers: which one is being read, and how to start and stop. */
export type Voice = {
  supported: boolean;
  /** The id of the answer being read, or null. */
  reading: string | null;
  read: (id: string, pieces: readonly string[]) => void;
  stop: () => void;
};

/** Reads an answer aloud in the page language, one piece at a time, and stops on request. */
export function useReadAloud(lang: Language): Voice {
  const [supported] = useState(() => typeof window !== "undefined" && "speechSynthesis" in window);
  const [reading, setReading] = useState<string | null>(null);

  useEffect(() => () => void (supported && speechSynthesis.cancel()), [supported]);

  const stop = useCallback(() => {
    // Ask calls this before every question, in browsers without speech too.
    if (supported) speechSynthesis.cancel();
    setReading(null);
  }, [supported]);

  const read = useCallback(
    (id: string, pieces: readonly string[]) => {
      if (!supported) return;
      speechSynthesis.cancel();
      const voice = voiceFor(lang);
      const parts = pieces.filter((p) => p.trim());
      parts.forEach((text, i) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = SPEECH_LANG[lang];
        if (voice) utterance.voice = voice;
        if (i === parts.length - 1)
          utterance.onend = () => setReading((r) => (r === id ? null : r));
        utterance.onerror = () => setReading((r) => (r === id ? null : r));
        speechSynthesis.speak(utterance);
      });
      setReading(parts.length > 0 ? id : null);
    },
    [lang, supported],
  );

  return { supported, reading, read, stop };
}
