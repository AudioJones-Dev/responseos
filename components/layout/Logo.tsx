import Image from "next/image";
import Link from "next/link";
import { cn } from "@/components/ui/cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/responseos-mark.png"
      alt="ResponseOS"
      width={237}
      height={130}
      className={cn("h-auto w-auto", className)}
      priority
    />
  );
}

export function Logo({
  href = "/",
  className,
}: {
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label="ResponseOS home"
      className={cn("inline-flex items-center", className)}
    >
      <Image
        src="/brand/responseos-wordmark.png"
        alt="ResponseOS"
        width={344}
        height={47}
        className="h-6 w-auto sm:h-7"
        priority
      />
    </Link>
  );
}
