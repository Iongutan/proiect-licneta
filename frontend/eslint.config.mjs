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
    // Cod din v1, nefolosit, programat pentru ștergere (README → Curățenie).
    "src/hooks/**",
    "src/lib/api-client.ts",
    "src/lib/demo-data.ts",
    "src/lib/kyc-data.ts",
    "scripts/**",
  ]),
]);

export default eslintConfig;
