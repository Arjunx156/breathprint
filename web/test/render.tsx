import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { App } from "../src/app/App";
import { AppProvider } from "../src/app/state";

/** The whole app at `path`, as Meera's demo household on the fixture morning. */
export function renderDemo(path: string) {
  sessionStorage.setItem("bp.demo", "meera");
  return renderWith(path, <App />);
}

export function renderWith(path: string, children: ReactNode) {
  const { hook } = memoryLocation({ path });
  return render(
    <Router hook={hook}>
      <AppProvider>{children}</AppProvider>
    </Router>,
  );
}

/** Swaps fetch for one test; returns a way to put it back. */
export function stubFetch(answer: (url: string, init?: RequestInit) => Promise<Response>) {
  const real = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    answer(input instanceof Request ? input.url : String(input), init)) as typeof fetch;
  return () => {
    globalThis.fetch = real;
  };
}
