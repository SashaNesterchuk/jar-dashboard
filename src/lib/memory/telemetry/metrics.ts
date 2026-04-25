/**
 * Derived memory metrics — SSOT J.3.2 and J.3.3.
 *
 *   memory_correction_rate =
 *     (count of memory_audit_log.action in
 *       {soft_reject, mark_stale, correction}) ÷
 *     (items_viewed_on_memory_screen)
 *
 * Pure formulas; the portal wires them on top of `MemoryAuditEvent`
 * streams. The correction rate is a health indicator — the higher it
 * climbs above 0.10 (SSOT J.3.2 p95 target), the stronger the signal
 * that confidence is over-assigning truth status.
 */

import type { MemoryAuditAction, MemoryAuditEvent } from "../types";

export const CORRECTIVE_ACTIONS: ReadonlySet<MemoryAuditAction> = new Set([
  "soft_reject",
  "mark_stale",
  "correction",
]);

export interface CorrectionRateInputs {
  audit: readonly MemoryAuditEvent[];
  items_viewed_on_memory_screen: number;
}

export interface CorrectionRateResult {
  /** `null` when denominator is zero. */
  rate: number | null;
  corrections: number;
  items_viewed: number;
  /** Which actions contributed to the numerator (for debug views). */
  breakdown: Record<MemoryAuditAction, number>;
}

export function computeMemoryCorrectionRate(
  input: CorrectionRateInputs,
): CorrectionRateResult {
  const breakdown: Record<MemoryAuditAction, number> = {
    confirm: 0,
    soft_reject: 0,
    mark_stale: 0,
    hide: 0,
    why_query: 0,
    correction: 0,
  };

  for (const evt of input.audit) {
    if (breakdown[evt.action] !== undefined) {
      breakdown[evt.action] += 1;
    }
  }

  const corrections =
    breakdown.soft_reject + breakdown.mark_stale + breakdown.correction;

  const items_viewed = Math.max(0, input.items_viewed_on_memory_screen);
  return {
    rate: items_viewed > 0 ? corrections / items_viewed : null,
    corrections,
    items_viewed,
    breakdown,
  };
}

/** Optional window filter by ISO-8601 `timestamp`. */
export function filterAuditByWindow(
  audit: readonly MemoryAuditEvent[],
  window: { from?: Date; to?: Date },
): MemoryAuditEvent[] {
  return audit.filter((evt) => {
    const t = Date.parse(evt.timestamp);
    if (Number.isNaN(t)) return false;
    if (window.from && t < window.from.getTime()) return false;
    if (window.to && t > window.to.getTime()) return false;
    return true;
  });
}
