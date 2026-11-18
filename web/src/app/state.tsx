import { isMessageKey, type MessageKey, t as translate, type Vars } from "@shared/i18n";
import { type Language, MEERA, type Profile, ProfileSchema } from "@shared/profile";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { z } from "zod/mini";
import { useLanguageReady } from "../lib/hindi";
import { KEYS, load, remove, save } from "../lib/storage";

const DoneSchema = z.object({ day: z.string(), ids: z.array(z.string()) });

type AppState = {
  profile: Profile | null;
  demo: boolean;
  lang: Language;
  t: (key: MessageKey, vars?: Vars) => string;
  /** For keys built at run time, such as `action.${id}.title`; a missing key shows as itself. */
  tx: (key: string, vars?: Vars) => string;
  saveProfile: (profile: Profile) => void;
  forget: () => void;
  exitDemo: () => void;
  done: ReadonlySet<string>;
  toggleDone: (actionId: string) => void;
};

const Ctx = createContext<AppState | null>(null);

const today = () => new Date().toLocaleDateString("en-CA");

function demoRequested(): boolean {
  try {
    if (new URLSearchParams(location.search).get("demo") === "meera")
      sessionStorage.setItem("bp.demo", "meera");
    return sessionStorage.getItem("bp.demo") === "meera";
  } catch {
    return false;
  }
}

function browserLanguage(): Language {
  return navigator.language.toLowerCase().startsWith("hi") ? "hi" : "en";
}

/**
 * The household, demo mode and what's been done today. All of it lives in
 * this browser; nothing here is sent anywhere until a model is asked.
 */
export function AppProvider({ children }: { children: ReactNode }) {
  const [demo, setDemo] = useState(demoRequested);
  const [stored, setStored] = useState(() => load(KEYS.profile, ProfileSchema));
  const [demoProfile, setDemoProfile] = useState<Profile>(MEERA);
  const [doneIds, setDoneIds] = useState<string[]>(() => {
    const saved = load(KEYS.done, DoneSchema);
    return saved?.day === today() ? saved.ids : [];
  });

  const profile = demo ? demoProfile : stored;
  const wanted = profile?.language ?? browserLanguage();
  // Until the Hindi strings arrive, the page stays in English rather than go blank.
  const lang = useLanguageReady(wanted) ? wanted : "en";
  // A Hindi reader's first paint waits the moment it takes, so it never starts in English.
  const [booted, setBooted] = useState(lang === wanted);
  if (!booted && lang === wanted) setBooted(true);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const saveProfile = useCallback(
    (next: Profile) => {
      if (demo) return setDemoProfile(next);
      setStored(next);
      save(KEYS.profile, next);
    },
    [demo],
  );

  const forget = useCallback(() => {
    remove(KEYS.profile);
    remove(KEYS.done);
    remove(KEYS.aiPlan);
    setStored(null);
    setDoneIds([]);
  }, []);

  const exitDemo = useCallback(() => {
    try {
      sessionStorage.removeItem("bp.demo");
    } catch {
      // Session storage blocked; leaving demo mode in memory is enough.
    }
    setDemo(false);
    setDoneIds([]);
    history.replaceState(null, "", "/");
  }, []);

  const toggleDone = useCallback(
    (id: string) => {
      setDoneIds((ids) => {
        const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
        if (!demo) save(KEYS.done, { day: today(), ids: next });
        return next;
      });
    },
    [demo],
  );

  const value = useMemo<AppState>(
    () => ({
      profile,
      demo,
      lang,
      t: (key, vars) => translate(lang, key, vars),
      tx: (key, vars) => (isMessageKey(key) ? translate(lang, key, vars) : key),
      saveProfile,
      forget,
      exitDemo,
      done: new Set(doneIds),
      toggleDone,
    }),
    [profile, demo, lang, saveProfile, forget, exitDemo, doneIds, toggleDone],
  );

  return <Ctx.Provider value={value}>{booted && children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const state = useContext(Ctx);
  if (!state) throw new Error("useApp needs an AppProvider above it");
  return state;
}
