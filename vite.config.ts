import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import { resolve } from "node:path";
import pkg from "./package.json";

// The ES build keeps every runtime dependency and peer as an import, so the
// consumer's bundler resolves one shared copy. Inlining three (and the
// three-based libraries) baked a second Three.js into dist, which a host app
// that also uses three then loads twice ("Multiple instances of Three.js").
const externalPackages = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
];
const isExternal = (id: string) =>
  externalPackages.some((name) => id === name || id.startsWith(`${name}/`));

// The CommonJS build (`vite build --mode cjs`) stays self-contained as before:
// three's addons and @dvt3d/maplibre-three-plugin are ESM-only, so leaving
// them as require() calls would break the `require` entry at load time.
const CJS_EXTERNAL = ["react", "react-dom", "react/jsx-runtime", "maplibre-gl"];

export default defineConfig(({ mode }) => {
  const cjs = mode === "cjs";
  return {
    plugins: [
      react(),
      ...(cjs
        ? []
        : [
            dts({
              include: ["src"],
              exclude: ["src/**/*.test.ts", "src/**/*.test.tsx", "examples"],
              outDir: "dist/types",
              rollupTypes: false,
            }),
          ]),
    ],
    build: {
      // The ES build runs first and owns the clean; the CJS build adds to dist.
      emptyOutDir: !cjs,
      lib: {
        entry: {
          index: resolve(__dirname, "src/index.ts"),
          react: resolve(__dirname, "src/react.ts"),
        },
        formats: [cjs ? "cjs" : "es"],
        fileName: (format, entryName) => {
          const ext = format === "es" ? "mjs" : "cjs";
          return `${entryName}.${ext}`;
        },
      },
      rollupOptions: {
        external: cjs ? CJS_EXTERNAL : isExternal,
        output: {
          globals: {
            react: "React",
            "react-dom": "ReactDOM",
            "maplibre-gl": "maplibregl",
          },
          assetFileNames: (assetInfo) => {
            if (assetInfo.name === "style.css") {
              return "maplibre-gl-splat.css";
            }
            return assetInfo.name || "assets/[name]-[hash][extname]";
          },
        },
      },
      cssCodeSplit: false,
      sourcemap: true,
      minify: false,
    },
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
    },
  };
});
