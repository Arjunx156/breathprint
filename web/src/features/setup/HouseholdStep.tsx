import {
  AGE_GROUPS,
  CONDITIONS,
  MAX_MEMBERS,
  MAX_NAME_CHARS,
  type Member,
  memberId,
  type Trip,
} from "@shared/profile";
import { type RefObject, useEffect, useRef, useState } from "react";
import { useApp } from "../../app/state";
import { Select, TextField, Toggle } from "../../components/fields";
import { type StepProps, useMemberLabel } from "./steps";

function withName(member: Member, name: string): Member {
  const { name: _old, ...rest } = member;
  return name === "" ? rest : { ...rest, name };
}

function MemberFields({
  member: m,
  onChange,
}: {
  member: Member;
  onChange: (next: Member) => void;
}) {
  const { t } = useApp();
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t("setup.name")}
          value={m.name ?? ""}
          maxLength={MAX_NAME_CHARS}
          autoComplete="off"
          onChange={(name) => onChange(withName(m, name))}
        />
        <Select
          legend={t("setup.group")}
          options={AGE_GROUPS}
          value={m.group}
          label={(g) => t(`groupLabel.${g}`)}
          onChange={(group) => onChange({ ...m, group })}
        />
      </div>
      <fieldset className="mt-4">
        <legend className="font-medium">{t("setup.conditions")}</legend>
        <div className="mt-1 grid gap-x-6 sm:grid-cols-3">
          {CONDITIONS.map((c) => (
            <Toggle
              key={c}
              label={t(`condition.${c}`)}
              checked={m.conditions.includes(c)}
              onChange={(on) =>
                onChange({
                  ...m,
                  conditions: on ? [...m.conditions, c] : m.conditions.filter((x) => x !== c),
                })
              }
            />
          ))}
          <Toggle
            label={t("setup.outdoorWork")}
            checked={m.outdoorWork}
            onChange={(outdoorWork) => onChange({ ...m, outdoorWork })}
          />
        </div>
      </fieldset>
    </>
  );
}

const ADD = "add";

/**
 * Where focus goes once the list has changed: a new person's name field, or
 * the add button after the one pressed has gone with its person.
 */
function useFocusAfterChange(list: RefObject<HTMLDivElement | null>) {
  const [target, setTarget] = useState<string | null>(null);
  useEffect(() => {
    if (target === null) return;
    const selector = target === ADD ? `[data-add]` : `[data-member="${target}"] input`;
    list.current?.querySelector<HTMLElement>(selector)?.focus();
    setTarget(null);
  }, [target, list]);
  return setTarget;
}

/** Who lives here: age group, health conditions and outdoor work, per person. */
export function HouseholdStep({ draft, update }: StepProps) {
  const { t } = useApp();
  const label = useMemberLabel();
  const list = useRef<HTMLDivElement>(null);
  const focusAfter = useFocusAfterChange(list);
  const setMember = (id: string, next: Member) =>
    update({ ...draft, members: draft.members.map((m) => (m.id === id ? next : m)) });
  // Someone who leaves the household leaves the trips too.
  const drop = (id: string) => {
    const without = (trip: Trip | null) =>
      trip ? { ...trip, who: trip.who.filter((w) => w !== id) } : null;
    update({
      ...draft,
      members: draft.members.filter((m) => m.id !== id),
      commute: without(draft.commute),
      schoolRun: without(draft.schoolRun),
    });
    focusAfter(ADD);
  };
  const add = () => {
    const id = memberId(draft.members.map((m) => m.id));
    update({
      ...draft,
      members: [...draft.members, { id, group: "adult", conditions: [], outdoorWork: false }],
    });
    focusAfter(id);
  };

  return (
    <div ref={list}>
      {draft.members.map((m, i) => (
        <fieldset
          key={m.id}
          data-member={m.id}
          className="border-t border-line py-6 first:border-t-0 first:pt-0"
        >
          <legend className="sr-only">{label(m, i)}</legend>
          <p className="mb-4 font-semibold" aria-hidden="true">
            {label(m, i)}
          </p>
          <MemberFields member={m} onChange={(next) => setMember(m.id, next)} />
          {draft.members.length > 1 && (
            <button type="button" className="link mt-2 min-h-11 text-sm" onClick={() => drop(m.id)}>
              {t("setup.remove", { who: label(m, i) })}
            </button>
          )}
        </fieldset>
      ))}
      {draft.members.length < MAX_MEMBERS && (
        <button type="button" data-add className="btn btn-quiet mt-2" onClick={add}>
          {t("setup.add")}
        </button>
      )}
    </div>
  );
}
