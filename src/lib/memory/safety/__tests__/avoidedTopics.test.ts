import { describe, expect, it } from "vitest";
import {
  containsAvoidedTopic,
  detectAvoidedTopicMentions,
} from "../avoidedTopics";

describe("detectAvoidedTopicMentions", () => {
  it("matches word-boundary case-insensitive", () => {
    expect(
      detectAvoidedTopicMentions("Let's talk about work.", ["work"]),
    ).toHaveLength(1);
    expect(
      detectAvoidedTopicMentions("Networking is great.", ["work"]),
    ).toHaveLength(0);
  });

  it("handles multi-word topics", () => {
    expect(
      detectAvoidedTopicMentions(
        "We should revisit family dynamics carefully.",
        ["family dynamics"],
      ),
    ).toHaveLength(1);
  });

  it("ignores empty topics", () => {
    expect(
      detectAvoidedTopicMentions("Hello world", ["", "  "]),
    ).toHaveLength(0);
  });

  it("containsAvoidedTopic returns boolean view", () => {
    expect(containsAvoidedTopic("no mentions here", ["work"])).toBe(false);
    expect(containsAvoidedTopic("about work today", ["work"])).toBe(true);
  });
});
