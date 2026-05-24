/**
 * Risk-branded IR guards — compile-time + runtime safety for Shell IR.
 *
 * These functions let downstream code demand specific RiskClass levels
 * at the type level. A function typed `onlyReadOps(ir: RiskBrandedIr<'R0_Read'>)`
 * cannot be called with an R2-branded IR — TypeScript rejects it at
 * compile time.
 *
 * The brand is a phantom type: at runtime the IR object is unchanged.
 */

import type { RiskBrandedIr, RiskClass, ShellIr } from './types.js'
import { classifyShellIr } from './risk.js'

// ---------------------------------------------------------------------------
// Branding / unbranding
// ---------------------------------------------------------------------------

/**
 * Brand a ShellIr with its runtime-classified RiskClass.
 *
 * Zero-allocation: returns the same object with a compile-time-only tag.
 */
export function brandShellIr(
  ir: ShellIr,
  riskClass: RiskClass,
): RiskBrandedIr<RiskClass> {
  return ir as RiskBrandedIr<typeof riskClass>
}

/**
 * Strip the brand, returning plain ShellIr.
 *
 * Use when passing to functions that don't care about risk level.
 */
export function unbrandShellIr<R extends RiskClass>(
  ir: RiskBrandedIr<R>,
): ShellIr {
  return ir as ShellIr
}

// ---------------------------------------------------------------------------
// Type guards — runtime check narrows compile-time type
// ---------------------------------------------------------------------------

/** Type guard: true iff the IR is branded R0_Read. */
export function isR0<R extends RiskClass>(
  ir: RiskBrandedIr<R>,
): ir is RiskBrandedIr<'R0_Read'> {
  return classifyShellIr(unbrandShellIr(ir)) === 'R0_Read'
}

/** Type guard: true iff the IR is branded R1_Reversible_mutation. */
export function isR1<R extends RiskClass>(
  ir: RiskBrandedIr<R>,
): ir is RiskBrandedIr<'R1_Reversible_mutation'> {
  return classifyShellIr(unbrandShellIr(ir)) === 'R1_Reversible_mutation'
}

/** Type guard: true iff the IR is branded R2_Irreversible. */
export function isR2<R extends RiskClass>(
  ir: RiskBrandedIr<R>,
): ir is RiskBrandedIr<'R2_Irreversible'> {
  return classifyShellIr(unbrandShellIr(ir)) === 'R2_Irreversible'
}

/** Type guard: true iff the IR is branded Destructive_protected. */
export function isDestructiveProtected<R extends RiskClass>(
  ir: RiskBrandedIr<R>,
): ir is RiskBrandedIr<'Destructive_protected'> {
  return classifyShellIr(unbrandShellIr(ir)) === 'Destructive_protected'
}

// ---------------------------------------------------------------------------
// Assertions — throw on mismatch
// ---------------------------------------------------------------------------

/** Assert R0; throws if the IR is not read-only. */
export function assertR0<R extends RiskClass>(
  ir: RiskBrandedIr<R>,
): RiskBrandedIr<'R0_Read'> {
  if (!isR0(ir)) {
    throw new Error(
      `Expected R0_Read command, got ${classifyShellIr(unbrandShellIr(ir))}`,
    )
  }
  return ir
}

/** Assert non-destructive (R0 or R1); throws on R2/Destructive_protected. */
export function assertNonDestructive<R extends RiskClass>(
  ir: RiskBrandedIr<R>,
): RiskBrandedIr<'R0_Read' | 'R1_Reversible_mutation'> {
  const r = classifyShellIr(unbrandShellIr(ir))
  if (r === 'R2_Irreversible' || r === 'Destructive_protected') {
    throw new Error(`Expected non-destructive command, got ${r}`)
  }
  return ir as RiskBrandedIr<'R0_Read' | 'R1_Reversible_mutation'>
}

// ---------------------------------------------------------------------------
// Narrowing helpers — extract subsets
// ---------------------------------------------------------------------------

/**
 * Narrow a branded IR to a specific risk level, or return null.
 *
 * Example:
 *   const r0 = narrowTo(ir, 'R0_Read')
 *   if (r0) { // TypeScript knows r0 is RiskBrandedIr<'R0_Read'> }
 */
export function narrowTo<R extends RiskClass, T extends RiskClass>(
  ir: RiskBrandedIr<R>,
  target: T,
): RiskBrandedIr<T> | null {
  const actual = classifyShellIr(unbrandShellIr(ir))
  return actual === target ? (ir as RiskBrandedIr<T>) : null
}
