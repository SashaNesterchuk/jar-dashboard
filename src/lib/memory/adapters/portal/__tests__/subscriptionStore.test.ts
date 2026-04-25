import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSubscriptionStore,
  SUBSCRIPTION_STORAGE_KEY,
} from "../subscriptionStore";
import { FakeStorage } from "./fakeStorage";

describe("createSubscriptionStore (Spec §0.5)", () => {
  let storage: FakeStorage;

  beforeEach(() => {
    storage = new FakeStorage();
  });

  it("default state is off when no storage value", () => {
    const s = createSubscriptionStore(storage);
    expect(s.getState()).toEqual({
      isPremiumActive: false,
      testSubscriptionOn: false,
    });
  });

  it("hydrates from storage on construction", () => {
    storage.setItem(SUBSCRIPTION_STORAGE_KEY, "true");
    const s = createSubscriptionStore(storage);
    expect(s.getState().isPremiumActive).toBe(true);
    expect(s.getState().testSubscriptionOn).toBe(true);
  });

  it("setTestSubscriptionOn() toggles when called with no argument", () => {
    const s = createSubscriptionStore(storage);
    s.setTestSubscriptionOn();
    expect(s.getState().testSubscriptionOn).toBe(true);
    s.setTestSubscriptionOn();
    expect(s.getState().testSubscriptionOn).toBe(false);
  });

  it("persists to storage so reload recovers state", () => {
    const s1 = createSubscriptionStore(storage);
    s1.setTestSubscriptionOn(true);
    // Simulate reload: construct a new store on the SAME storage.
    const s2 = createSubscriptionStore(storage);
    expect(s2.getState().isPremiumActive).toBe(true);
  });

  it("notifies subscribers on change and deduplicates identical writes", () => {
    const s = createSubscriptionStore(storage);
    const listener = vi.fn();
    s.subscribe(listener);
    s.setTestSubscriptionOn(true);
    s.setTestSubscriptionOn(true); // same value → no emit
    s.setTestSubscriptionOn(false);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("unsubscribe stops further notifications", () => {
    const s = createSubscriptionStore(storage);
    const listener = vi.fn();
    const off = s.subscribe(listener);
    off();
    s.setTestSubscriptionOn(true);
    expect(listener).not.toHaveBeenCalled();
  });

  it("tolerates null storage (SSR path)", () => {
    const s = createSubscriptionStore(null);
    expect(() => s.setTestSubscriptionOn(true)).not.toThrow();
    expect(s.getState().isPremiumActive).toBe(true);
  });
});
