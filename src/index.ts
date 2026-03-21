#!/usr/bin/env node
/**
 * Desktop Claude Code – Browser Link CLI
 *
 * Commands:
 *   link    Generate a link token, start local server, and open the browser link
 *   status  Show the currently saved linked session (if any)
 *   unlink  Remove the saved linked session
 */

import {
  generateLinkToken,
  startLinkServer,
  openBrowserLink,
  saveLinkSession,
  loadLinkSession,
  removeLinkSession,
  getSessionFilePath,
  DEFAULT_LINK_PORT,
  LinkSession,
} from "./link";

// ---------------------------------------------------------------------------
// CLI helpers
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.log(`
Claude Code – Browser Link

Usage:
  claude-link <command> [options]

Commands:
  link    Link this desktop session with a browser Claude Code session
  status  Show the currently linked session
  unlink  Remove the linked session credentials

Options:
  --port <number>   Port for the local callback server (default: ${DEFAULT_LINK_PORT})
  --help            Show this help message
`);
}

function parseArgs(argv: string[]): { command: string; port: number } {
  const args = argv.slice(2); // remove "node" and script path
  let command = "";
  let port = DEFAULT_LINK_PORT;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--port" && i + 1 < args.length) {
      const parsed = parseInt(args[++i], 10);
      if (!isNaN(parsed) && parsed > 0 && parsed < 65536) {
        port = parsed;
      } else {
        console.error("Invalid port number, using default:", DEFAULT_LINK_PORT);
      }
    } else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else if (!arg.startsWith("--")) {
      command = arg;
    }
  }

  return { command, port };
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function commandLink(port: number): Promise<void> {
  console.log("Starting link flow…");

  // 1. Generate a secure token
  const token = generateLinkToken();
  console.log(`Generated link token: ${token.slice(0, 8)}…`);

  // 2. Start the local callback server (non-blocking, returns a promise)
  console.log(`Starting local callback server on port ${port}…`);
  const callbackPromise = startLinkServer(port, token);

  // 3. Open (or display) the browser link
  await openBrowserLink(token, port);

  console.log(`Waiting for browser callback on http://localhost:${port}/callback …`);
  console.log("(This will time out after 5 minutes if no callback is received.)\n");

  // 4. Race the callback against a 5-minute timeout
  const TIMEOUT_MS = 5 * 60 * 1000;
  const timeoutPromise = new Promise<{ success: false; error: string }>((resolve) =>
    setTimeout(
      () => resolve({ success: false, error: "Timed out waiting for browser callback." }),
      TIMEOUT_MS
    )
  );

  const result = await Promise.race([callbackPromise, timeoutPromise]);

  if (!result.success) {
    console.error("\nLink failed:", result.error);
    process.exit(1);
  }

  const session = result.session as LinkSession;

  // 5. Save session
  saveLinkSession(session);

  console.log("\nLink successful!");
  console.log(`  Session ID : ${session.sessionId}`);
  if (session.userInfo?.email) {
    console.log(`  Email      : ${session.userInfo.email}`);
  }
  if (session.userInfo?.displayName) {
    console.log(`  Name       : ${session.userInfo.displayName}`);
  }
  console.log(`  Linked at  : ${session.linkedAt}`);
  if (session.expiresAt) {
    console.log(`  Expires at : ${session.expiresAt}`);
  }
  console.log(`\nSession saved to: ${getSessionFilePath()}`);
}

function commandStatus(): void {
  const session = loadLinkSession();

  if (!session) {
    console.log("No linked session found.");
    console.log(`(Expected location: ${getSessionFilePath()})`);
    console.log('\nRun "claude-link link" to create a new link.');
    return;
  }

  console.log("Linked session found:\n");
  console.log(`  Session ID : ${session.sessionId}`);
  if (session.userInfo?.email) {
    console.log(`  Email      : ${session.userInfo.email}`);
  }
  if (session.userInfo?.displayName) {
    console.log(`  Name       : ${session.userInfo.displayName}`);
  }
  console.log(`  Linked at  : ${session.linkedAt}`);
  if (session.expiresAt) {
    const expiresDate = new Date(session.expiresAt);
    const isExpired = expiresDate < new Date();
    console.log(`  Expires at : ${session.expiresAt}${isExpired ? " (EXPIRED)" : ""}`);
  }
  console.log(`  Token      : ${session.token.slice(0, 8)}…`);
  console.log(`\nFile: ${getSessionFilePath()}`);
}

function commandUnlink(): void {
  const session = loadLinkSession();

  if (!session) {
    console.log("No linked session to remove.");
    return;
  }

  removeLinkSession();
  console.log("Linked session removed.");
  console.log(`  Removed session ID: ${session.sessionId}`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { command, port } = parseArgs(process.argv);

  switch (command) {
    case "link":
      await commandLink(port);
      break;

    case "status":
      commandStatus();
      break;

    case "unlink":
      commandUnlink();
      break;

    case "":
    case "help":
      printUsage();
      break;

    default:
      console.error(`Unknown command: "${command}"`);
      printUsage();
      process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error("Fatal error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
