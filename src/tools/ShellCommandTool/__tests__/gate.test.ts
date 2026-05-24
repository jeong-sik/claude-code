/**
 * Permission gate tests — proves typed gate behavior for each
 * RiskClass × Mode × Sandbox combination.
 */

import { describe, expect, test } from 'bun:test'
import { evaluateGate } from '../gate.js'
import type { RiskClass, ShellIrMode } from '../types.js'

type GateTestCase = {
  riskClass: RiskClass
  mode: ShellIrMode
  sandbox: boolean
  expectedBehavior: 'allow' | 'deny' | 'ask'
}

const GATE_CASES: GateTestCase[] = [
  // R0 — always allowed
  { riskClass: 'R0_Read', mode: 'strict', sandbox: false, expectedBehavior: 'allow' },
  { riskClass: 'R0_Read', mode: 'strict', sandbox: true, expectedBehavior: 'allow' },
  { riskClass: 'R0_Read', mode: 'coding', sandbox: false, expectedBehavior: 'allow' },
  { riskClass: 'R0_Read', mode: 'coding', sandbox: true, expectedBehavior: 'allow' },

  // R1 + strict + no sandbox → ask
  { riskClass: 'R1_Reversible_mutation', mode: 'strict', sandbox: false, expectedBehavior: 'ask' },
  // R1 + strict + sandbox → allow (sandboxed)
  { riskClass: 'R1_Reversible_mutation', mode: 'strict', sandbox: true, expectedBehavior: 'allow' },
  // R1 + coding + no sandbox → allow (coding mode)
  { riskClass: 'R1_Reversible_mutation', mode: 'coding', sandbox: false, expectedBehavior: 'allow' },
  // R1 + coding + sandbox → allow
  { riskClass: 'R1_Reversible_mutation', mode: 'coding', sandbox: true, expectedBehavior: 'allow' },

  // R2 — always ask (destructive)
  { riskClass: 'R2_Irreversible', mode: 'strict', sandbox: false, expectedBehavior: 'ask' },
  { riskClass: 'R2_Irreversible', mode: 'strict', sandbox: true, expectedBehavior: 'ask' },
  { riskClass: 'R2_Irreversible', mode: 'coding', sandbox: false, expectedBehavior: 'ask' },
  { riskClass: 'R2_Irreversible', mode: 'coding', sandbox: true, expectedBehavior: 'ask' },

  // Destructive_protected — always ask
  { riskClass: 'Destructive_protected', mode: 'strict', sandbox: false, expectedBehavior: 'ask' },
  { riskClass: 'Destructive_protected', mode: 'strict', sandbox: true, expectedBehavior: 'ask' },
  { riskClass: 'Destructive_protected', mode: 'coding', sandbox: false, expectedBehavior: 'ask' },
  { riskClass: 'Destructive_protected', mode: 'coding', sandbox: true, expectedBehavior: 'ask' },
]

describe('evaluateGate', () => {
  for (const { riskClass, mode, sandbox, expectedBehavior } of GATE_CASES) {
    test(`${riskClass} + ${mode} + sandbox=${sandbox} → ${expectedBehavior}`, () => {
      const result = evaluateGate(riskClass, mode, sandbox)
      expect(result.behavior).toBe(expectedBehavior)
    })
  }
})
