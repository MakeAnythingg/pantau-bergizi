import Image from "next/image";
import { renderSVG } from "uqr";
import { cn } from "@/lib/utils";

/** Server-rendered SVG QR. Error correction Q so a scuffed print still scans. */
export function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const svg = renderSVG(value, { ecc: "Q", blackColor: "#18242C" });

  return (
    <Image
      src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`}
      alt={label}
      width={512}
      height={512}
      unoptimized
      className={cn("aspect-square bg-white [image-rendering:pixelated]", className)}
    />
  );
}
