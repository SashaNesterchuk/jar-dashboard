/**
 * Decay model — SSOT D.4.4.
 *
 *   freshness_score(t) =
 *     exp(-ln(2) * (days_since_last_supported_at) / half_life_days)
 *
 * For types with no automatic decay (`immutable_fact`, `declared_boundary`)
 * freshness_score is always 1. `stale` is a lifecycle status, not a type,
 * so it has no independent half-life (SSOT D.4.4).
 */

import { HALF_LIFE_DAYS } from "../constants";
import type { MemoryItemType } from "../types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const LN2 = Math.log(2);

export function daysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / MS_PER_DAY;
}

export function halfLifeDaysFor(type: MemoryItemType): number | null {
  return HALF_LIFE_DAYS[type];
}

/**
 * Compute freshness for a memory item.
 *
 * @param type       memory item type (drives the half-life)
 * @param lastSupportedAt  last time an evidence signal reinforced the item
 * @param now        "now" provided by the caller (ClockAdapter)
 */
export function freshnessScore(
  type: MemoryItemType,
  lastSupportedAt: Date,
  now: Date,
): number {
  const halfLife = HALF_LIFE_DAYS[type];
  if (halfLife === null) return 1;

  const days = Math.max(0, daysBetween(lastSupportedAt, now));
  if (days === 0) return 1;

  const score = Math.exp((-LN2 * days) / halfLife);
  if (score < 0) return 0;
  if (score > 1) return 1;
  return score;
}
