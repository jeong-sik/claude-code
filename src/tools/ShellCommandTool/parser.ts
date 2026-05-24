/**
 * Shell IR parser — converts tree-sitter's SimpleCommand[] to typed ShellIr.
 *
 * Delegates to ast.ts's parseForSecurity for the heavy parsing, then maps
 * the result to our ShellIr type. This is the single entry point for
 * string -> structured IR conversion in ShellCommandTool.
 */

import { parseForSecurity } from '../../utils/shell/bashAst.js'
import { buildShellIr, mapParseResult } from './ir-builder.js'

/**
 * Parse a raw shell command string into structured Shell IR.
 *
 * This is the canonical entry point — all other code that needs structural
 * analysis of a shell command should go through here, not directly to
 * parseForSecurity or regex-based splitCommand.
 */
export async function parseToShellIr(
  command: string,
): Promise<import('./types.js').ShellIrParseResponse> {
  const trimmed = command.trim()
  if (trimmed === '') {
    return { ok: false, error: { kind: 'empty' } }
  }

  const parsed = await parseForSecurity(command)
  return mapParseResult(parsed)
}

// Re-export pure IR helpers (separated for testability without tree-sitter)
export { getBaseCommand, getAllBaseCommands } from './ir-helpers.js'
