// Copies Monaco's prebuilt AMD bundle into public/ so the editor is served
// from our own origin instead of a CDN. Runs on postinstall/predev/prebuild.
import { cpSync, existsSync, rmSync } from "node:fs"
import { join } from "node:path"

const src = join(process.cwd(), "node_modules", "monaco-editor", "min", "vs")
const dest = join(process.cwd(), "public", "monaco", "vs")

if (!existsSync(src)) {
  console.error(`monaco: ${src} not found; run npm install first`)
  process.exit(1)
}
rmSync(dest, { recursive: true, force: true })
cpSync(src, dest, { recursive: true })
console.log(`monaco: copied editor assets to public/monaco/vs`)
