/**
 * Signal strength formula — SSOT D.2.2.
 *
 *   signal_strength = 0.4 * text_session_factor
 *                   + 0.3 * explicit_user_signal_factor
 *                   + 0.2 * cross_source_agreement
 *                   + 0.1 * recency_factor
 *
 * Each factor ∈ [0, 1]. Result clamped to [0, 1].
 */

import { SIGNAL_STRENGTH_WEIGHTS } from "../constants";
import type { SignalStrengthInputs } from "../types";

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function computeSignalStrength(inputs: SignalStrengthInputs): number {
  const w = SIGNAL_STRENGTH_WEIGHTS;
  const score =
    w.text_session_factor * clamp(inputs.text_session_factor, 0, 1) +
    w.explicit_user_signal_factor *
      clamp(inputs.explicit_user_signal_factor, 0, 1) +
    w.cross_source_agreement * clamp(inputs.cross_source_agreement, 0, 1) +
    w.recency_factor * clamp(inputs.recency_factor, 0, 1);
  return clamp(score, 0, 1);
}
