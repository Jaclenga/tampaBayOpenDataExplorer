import js from "@eslint/js";
import ts from "typescript-eslint";
export default ts.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      ".upstream/**",
      ".wrangler/**",
      "playwright-report/**",
      "test-results/**",
      "coverage/**",
      "worker-configuration.d.ts",
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: { complexity: ["error", 15] },
  },
  {
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        fetch: "readonly",
        AbortSignal: "readonly",
        setTimeout: "readonly",
      },
    },
    rules: { "@typescript-eslint/no-explicit-any": "error" },
  },
);
