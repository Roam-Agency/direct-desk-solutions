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
    // Standalone ops tooling — run directly with `node`, not part of the
    // Next app build, so it isn't subject to the app's lint rules.
    "data/imports/**",
  ]),
  // Respect the underscore-prefix convention for intentionally-unused
  // identifiers. Variables, function args, and destructured array members
  // whose name starts with `_` are silently ignored by the unused-vars
  // rule. This matches the JavaScript convention and TypeScript's own
  // tsconfig `noUnusedParameters` exemption pattern.
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
]);

export default eslintConfig;
