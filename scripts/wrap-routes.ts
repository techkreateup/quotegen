// One-off codemod: wraps every API route handler in withApi() for tenant context.
// Transforms `export async function GET(...)` into a private handler + wrapped export.
// Skips /api/auth/** (public/self-managed) — review output with git diff.
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { globSync } from "glob";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

const files = globSync("src/app/api/**/route.ts", { cwd: process.cwd() }).filter(
  (f) => !f.replace(/\\/g, "/").includes("/api/auth/")
);

let changed = 0;
for (const rel of files) {
  const file = join(process.cwd(), rel);
  let src = readFileSync(file, "utf8");
  if (src.includes("withApi(")) continue; // already wrapped

  const found: string[] = [];
  for (const m of METHODS) {
    const re = new RegExp(`export async function ${m}\\(`);
    if (re.test(src)) {
      src = src.replace(re, `async function ${m}_handler(`);
      found.push(m);
    }
  }
  if (found.length === 0) continue;

  if (!src.includes('from "@/lib/with-api"')) {
    src = `import { withApi } from "@/lib/with-api";\n` + src;
  }
  src +=
    "\n" +
    found.map((m) => `export const ${m} = withApi(${m}_handler);`).join("\n") +
    "\n";

  writeFileSync(file, src);
  changed++;
  console.log(`wrapped: ${rel} [${found.join(", ")}]`);
}
console.log(`\n${changed} files wrapped of ${files.length} candidates`);
