import { type Block, readAnswer, textsOf } from "@shared/answer";
import { useApp } from "../../app/state";
import type { useReadAloud } from "../../lib/speech";
import type { Exchange } from "./exchange";
import { Cited, Library } from "./Sources";

export type Voice = ReturnType<typeof useReadAloud>;

function ReadAloud({ x, blocks, voice }: { x: Exchange; blocks: Block[]; voice: Voice }) {
  const { t } = useApp();
  const id = String(x.id);
  const pieces = textsOf(blocks);
  if (!voice.supported || pieces.length === 0) return null;
  const reading = voice.reading === id;
  return (
    <button
      type="button"
      className="link mt-4 min-h-11 text-sm font-medium"
      onClick={() => (reading ? voice.stop() : voice.read(id, pieces))}
    >
      {reading ? t("ask.stopReading") : t("ask.read")}
    </button>
  );
}

function Blocks({ blocks }: { blocks: readonly Block[] }) {
  return blocks.map((block) =>
    block.kind === "p" ? (
      <p key={block.line}>{block.text}</p>
    ) : (
      <ul key={block.line} className="list-disc space-y-1 pl-5 marker:text-muted">
        {block.items.map((item) => (
          <li key={item.line}>{item.text}</li>
        ))}
      </ul>
    ),
  );
}

export function ExchangeView({ x, voice }: { x: Exchange; voice: Voice }) {
  const { t } = useApp();
  const answer = readAnswer(x.answer);
  const streaming = x.state === "streaming";
  return (
    <article className="scroll-mt-6 border-t border-line py-8" data-exchange={x.id}>
      <h2 className="text-xl font-semibold leading-snug">
        <span className="sr-only">{t("ask.you")}: </span>
        {x.question}
      </h2>
      <div aria-live="polite" aria-busy={streaming} className="mt-4 max-w-prose space-y-3">
        {streaming && answer.blocks.length === 0 && (
          <p className="flex items-center gap-3 text-muted">
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full bg-accent motion-safe:animate-pulse"
            />
            {t("ask.asking")}
          </p>
        )}
        <Blocks blocks={answer.blocks} />
        {x.state === "offline" && <Library question={x.question} />}
      </div>
      {x.state === "done" && <ReadAloud x={x} blocks={answer.blocks} voice={voice} />}
      {!streaming && <Cited cards={answer.cards} actions={answer.actions} />}
      {x.flags.length > 0 && (
        <p className="mt-6 max-w-prose border-l-2 border-[var(--lvl-3)] pl-3 text-sm">
          {t("ask.flagged", { figures: x.flags.join(", ") })}
        </p>
      )}
      {x.recorded && <p className="mt-4 text-sm text-muted">{t("ask.recorded")}</p>}
      {x.state === "broken" && <p className="mt-4 text-sm">{t("ask.broken")}</p>}
    </article>
  );
}
