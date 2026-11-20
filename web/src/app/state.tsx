import { type MessageKey, t as translate, tx as translateAny, type Vars } from "@shared/i18n";
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

/** Demo mode lasts for the tab, so a reload keeps it and a new visit starts fresh. */
const DEMO_KEY = "bp.demo";
const DEMO_PERSONA = "meera";

function demoRequested(): boolean {
  try {
    if (new URLSearchParams(location.search).get("demo") === DEMO_PERSONA)
      sessionStorage.setItem(DEMO_KEY, DEMO_PERSONA);
    return sessionStorage.getItem(DEMO_KEY) === DEMO_PERSONA;
  } catch {
    // Session storage blocked: run the app as usual, not the demo.
    return false;
  }
}

function browserLanguage(): Language {
  return navigator.language.toLowerCase().startsWith("hi") ? "hi" : "en";
}

/** The language to show: the household's own once its strings are here, English until then. */
function usePageLanguage(wanted: Language) {
  const lang = useLanguageReady(wanted) ? wanted : "en";
  // A Hindi reader's first paint waits the moment it takes, so it never starts in English.
  const [booted, setBooted] = useState(lang === wanted);
  if (!booted && lang === wanted) setBooted(true);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return { lang, booted };
}

/** Steps marked done today. A new day starts empty, and the demo never saves. */
function useDoneToday(demo: boolean) {
  const [ids, setIds] = useState<string[]>(() => {
    const saved = load(KEYS.done, DoneSchema);
    return saved?.day === today() ? saved.ids : [];
  });

  const toggle = useCallback(
    (id: string) => {
      setIds((current) => {
        const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
        if (!demo) save(KEYS.done, { day: today(), ids: next });
        return next;
      });
    },
    [demo],
  );

  const clear = useCallback(() => setIds([]), []);
  return { ids, toggle, clear };
}

/**
 * The household, demo mode and what's been done today. All of it lives in
 * this browser; nothing here is sent anywhere until a model is asked.
 */
export function AppProvider({ children }: { children: ReactNode }) {
  const [demo, setDemo] = useState(demoRequested);
  const [stored, setStored] = useState(() => load(KEYS.profile, ProfileSchema));
  const [demoProfile, setDemoProfile] = useState<Profile>(MEERA);
  const profile = demo ? demoProfile : stored;
  const { lang, booted } = usePageLanguage(profile?.language ?? browserLanguage());
  const done = useDoneToday(demo);
  const clearDone = done.clear;

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
    clearDone();
  }, [clearDone]);

  const exitDemo = useCallback(() => {
    try {
      sessionStorage.removeItem(DEMO_KEY);
    } catch {
      // Session storage blocked; leaving demo mode in memory is enough.
    }
    setDemo(false);
    clearDone();
    history.replaceState(null, "", "/");
  }, [clearDone]);

  const value = useMemo<AppState>(
    () => ({
      profile,
      demo,
      lang,
      t: (key, vars) => translate(lang, key, vars),
      tx: (key, vars) => translateAny(lang, key, vars),
      saveProfile,
      forget,
      exitDemo,
      done: new Set(done.ids),
      toggleDone: done.toggle,
    }),
    [profile, demo, lang, saveProfile, forget, exitDemo, done.ids, done.toggle],
  );

  return <Ctx.Provider value={value}>{booted && children}</Ctx.Provider>;
}

/** The household, language and helpers every page shares. */
export function useApp(): AppState {
  const state = useContext(Ctx);
  if (!state) throw new Error("useApp needs an AppProvider above it");
  return state;
}
