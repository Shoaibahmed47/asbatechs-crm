import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: ["**/.next/**", "**/node_modules/**", "**/dist/**"]
  },
  {
    files: ["**/*.{js,jsx,ts,tsx,mjs,cjs}"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true }
      }
    },
    rules: {}
  }
];

