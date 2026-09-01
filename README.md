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

It then inserts a short runtime-only system message immediately after the
character/persona system prompt.

This keeps the character prompt clean while making temporal awareness
deterministic on every turn. Unlike a `get_current_time` tool, the model
cannot forget to call it.

## Why this approach works well for companion AI

A companion AI needs time awareness on almost every conversational turn,
even when the user never mentions time. Tool calling is therefore the
wrong default: the agent may not call the tool when it should.

Runtime injection is cheap, reliable, and passive.

The instruction explicitly tells the model:

- use time only as background awareness;
- do not reveal the injected context;
- do not state the time unless the user asks;
- avoid greetings or sleep-related comments that conflict with the day part.

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
  injectTemporalContext
} from "./src/index.js";

const messages = [
  {
    role: "system",
    content: "You are Hermes, a warm companion AI. Stay in character."
  },
  {
    role: "user",
    content: "嗨，我回來了。"
  }
];

const temporal = createTemporalContext({
  timezone: "Asia/Taipei"
});

const finalMessages = injectTemporalContext(messages, temporal);

// Send finalMessages to your OpenAI-compatible chat-completions backend.
```

## Recommended integration point

Apply `injectTemporalContext()` immediately before sending the request to
the model provider:

```text
user message
    ↓
load persona + memory + chat history
    ↓
createTemporalContext(user.timezone)
    ↓
injectTemporalContext(messages, temporal)
    ↓
model request
```

If your app knows the user's IANA timezone, pass it directly. Otherwise
use a configured fallback such as `Asia/Taipei`.

## Privacy

The module does not need location coordinates. A timezone string such as
`Asia/Taipei` is enough.

## License

MIT
