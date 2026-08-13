#!/usr/bin/env node
/**
 * Phase 5 pre-flight.
 *
 * Phase 5 revokes the client's write access to every column that affects rank.
 * That is safe only if no client code path still writes those columns — and
 * "we think we changed them all" is not evidence. This script is the evidence.
 *
 * It is a static audit, deliberately: it reads the source rather than watching
 * traffic, so it cannot be fooled by a code path that simply did not run
 * during the soak. Run it immediately before applying the Phase 5 migration.
 *
 *   node scripts/preflight-phase5.mjs
 *
 * Exit 0 = safe to proceed. Exit 1 = something still writes a protected
 * column, and revoking would break it at runtime with a 42501 that TypeScript
 * will not have warned you about.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Columns the server owns after Phase 4. No client write may touch these. */
const PROTECTED_COLUMNS = [
  "xp",
  "streak",
  "last_check_in",
  "last_habit_reset",
  "completed_today",
];

/** Tables the client must not write at all. */
const SERVER_ONLY_TABLES = ["daily_logs", "friendships", "friend_requests"];

/** Client bundles only. Anything under app/api runs on the server. */
const CLIENT_ROOTS = ["src/context", "src/components"];
const CLIENT_FILES_EXTRA = ["src/app/page.tsx", "src/app/layout.tsx"];

const WRITE_OPS = /\.(insert|update|upsert|delete)\s*\(/;

function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const files = [
  ...CLIENT_ROOTS.flatMap(walk),
  ...CLIENT_FILES_EXTRA.filter((f) => {
    try {
      statSync(f);
      return true;
    } catch {
      return false;
    }
  }),
];

const findings = [];

for (const file of files) {
  const src = readFileSync(file, "utf8");

  // Every `.from(x)` and the chain that follows it, so multi-line builders and
  // dynamic table names are both covered.
  for (const match of src.matchAll(/\.from\(([^)]*)\)((?:.|\n){0,300})/g)) {
    const rawTable = match[1].trim();
    const chain = match[2];
    const op = chain.match(WRITE_OPS);
    if (!op) continue;

    const line = src.slice(0, match.index).split("\n").length;
    // A dynamic table name is resolved by looking at what the variable can be.
    const tables = rawTable.startsWith('"')
      ? [rawTable.replace(/"/g, "")]
      : [
          ...src.matchAll(
            new RegExp(`const\\s+${rawTable}\\s*=[^;]*?"([a-z_]+)"[^;]*?"([a-z_]+)"`, "g")
          ),
        ].flatMap((m) => [m[1], m[2]]);

    for (const table of tables.length ? tables : [`<dynamic:${rawTable}>`]) {
      if (SERVER_ONLY_TABLES.includes(table)) {
        findings.push({
          file,
          line,
          detail: `writes server-only table \`${table}\` (${op[1]})`,
        });
      }
    }

    // The payload of the write, checked for protected columns.
    const payload = chain.slice(op.index);
    for (const col of PROTECTED_COLUMNS) {
      if (new RegExp(`(^|[{,\\s])${col}\\s*:`).test(payload)) {
        findings.push({
          file,
          line,
          detail: `writes protected column \`${col}\``,
        });
      }
    }
  }
}

if (findings.length === 0) {
  console.log("PASS — no client write touches a protected column or table.");
  console.log("       Phase 5 grant revocation is safe to apply.");
  process.exit(0);
}

console.error("FAIL — client code still writes what Phase 5 will revoke:\n");
for (const f of findings) {
  console.error(`  ${f.file}:${f.line}  ${f.detail}`);
}
console.error(
  "\nRevoking now would break these at runtime with a Postgres 42501."
);
process.exit(1);
