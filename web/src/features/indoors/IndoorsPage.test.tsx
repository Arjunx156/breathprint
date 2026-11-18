import "../../../test/page";
import { describe, expect, test } from "bun:test";
import { t } from "@shared/i18n";
import { fireEvent } from "@testing-library/react";
import { withPage } from "../../../test/dom";
import { renderDemo, stubFetch } from "../../../test/render";

withPage();
const en = (key: Parameters<typeof t>[1]) => t("en", key);

describe("room scan", () => {
  test("ticking what's in the room ranks fixes, and saving keeps focus and says so", async () => {
    const view = renderDemo("/indoors");
    fireEvent.click(await view.findByRole("button", { name: en("indoors.noPhoto") }));
    fireEvent.click(view.getByRole("checkbox", { name: en("scan.kind.mosquito-coil") }));
    fireEvent.click(view.getByRole("button", { name: en("indoors.rank") }));

    const heading = await view.findByRole("heading", { name: en("indoors.seen") });
    expect(document.activeElement).toBe(heading);
    expect(view.getByText(en("action.swap-coil.title"))).toBeTruthy();

    const save = view.getByRole("button", { name: en("indoors.save") });
    save.focus();
    fireEvent.click(save);
    expect(document.activeElement).toBe(save);
    expect(save.getAttribute("aria-disabled")).toBe("true");
    expect(view.getByRole("status").textContent).toContain(en("indoors.saved"));
    // The household now matches, but the list of what changed stays on screen.
    expect(view.getByText(en("scan.home.mosquitoCoil"))).toBeTruthy();
  });

  test("when Gemini can't read the photo, the checklist takes over", async () => {
    const restore = stubFetch(async (url) => {
      if (url.includes("/samples/")) {
        return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), {
          headers: { "content-type": "image/jpeg" },
        });
      }
      return Response.json(
        { error: { code: "model_unavailable", message: "No model answered.", requestId: "t" } },
        { status: 503 },
      );
    });
    try {
      const view = renderDemo("/indoors");
      fireEvent.click(await view.findByRole("button", { name: en("indoors.sample") }));
      fireEvent.click(await view.findByRole("button", { name: en("indoors.scan") }));
      expect(await view.findByText(en("indoors.failed"))).toBeTruthy();
      expect(view.getByRole("group", { name: en("indoors.checklist") })).toBeTruthy();
      expect(view.getByRole("img", { name: en("indoors.sampleAlt") })).toBeTruthy();
    } finally {
      restore();
    }
  });
});
