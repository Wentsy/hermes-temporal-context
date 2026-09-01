import test from "node:test";
import assert from "node:assert/strict";
import {
  getDayPart,
  createTemporalContext,
  temporalContextInstruction
} from "../src/index.js";

test("maps hours to sensible day parts", () => {
  assert.equal(getDayPart(2), "late_night");
  assert.equal(getDayPart(6), "early_morning");
  assert.equal(getDayPart(8), "morning");
  assert.equal(getDayPart(12), "noon");
  assert.equal(getDayPart(15), "afternoon");
  assert.equal(getDayPart(19), "evening");
  assert.equal(getDayPart(23), "night");
});

test("creates Taipei context deterministically", () => {
  const context = createTemporalContext({
    timezone: "Asia/Taipei",
    now: new Date("2026-09-01T00:30:00.000Z")
  });

  assert.equal(context.localHour, 8);
  assert.equal(context.dayPart, "morning");
});

test("instruction discourages announcing the time", () => {
  const text = temporalContextInstruction({
    timezone: "Asia/Taipei",
    weekday: "Tuesday",
    localHour: 8,
    dayPart: "morning"
  });

  assert.match(text, /passive situational awareness/);
  assert.match(text, /Do not mention or reveal/);
});
