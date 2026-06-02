// Rasterize the OG social card SVG to PNG via sharp (same toolchain as the
// favicons). Source of truth is public/og/responseos-og.svg; see
// docs/product/responseos-og-social-preview-spec.md. Run: node scripts/generate-og.mjs
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "public/og/responseos-og.svg");
const out = join(root, "public/og/responseos-og.png");

const svg = await readFile(src);
const png = await sharp(svg, { density: 384 })
  .resize(1200, 630, { fit: "fill" })
  .png()
  .toBuffer();
await writeFile(out, png);

const meta = await sharp(png).metadata();
console.log(`wrote ${out} — ${meta.width}x${meta.height} ${meta.format}`);
