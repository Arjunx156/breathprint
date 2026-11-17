import { actionById } from "./actions/catalogue";
import { cardById } from "./knowledge/search";

/*
 * The chat model cites with markers instead of links: [K:card-id] after a
 * claim and [A:action-id] for a step it recommends. These turn them into
 * citations and action titles, and drop any id that doesn't exist.
 */

const MARKER = /\s*\[([KA]):([a-z0-9-]{1,40})\]/g;
/** A marker cut off by the end of the stream so far, like "[K:mas". */
const PARTIAL = /\s*\[(?:[KA](?::[a-z0-9-]*)?)?$/;
const ITEM = /^[-*•]\s+(.+)$/;

export type Block = { kind: "p"; text: string } | { kind: "list"; items: string[] };
export type Answer = { blocks: Block[]; cards: string[]; actions: string[] };

/** Every id the text cites, in order of first mention, known or not. */
export function markers(text: string): { cards: string[]; actions: string[] } {
  const cards = new Set<string>();
  const actions = new Set<string>();
  for (const [, kind, id] of text.matchAll(MARKER)) {
    if (id) (kind === "K" ? cards : actions).add(id);
  }
  return { cards: [...cards], actions: [...actions] };
}

/** The words alone: markers, half-streamed markers and stray emphasis removed. */
export function cleanText(text: string): string {
  return text
    .replace(MARKER, "")
    .replace(PARTIAL, "")
    .replace(/\*\*|__/g, "");
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
