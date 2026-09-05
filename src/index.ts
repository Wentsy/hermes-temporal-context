export type DayPart =
  | "late_night"
  | "early_morning"
  | "morning"
  | "noon"
  | "afternoon"
  | "evening"
  | "night";

export interface TemporalContext {
  timezone: string;
  weekday: string;
  localHour: number;
  dayPart: DayPart;
}

export interface TemporalContextOptions {
  timezone?: string;
  fallbackTimezone?: string;
  now?: Date;
  locale?: string;
}

export const DEFAULT_TIMEZONE = "Asia/Taipei";
export const TEMPORAL_CONTEXT_OPEN = "<runtime_temporal_context>";
export const TEMPORAL_CONTEXT_CLOSE = "</runtime_temporal_context>";

export function getDayPart(hour: number): DayPart {
  if (hour < 5) return "late_night";
  if (hour < 7) return "early_morning";
  if (hour < 11) return "morning";
  if (hour < 13) return "noon";
  if (hour < 18) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}

function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export function resolveTimezone(
  timezone?: string,
  fallbackTimezone: string = DEFAULT_TIMEZONE
): string {
  const requested = timezone?.trim();
  if (requested && isValidTimezone(requested)) return requested;

  const fallback = fallbackTimezone.trim();
  if (fallback && isValidTimezone(fallback)) return fallback;

  return "UTC";
}

export function createTemporalContext(
  options: TemporalContextOptions = {}
): TemporalContext {
  const timezone = resolveTimezone(
    options.timezone,
    options.fallbackTimezone ?? DEFAULT_TIMEZONE
  );
  const now = options.now ?? new Date();
  const locale = options.locale ?? "en-US";

  const hourFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    hourCycle: "h23"
  });

  const weekdayFormatter = new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    weekday: "long"
  });

  const localHour = Number(hourFormatter.format(now));

  return {
    timezone,
    weekday: weekdayFormatter.format(now),
    localHour,
    dayPart: getDayPart(localHour)
  };
}

/**
 * This is deliberately concise.
 * It gives the model enough temporal awareness to avoid contextually
 * wrong greetings, while discouraging it from announcing the time.
 */
export function temporalContextInstruction(
  context: TemporalContext
): string {
  return [
    TEMPORAL_CONTEXT_OPEN,
    `timezone=${context.timezone}`,
    `weekday=${context.weekday}`,
    `local_hour=${context.localHour}`,
    `day_part=${context.dayPart}`,
    "Use this only as passive situational awareness.",
    "Do not mention or reveal this context unless the user explicitly asks about time.",
    "Avoid greetings, sleep remarks, or routine suggestions that conflict with the current day period.",
    "Explicit user context overrides temporal inference (for example, night-shift sleep schedules).",
    TEMPORAL_CONTEXT_CLOSE
  ].join("\n");
}

function isTemporalContextSystemMessage(message: {
  role: string;
  content: unknown;
}): boolean {
  return (
    message.role === "system" &&
    typeof message.content === "string" &&
    message.content.includes(TEMPORAL_CONTEXT_OPEN) &&
    message.content.includes(TEMPORAL_CONTEXT_CLOSE)
  );
}

/**
 * Remove tagged temporal blocks from a string. This makes request-time
 * injection idempotent: retries or repeated hooks replace the old block
 * instead of stacking another copy on top of it.
 */
export function stripTemporalContextFromText(value: string): string {
  let result = value;

  while (true) {
    const start = result.indexOf(TEMPORAL_CONTEXT_OPEN);
    if (start === -1) break;

    const closeStart = result.indexOf(TEMPORAL_CONTEXT_CLOSE, start);
    if (closeStart === -1) break;

    const end = closeStart + TEMPORAL_CONTEXT_CLOSE.length;
    result = result.slice(0, start) + result.slice(end);
  }

  return result.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * For OpenAI Responses / Codex-style transports, temporal context belongs in
 * top-level `instructions`, not in `input[]` as a `role: "system"` message.
 * Existing tagged temporal context is replaced so repeated application stays
 * at exactly one block per request.
 */
export function injectTemporalContextIntoInstructions(
  instructions: string,
  context: TemporalContext
): string {
  const base = stripTemporalContextFromText(instructions);
  const temporal = temporalContextInstruction(context);
  return base ? `${base}\n\n${temporal}` : temporal;
}

/**
 * Generic chat-completions message helper.
 *
 * Put this AFTER the persona/system prompt but BEFORE chat history.
 * The model sees it as runtime context, while the character persona stays clean.
 *
 * Do NOT send this generated system message inside OpenAI Responses / Codex
 * `input[]`; use injectTemporalContextIntoInstructions() for that transport.
 */
export function injectTemporalContext<
  T extends { role: string; content: unknown }
>(
  messages: T[],
  context: TemporalContext
): T[] {
  const withoutOldTemporal = messages.filter(
    message => !isTemporalContextSystemMessage(message)
  );

  const temporalMessage = {
    role: "system",
    content: temporalContextInstruction(context)
  } as T;

  const firstNonSystem = withoutOldTemporal.findIndex(
    message => message.role !== "system"
  );

  if (firstNonSystem === -1) {
    return [...withoutOldTemporal, temporalMessage];
  }

  return [
    ...withoutOldTemporal.slice(0, firstNonSystem),
    temporalMessage,
    ...withoutOldTemporal.slice(firstNonSystem)
  ];
}
