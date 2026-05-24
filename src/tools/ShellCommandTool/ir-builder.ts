/**
 * Pure mapping from parse-for-security shapes to ShellIr.
 *
 * This module has ZERO runtime dependencies on tree-sitter, bun:bundle,
 * or any other bundler-gated code. It accepts plain objects and produces
 * typed ShellIr, making it fully testable in any environment.
 */

import type {
  ShellIr,
  ShellIrParseError,
  ShellIrParseResponse,
  ShellIrPipeline,
  ShellIrRedirect,
  ShellIrSimple,
} from './types.js'

/**
 * Shape-compatible input for buildShellIr.
 * Mirrors ast.ts's SimpleCommand but uses structural typing so no
 * import from ast.ts (and its bun:bundle chain) is required.
 */
export interface SimpleCommandInput {
  argv: string[]
  envVars: Array<{ name: string; value: string }>
  redirects: Array<{ op: string; target: string; fd?: number }>
  text: string
}

/**
 * Shape-compatible input for mapParseResult.
 * Mirrors ast.ts's ParseForSecurityResult.
 */
export type ParseForSecurityInput =
  | { kind: 'simple'; commands: SimpleCommandInput[] }
  | { kind: 'too-complex'; reason: string; nodeType?: string }
  | { kind: 'parse-unavailable' }

/**
 * Map a parse-for-security result into a ShellIr parse response.
 */
export function mapParseResult(
  parsed: ParseForSecurityInput,
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

/**
 * Build ShellIr from an array of simple commands.
 */
export function buildShellIr(commands: SimpleCommandInput[]): {
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
          op: r.op as ShellIrRedirect['op'],
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
