import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Portability guard for the memory layer (Spec §0.4 + §10.3).
 *
 * Files under `src/lib/memory/**` must port 1:1 into `jar/` (React
 * Native). They can depend on React (RN ships React) and on the
 * adapter interfaces, but MUST NOT reach into web-only / Next /
 * Supabase primitives. Portal-specific adapters live under
 * `src/lib/memory/adapters/portal/**` and are explicitly exempt via
 * the nested override below.
 */
const MEMORY_CORE_RESTRICTED = {
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        {
          group: ["next", "next/*"],
          message:
            "src/lib/memory must stay platform-agnostic (Spec §10.3). Move the logic to an API route or adapter.",
        },
        {
          group: ["@supabase/*"],
          message:
            "src/lib/memory must not depend on Supabase directly. Use StorageAdapter.",
        },
        {
          group: ["react-native", "react-native/*"],
          message:
            "src/lib/memory must not import react-native — it is shared between web and RN via adapters.",
        },
      ],
      paths: [
        {
          name: "window",
          message:
            "src/lib/memory must not touch `window` directly. Route through an adapter.",
        },
        {
          name: "localStorage",
          message:
            "src/lib/memory must not touch localStorage directly. Use StorageAdapter / StorageLike.",
        },
      ],
    },
  ],
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/lib/memory/**/*.{ts,tsx}"],
    ignores: [
      "src/lib/memory/adapters/portal/**",
      "src/lib/memory/hooks/useMemoryContext.tsx",
      "src/lib/memory/ui/PremiumToggle.tsx",
      "**/__tests__/**",
    ],
    rules: MEMORY_CORE_RESTRICTED,
  },
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
