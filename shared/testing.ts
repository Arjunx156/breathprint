import type { Context } from "./actions/types";
import { summarize } from "./air";
import { DEMO_DAY, delhiMorning, delhiSevereSnapshot } from "./fixtures";
import { MEERA, type Profile } from "./profile";

/** Meera's family, or a variation of it, on the fixture's severe Delhi morning. */
export function severeDay(profile: Profile = MEERA, base = 285): Context {
  return { profile, air: summarize(delhiSevereSnapshot(DEMO_DAY, base), delhiMorning(DEMO_DAY)) };
}

/** The same morning shape at a level WHO would call moderate. */
export function cleanDay(profile: Profile = MEERA): Context {
  return severeDay(profile, 28);
}

export function withHome(profile: Profile, home: Partial<Profile["home"]>): Profile {
  return { ...profile, home: { ...profile.home, ...home } };
}
