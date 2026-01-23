import { existsSync, statSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";

/**
 * Rewrite relative module specifiers in Codex CLI-generated TS files to include `.js`.
 *
 * Codex generates `.ts` files with ESM-style imports/exports like `from "./Foo"`.
 * Under `moduleResolution: "NodeNext"`, TypeScript requires explicit extensions.
 */

const ROOT = new URL(
  "../packages/codex-app-server-protocol/src/generated/",
  import.meta.url,
);

const KNOWN_EXTENSIONS = new Set([
  ".js",
  ".ts",
  ".json",
  ".node",
  ".mjs",
  ".cjs",
]);

/**
 * @param {string} spec
 */
function needsJsExtension(spec) {
  if (!spec.startsWith(".")) return false;
  const extension = extname(spec);
  if (extension.length === 0) return true;
  return !KNOWN_EXTENSIONS.has(extension);
}

/**
 * @param {string} content
 */
function rewriteSpecifier(filePath, spec) {
  if (!spec.startsWith(".")) return spec;

  if (spec.endsWith(".js")) {
    const withoutJs = spec.slice(0, -3);
    const absolute = resolve(dirname(filePath), withoutJs);
    if (existsSync(absolute) && statSync(absolute).isDirectory()) {
      return `${withoutJs}/index.js`;
    }
    return spec;
  }

  if (!needsJsExtension(spec)) return spec;

  const absolute = resolve(dirname(filePath), spec);

  if (
    existsSync(`${absolute}.ts`) ||
    existsSync(`${absolute}.tsx`) ||
    existsSync(`${absolute}.d.ts`)
  ) {
    return `${spec}.js`;
  }

  if (existsSync(absolute) && statSync(absolute).isDirectory()) {
    return `${spec}/index.js`;
  }

  return `${spec}.js`;
}

/**
 * @param {string} filePath
 * @param {string} content
 */
function rewriteSpecifiers(filePath, content) {
  return content.replaceAll(
    /(from\s+["'])(\.[^"']+)(["'])/g,
    (_full, prefix, spec, suffix) =>
      `${prefix}${rewriteSpecifier(filePath, spec)}${suffix}`,
  );
}

/**
 * @param {string} dirPath
 */
async function walk(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(entryPath)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(entryPath);
    }
  }

  return files;
}

const files = await walk(new URL(".", ROOT).pathname);

let touchedFiles = 0;

for (const filePath of files) {
  const before = await readFile(filePath, "utf8");
  const after = rewriteSpecifiers(filePath, before);

  if (after === before) continue;
  await writeFile(filePath, after, "utf8");
  touchedFiles += 1;
}

process.stderr.write(
  `codex-app-server-protocol-postprocess: updated ${touchedFiles} files\n`,
);
