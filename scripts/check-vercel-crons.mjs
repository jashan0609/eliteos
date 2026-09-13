// Fails if vercel.json schedules any cron more than once a day.
//
// Vercel Hobby rejects such an expression at deploy time. CI never looked at
// vercel.json, so when Phase 0 set the reset to hourly, every deployment from
// August 11 to September 13, 2026 failed while CI stayed green, and production
// silently served a June build for a month. This makes the same mistake fail
// here, where someone is watching.
//
// Remove this check only after moving the project to a paid Vercel plan.
import { readFileSync } from "node:fs";

const { crons = [] } = JSON.parse(readFileSync("vercel.json", "utf8"));
const isFixed = (field) => /^\d+$/.test(field);

const tooFrequent = crons.filter(({ schedule }) => {
  const [minute, hour] = schedule.trim().split(/\s+/);
  return !(isFixed(minute) && isFixed(hour));
});

for (const { path, schedule } of crons) {
  const bad = tooFrequent.some((c) => c.path === path);
  console.log(`${bad ? "FAIL" : "ok  "}  ${schedule.padEnd(12)} ${path}`);
}

if (tooFrequent.length > 0) {
  console.error(
    "\nVercel Hobby allows at most one run per day per cron. Use a fixed " +
      "minute and hour, e.g. '0 6 * * *'."
  );
  process.exit(1);
}
