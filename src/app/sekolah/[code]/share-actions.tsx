"use client";

import { useState } from "react";

const button =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-white px-5 text-[15px] font-bold text-navy shadow-[0_0_0_1px_rgb(24_36_44/0.08),0_2px_6px_-2px_rgb(24_36_44/0.14)]";

/** Print, WhatsApp share, and copy-link for one school's form URL. */
export function ShareActions({ url, schoolName }: { url: string; schoolName: string }) {
  const [copied, setCopied] = useState(false);
  const text = `Laporkan pengalaman makan MBG di ${schoolName}: ${url}`;

  return (
    <div className="flex flex-wrap gap-2.5">
      <button
        type="button"
        className={button}
        onClick={() => {
          window.print();
        }}
      >
        Cetak QR
      </button>
      <a
        className={button}
        href={`https://wa.me/?text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Bagikan ke grup WhatsApp
      </a>
      <button
        type="button"
        className={button}
        onClick={() => {
          void navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
          });
        }}
      >
        {copied ? "Link disalin" : "Salin link"}
      </button>
      <output className="sr-only">{copied ? "Link disalin" : ""}</output>
    </div>
  );
}
