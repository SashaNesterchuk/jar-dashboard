import { describe, expect, it } from "vitest";
import {
  EVENT_TYPE_TO_SESSION_TYPE,
  createsSessionCard,
} from "../eventTypeMap";
import {
  normalizeToSessionCard,
  UnsupportedEventTypeError,
  type NormalizeCheckInInput,
} from "../normalize";

const START = new Date("2026-04-19T09:00:00Z");
const END = new Date("2026-04-19T09:05:00Z");

function baseInput(
  overrides: Partial<NormalizeCheckInInput> = {},
): NormalizeCheckInInput {
  return {
    session_id: "sess_1",
    user_id: "u1",
    started_at: START,
    completed_at: END,
    event_type: "mood",
    check_in: { mood: "ok", reflection: "Had a calm morning." },
    client_metadata: {
      app_version: "portal-dev",
      locale: "en",
      timezone_offset: "+00:00",
    },
    ...overrides,
  };
}

describe("eventTypeMap", () => {
  it("maps all Spec §2.1 event types", () => {
    expect(EVENT_TYPE_TO_SESSION_TYPE.journaling).toBe("journal");
    expect(EVENT_TYPE_TO_SESSION_TYPE.meditation).toBe("meditation");
    expect(EVENT_TYPE_TO_SESSION_TYPE.reflection).toBe("reflection");
    expect(EVENT_TYPE_TO_SESSION_TYPE.breathing).toBe("breathing");
    expect(EVENT_TYPE_TO_SESSION_TYPE.mood).toBe("check_in");
    expect(EVENT_TYPE_TO_SESSION_TYPE.question).toBe("self_discovery");
    expect(EVENT_TYPE_TO_SESSION_TYPE.streak).toBeNull();
    expect(EVENT_TYPE_TO_SESSION_TYPE.todo).toBeNull();
    expect(EVENT_TYPE_TO_SESSION_TYPE.affirmations).toBeNull();
    expect(EVENT_TYPE_TO_SESSION_TYPE.review).toBeNull();
    expect(EVENT_TYPE_TO_SESSION_TYPE.summary).toBeNull();
    expect(EVENT_TYPE_TO_SESSION_TYPE.letter).toBeNull();
  });

  it("createsSessionCard returns false for non-session types", () => {
    expect(createsSessionCard("todo")).toBe(false);
    expect(createsSessionCard("journaling")).toBe(true);
  });
});

describe("normalizeToSessionCard", () => {
  it("produces a canonical E.3 SessionCard", () => {
    const out = normalizeToSessionCard(baseInput());
    expect(out.session_id).toBe("sess_1");
    expect(out.user_id).toBe("u1");
    expect(out.session_type).toBe("check_in");
    expect(out.started_at).toBe(START.toISOString());
    expect(out.completed_at).toBe(END.toISOString());
    expect(out.entry_mood).toBe("ok");
    expect(out.user_stated_text).toBe("Had a calm morning.");
    expect(out.selected_emotions).toEqual([]);
    expect(out.selected_triggers).toEqual([]);
    expect(out.completion_state).toBe("completed");
    expect(out.flags_initial).toEqual(["none"]);
  });

  it("maps mood → quick_check_in when no text is supplied", () => {
    const out = normalizeToSessionCard(
      baseInput({
        check_in: { mood: "good" },
        user_stated_text: null,
      }),
    );
    expect(out.session_type).toBe("quick_check_in");
    expect(out.user_stated_text).toBeNull();
  });

  it("maps canonical practice event types directly", () => {
    expect(
      normalizeToSessionCard(baseInput({ event_type: "journaling" }))
        .session_type,
    ).toBe("journal");
    expect(
      normalizeToSessionCard(baseInput({ event_type: "reflection" }))
        .session_type,
    ).toBe("reflection");
    expect(
      normalizeToSessionCard(baseInput({ event_type: "question" }))
        .session_type,
    ).toBe("self_discovery");
  });

  it("throws UnsupportedEventTypeError for non-session event types", () => {
    expect(() =>
      normalizeToSessionCard(baseInput({ event_type: "todo" })),
    ).toThrowError(UnsupportedEventTypeError);
  });

  it("dedupes emotions and triggers by label", () => {
    const out = normalizeToSessionCard(
      baseInput({
        selected_emotions: [
          { tKey: "emo.calm", label: "calm" },
          { tKey: "emo.calm2", label: "calm" },
          { tKey: "emo.tired", label: "tired" },
        ],
        selected_triggers: [
          { tKey: "t.work", label: "work", categoryId: "c" },
          { tKey: "t.work2", label: "work", categoryId: "c" },
        ],
      }),
    );
    expect(out.selected_emotions.map((e) => e.label)).toEqual([
      "calm",
      "tired",
    ]);
    expect(out.selected_triggers.map((t) => t.label)).toEqual(["work"]);
  });
});
