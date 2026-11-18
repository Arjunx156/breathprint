import { inScript } from "../../shared/i18n/script";
import type { Language } from "../../shared/profile";
import { ROOMS, type Scan, ScanSchema, SIGHTINGS } from "../../shared/scan";
import type { InlineImage, LlmRequest } from "../llm/types";
import { scanSystem, wrongLanguage } from "./prompts";
import { type Parsed, parseJson } from "./structured";

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

/**
 * Reads a reply as a scan: the closed list only, each kind once, short notes
 * in the right language and with no figures, since the engine owns every number.
 */
export function readScan(lang: Language) {
  return (reply: string): Parsed<Scan> => {
    const json = parseJson(reply);
    if (!json.ok) return json;
    const shaped = ScanSchema.safeParse(json.value);
    if (!shaped.success) {
      return {
        ok: false,
        issues: shaped.error.issues.map((i) => `${i.path.join(".") || "scan"}: ${i.message}`),
      };
    }
    const { room } = shaped.data;
    const seen = new Set<string>();
    const sightings =
      room === "notRoom"
        ? []
        : shaped.data.sightings.filter((s) => !seen.has(s.kind) && seen.add(s.kind));
    const notes = sightings.map((s) => s.where).join("\n");
    const issues: string[] = [];
    if (DIGIT.test(notes))
      issues.push("A where note has a number in it; describe places in words.");
    if (notes && !inScript(notes, lang)) issues.push(wrongLanguage(lang));
    return issues.length > 0 ? { ok: false, issues } : { ok: true, value: { room, sightings } };
  };
}
