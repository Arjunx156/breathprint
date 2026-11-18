import "../../../test/page";
import { afterEach, describe, expect, test } from "bun:test";
import { delhiSevereSnapshot } from "@shared/fixtures";
import { t } from "@shared/i18n";
import { ProfileSchema } from "@shared/profile";
import { fireEvent, type RenderResult } from "@testing-library/react";
import { withPage } from "../../../test/dom";
import { renderWith, stubFetch } from "../../../test/render";
import { App } from "../../app/App";
import { KEYS, load } from "../../lib/storage";

withPage();
const en = (key: Parameters<typeof t>[1], vars?: Parameters<typeof t>[2]) => t("en", key, vars);

const ROHINI = { name: "Rohini, Delhi", lat: 28.7, lon: 77.1, country: "IN" };
const snapshot = delhiSevereSnapshot(new Date().toISOString().slice(0, 10));

/** What place search answers; the forecast is always up and the model always down. */
let places: () => Response = () => Response.json({ places: [ROHINI] });
let restore: () => void = () => undefined;
afterEach(() => {
  restore();
  places = () => Response.json({ places: [ROHINI] });
});

function setup() {
  restore = stubFetch(async (url) => {
    if (url.includes("/api/geocode")) return places();
    if (url.includes("/api/air")) return Response.json(snapshot);
    return new Response(null, { status: 503 });
  });
  return renderWith("/setup", <App />);
}

async function search(view: RenderResult, q: string) {
  fireEvent.change(await view.findByLabelText(en("setup.search")), { target: { value: q } });
}

const next = (view: RenderResult) =>
  fireEvent.click(view.getByRole("button", { name: en("setup.next") }));
const nth = (els: HTMLElement[], i: number) => {
  const el = els[i];
  if (!el) throw new Error(`no element ${i}`);
  return el;
};

/** Pretends the browser can locate, then answers with `answer`. */
function geolocation(answer: (ok: PositionCallback, fail: () => void) => void) {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition: (ok: PositionCallback, fail: () => void) => answer(ok, fail) },
  });
  const previous = restore;
  restore = () => {
    previous();
    Reflect.deleteProperty(navigator, "geolocation");
  };
}

describe("setup", () => {
  test("a new household goes from place to plan, and nothing is kept until the end", async () => {
    const view = setup();
    const first = await view.findByRole("button", { name: en("setup.next") });
    expect(first).toHaveProperty("disabled", true);
    await search(view, "Rohini");
    fireEvent.click(await view.findByRole("button", { name: ROHINI.name }));
    expect(view.getByText(en("setup.chosen", { place: ROHINI.name }))).toBeTruthy();

    next(view);
    const household = view.getByRole("heading", { name: en("setup.household") });
    expect(document.activeElement).toBe(household);
    fireEvent.click(view.getByRole("button", { name: en("setup.add") }));
    // A new person's name is the next thing to type.
    expect(document.activeElement).toBe(nth(view.getAllByLabelText(en("setup.name")), 1));
    fireEvent.click(view.getByRole("button", { name: en("setup.add") }));
    for (const i of [1, 2]) {
      fireEvent.change(nth(view.getAllByLabelText(en("setup.group")), i), {
        target: { value: "child" },
      });
    }
    fireEvent.click(nth(view.getAllByRole("checkbox", { name: en("condition.asthma") }), 1));

    next(view);
    // The school run starts with every child and an adult; its distance is held to what's sane.
    fireEvent.change(nth(view.getAllByLabelText(en("setup.mode")), 1), {
      target: { value: "bus" },
    });
    const km = view.getByLabelText(en("setup.km")) as HTMLInputElement;
    fireEvent.change(km, { target: { value: "500" } });
    expect(km.value).toBe("80");

    // Someone who leaves the household leaves the school run too.
    fireEvent.click(view.getByRole("button", { name: en("setup.back") }));
    fireEvent.click(
      view.getByRole("button", { name: en("setup.remove", { who: en("setup.person", { n: 3 }) }) }),
    );
    // The pressed button left with its person; focus lands somewhere that still exists.
    expect(document.activeElement).toBe(view.getByRole("button", { name: en("setup.add") }));
    next(view);
    next(view);
    fireEvent.click(view.getByRole("checkbox", { name: en("setup.purifier") }));
    next(view);
    fireEvent.click(view.getByRole("radio", { name: en("scale.US") }));
    expect(localStorage.getItem(KEYS.profile)).toBeNull();

    fireEvent.click(view.getByRole("button", { name: en("setup.finish") }));
    expect(await view.findByRole("heading", { name: en("plan.title") })).toBeTruthy();
    const saved = load(KEYS.profile, ProfileSchema);
    expect(saved?.members.map((m) => [m.group, m.conditions])).toEqual([
      ["adult", []],
      ["child", ["asthma"]],
    ]);
    expect(saved?.schoolRun).toMatchObject({ mode: "bus", km: 80, who: ["p2", "me"] });
    expect(saved?.home.purifier).toBe(true);
    expect(saved).toMatchObject({ scale: "US", ai: false });
  });

  test("search says when it finds nothing and when it can't search at all", async () => {
    places = () => Response.json({ places: [] });
    const view = setup();
    await search(view, "Nowhereville");
    expect(await view.findByText(en("setup.noResults"))).toBeTruthy();
    places = () => new Response(null, { status: 502 });
    await search(view, "Nowhereville again");
    expect(await view.findByText(en("setup.searchError"))).toBeTruthy();
  });

  test("a located household is rounded to the grid before anything keeps it", async () => {
    geolocation((ok) => ok({ coords: { latitude: 28.70412, longitude: 77.10249 } } as never));
    const view = setup();
    fireEvent.click(await view.findByRole("button", { name: en("setup.locate") }));
    expect(view.getByText(en("setup.chosen", { place: en("setup.here") }))).toBeTruthy();
    for (let step = 0; step < 4; step++) next(view);
    fireEvent.click(view.getByRole("button", { name: en("setup.finish") }));
    await view.findByRole("heading", { name: en("plan.title") });
    expect(load(KEYS.profile, ProfileSchema)?.place).toEqual({
      name: en("setup.here"),
      lat: 28.7,
      lon: 77.1,
      country: "IN",
    });
  });

  test("a refused location says so and leaves search open", async () => {
    geolocation((_ok, fail) => fail());
    const view = setup();
    fireEvent.click(await view.findByRole("button", { name: en("setup.locate") }));
    expect(view.getByRole("alert").textContent).toBe(en("setup.locateError"));
    expect(view.getByLabelText(en("setup.search"))).toBeTruthy();
  });
});
