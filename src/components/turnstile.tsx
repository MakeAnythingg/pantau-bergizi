"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

type TurnstileApi = {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      appearance: "interaction-only";
      callback: () => void;
      "expired-callback": () => void;
    },
  ) => string;
  reset: (id?: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/**
 * Cloudflare Turnstile, rendered explicitly so it survives client navigation. It adds the hidden
 * `cf-turnstile-response` input to the surrounding form. Tokens are single-use: call `window.turnstile.reset()`
 * after reading one.
 */
export function Turnstile({ siteKey, onReady }: { siteKey: string; onReady: (ready: boolean) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);

  const render = () => {
    if (!container.current || !window.turnstile || widget.current) return;
    widget.current = window.turnstile.render(container.current, {
      sitekey: siteKey,
      appearance: "interaction-only",
      callback: () => {
        onReady(true);
      },
      "expired-callback": () => {
        onReady(false);
      },
    });
  };

  useEffect(
    () => () => {
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    },
    [],
  );

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={render} />
      <div ref={container} />
    </>
  );
}
