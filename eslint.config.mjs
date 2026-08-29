import next from "eslint-config-next";

// eslint-config-next ships a flat config array, so it spreads in directly —
// no FlatCompat shim needed on ESLint 9 / Next 16.
const config = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "lib/generated/**",
      "public/sw.js",
      "test-results/**",
      "playwright-report/**",
    ],
  },
  ...next,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      // The exhaustive-deps rule is the one that would have caught the filter
      // refetch race, so it stays an error rather than a warning.
      "react-hooks/exhaustive-deps": "error",
    },
  },
];

export default config;
