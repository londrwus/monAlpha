/**
 * monAlpha Tools Plugin for OpenClaw
 *
 * Registers 13 investigation tools that call back to the monAlpha
 * Next.js API for execution. OpenClaw's LLM decides which tools
 * to call and in what order based on the active SKILL.md strategy.
 */

import { tools } from "./tools.js";

export async function register(openclaw: {
  registerTool: (tool: {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    execute: (params: Record<string, unknown>) => Promise<unknown>;
  }) => void;
}) {
  for (const tool of tools) {
    openclaw.registerTool(tool);
  }

  console.log(`[monalpha-tools] Registered ${tools.length} investigation tools`);
  console.log(`[monalpha-tools] API URL: ${process.env.MONALPHA_API_URL || "http://localhost:3000"}`);
}
