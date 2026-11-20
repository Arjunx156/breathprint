import type { Member, Profile } from "@shared/profile";
import { useApp } from "../../app/state";

/** Setup's steps, in order. */
export const STEPS = [
  "setup.place",
  "setup.household",
  "setup.travel",
  "setup.home",
  "setup.prefs",
] as const;

/** Every step past the place edits the same draft, saved only at the end. */
export type StepProps = { draft: Profile; update: (next: Profile) => void };

/** A member's name, or "Person 2" when they haven't been given one. */
export function useMemberLabel(): (m: Member, i: number) => string {
  const { t } = useApp();
  return (m, i) => m.name?.trim() || t("setup.person", { n: i + 1 });
}
