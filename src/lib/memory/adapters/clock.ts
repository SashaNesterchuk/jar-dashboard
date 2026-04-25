/**
 * ClockAdapter — platform boundary for "now".
 *
 * Spec §3.5. Exists so decay, recalibration, and transition windows
 * are deterministic in tests and portable to RN without touching any
 * pure-core function.
 */

export interface ClockAdapter {
  now(): Date;
}
