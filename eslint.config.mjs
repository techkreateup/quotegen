import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated Prisma client — not our code
    "src/generated/**",
    // One-off maintenance scripts
    "scripts/**",
    // Tooling/skill files and local data — not app code
    ".claude/**",
    "backups/**",
  ]),
  {
    rules: {
      // Fires on the long-standing "fetch data in useEffect" pattern used across
      // all list pages. Treat as advisory until those pages move to a data layer.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
