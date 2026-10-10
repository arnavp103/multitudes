#!/usr/bin/env node

/**
 * Returns concise usage information for the multitudes command.
 */
const getHelpText = (): string =>
  "Usage: multitudes <command>\n\nCommands:\n  help  Show this help message";

const [command] = process.argv.slice(2);

if (command === undefined || command === "help") {
  console.log(getHelpText());
} else {
  console.error(`Unknown command: ${command}`);
  console.error(getHelpText());
  process.exitCode = 1;
}
