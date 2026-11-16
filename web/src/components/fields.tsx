import { type ReactNode, useId } from "react";

/*
 * Form controls with their labels built in, so no field ships without one.
 * Every target is at least 44 px tall.
 */

type ChoiceProps<T extends string> = {
  legend: string;
  options: readonly T[];
  value: T;
  label: (option: T) => string;
  onChange: (option: T) => void;
  /** For a choice whose meaning is plain from what sits beside it. */
  hideLegend?: boolean;
};

/** A short set of options as radio pills; for longer lists use Select. */
export function Choice<T extends string>({
  legend,
  options,
  value,
  label,
  onChange,
  hideLegend = false,
}: ChoiceProps<T>) {
  const name = useId();
  return (
    <fieldset>
      <legend className={hideLegend ? "sr-only" : "mb-2 font-medium"}>{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option}
            className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-line bg-surface px-4 text-sm hover:border-muted has-checked:border-ink has-checked:bg-ink has-checked:text-bg has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              className="sr-only"
            />
            {label(option)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

type SelectProps<T extends string> = Omit<ChoiceProps<T>, "hideLegend">;

export function Select<T extends string>({
  legend,
  options,
  value,
  label,
  onChange,
}: SelectProps<T>) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block font-medium">
        {legend}
      </label>
      <select
        id={id}
        className="field"
        value={value}
        onChange={(e) => onChange(options.find((o) => o === e.target.value) ?? value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {label(option)}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

type TextProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "time" | "number" | "search";
  hint?: string;
  inputMode?: "decimal" | "text" | "search";
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
  autoComplete?: string;
};

export function TextField({ label, hint, onChange, type = "text", ...rest }: TextProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block font-medium">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="-mt-1 mb-1.5 text-sm text-muted">
          {hint}
        </p>
      )}
      <input
        id={id}
        type={type}
        className="field"
        aria-describedby={hint ? hintId : undefined}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
    </div>
  );
}
