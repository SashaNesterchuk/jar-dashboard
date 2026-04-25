"use client";

/**
 * Reflection simulator — SSOT D.5.1 `reflection_text` (+0.20
 * evidence). Reflections reinforce active observations / hypotheses
 * whose theme tags match the session triggers; the hook picks those
 * targets automatically unless the tester selects items explicitly.
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMemoryStorage } from "@/lib/memory/hooks/useMemoryContext";
import { useReflectionSubmit } from "@/lib/memory/hooks/useReflectionSubmit";
import type {
  CheckIn,
  Emotion,
  Mood,
  Tag,
} from "@/lib/memory/jarTypes";
import type { MemoryItem } from "@/lib/memory/types";
import { formatJson, generateUuid, SIM_CLIENT_METADATA, useSimUserId } from "../_sim/sim-helpers";

const MOODS: Mood[] = ["awful", "bad", "ok", "good", "great"];

export default function ReflectionSimPage() {
  const [userId] = useSimUserId();
  const storage = useMemoryStorage();
  const { submit, isSubmitting, error } = useReflectionSubmit(userId);

  const [mood, setMood] = React.useState<Mood>("ok");
  const [triggers, setTriggers] = React.useState("evenings, work");
  const [emotions, setEmotions] = React.useState("tired");
  const [text, setText] = React.useState(
    "Tonight I sat with how tense evenings feel after long work days — it keeps coming back.",
  );
  const [items, setItems] = React.useState<MemoryItem[]>([]);
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [useAutoTargets, setUseAutoTargets] = React.useState(true);
  const [lastResult, setLastResult] = React.useState<unknown>(null);

  const refresh = React.useCallback(async () => {
    if (!userId) return;
    const all = await storage.getMemoryItems(userId);
    setItems(
      all.filter(
        (i) =>
          (i.type === "observation" || i.type === "hypothesis") &&
          i.status === "active",
      ),
    );
  }, [storage, userId]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!userId) return;
    const now = new Date();
    const checkIn: CheckIn = { mood, reflection: text };
    const selEmotions: Emotion[] = splitCsv(emotions).map((label) => ({
      tKey: `emotion.${label}`,
      label,
    }));
    const selTriggers: Tag[] = splitCsv(triggers).map((label) => ({
      tKey: `trigger.${label}`,
      label,
      categoryId: "sim",
    }));
    const result = await submit({
      session_id: generateUuid(),
      user_id: userId,
      started_at: new Date(now.getTime() - 120_000),
      completed_at: now,
      event_type: "reflection",
      check_in: checkIn,
      selected_emotions: selEmotions,
      selected_triggers: selTriggers,
      user_stated_text: text,
      client_metadata: SIM_CLIENT_METADATA,
      skip_smart_summary: true,
      target_item_ids:
        useAutoTargets || picked.size === 0 ? undefined : Array.from(picked),
    });
    setLastResult(result);
    await refresh();
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Reflection simulator</h1>
        <p className="text-sm text-muted-foreground">
          SSOT D.5.1 — reflection text (+0.20) reinforces matching
          observations / hypotheses.
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
          <CardTitle>Mood</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMood(m)}
              className={`rounded-full border px-3 py-1 text-sm ${
                mood === m
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted"
              }`}
            >
              {m}
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Triggers</CardTitle>
            <CardDescription>Comma-separated.</CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              value={triggers}
              onChange={(e) => setTriggers(e.target.value)}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Emotions</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              value={emotions}
              onChange={(e) => setEmotions(e.target.value)}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reflection text</CardTitle>
          <CardDescription>
            Stored as <code>user_stated_text</code> on the SessionCard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Targets</CardTitle>
          <CardDescription>
            Automatic matching picks items whose theme_tags overlap
            with selected triggers. Uncheck to pick explicit items.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={useAutoTargets}
              onCheckedChange={(v) => setUseAutoTargets(Boolean(v))}
            />
            Auto-match via theme tags (SSOT D.5.1 row 3)
          </label>
          {!useAutoTargets &&
            (items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No candidate items yet.
              </p>
            ) : (
              items.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-3 rounded-md border p-2 text-sm"
                >
                  <Checkbox
                    checked={picked.has(item.id)}
                    onCheckedChange={() => toggle(item.id)}
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
            ))}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button
          onClick={handleSubmit}
          disabled={!userId || isSubmitting}
          size="lg"
        >
          {isSubmitting ? "Submitting…" : "Submit reflection"}
        </Button>
        {error ? (
          <Badge variant="destructive">Error: {error.message}</Badge>
        ) : null}
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

function splitCsv(s: string): string[] {
  return s
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}
