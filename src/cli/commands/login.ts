import { Command } from "commander";
import { loginFlow } from "../auth.js";

export const loginCommand = new Command("login")
  .description("Authenticate with Anthropic (opens browser or paste API key)")
  .action(async () => {
    const success = await loginFlow();
    if (!success) {
      process.exit(1);
    }
  });
