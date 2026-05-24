/**
 * Branded-guard tests — prove that RiskBrandedIr provides both runtime
 * and compile-time safety.
 *
 * Coverage: brand/unbrand, type guards (isR0/isR1/isR2/isDestructiveProtected),
 * assertions (assertR0/assertNonDestructive), narrowing (narrowTo).
 */

import { describe, expect, test } from 'bun:test'
import {
  brandShellIr,
  unbrandShellIr,
  isR0,
  isR1,
  isR2,
  isDestructiveProtected,
  assertR0,
  assertNonDestructive,
  narrowTo,
} from '../branded-guards.js'
import { classifyAndBrand, classifyShellIr } from '../risk.js'
import type { RiskBrandedIr, RiskClass, ShellIr } from '../types.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const catIr: ShellIr = { kind: 'simple', stage_words: ['cat', 'file.txt'], env_vars: [], redirects: [], text: 'cat file.txt' }
const cpIr: ShellIr = { kind: 'simple', stage_words: ['cp', 'a', 'b'], env_vars: [], redirects: [], text: 'cp a b' }
const rmIr: ShellIr = { kind: 'simple', stage_words: ['rm', 'file.txt'], env_vars: [], redirects: [], text: 'rm file.txt' }
const rmRfIr: ShellIr = { kind: 'simple', stage_words: ['rm', '-rf', '/'], env_vars: [], redirects: [], text: 'rm -rf /' }

// ---------------------------------------------------------------------------
// brand / unbrand round-trip
// ---------------------------------------------------------------------------

describe('brandShellIr / unbrandShellIr', () => {
  test('branding returns the same object (zero allocation)', () => {
    const branded = brandShellIr(catIr, 'R0_Read')
    expect(unbrandShellIr(branded)).toBe(catIr)
  })

  test('classifyAndBrand produces a branded IR matching classifyShellIr', () => {
    const branded = classifyAndBrand(catIr)
    expect(classifyShellIr(unbrandShellIr(branded))).toBe('R0_Read')
  })
})

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

describe('isR0', () => {
  test('cat → true', () => {
    const b = classifyAndBrand(catIr)
    expect(isR0(b)).toBe(true)
  })

  test('cp → false', () => {
    const b = classifyAndBrand(cpIr)
    expect(isR0(b)).toBe(false)
  })
})

describe('isR1', () => {
  test('cp → true', () => {
    const b = classifyAndBrand(cpIr)
    expect(isR1(b)).toBe(true)
  })

  test('cat → false', () => {
    const b = classifyAndBrand(catIr)
    expect(isR1(b)).toBe(false)
  })
})

describe('isR2', () => {
  test('rm → true', () => {
    const b = classifyAndBrand(rmIr)
    expect(isR2(b)).toBe(true)
  })

  test('cat → false', () => {
    const b = classifyAndBrand(catIr)
    expect(isR2(b)).toBe(false)
  })
})

describe('isDestructiveProtected', () => {
  test('rm -rf / → true', () => {
    const b = classifyAndBrand(rmRfIr)
    expect(isDestructiveProtected(b)).toBe(true)
  })

  test('rm → false', () => {
    const b = classifyAndBrand(rmIr)
    expect(isDestructiveProtected(b)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

describe('assertR0', () => {
  test('cat passes', () => {
    const b = classifyAndBrand(catIr)
    const r0 = assertR0(b)
    expect(r0).toBeDefined()
  })

  test('rm throws', () => {
    const b = classifyAndBrand(rmIr)
    expect(() => assertR0(b)).toThrow('Expected R0_Read command, got R2_Irreversible')
  })
})

describe('assertNonDestructive', () => {
  test('cat passes (R0)', () => {
    const b = classifyAndBrand(catIr)
    expect(() => assertNonDestructive(b)).not.toThrow()
  })

  test('cp passes (R1)', () => {
    const b = classifyAndBrand(cpIr)
    expect(() => assertNonDestructive(b)).not.toThrow()
  })

  test('rm throws (R2)', () => {
    const b = classifyAndBrand(rmIr)
    expect(() => assertNonDestructive(b)).toThrow('Expected non-destructive command, got R2_Irreversible')
  })

  test('rm -rf throws (Destructive_protected)', () => {
    const b = classifyAndBrand(rmRfIr)
    expect(() => assertNonDestructive(b)).toThrow('Expected non-destructive command, got Destructive_protected')
  })
})

// ---------------------------------------------------------------------------
// Narrowing
// ---------------------------------------------------------------------------

describe('narrowTo', () => {
  test('cat narrowed to R0 → returns branded R0', () => {
    const b = classifyAndBrand(catIr)
    const narrowed = narrowTo(b, 'R0_Read')
    expect(narrowed).not.toBeNull()
    expect(unbrandShellIr(narrowed!)).toBe(catIr)
  })

  test('cat narrowed to R1 → null', () => {
    const b = classifyAndBrand(catIr)
    const narrowed = narrowTo(b, 'R1_Reversible_mutation')
    expect(narrowed).toBeNull()
  })
})
