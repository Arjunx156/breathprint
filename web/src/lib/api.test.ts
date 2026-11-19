import "../../test/page";
import { afterEach, describe, expect, test } from "bun:test";
import { DEMO_DAY, delhiSevereSnapshot } from "@shared/fixtures";
import { withPage } from "../../test/dom";
import { stubFetch } from "../../test/render";
import { ApiError, fetchAir, searchPlaces } from "./api";

withPage();

let restore: () => void = () => undefined;
afterEach(() => restore());

/** Answers every call with `response` and remembers the URLs asked for. */
function answer(response: () => Response) {
  const asked: string[] = [];
  restore = stubFetch(async (url) => {
    asked.push(url);
    return response();
  });
  return asked;
}

describe("api client", () => {
  test("asks for the forecast by grid cell and returns the checked snapshot", async () => {
    const snapshot = delhiSevereSnapshot(DEMO_DAY);
    const asked = answer(() => Response.json(snapshot));
    expect(await fetchAir(28.7, 77.1)).toEqual(snapshot);
    expect(asked[0]).toContain("/api/air?lat=28.7&lon=77.1");
  });

  test("a reply that isn't a forecast is refused before the engine sees it", async () => {
    answer(() => Response.json({ hours: "lots" }));
    await expect(fetchAir(28.7, 77.1)).rejects.toThrow();
  });

  test("the server's error code reaches the page", async () => {
    answer(() =>
      Response.json(
        { error: { code: "upstream_unavailable", message: "x", requestId: "r" } },
        { status: 502 },
      ),
    );
    const err = await fetchAir(28.7, 77.1).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 502, code: "upstream_unavailable" });
  });

  test("an error with no envelope, such as a proxy's HTML page, reads as the network", async () => {
    answer(() => new Response("<h1>Bad gateway</h1>", { status: 502 }));
    await expect(searchPlaces("Rohini", "en")).rejects.toMatchObject({ code: "network" });
  });

  test("place search passes the reader's language along", async () => {
    const place = { name: "Rohini, Delhi", country: "IN", lat: 28.7, lon: 77.1 };
    const asked = answer(() => Response.json({ places: [place] }));
    expect(await searchPlaces("Rohini", "hi")).toEqual([place]);
    expect(asked[0]).toContain("lang=hi");
  });

  test("a reply that isn't the shape the page expects is refused, not shown", async () => {
    answer(() => Response.json({ places: [{ name: "Rohini", country: "IN", lat: 999, lon: 77 }] }));
    await expect(searchPlaces("Rohini", "en")).rejects.toThrow();
  });
});
