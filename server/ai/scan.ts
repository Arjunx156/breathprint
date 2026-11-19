import { inScript } from "../../shared/i18n/script";
import type { Language } from "../../shared/profile";
import { distinctSightings, ROOMS, type Scan, ScanSchema, SIGHTINGS } from "../../shared/scan";
import type { InlineImage, LlmRequest } from "../llm/types";
import { scanSystem, wrongLanguage } from "./prompts";
import { type Parsed, parseShaped, verdict } from "./structured";

const SCAN_JSON_SCHEMA = {
  type: "object",
  properties: {
    room: { type: "string", enum: [...ROOMS] },
    sightings: {
      type: "array",
      maxItems: SIGHTINGS.length,
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: [...SIGHTINGS] },
          where: { type: "string" },
        },
        required: ["kind", "where"],
      },
    },
  },
  required: ["room", "sightings"],
};

/** The photo goes alone: no household, no place, nothing the model could tie to a family. */
export function scanRequest(image: InlineImage, lang: Language): LlmRequest {
  return {
    job: "scan",
    system: scanSystem(lang),
    turns: [{ role: "user", text: "List what you can see.", images: [image] }],
    schema: SCAN_JSON_SCHEMA,
    maxTokens: 600,
    temperature: 0.2,
  };
}

const DIGIT = /[0-9०-९]/;

/** Notes describe places in words and in the reader's language; the engine owns every number. */
function noteIssues(sightings: Scan["sightings"], lang: Language): string[] {
  const notes = sightings.map((s) => s.where).join("\n");
  const issues: string[] = [];
  if (DIGIT.test(notes)) issues.push("A where note has a number in it; describe places in words.");
  if (notes && !inScript(notes, lang)) issues.push(wrongLanguage(lang));
  return issues;
}

/** Reads a reply as a scan: the closed list only, each kind once, short notes in words. */
export function readScan(lang: Language) {
  return (reply: string): Parsed<Scan> => {
    const shaped = parseShaped(reply, ScanSchema, "scan");
    if (!shaped.ok) return shaped;
    const sightings = distinctSightings(shaped.value);
    return verdict({ room: shaped.value.room, sightings }, noteIssues(sightings, lang));
  };
}
