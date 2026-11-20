import { describe, expect, test } from "bun:test";
import { PHOTO_LIMIT } from "../app";
import { inTurn, scriptedLlm } from "../llm/fake";
import type { LlmRequest } from "../llm/types";
import { photoId } from "../routes/scan";
import { testApp } from "../test/app";
import { recorded } from "./recorded";

/** Enough of a JPEG for the route: its start-of-image marker and a little more. */
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array.from({ length: 28 }, (_, i) => i)]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, ...Array.from({ length: 28 }, (_, i) => i)]);
const b64 = (b: Buffer) => b.toString("base64");

function withModel(replies: Array<string | Error>) {
  const seen: LlmRequest[] = [];
  return { app: testApp({ llm: scriptedLlm(inTurn(replies, seen)) }), seen };
}

const scanPost = (app: ReturnType<typeof testApp>, body: unknown) =>
  app.request("/api/scan", {
    method: "POST",
    headers: {
      origin: "http://localhost",
      "content-type": "application/json",
      "x-real-ip": "198.51.100.7",
    },
    body: JSON.stringify(body),
  });

const reply = (room: string, ...sightings: [string, string][]) =>
  JSON.stringify({ room, sightings: sightings.map(([kind, where]) => ({ kind, where })) });

type Body = { scan: { room: string; sightings: { kind: string }[] }; recorded: boolean };

describe("room scan route", () => {
  test("sends the photo alone and returns what the model saw, each kind once", async () => {
    const { app, seen } = withModel([
      reply(
        "kitchen",
        ["incense", "on the shelf"],
        ["incense", "by the stove"],
        ["stove-no-chimney", "against the wall"],
      ),
    ]);
    const res = await scanPost(app, { image: b64(JPEG), lang: "en" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Body;
    expect(body.scan.sightings.map((s) => s.kind)).toEqual(["incense", "stove-no-chimney"]);
    const turn = seen[0]?.turns[0];
    expect(turn?.images).toEqual([{ mime: "image/jpeg", data: b64(JPEG) }]);
    // No household, no place: the model sees the photo and its instructions only.
    expect(turn?.text).toBe("List what you can see.");
    expect(seen[0]?.system).not.toContain("Rohini");
  });

  test("lists nothing for a photo that is not a room", async () => {
    const { app } = withModel([reply("notRoom", ["incense", "in the street"])]);
    const body = (await (await scanPost(app, { image: b64(JPEG), lang: "en" })).json()) as Body;
    expect(body.scan).toEqual({ room: "notRoom", sightings: [] });
  });

  test("sends back a note with a number or in the wrong language", async () => {
    const { app, seen } = withModel([
      reply("kitchen", ["incense", "2 sticks on the shelf"]),
      reply("kitchen", ["incense", "शेल्फ़ पर"]),
    ]);
    const res = await scanPost(app, { image: b64(JPEG), lang: "hi" });
    expect(res.status).toBe(200);
    expect(seen).toHaveLength(2);
    expect(seen[1]?.turns.at(-1)?.text).toContain("number");
  });

  test("reads the same photo once", async () => {
    const { app, seen } = withModel([reply("bedroom", ["open-window", "behind the bed"])]);
    await scanPost(app, { image: b64(JPEG), lang: "en" });
    const again = await scanPost(app, { image: b64(JPEG), lang: "en" });
    expect(again.status).toBe(200);
    expect(seen).toHaveLength(1);
  });

  test("refuses anything but a JPEG before a model sees it", async () => {
    const { app, seen } = withModel([]);
    const res = await scanPost(app, { image: b64(PNG), lang: "en" });
    expect(res.status).toBe(415);
    expect(seen).toHaveLength(0);
    expect((await scanPost(app, { image: "not base64!", lang: "en" })).status).toBe(400);
  });

  test("refuses a photo over the limit", async () => {
    const { app } = withModel([]);
    const res = await scanPost(app, { image: "A".repeat(PHOTO_LIMIT), lang: "en" });
    expect(res.status).toBe(413);
  });

  test("other routes keep their small limit", async () => {
    const { app } = withModel([]);
    const res = await app.request("/api/plan", {
      method: "POST",
      headers: { origin: "http://localhost", "content-type": "application/json" },
      body: JSON.stringify({ padding: "x".repeat(20_000) }),
    });
    expect(res.status).toBe(413);
  });

  test("answers 503 when the model is out and nothing was saved for this photo", async () => {
    const { app } = withModel([new Error("down"), new Error("down")]);
    const res = await scanPost(app, { image: b64(JPEG), lang: "en", demo: true });
    expect(res.status).toBe(503);
  });

  test("the demo's sample photo has a saved reading in both languages", async () => {
    const sample = new Uint8Array(await Bun.file("web/public/samples/kitchen.jpg").arrayBuffer());
    const id = photoId(sample);
    expect(recorded(`scan:en:${id}`)).toBeDefined();
    expect(recorded(`scan:hi:${id}`)).toBeDefined();
  });
});
