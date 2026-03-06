import chalk from "chalk";

let verbose = false;

export function setVerbose(v: boolean) {
  verbose = v;
}

export const log = {
  info: (msg: string) => console.log(chalk.blue("i"), msg),
  success: (msg: string) => console.log(chalk.green("v"), msg),
  warn: (msg: string) => console.log(chalk.yellow("!"), msg),
  error: (msg: string) => console.error(chalk.red("x"), msg),
  debug: (msg: string) => {
    if (verbose) console.log(chalk.gray("~"), chalk.gray(msg));
  },
  step: (label: string, msg: string) =>
    console.log(chalk.hex("#F97316")(`[${label}]`), msg),
};
