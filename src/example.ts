import {
  createTemporalContext,
  injectTemporalContext
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

const messages = injectTemporalContext(history, context);

console.log(messages);
