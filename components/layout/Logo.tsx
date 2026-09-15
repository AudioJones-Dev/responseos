import Image from "next/image";
import Link from "next/link";
import { cn } from "@/components/ui/cn";

/** ResponseOS RO compact mark (Brand 2.0/2.1, ADR-0025). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/responseos-mark.svg"
      alt="ResponseOS"
      width={360}
      height={250}
      unoptimized
      className={cn("w-auto", className)}
    />
  );
}

/** Primary ResponseOS wordmark for marketing headers (ADR-0025). */
export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      aria-label="ResponseOS home"
      className={cn("flex items-center", className)}
    >
      <Image
        src="/brand/responseos-wordmark.svg"
        alt="ResponseOS"
        width={820}
        height={120}
        priority
        unoptimized
        className="h-5 w-auto sm:h-6"
      />
    </Link>
  );
}
