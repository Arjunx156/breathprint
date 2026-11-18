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

/**
 * Each block and list item keeps the line it starts on. A streamed answer only
 * grows at the end, so these stay put and can key what's on screen.
 */
export type Line = { line: number; text: string };
export type Block = ({ kind: "p" } & Line) | { kind: "list"; line: number; items: Line[] };
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
      // The model sometimes ends a sentence with the ideographic full stop.
      .replace(/(\p{Script=Devanagari})\s*。/gu, "$1।")
      .replace(/。/g, ".")
      // "[K:a], [A:b]." would leave a comma stranded before the full stop.
      .replace(/\s*,\s*([.!?।])/g, "$1")
      .replace(PARTIAL, "")
      .replace(/\*\*|__/g, "")
  );
}

/** Paragraphs and "- " lists, the only shapes the prompt allows. */
export function blocksOf(text: string): Block[] {
  const blocks: Block[] = [];
  let para: Line[] = [];
  let list: Line[] = [];
  const endPara = () => {
    const [first] = para;
    if (first)
      blocks.push({ kind: "p", line: first.line, text: para.map((p) => p.text).join(" ") });
    para = [];
  };
  const endList = () => {
    const [first] = list;
    if (first) blocks.push({ kind: "list", line: first.line, items: list });
    list = [];
  };
  for (const [n, raw] of text.split("\n").entries()) {
    const line = raw.trim();
    // A bullet that held only a marker is empty once the marker is gone.
    if (BARE_BULLET.test(line)) continue;
    const item = ITEM.exec(line)?.[1];
    if (!line) {
      endPara();
      endList();
    } else if (item) {
      endPara();
      list.push({ line: n, text: item });
    } else {
      endList();
      para.push({ line: n, text: line });
    }
  }
  endPara();
  endList();
  return blocks;
}

/** Every sentence a reader sees, in order, with the list items laid flat. */
export function textsOf(blocks: readonly Block[]): string[] {
  return blocks.flatMap((b) => (b.kind === "p" ? [b.text] : b.items.map((i) => i.text)));
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
