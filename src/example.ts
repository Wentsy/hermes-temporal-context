import {
  createTemporalContext,
  injectTemporalContext,
  injectTemporalContextIntoInstructions
} from "./index.js";

const persona = {
  role: "system",
  content: "You are Hermes, a warm companion AI. Stay in character."
};

const history = [
  persona,
  { role: "user", content: "嗨，我回來了。" }
];

const context = createTemporalContext({
  timezone: "Asia/Taipei"
});

// Chat Completions-style transports: add one transient system message.
const messages = injectTemporalContext(history, context);
console.log(messages);

// OpenAI Responses / Codex-style transports: keep system messages out of input[].
const instructions = injectTemporalContextIntoInstructions(
  "You are Hermes, a warm companion AI. Stay in character.",
  context
);
const input = [{ role: "user", content: "嗨，我回來了。" }];
console.log({ instructions, input });
