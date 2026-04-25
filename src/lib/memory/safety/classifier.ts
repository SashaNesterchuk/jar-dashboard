/**
 * Safety classifier wrapper. SSOT F.1.
 *
 * Applies the portal hard timeout for Smart Summary generation. The SSOT
 * target remains 500 ms p95 (F.1.3), but the current Edge/OpenAI runtime
 * path needs the 3000 ms hard ceiling from E.11 to avoid false fallbacks.
 *
 * This is NOT the classifier itself. The model work lives in the
 * `AIAdapter.runSafetyClassifier` implementation. This module is the
 * budget / retry / telemetry seam.
 */

import type { AIAdapter, SafetyInput, SafetyResult } from "../adapters/ai";
import type { ClockAdapter } from "../adapters/clock";
import type { TelemetryAdapter } from "../adapters/telemetry";
import type { Surface } from "../types";

/**
 * SSOT E.11 hard ceiling for Smart Summary generation, including classifier.
 * Keep as a constant so tests can import it.
 */
export const CLASSIFIER_LATENCY_BUDGET_MS = 3000;

export interface RunClassifierParams {
  ai: AIAdapter;
  clock: ClockAdapter;
  telemetry?: TelemetryAdapter;
  input: SafetyInput;
  /** For telemetry only. */
  surface: Surface;
  user_id: string;
  session_id: string | null;
  /** Output under scrutiny — hashed into the safety event. */
  output_for_hash: string;
}

export interface ClassifierRunResult {
  result: SafetyResult;
  /** True when the adapter timed out and a safe fallback was returned. */
  timed_out: boolean;
}

export async function runSafetyClassifier(
  params: RunClassifierParams,
): Promise<ClassifierRunResult> {
  const { ai, clock, telemetry, input, surface, user_id, session_id } = params;
  const start = clock.now().getTime();

  const timeout = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), CLASSIFIER_LATENCY_BUDGET_MS),
  );
  const call = ai
    .runSafetyClassifier(input)
    .then((r) => ({ kind: "ok" as const, r }))
    .catch((e) => ({ kind: "error" as const, e }));

  const race = await Promise.race([timeout, call]);

  if (race === "timeout") {
    const elapsed = clock.now().getTime() - start;
    const result: SafetyResult = {
      flag: "soft",
      reason: "classifier_timeout",
      suggested_action: "safe_template", // SSOT F.1.3
      classifier_latency_ms: elapsed,
    };
    emitEvent({ telemetry, clock, user_id, session_id, surface, result, output_for_hash: params.output_for_hash });
    return { result, timed_out: true };
  }

  if (race.kind === "error") {
    const elapsed = clock.now().getTime() - start;
    const result: SafetyResult = {
      flag: "hard",
      reason: "classifier_failed",
      suggested_action: "safe_template", // SSOT E.10.6
      classifier_latency_ms: elapsed,
    };
    emitEvent({ telemetry, clock, user_id, session_id, surface, result, output_for_hash: params.output_for_hash });
    return { result, timed_out: false };
  }

  emitEvent({ telemetry, clock, user_id, session_id, surface, result: race.r, output_for_hash: params.output_for_hash });
  return { result: race.r, timed_out: false };
}

interface EmitArgs {
  telemetry?: TelemetryAdapter;
  clock: ClockAdapter;
  user_id: string;
  session_id: string | null;
  surface: Surface;
  result: SafetyResult;
  output_for_hash: string;
}

function emitEvent(args: EmitArgs): void {
  if (!args.telemetry) return;
  const payload = {
    user_id: args.user_id,
    session_id: args.session_id,
    surface: args.surface,
    flag: args.result.flag,
    reason: args.result.reason,
    suggested_action: args.result.suggested_action,
    classifier_latency_ms: args.result.classifier_latency_ms,
    timestamp: args.clock.now().toISOString(),
    output_hash: cheapHash(args.output_for_hash),
  };
  args.telemetry.capture("safety_classifier_completed", payload);
  if (args.result.flag !== "none") {
    args.telemetry.capture("safety_flag_raised", payload);
  }
}

/**
 * FNV-1a 32-bit. Deterministic, no crypto dep. Only used as an audit
 * breadcrumb to correlate an output with its safety decision — it is
 * NOT a security primitive.
 */
function cheapHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
