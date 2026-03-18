#!/usr/bin/env node
import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { loginCommand } from "./commands/login.js";
import { configCommand } from "./commands/config.js";
import { uiCommand } from "./commands/ui.js";
import { chatCommand } from "./commands/chat.js";
import { setVerbose } from "../utils/logger.js";
import { printBanner } from "./banner.js";

const program = new Command();

program
  .name("dev")
  .description("AI-powered web development and SEO audit client")
  .version("1.0.0")
  .option("--verbose", "Enable debug logging")
  .hook("preAction", (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.verbose) setVerbose(true);
  });

program.addCommand(initCommand);
program.addCommand(loginCommand);
program.addCommand(configCommand);
program.addCommand(uiCommand);
program.addCommand(chatCommand);

if (process.argv.length <= 2) {
  printBanner();
  program.outputHelp();
  process.exit(0);
}

program.parse();
