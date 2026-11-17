import { actionById } from "./actions/catalogue";
import { cardById } from "./knowledge/search";

/*
 * The chat model cites with markers instead of links: [K:card-id] after a
 * claim and [A:action-id] for a step it recommends. These turn them into
 * citations and action titles, and drop any id that doesn't exist.
 */

const MARKER = /\s*\[(?:([KA])?:)?([a-z][a-z0-9-]{0,39})\]/g;
/** A marker cut off by the end of the stream so far, like "[K:mas". */
const PARTIAL = /\s*\[(?:[KA]?(?::[a-z0-9-]*)?|[a-z][a-z0-9-]*)?$/;
const ITEM = /^[-*•]\s+(.+)$/;
const BARE_BULLET = /^[-*•]$/;

/** The tagged blocks a chat prompt hands the model its data in. */
export const DATA_TAGS = [
  "air",
  "household",
  "options",
  "actions",
  "cards",
  "community",
  "question",
] as const;
const DATA_TAG = new Set<string>(DATA_TAGS);

export type Block = { kind: "p"; text: string } | { kind: "list"; items: string[] };
export type Answer = { blocks: Block[]; cards: string[]; actions: string[] };

/**
 * What one bracket cites. The model sometimes drops the K or A, or the colon
 * too, so a bare id counts when it names a real card or action; any other
 * bracket is text.
 */
function cited(kind: string | undefined, id: string): "K" | "A" | null {
  if (kind === "K" || kind === "A") return kind;
  if (cardById(id)) return "K";
  if (actionById(id)) return "A";
  return null;
}

/** Every id the text cites, in order of first mention, known or not. */
export function markers(text: string): { cards: string[]; actions: string[] } {
  const cards = new Set<string>();
  const actions = new Set<string>();
  for (const [, kind, id] of text.matchAll(MARKER)) {
    if (!id) continue;
    const as = cited(kind, id);
    if (as) (as === "K" ? cards : actions).add(id);
  }
  return { cards: [...cards], actions: [...actions] };
}

/**
 * The words alone: markers, half-streamed markers and stray emphasis removed,
 * along with any data block the model cites by name, like "[air]".
 */
export function cleanText(text: string): string {
  const drop = (kind: string | undefined, id: string) =>
    cited(kind, id) !== null || (!kind && DATA_TAG.has(id));
  return (
    text
      .replace(MARKER, (whole, kind?: string, id = "") => (drop(kind, id) ? "" : whole))
      // "[K:a], [A:b]." would leave a comma stranded before the full stop.
      .replace(/\s*,\s*([.!?।])/g, "$1")
      .replace(PARTIAL, "")
      .replace(/\*\*|__/g, "")
  );
}

/** Paragraphs and "- " lists, the only shapes the prompt allows. */
export function blocksOf(text: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const endPara = () => {
    if (para.length > 0) blocks.push({ kind: "p", text: para.join(" ") });
    para = [];
  };
  const endList = () => {
    if (list.length > 0) blocks.push({ kind: "list", items: list });
    list = [];
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    // A bullet that held only a marker is empty once the marker is gone.
    if (BARE_BULLET.test(line)) continue;
    const item = ITEM.exec(line)?.[1];
    if (!line) {
      endPara();
      endList();
    } else if (item) {
      endPara();
      list.push(item);
    } else {
      endList();
      para.push(line);
    }
  }
  endPara();
  endList();
  return blocks;
}

/** An answer, whole or still streaming, ready to show. */
export function readAnswer(text: string): Answer {
  const cited = markers(text);
  return {
    blocks: blocksOf(cleanText(text)),
    cards: cited.cards.filter((id) => cardById(id)),
    actions: cited.actions.filter((id) => actionById(id)),
  };
}
