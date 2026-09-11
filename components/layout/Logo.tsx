import Image from "next/image";
import Link from "next/link";
import { cn } from "@/components/ui/cn";

/**
 * RO compact mark (ADR-0025) from the supplied logo pack — transparent raster
 * for dark surfaces. Provenance: `docs/brand/RESPONSEOS_ASSET_MANIFEST.md`.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/responseos-mark.png"
      alt="ResponseOS"
      width={237}
      height={130}
      loading="eager"
      className={cn("w-auto", className)}
    />
  );
}

/**
 * Primary lockup: the supplied ResponseOS wordmark, with the compact mark
 * standing in below `sm`. At 375px the 176px-wide wordmark left the header CTA
 * wrapping onto three lines inside its 64px bar.
 */
export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      aria-label="ResponseOS home"
      className={cn("inline-flex shrink-0 items-center", className)}
    >
      <Image
        src="/brand/responseos-mark.png"
        alt=""
        width={237}
        height={130}
        loading="eager"
        className="h-6 w-auto sm:hidden"
      />
      <Image
        src="/brand/responseos-wordmark.png"
        alt=""
        width={344}
        height={47}
        loading="eager"
        className="hidden h-6 w-auto sm:block"
      />
    </Link>
  );
}
