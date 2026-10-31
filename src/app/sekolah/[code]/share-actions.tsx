"use client";

import { CopyIcon, PrinterIcon, WhatsappLogoIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const button = "h-11 rounded-full bg-card px-5 text-[15px] font-bold text-primary";

/** Print, WhatsApp share, and copy-link for one school's form URL. */
export function ShareActions({ url, schoolName }: { url: string; schoolName: string }) {
  const [copied, setCopied] = useState(false);
  const text = `Laporkan pengalaman makan MBG di ${schoolName}: ${url}`;

  return (
    <div className="flex flex-wrap gap-2.5">
      <Button
        type="button"
        variant="outline"
        className={button}
        onClick={() => {
          window.print();
        }}
      >
        <PrinterIcon aria-hidden="true" />
        Cetak QR
      </Button>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(buttonVariants({ variant: "outline" }), button)}
      >
        <WhatsappLogoIcon aria-hidden="true" />
        Bagikan ke grup WhatsApp
      </a>
      <Button
        type="button"
        variant="outline"
        className={button}
        onClick={() => {
          void navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
          });
        }}
      >
        <CopyIcon aria-hidden="true" />
        {copied ? "Link disalin" : "Salin link"}
      </Button>
      <output className="sr-only">{copied ? "Link disalin" : ""}</output>
    </div>
  );
}
