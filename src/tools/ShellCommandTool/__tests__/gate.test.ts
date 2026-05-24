/**
 * Permission gate tests — exhaustive proof of the 16-cell permission matrix.
 *
 * Coverage: 4 RiskClass × 2 Mode × 2 Sandbox = 16 deterministic verdicts.
 * Every cell asserts both behavior AND reason, leaving zero ambiguity.
 */

import { describe, expect, test } from 'bun:test'
import { evaluateGate } from '../gate.js'
import type { RiskClass, ShellIrMode } from '../types.js'

// ---------------------------------------------------------------------------
// 16-cell exhaustive matrix
// ---------------------------------------------------------------------------

type GateCase = {
  riskClass: RiskClass
  mode: ShellIrMode
  sandbox: boolean
  expectedBehavior: 'allow' | 'ask'
  expectedReason?: string
}

const ALL_CASES: GateCase[] = [
  // ── R0_Read ──────────────────────────────────────────────────────────────
  { riskClass: 'R0_Read', mode: 'strict', sandbox: false, expectedBehavior: 'allow' },
  { riskClass: 'R0_Read', mode: 'strict', sandbox: true,  expectedBehavior: 'allow' },
  { riskClass: 'R0_Read', mode: 'coding', sandbox: false, expectedBehavior: 'allow' },
  { riskClass: 'R0_Read', mode: 'coding', sandbox: true,  expectedBehavior: 'allow' },

  // ── R1_Reversible_mutation ──────────────────────────────────────────────
  { riskClass: 'R1_Reversible_mutation', mode: 'strict', sandbox: false, expectedBehavior: 'ask', expectedReason: 'This command may modify files outside the sandbox.' },
  { riskClass: 'R1_Reversible_mutation', mode: 'strict', sandbox: true,  expectedBehavior: 'allow', expectedReason: 'sandboxed' },
  { riskClass: 'R1_Reversible_mutation', mode: 'coding', sandbox: false, expectedBehavior: 'allow', expectedReason: 'coding mode' },
  { riskClass: 'R1_Reversible_mutation', mode: 'coding', sandbox: true,  expectedBehavior: 'allow', expectedReason: 'sandboxed' },

  // ── R2_Irreversible ─────────────────────────────────────────────────────
  { riskClass: 'R2_Irreversible', mode: 'strict', sandbox: false, expectedBehavior: 'ask', expectedReason: 'This command performs irreversible file operations without sandbox protection.' },
  { riskClass: 'R2_Irreversible', mode: 'strict', sandbox: true,  expectedBehavior: 'ask', expectedReason: 'This command performs irreversible operations even within the sandbox.' },
  { riskClass: 'R2_Irreversible', mode: 'coding', sandbox: false, expectedBehavior: 'ask', expectedReason: 'This command performs irreversible operations without sandbox protection.' },
  { riskClass: 'R2_Irreversible', mode: 'coding', sandbox: true,  expectedBehavior: 'ask', expectedReason: 'This command performs irreversible operations even within the sandbox.' },

  // ── Destructive_protected ───────────────────────────────────────────────
  { riskClass: 'Destructive_protected', mode: 'strict', sandbox: false, expectedBehavior: 'ask', expectedReason: 'This command is destructive and may target protected resources.' },
  { riskClass: 'Destructive_protected', mode: 'strict', sandbox: true,  expectedBehavior: 'ask', expectedReason: 'This command targets protected resources and is destructive.' },
  { riskClass: 'Destructive_protected', mode: 'coding', sandbox: false, expectedBehavior: 'ask', expectedReason: 'This command is destructive and may target protected resources.' },
  { riskClass: 'Destructive_protected', mode: 'coding', sandbox: true,  expectedBehavior: 'ask', expectedReason: 'This command targets protected resources and is destructive.' },
]

if (ALL_CASES.length !== 16) {
  throw new Error(`Expected 16 gate cases, got ${ALL_CASES.length}`)
}

// ---------------------------------------------------------------------------
// Per-cell tests
// ---------------------------------------------------------------------------

describe('evaluateGate — 16-cell exhaustive matrix', () => {
  for (const { riskClass, mode, sandbox, expectedBehavior, expectedReason } of ALL_CASES) {
    const label = `${riskClass} | ${mode} | sandbox=${sandbox} → ${expectedBehavior}`

    test(label, () => {
      const result = evaluateGate(riskClass, mode, sandbox)
      expect(result.behavior).toBe(expectedBehavior)
      if (expectedReason !== undefined) {
        expect(result.reason).toBe(expectedReason)
      }
    })
  }
})

// ---------------------------------------------------------------------------
// Structural properties
// ---------------------------------------------------------------------------

describe('evaluateGate — structural invariants', () => {
  test('sandbox isolates R1 from mode differences (strict vs coding both allow)', () => {
    const strict = evaluateGate('R1_Reversible_mutation', 'strict', true)
    const coding = evaluateGate('R1_Reversible_mutation', 'coding', true)
    expect(strict.behavior).toBe('allow')
    expect(coding.behavior).toBe('allow')
    expect(strict.reason).toBe('sandboxed')
    expect(coding.reason).toBe('sandboxed')
  })

  test('no sandbox + strict is the most restrictive policy', () => {
    expect(evaluateGate('R0_Read', 'strict', false).behavior).toBe('allow')
    expect(evaluateGate('R1_Reversible_mutation', 'strict', false).behavior).toBe('ask')
    expect(evaluateGate('R2_Irreversible', 'strict', false).behavior).toBe('ask')
    expect(evaluateGate('Destructive_protected', 'strict', false).behavior).toBe('ask')
  })

  test('no sandbox + coding allows R0 and R1 only', () => {
    expect(evaluateGate('R0_Read', 'coding', false).behavior).toBe('allow')
    expect(evaluateGate('R1_Reversible_mutation', 'coding', false).behavior).toBe('allow')
    expect(evaluateGate('R2_Irreversible', 'coding', false).behavior).toBe('ask')
    expect(evaluateGate('Destructive_protected', 'coding', false).behavior).toBe('ask')
  })

  test('destructive risks are always gated regardless of mode or sandbox', () => {
    for (const mode of ['strict', 'coding'] as ShellIrMode[]) {
      for (const sandbox of [false, true]) {
        expect(evaluateGate('R2_Irreversible', mode, sandbox).behavior).toBe('ask')
        expect(evaluateGate('Destructive_protected', mode, sandbox).behavior).toBe('ask')
      }
    }
  })

  test('R0 is always allowed regardless of mode or sandbox', () => {
    for (const mode of ['strict', 'coding'] as ShellIrMode[]) {
      for (const sandbox of [false, true]) {
        expect(evaluateGate('R0_Read', mode, sandbox).behavior).toBe('allow')
      }
    }
  })
})
