/**
 * Shell IR parser — converts tree-sitter's SimpleCommand[] to typed ShellIr.
 *
 * Delegates to ast.ts's parseForSecurity for the heavy parsing, then maps
 * the result to our ShellIr type. This is the single entry point for
 * string -> structured IR conversion in ShellCommandTool.
 */

import {
  parseForSecurity,
  type ParseForSecurityResult,
  type SimpleCommand,
} from '../../utils/bash/ast.js'
import type {
  ShellIr,
  ShellIrParseError,
  ShellIrParseResponse,
  ShellIrPipeline,
  ShellIrRedirect,
  ShellIrSimple,
} from './types.js'

/**
 * Parse a raw shell command string into structured Shell IR.
 *
 * This is the canonical entry point — all other code that needs structural
 * analysis of a shell command should go through here, not directly to
 * parseForSecurity or regex-based splitCommand.
 */
export async function parseToShellIr(
  command: string,
): Promise<ShellIrParseResponse> {
  const trimmed = command.trim()
  if (trimmed === '') {
    return { ok: false, error: { kind: 'empty' } }
  }

  const parsed = await parseForSecurity(command)
  return mapParseResult(parsed)
}

function mapParseResult(
  parsed: ParseForSecurityResult,
): ShellIrParseResponse {
  switch (parsed.kind) {
    case 'simple':
      return { ok: true, result: buildShellIr(parsed.commands) }
    case 'too-complex':
      return {
        ok: false,
        error: { kind: 'too-complex', reason: parsed.reason },
      }
    case 'parse-unavailable':
      return { ok: false, error: { kind: 'parse-unavailable' } }
  }
}

function buildShellIr(commands: SimpleCommand[]): {
  ir: ShellIr
  stage_words: string[]
} {
  const stages: ShellIrSimple[] = commands.map(cmd => ({
    kind: 'simple' as const,
    stage_words: [...cmd.argv],
    env_vars: cmd.envVars.map(ev => ({ name: ev.name, value: ev.value })),
    redirects: cmd.redirects.map(
      r =>
        ({
          op: r.op,
          target: r.target,
        }) satisfies ShellIrRedirect,
    ),
    text: cmd.text,
  }))

  const allStageWords = stages.flatMap(s => s.stage_words)

  if (stages.length === 1) {
    return { ir: stages[0]!, stage_words: allStageWords }
  }

  const pipeline: ShellIrPipeline = {
    kind: 'pipeline',
    stages,
  }

  return { ir: pipeline, stage_words: allStageWords }
}

// Re-export pure IR helpers (separated for testability without tree-sitter)
export { getBaseCommand, getAllBaseCommands } from './ir-helpers.js'
