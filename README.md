# hermes-temporal-context

Passive local-time awareness for companion / role-play AI agents.

The goal is simple: Hermes should naturally know whether it is morning,
afternoon, evening, or late night so it does not say things such as
“good night” at 8 AM. It should *not* constantly announce the clock time.

## Design

This package creates a tiny runtime temporal context:

```ts
{
  timezone: "Asia/Taipei",
  weekday: "Tuesday",
  localHour: 8,
  dayPart: "morning"
}
```

The context is transient. It should be regenerated for every model request,
used only for that request, and never written into chat history or long-term
memory.

Unlike a `get_current_time` tool, runtime injection cannot be forgotten by the
model. The user’s explicit statements still take precedence over temporal
inference: a person saying “I just finished a night shift and I’m going to
sleep” should not be contradicted just because it is morning.

## Transport rule: Chat Completions vs Responses / Codex

This distinction is important.

### Chat Completions-style transports

For backends that accept OpenAI-style `messages` with system roles, use
`injectTemporalContext()`. It adds one transient system message after the
stable system/persona prefix and before normal history.

```ts
const temporal = createTemporalContext({ timezone: "Asia/Taipei" });
const finalMessages = injectTemporalContext(messages, temporal);
```

### OpenAI Responses / Codex-style transports

Do **not** put the generated temporal `role: "system"` message into Responses
`input[]`. Strict Codex Responses transports may reject that shape.

Put temporal context into top-level `instructions` instead:

```ts
const temporal = createTemporalContext({ timezone: "Asia/Taipei" });

const instructions = injectTemporalContextIntoInstructions(
  personaInstructions,
  temporal
);

const request = {
  model: "gpt-5.6-luna",
  instructions,
  input: [
    { role: "user", content: "嗨，我回來了。" }
  ]
};
```

Keep persona construction and temporal-context construction separate in code,
even when the final transport combines them into the same `instructions`
field. This preserves a clean architecture and makes prompt caching easier to
reason about.

## Idempotent request-time injection

Both injection helpers are idempotent. If a retry, middleware pass, or plugin
hook applies temporal context more than once to the same request, the previous
tagged temporal block is replaced instead of duplicated.

That means:

```text
one model request -> exactly one temporal block
next model request -> regenerate a fresh temporal block
```

So a conversation can correctly cross a boundary such as 17:59 -> 18:01
without carrying stale `afternoon` context into the next turn.

## Why this approach works well for companion AI

A companion AI needs time awareness on ordinary conversational turns even when
the user never mentions time. Tool calling is therefore the wrong default: the
agent may not call the tool when it should.

The runtime instruction tells the model to:

- use time only as background awareness;
- not reveal the injected context;
- not state precise time unless the user asks;
- avoid greetings or sleep-related comments that conflict with the day part;
- let explicit user context override temporal inference.

## Day parts

```text
00:00-04:59  late_night
05:00-06:59  early_morning
07:00-10:59  morning
11:00-12:59  noon
13:00-17:59  afternoon
18:00-20:59  evening
21:00-23:59  night
```

These buckets are intentionally broad. The purpose is natural situational
awareness, not precision clock reporting.

## Timezones and fallback

Use the user’s IANA timezone when available, for example:

```text
Asia/Taipei
Asia/Tokyo
America/New_York
Europe/London
```

`createTemporalContext()` defaults to `Asia/Taipei`. Invalid requested
timezones fall back safely instead of failing the whole model request. A host
application may supply a different fallback with `fallbackTimezone` and may log
the fallback internally if desired.

```ts
const temporal = createTemporalContext({
  timezone: user.timezone,
  fallbackTimezone: "Asia/Taipei"
});
```

Do not infer the user’s time from the server machine timezone.

## Recommended Hermes integration point

Apply temporal context after persona/memory/history have been assembled but
before the provider request is sent:

```text
user message
    ↓
load persona + memory + chat history
    ↓
createTemporalContext(user.timezone)
    ↓
choose transport-aware injection
    ├─ chat-completions -> injectTemporalContext(messages, temporal)
    └─ codex_responses  -> injectTemporalContextIntoInstructions(instructions, temporal)
    ↓
model request
```

For a local Hermes customization, prefer a user-owned plugin outside the
Git-managed `hermes-agent` source tree (for example under `$HERMES_HOME/plugins/`)
so normal Hermes updates do not overwrite the integration code.

## Prompt-cache guidance

Keep the large, stable persona prompt separate from the small dynamic temporal
block in your application architecture. On transports with a dedicated
`instructions` field, append or replace only the tagged temporal block instead
of rebuilding unrelated prompt content.

## Install / build

```bash
npm install
npm run build
npm test
```

## Usage

```ts
import {
  createTemporalContext,
  injectTemporalContext,
  injectTemporalContextIntoInstructions
} from "./src/index.js";
```

See `src/example.ts` for both transport styles.

## Privacy

The module does not need location coordinates. A timezone string such as
`Asia/Taipei` is enough.

## License

MIT
