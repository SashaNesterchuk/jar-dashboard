/**
 * Memory layer canonical types.
 *
 * Every name, enum value, and mandatory field is taken verbatim from
 * SSOT `docs/2026/MindJar_consolidated_documentation_system_19_04_2026_03-16.md`.
 *
 * Scope: pure data shapes. Zero runtime logic. Zero platform imports.
 * Safe to copy as-is into `jar/types/memory.ts` on port.
 */

import type { Emotion, Mood, Tag, TimeSlot } from "./jarTypes";

export type Iso8601 = string;

export type MemoryItemType =
  | "immutable_fact"
  | "declared_preference"
  | "declared_boundary"
  | "temporary_constraint"
  | "observation"
  | "hypothesis"
  | "confirmed_insight";

export type MemoryItemStatus =
  | "active"
  | "re_check"
  | "stale"
  | "hidden"
  | "removed_by_user";

export type SensitivityLevel =
  | "public"
  | "personal"
  | "sensitive"
  | "avoided_adjacent";

export type VisibilityScope =
  | "summary"
  | "memory_screen"
  | "plan_context"
  | "hidden";

export type SignalKind =
  | "truth_confirmation"
  | "corroboration"
  | "resonance"
  | "contradiction"
  | "declaration";

export type SourceType =
  | "onboarding"
  | "check_in_text"
  | "trigger_tags"
  | "reflection"
  | "journal"
  | "self_discovery"
  | "practice_feedback"
  | "pattern_detection"
  | "echo_save"
  | "memory_screen";

export type UserFeedbackState =
  | "none"
  | "confirmed_by_user"
  | "rejected_by_user"
  | "marked_stale_by_user";

export type ConfidenceLevel = "A" | "B" | "C" | "D";

export type ContentDomain =
  | "identity"
  | "preference"
  | "boundary"
  | "context"
  | "behavior"
  | "emotion"
  | "support";

export type ContentPolarity = "positive" | "negative" | "neutral" | "mixed";

export interface MemoryItemContent {
  claim: string;
  domain: ContentDomain;
  polarity: ContentPolarity;
  /** range [0, 1] */
  intensity: number;
}

export interface MemoryItemSource {
  source_type: SourceType;
  source_event_id: string;
  session_id: string | null;
  timestamp: Iso8601;
  /** range [0, 1] */
  weight: number;
  signal_kind: SignalKind;
}

export interface MemoryStateHistoryEntry {
  from_status: MemoryItemStatus | null;
  to_status: MemoryItemStatus;
  trigger_event_id: string;
  timestamp: Iso8601;
  auto_or_manual: "auto" | "user" | "ops";
}

export interface MemoryItem {
  id: string;
  user_id: string;
  type: MemoryItemType;
  status: MemoryItemStatus;
  statement_user_facing: string | null;
  statement_internal: string;
  content: MemoryItemContent;
  internal_evidence_summary: string | null;
  /** range [0, 1] */
  confidence: number;
  /** range [0, 1] */
  freshness_score: number;
  /** range [0, 1]; cache recomputed on every retrieval (SSOT D.4.3) */
  active_confidence: number;
  last_confidence_computed_at: Iso8601;
  first_seen_at: Iso8601;
  last_supported_at: Iso8601;
  user_feedback_state: UserFeedbackState;
  sources: MemoryItemSource[];
  source_event_ids: string[];
  sensitivity_level: SensitivityLevel;
  visibility_scope: VisibilityScope;
  theme_tags: string[];
  related_focus_areas: string[];
  state_history: MemoryStateHistoryEntry[];
  supersedes_id: string | null;
  version: number;
  created_at: Iso8601;
  updated_at: Iso8601;
}

export type MemoryAuditAction =
  | "confirm"
  | "soft_reject"
  | "mark_stale"
  | "hide"
  | "why_query"
  | "correction";

export type ContextSurface =
  | "memory_screen"
  | "smart_summary"
  | "reflection"
  | "chat_reply"
  | "plan"
  | "weekly_summary";

export interface MemoryAuditEvent {
  event_id: string;
  memory_item_id: string;
  action: MemoryAuditAction;
  user_id: string;
  timestamp: Iso8601;
  previous_state: {
    confidence: number;
    status: MemoryItemStatus;
    user_feedback_state?: UserFeedbackState;
    visibility_scope?: VisibilityScope;
  };
  new_state: {
    confidence: number;
    status: MemoryItemStatus;
    user_feedback_state?: UserFeedbackState;
    visibility_scope?: VisibilityScope;
  };
  context_surface: ContextSurface;
  source_event_id: string | null;
}

export type SessionType =
  | "check_in"
  | "quick_check_in"
  | "journal"
  | "reflection"
  | "breathing"
  | "meditation"
  | "self_discovery"
  | "personal_practice";

export type CompletionState = "completed" | "abandoned" | "timed_out";

export type SessionFlagInitial =
  | "safety_check_required"
  | "sensitive_topic_mentioned"
  | "avoided_topic_adjacent"
  | "none";

export interface SessionCard {
  session_id: string;
  user_id: string;
  session_type: SessionType;
  started_at: Iso8601;
  completed_at: Iso8601;
  entry_mood: Mood | null;
  exit_mood: Mood | null;
  user_stated_text: string | null;
  selected_emotions: Emotion[];
  selected_triggers: Tag[];
  completion_state: CompletionState;
  reaction_to_output: {
    liked: boolean;
    disliked: boolean;
    echo_saved: boolean;
    regenerated: boolean;
  };
  practice_specific: {
    practice_id: string | null;
    effectiveness_self_report: "better" | "same" | "worse" | null;
    duration_seconds: number | null;
  };
  flags_initial: SessionFlagInitial[];
  client_metadata: {
    app_version: string;
    locale: string;
    timezone_offset: string;
  };
}

export type HelpedOrNot = "yes" | "no" | "unclear" | null;

export type SessionRuntimeFlag = "safety" | "sensitive" | "none";

export type EmotionalValence = "positive" | "negative" | "neutral" | "mixed";

export interface SessionSummaryV1Sync {
  session_id: string;
  session_type: SessionType;
  summary_version: "v1_sync";
  completed_at: Iso8601;
  user_stated: string[];
  emotional_tone: {
    mood: string;
    emotions: string[];
    valence: EmotionalValence;
  };
  themes_obvious: string[];
  helped_or_not: HelpedOrNot;
  flags_runtime: SessionRuntimeFlag[];
  requires_async_enrichment: boolean;
}

export interface CandidateHypothesis {
  statement: string;
  /** range [0, 1] */
  strength: number;
  theme: string;
}

export interface EffectivenessObservation {
  practice_type: string;
  observation: string;
}

export interface SessionSummaryV2Enriched {
  session_id: string;
  summary_version: "v2_enriched";
  enriched_at: Iso8601;
  themes_deep: string[];
  candidate_hypotheses: CandidateHypothesis[];
  cross_session_signals: string[];
  effectiveness_observation: EffectivenessObservation | null;
}

export type StreakStatus = "active" | "broken" | "none";
export type ActivityLevel = "low" | "medium" | "high";

export interface DailySnapshot {
  date: string;
  user_id: string;
  last_mood: Mood | null;
  trending_emotions: string[];
  trending_themes: string[];
  activity_level: ActivityLevel;
  days_since_last_checkin: number;
  days_active_last_7: number;
  days_active_last_14: number;
  practices_started_today: number;
  practices_completed_today: number;
  rings_state: {
    express: number;
    presence: number;
    insight: number;
  };
  streak_status: StreakStatus;
  refreshed_at: Iso8601;
}

export interface StableProfileBasics {
  name: string | null;
  locale: string | null;
  sign_up_date: Iso8601 | null;
}

export interface StableProfileDeclared {
  primary_motivation: string[];
  top_value: string | null;
  focus_areas: string[];
  support_style: string | null;
  realistic_action_modes: string[];
  daily_time_budget: string | null;
  support_timing_preference: string | null;
}

export interface StableProfileCurrentConstraints {
  pain_map: string[];
  avoided_topics: string[];
  current_life_context: Array<{
    topic: string;
    active_until: Iso8601 | null;
  }>;
}

export interface StableProfileHelpEntry {
  practice_type: string;
  effectiveness_score: number;
  sample_size: number;
}

export interface StableProfileHypothesisEntry {
  id: string;
  statement: string;
  confidence: number;
  theme: string;
}

export interface StableProfileActivitySnapshot {
  total_sessions: number;
  days_active_in_last_14: number;
  text_sessions_ratio: number;
  streak_status: StreakStatus;
}

export interface StableProfile {
  user_id: string;
  basics: StableProfileBasics;
  declared: StableProfileDeclared;
  current_constraints: StableProfileCurrentConstraints;
  what_tends_to_help: StableProfileHelpEntry[];
  active_hypotheses: StableProfileHypothesisEntry[];
  confirmed_insights: StableProfileHypothesisEntry[];
  confidence_level: ConfidenceLevel;
  user_confidence_score: number;
  last_refreshed_at: Iso8601;
  activity_snapshot: StableProfileActivitySnapshot;
}

export type SafetyFlag = "none" | "soft" | "hard" | "critical";

export type SafetySuggestedAction =
  | "regenerate"
  | "safe_template"
  | "crisis_flow"
  | "manual_review";

export type RiskState =
  | "normal"
  | "sensitive_adjacent"
  | "elevated"
  | "critical";

export type Surface =
  | "smart_summary"
  | "chat_reply"
  | "weekly_summary"
  | "plan"
  | "memory_screen";

export interface SafetyEvent {
  id: string;
  user_id: string;
  session_id: string | null;
  surface: Surface;
  flag: SafetyFlag;
  reason: string;
  suggested_action: SafetySuggestedAction;
  classifier_latency_ms: number;
  timestamp: Iso8601;
  output_hash: string;
}

export interface ConfidenceScoreInputs {
  total_sessions: number;
  /** range [0, 1] */
  text_sessions_ratio: number;
  confirmed_signals_count: number;
  contradicted_signals_count: number;
  /** range [0, 14] */
  days_active_in_last_14: number;
  /** count of distinct source types, range [0, 8] */
  source_diversity: number;
  /** range [0, 1] */
  avg_freshness: number;
}

export interface SignalStrengthInputs {
  /** range [0, 1] */
  text_session_factor: number;
  /** range [0, 1] */
  explicit_user_signal_factor: number;
  /** range [0, 1] */
  cross_source_agreement: number;
  /** range [0, 1] */
  recency_factor: number;
}

export type { Emotion, Mood, Tag, TimeSlot };
