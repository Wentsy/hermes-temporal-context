import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_TIMEZONE,
  TEMPORAL_CONTEXT_OPEN,
  createTemporalContext,
  getDayPart,
  injectTemporalContext,
  injectTemporalContextIntoInstructions,
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

test("falls back when timezone is invalid", () => {
  const context = createTemporalContext({
    timezone: "Asia/InvalidCity",
    now: new Date("2026-09-01T00:30:00.000Z")
  });

  assert.equal(context.timezone, DEFAULT_TIMEZONE);
  assert.equal(context.localHour, 8);
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
  assert.match(text, /Explicit user context overrides temporal inference/);
});

test("chat message injection is idempotent and refreshes the block", () => {
  const messages = [
    { role: "system", content: "You are Hermes." },
    { role: "user", content: "Hello" }
  ];

  const morning = {
    timezone: "Asia/Taipei",
    weekday: "Tuesday",
    localHour: 8,
    dayPart: "morning" as const
  };
  const evening = {
    timezone: "Asia/Taipei",
    weekday: "Tuesday",
    localHour: 18,
    dayPart: "evening" as const
  };

  const once = injectTemporalContext(messages, morning);
  const twice = injectTemporalContext(once, evening);
  const temporalMessages = twice.filter(
    message =>
      message.role === "system" &&
      typeof message.content === "string" &&
      message.content.includes(TEMPORAL_CONTEXT_OPEN)
  );

  assert.equal(temporalMessages.length, 1);
  assert.match(String(temporalMessages[0]?.content), /local_hour=18/);
  assert.doesNotMatch(String(temporalMessages[0]?.content), /local_hour=8\n/);
});

test("Responses instructions injection is idempotent", () => {
  const morning = {
    timezone: "Asia/Taipei",
    weekday: "Tuesday",
    localHour: 8,
    dayPart: "morning" as const
  };
  const night = {
    timezone: "Asia/Taipei",
    weekday: "Tuesday",
    localHour: 23,
    dayPart: "night" as const
  };

  const once = injectTemporalContextIntoInstructions(
    "You are a helpful assistant.",
    morning
  );
  const twice = injectTemporalContextIntoInstructions(once, night);

  assert.equal(twice.split(TEMPORAL_CONTEXT_OPEN).length - 1, 1);
  assert.match(twice, /You are a helpful assistant\./);
  assert.match(twice, /local_hour=23/);
  assert.doesNotMatch(twice, /local_hour=8\n/);
});
