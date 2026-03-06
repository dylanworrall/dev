import { Command } from "commander";
import { loadConfig } from "../../config/loader.js";
import { log } from "../../utils/logger.js";

export const configCommand = new Command("config")
  .description("View current configuration")
  .action(async () => {
    const config = await loadConfig();
    log.info("Current configuration:");
    console.log(JSON.stringify(config, null, 2));
  });
