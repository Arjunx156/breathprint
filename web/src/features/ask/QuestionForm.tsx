import { MAX_CHARS } from "@shared/replies";
import { type KeyboardEvent, useId } from "react";
import { useApp } from "../../app/state";
import type { useDictation } from "../../lib/speech";

type Props = {
  draft: string;
  busy: boolean;
  dictation: ReturnType<typeof useDictation>;
  onDraft: (text: string) => void;
  onAsk: (question: string) => void;
};

/** The question box, with voice input where the browser offers it. */
export function QuestionForm({ draft, busy, dictation, onDraft, onAsk }: Props) {
  const { t } = useApp();
  const fieldId = useId();

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter asks, Shift+Enter adds a line; never mid-composition in a Hindi keyboard.
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    onAsk(draft);
  };

  return (
    <form
      className="mt-10"
      onSubmit={(e) => {
        e.preventDefault();
        onAsk(draft);
      }}
    >
      <label htmlFor={fieldId} className="mb-1.5 block font-medium">
        {t("ask.label")}
      </label>
      <textarea
        id={fieldId}
        className="field min-h-24 resize-y"
        rows={3}
        maxLength={MAX_CHARS}
        value={draft}
        placeholder={t("ask.placeholder")}
        aria-describedby={`${fieldId}-note`}
        onChange={(e) => onDraft(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <button type="submit" className="btn btn-primary" disabled={busy || !draft.trim()}>
          {busy ? t("ask.asking") : t("ask.submit")}
        </button>
        {dictation.supported && (
          <button
            type="button"
            className="btn btn-quiet"
            aria-describedby={`${fieldId}-voice`}
            onClick={dictation.listening ? dictation.stop : dictation.start}
          >
            {dictation.listening ? t("ask.stopListening") : t("ask.speak")}
          </button>
        )}
        <p id={`${fieldId}-note`} className="text-sm text-muted">
          {t("ask.privacy")}
        </p>
      </div>
      {dictation.supported && (
        <>
          <p aria-live="polite" className="mt-3 min-h-5 text-sm">
            {dictation.listening && t("ask.listening")}
            {!dictation.listening && dictation.error && t(`ask.voice.${dictation.error}`)}
          </p>
          <p id={`${fieldId}-voice`} className="mt-1 max-w-prose text-sm text-muted">
            {t("ask.voicePrivacy")}
          </p>
        </>
      )}
    </form>
  );
}
