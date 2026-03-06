import chalk from "chalk";

export const BANNER = `
${chalk.hex("#F97316")(`  ██████╗ ███████╗██╗   ██╗`)}
${chalk.hex("#F97316")(`  ██╔══██╗██╔════╝██║   ██║`)}
${chalk.hex("#F97316")(`  ██║  ██║█████╗  ██║   ██║`)}
${chalk.hex("#F97316")(`  ██║  ██║██╔══╝  ╚██╗ ██╔╝`)}
${chalk.hex("#F97316")(`  ██████╔╝███████╗ ╚████╔╝`)}
${chalk.hex("#F97316")(`  ╚═════╝ ╚══════╝  ╚═══╝`)}
${chalk.dim(`  ──────────────────────────────`)}
${chalk.white.bold(`  Audit`)} ${chalk.dim(`·`)} ${chalk.hex("#F97316")(`Optimize`)} ${chalk.dim(`·`)} ${chalk.green(`Deliver`)}
${chalk.dim(`  ──────────────────────────────`)}
`;

export function printBanner(): void {
  console.log(BANNER);
}
