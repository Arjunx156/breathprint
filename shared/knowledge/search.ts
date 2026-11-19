import { CARDS, type Card } from "./cards";

const K1 = 1.2;
const B = 0.75;
/** Titles and aliases say what a card is about, so they count more than body words. */
const TITLE_WEIGHT = 3;
const ALIAS_WEIGHT = 3;

const STOPWORDS = new Set(
  "a an and are as at be but by can do does for from how i if in is it its me my of on or our should so than that the their them then there these they this to too was we what when where which who why will with you your hai hain kya ki ka ke ko se me mein par aur bhi to ya है हैं क्या की का के को से में पर और भी तो या".split(
    " ",
  ),
);

/** Lower-cased words in Latin or Devanagari script, minus stopwords. */
export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+|[ऀ-ॿ]+/g) ?? []).filter((w) => !STOPWORDS.has(w));
}

type Doc = { card: Card; terms: Map<string, number>; length: number };

function document(card: Card): Doc {
  const words = [
    ...Array<string[]>(TITLE_WEIGHT)
      .fill(tokenize(`${card.title} ${card.titleHi}`))
      .flat(),
    ...Array<string[]>(ALIAS_WEIGHT)
      .fill(tokenize(card.aliases.join(" ")))
      .flat(),
    ...tokenize(card.body),
  ];
  const terms = new Map<string, number>();
  for (const w of words) terms.set(w, (terms.get(w) ?? 0) + 1);
  return { card, terms, length: words.length };
}

export type Index = { docs: Doc[]; avgLength: number; df: Map<string, number> };

function buildIndex(cards: readonly Card[]): Index {
  const docs = cards.map(document);
  const df = new Map<string, number>();
  for (const d of docs) for (const term of d.terms.keys()) df.set(term, (df.get(term) ?? 0) + 1);
  const avgLength = docs.reduce((s, d) => s + d.length, 0) / Math.max(1, docs.length);
  return { docs, avgLength, df };
}

function bm25(index: Index, doc: Doc, query: readonly string[]): number {
  const n = index.docs.length;
  let score = 0;
  for (const term of query) {
    const tf = doc.terms.get(term) ?? 0;
    if (tf === 0) continue;
    const df = index.df.get(term) ?? 0;
    const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
    score += (idf * tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * doc.length) / index.avgLength));
  }
  return score;
}

export type Hit = { card: Card; score: number };

const DEFAULT_INDEX = buildIndex(CARDS);

/** The cards that best answer `query`, best first; empty when nothing matches. */
export function search(query: string, k = 4, index: Index = DEFAULT_INDEX): Hit[] {
  const terms = [...new Set(tokenize(query))];
  return index.docs
    .map((doc) => ({ card: doc.card, score: bm25(index, doc, terms) }))
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

const BY_ID = new Map(CARDS.map((c) => [c.id, c]));

/** The knowledge card with an id, or undefined when no card has it. */
export function cardById(id: string): Card | undefined {
  return BY_ID.get(id);
}
