"use client";

/**
 * Practice simulator — SSOT E.4.1 (`helped_or_not`) + D.5.1
 * (`practice_better` / `practice_worse`).
 *
 * Flow:
 *   1. Pick a practice type (breathing / meditation / personal) and an
 *      outcome (Better / Same / Worse).
 *   2. Submit creates a `SessionCard` with
 *      `practice_specific.effectiveness_self_report` set, going
 *      through the sync pipeline (Smart Summary skipped — practice
 *      sessions don't emit one).
 *   3. Apply `practice_better` / `practice_worse` to the currently
 *      selected memory items via `usePracticeFeedback`.
 *
 * SSOT E.4.1 #1/#2: explicit Better/Worse overrides soft signals; the
 * simulator surfaces that explicitly so testers can verify the
 * contradiction / corroboration deltas on the items.
 */

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useMemoryStorage } from "@/lib/memory/hooks/useMemoryContext";
import {
  usePracticeFeedback,
  type PracticeOutcome,
} from "@/lib/memory/hooks/usePracticeFeedback";
import { useSessionSubmit } from "@/lib/memory/hooks/useSessionSubmit";
import type {
  CheckIn,
  EventType,
  Mood,
} from "@/lib/memory/jarTypes";
import type { MemoryItem } from "@/lib/memory/types";
import { formatJson, generateUuid, SIM_CLIENT_METADATA, useSimUserId } from "../_sim/sim-helpers";

const PRACTICE_TYPES: Array<{
  id: EventType;
  label: string;
  session_type: string;
}> = [
  { id: "breathing", label: "Breathing", session_type: "breathing" },
  { id: "meditation", label: "Meditation", session_type: "meditation" },
  {
    id: "reflection",
    label: "Reflection",
    session_type: "reflection",
  },
];

const OUTCOMES: Array<{ id: PracticeOutcome; label: string }> = [
  { id: "better", label: "Better" },
  { id: "same", label: "Same" },
  { id: "worse", label: "Worse" },
];

const MOODS: Mood[] = ["awful", "bad", "ok", "good", "great"];

export default function PracticeSimPage() {
  const [userId] = useSimUserId();
  const storage = useMemoryStorage();
  const { submit: submitSession, isSubmitting: isSubmittingSession } =
    useSessionSubmit(userId);
  const { apply, isApplying } = usePracticeFeedback(userId);

  const [practice, setPractice] = React.useState<EventType>("breathing");
  const [outcome, setOutcome] = React.useState<PracticeOutcome>("better");
  const [entryMood, setEntryMood] = React.useState<Mood>("bad");
  const [exitMood, setExitMood] = React.useState<Mood>("ok");
  const [items, setItems] = React.useState<MemoryItem[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [lastResult, setLastResult] = React.useState<unknown>(null);

  const refreshItems = React.useCallback(async () => {
    if (!userId) return;
    const all = await storage.getMemoryItems(userId);
    setItems(
      all.filter(
        (i) =>
          i.status === "active" &&
          (i.type === "observation" ||
            i.type === "hypothesis" ||
            i.type === "confirmed_insight"),
      ),
    );
  }, [storage, userId]);

  React.useEffect(() => {
    void refreshItems();
  }, [refreshItems]);

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!userId) return;
    const now = new Date();
    const sessionId = generateUuid();

    const checkIn: CheckIn = { mood: exitMood };
    const session = await submitSession({
      session_id: sessionId,
      user_id: userId,
      started_at: new Date(now.getTime() - 180_000),
      completed_at: now,
      event_type: practice,
      check_in: checkIn,
      entry_mood: entryMood,
      client_metadata: SIM_CLIENT_METADATA,
      skip_smart_summary: true,
      practice_specific: {
        practice_id: `${practice}-sim`,
        effectiveness_self_report: outcome,
        duration_seconds: 180,
      },
    });

    const feedback = await apply({
      item_ids: Array.from(selected),
      outcome,
      session_id: session.session_card.session_id,
      practice_type: practice,
    });

    await refreshItems();
    setLastResult({ session, feedback });
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Practice simulator</h1>
        <p className="text-sm text-muted-foreground">
          SSOT E.4.1 — explicit Better / Worse overrides soft signals
          on selected items (D.5.1 practice_better / practice_worse).
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>user_id:</span>
          <code className="rounded bg-muted px-2 py-0.5">
            {userId ?? "…"}
          </code>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Practice</CardTitle>
          <CardDescription>
            Mapped to SessionCard.session_type via
            <code> eventTypeMap</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {PRACTICE_TYPES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPractice(p.id)}
              className={`rounded-full border px-3 py-1 text-sm ${
                practice === p.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted"
              }`}
            >
              {p.label}
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Outcome</CardTitle>
          <CardDescription>
            Better → +0.20 corroboration. Worse → −0.20 contradiction.
            Same → no-op (SSOT D.5.1).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {OUTCOMES.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setOutcome(o.id)}
              className={`rounded-full border px-3 py-1 text-sm ${
                outcome === o.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted"
              }`}
            >
              {o.label}
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Entry mood</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {MOODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setEntryMood(m)}
                className={`rounded-full border px-3 py-1 text-sm ${
                  entryMood === m
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted"
                }`}
              >
                {m}
              </button>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Exit mood</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {MOODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setExitMood(m)}
                className={`rounded-full border px-3 py-1 text-sm ${
                  exitMood === m
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted"
                }`}
              >
                {m}
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Target items · {items.length}</CardTitle>
          <CardDescription>
            Pick which items the practice outcome should reinforce or
            contradict. Empty set = session only, no signal applied.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No observations / hypotheses / insights yet. Seed some via
              onboarding + check-ins first.
            </p>
          ) : (
            items.map((item) => (
              <label
                key={item.id}
                className="flex items-center gap-3 rounded-md border p-2 text-sm"
              >
                <Checkbox
                  checked={selected.has(item.id)}
                  onCheckedChange={() => toggleSelected(item.id)}
                />
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{item.type}</Badge>
                    <Badge variant="outline">
                      conf {item.confidence.toFixed(2)}
                    </Badge>
                  </div>
                  <Label className="mt-1 block font-medium">
                    {item.statement_user_facing}
                  </Label>
                </div>
              </label>
            ))
          )}
        </CardContent>
      </Card>

      <div>
        <Button
          onClick={handleSubmit}
          disabled={!userId || isSubmittingSession || isApplying}
          size="lg"
        >
          {isSubmittingSession || isApplying
            ? "Submitting…"
            : "Submit practice outcome"}
        </Button>
      </div>

      {lastResult ? (
        <Card>
          <CardHeader>
            <CardTitle>Result</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-96 overflow-auto rounded bg-muted p-3 text-xs">
              {formatJson(lastResult)}
            </pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
