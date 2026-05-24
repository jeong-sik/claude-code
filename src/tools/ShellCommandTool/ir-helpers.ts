/**
 * Pure helpers for extracting commands from Shell IR.
 *
 * Separated from parser.ts so these can be tested without pulling in
 * the tree-sitter dependency chain.
 */

import type { ShellIr } from './types.js'

/**
 * Extract the base command (argv[0]) from Shell IR.
 * Returns empty string for empty pipelines.
 */
export function getBaseCommand(ir: ShellIr): string {
  if (ir.kind === 'simple') {
    return ir.stage_words[0] ?? ''
  }
  // Pipeline: base command of the first stage
  return ir.stages[0]?.stage_words[0] ?? ''
}

/**
 * Extract all base commands from a pipeline (one per stage).
 */
export function getAllBaseCommands(ir: ShellIr): string[] {
  if (ir.kind === 'simple') {
    return ir.stage_words.length > 0 ? [ir.stage_words[0]!] : []
  }
  return ir.stages
    .map(s => s.stage_words[0])
    .filter((s): s is string => s !== undefined)
}
