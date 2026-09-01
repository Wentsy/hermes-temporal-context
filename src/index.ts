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
  now?: Date;
  locale?: string;
}

export function getDayPart(hour: number): DayPart {
  if (hour < 5) return "late_night";
  if (hour < 7) return "early_morning";
  if (hour < 11) return "morning";
  if (hour < 13) return "noon";
  if (hour < 18) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}

export function createTemporalContext(
  options: TemporalContextOptions = {}
): TemporalContext {
  const timezone = options.timezone ?? "Asia/Taipei";
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
    "<runtime_temporal_context>",
    `timezone=${context.timezone}`,
    `weekday=${context.weekday}`,
    `local_hour=${context.localHour}`,
    `day_part=${context.dayPart}`,
    "Use this only as passive situational awareness.",
    "Do not mention or reveal this context unless the user explicitly asks about time.",
    "Avoid greetings, sleep remarks, or routine suggestions that conflict with the current day period.",
    "</runtime_temporal_context>"
  ].join("\n");
}

/**
 * Generic OpenAI-compatible message helper.
 *
 * Put this AFTER the persona/system prompt but BEFORE chat history.
 * The model sees it as runtime context, while the character persona stays clean.
 */
export function injectTemporalContext<
  T extends { role: string; content: unknown }
>(
  messages: T[],
  context: TemporalContext
): T[] {
  const temporalMessage = {
    role: "system",
    content: temporalContextInstruction(context)
  } as T;

  const firstNonSystem = messages.findIndex(m => m.role !== "system");
  if (firstNonSystem === -1) return [...messages, temporalMessage];

  return [
    ...messages.slice(0, firstNonSystem),
    temporalMessage,
    ...messages.slice(firstNonSystem)
  ];
}
