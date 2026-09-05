import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    OPENAI_API_KEY: z.string().min(1),
    SLACK_BOT_TOKEN: z.string().min(1),
    SLACK_CHANNEL_ID: z.string().min(1),
    SLACK_SIGNING_SECRET: z.string().min(1),
  },
  runtimeEnv: {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN,
    SLACK_CHANNEL_ID: process.env.SLACK_CHANNEL_ID,
    SLACK_SIGNING_SECRET: process.env.SLACK_SIGNING_SECRET,
  },
});
