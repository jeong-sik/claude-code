/**
 * Shell IR types — typed AST for shell commands.
 *
 * Maps tree-sitter's SimpleCommand to a structured IR with phantom-like
 * risk classification at the type level (R0/R1/R2). Inspired by
 * Masc_exec.Shell_ir.t from masc-mcp.
 */

/** Parse mode: strict (full security) or coding (allowlisted dev tools). */
export type ShellIrMode = 'strict' | 'coding'

/** Risk classification — phantom-typed envelope equivalent. */
export type RiskClass =
  | 'R0_Read'
  | 'R1_Reversible_mutation'
  | 'R2_Irreversible'
  | 'Destructive_protected'

/** A single redirection operator + target. */
export type ShellIrRedirect = {
  op: string
  target: string
}

/** A simple command: words + env vars + redirects. */
export interface ShellIrSimple {
  kind: 'simple'
  /** Flattened argv — stage_words[i] is the i-th word. */
  stage_words: string[]
  /** Leading VAR=val assignments. */
  env_vars: Array<{ name: string; value: string }>
  /** Output/input redirects. */
  redirects: ShellIrRedirect[]
  /** Original source text. */
  text: string
}

/** A pipeline of simple commands. */
export interface ShellIrPipeline {
  kind: 'pipeline'
  stages: ShellIrSimple[]
}

/** Discriminated union: simple command or pipeline. */
export type ShellIr = ShellIrSimple | ShellIrPipeline

/** Result of parsing + classifying a shell command. */
export interface ShellIrParseResult {
  ir: ShellIr
  risk_class: RiskClass
  is_read_operation: boolean
  is_destructive: boolean
  /** Flattened words from all stages (for backward compat with flat_stage_words). */
  stage_words: string[]
}

/** Parse error — structured so callers can decide how to surface it. */
export type ShellIrParseError =
  | { kind: 'too-complex'; reason: string }
  | { kind: 'parse-unavailable' }
  | { kind: 'empty' }

export type ShellIrParseResponse =
  | { ok: true; result: ShellIrParseResult }
  | { ok: false; error: ShellIrParseError }

/** Permission gate verdict. */
export type ShellIrGateVerdict =
  | { behavior: 'allow'; reason?: string }
  | { behavior: 'deny'; reason: string }
  | { behavior: 'ask'; reason: string }

// ---------------------------------------------------------------------------
// Risk-branded types — phantom-type discipline for compile-time safety
// ---------------------------------------------------------------------------

declare const __riskBrand: unique symbol

/**
 * A ShellIr tagged at the type level with its RiskClass.
 *
 * This is a *phantom type* — the brand exists only in TypeScript's type
 * system. At runtime it is the same object as the original ShellIr.
 *
 * Usage:
 *   const branded = classifyAndBrand(ir)  // RiskBrandedIr<RiskClass>
 *   function onlyRead(ir: RiskBrandedIr<'R0_Read'>) { ... }
 */
export type RiskBrandedIr<R extends RiskClass> = ShellIr & {
  readonly [__riskBrand]: R
}

// ---------------------------------------------------------------------------
// Runtime type guard for ShellIr (used when IR is passed from external caller)
// ---------------------------------------------------------------------------

/** Validate that a value conforms to ShellIr shape at runtime. */
export function isShellIr(value: unknown): value is ShellIr {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  if (v.kind === 'simple') {
    return (
      Array.isArray(v.stage_words) &&
      v.stage_words.every(w => typeof w === 'string') &&
      Array.isArray(v.env_vars) &&
      Array.isArray(v.redirects) &&
      typeof v.text === 'string'
    )
  }
  if (v.kind === 'pipeline') {
    return (
      Array.isArray(v.stages) &&
      v.stages.every(s => isShellIr(s))
    )
  }
  return false
}
