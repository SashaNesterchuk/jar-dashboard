import type { StorageLike } from "../subscriptionStore";

/**
 * Minimal in-process `Storage` polyfill for tests. Behaves like
 * `localStorage` but lives in a plain `Map`, so tests can inspect and
 * reset it deterministically.
 */
export class FakeStorage implements StorageLike {
  private data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.has(key) ? (this.data.get(key) as string) : null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  clear(): void {
    this.data.clear();
  }

  get size(): number {
    return this.data.size;
  }

  dump(): Record<string, string> {
    return Object.fromEntries(this.data);
  }
}
