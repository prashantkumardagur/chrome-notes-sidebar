import { describe, expect, it } from "vitest";
import { relativeTime } from "../../src/lib/util/time";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const NOW = new Date("2026-07-16T12:00:00Z").getTime();

describe("relativeTime", () => {
  it("shows 'just now' under a minute", () => {
    expect(relativeTime(NOW, NOW)).toBe("just now");
    expect(relativeTime(NOW - 59 * SECOND, NOW)).toBe("just now");
  });

  it("shows minutes, singular and plural", () => {
    expect(relativeTime(NOW - MINUTE, NOW)).toBe("1 minute ago");
    expect(relativeTime(NOW - 5 * MINUTE, NOW)).toBe("5 minutes ago");
  });

  it("shows hours, singular and plural", () => {
    expect(relativeTime(NOW - HOUR, NOW)).toBe("1 hour ago");
    expect(relativeTime(NOW - 3 * HOUR, NOW)).toBe("3 hours ago");
  });

  it("shows days up to a week", () => {
    expect(relativeTime(NOW - DAY, NOW)).toBe("1 day ago");
    expect(relativeTime(NOW - 6 * DAY, NOW)).toBe("6 days ago");
  });

  it("falls back to a locale date beyond a week", () => {
    const old = NOW - 30 * DAY;
    expect(relativeTime(old, NOW)).toBe(new Date(old).toLocaleDateString());
  });
});
