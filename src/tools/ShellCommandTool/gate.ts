/**
 * Risk-class based permission gate for ShellCommandTool.
 *
 * Replaces the 25+ regex validators in bashSecurity.ts with a typed,
 * single-source-of-truth gate that uses the RiskClass from Shell IR
 * classification.
 *
 * Ported from masc-mcp's Keeper_shell_ir.gate_verdict_map concept.
 */

import type {
  RiskClass,
  ShellIrGateVerdict,
  ShellIrMode,
} from './types.js'

/**
 * Evaluate a permission gate for a classified shell command.
 *
 * @param riskClass — the classified risk of the command
 * @param mode — 'strict' (full security) or 'coding' (allowlisted dev tools)
 * @param isInSandbox — whether the command runs in a sandboxed environment
 * @returns gate verdict: allow / deny / ask
 */
export function evaluateGate(
  riskClass: RiskClass,
  mode: ShellIrMode,
  isInSandbox: boolean,
): ShellIrGateVerdict {
  // Sandbox relaxes the gate — sandboxed commands are lower risk
  // because filesystem mutations are contained.
  if (isInSandbox) {
    // In sandbox: R0 and R1 are allowed without prompt.
    // R2 still asks (destructive within sandbox is still destructive).
    // Destructive_protected still asks.
    switch (riskClass) {
      case 'R0_Read':
        return { behavior: 'allow' }
      case 'R1_Reversible_mutation':
        return { behavior: 'allow', reason: 'sandboxed' }
      case 'R2_Irreversible':
        return {
          behavior: 'ask',
          reason:
            'This command performs irreversible operations even within the sandbox.',
        }
      case 'Destructive_protected':
        return {
          behavior: 'ask',
          reason:
            'This command targets protected resources and is destructive.',
        }
    }
  }

  // Non-sandboxed: stricter gate
  switch (mode) {
    case 'strict':
      return evaluateStrictGate(riskClass)
    case 'coding':
      return evaluateCodingGate(riskClass)
  }
}

function evaluateStrictGate(riskClass: RiskClass): ShellIrGateVerdict {
  switch (riskClass) {
    case 'R0_Read':
      return { behavior: 'allow' }
    case 'R1_Reversible_mutation':
      return {
        behavior: 'ask',
        reason: 'This command may modify files outside the sandbox.',
      }
    case 'R2_Irreversible':
      return {
        behavior: 'ask',
        reason:
          'This command performs irreversible file operations without sandbox protection.',
      }
    case 'Destructive_protected':
      return {
        behavior: 'ask',
        reason:
          'This command is destructive and may target protected resources.',
      }
  }
}

function evaluateCodingGate(riskClass: RiskClass): ShellIrGateVerdict {
  // Coding mode allows more dev-tool mutations without prompting
  // (e.g., npm install, cargo build, dune build).
  switch (riskClass) {
    case 'R0_Read':
      return { behavior: 'allow' }
    case 'R1_Reversible_mutation':
      // Coding mode auto-allows reversible mutations (typical dev workflow)
      return { behavior: 'allow', reason: 'coding mode' }
    case 'R2_Irreversible':
      return {
        behavior: 'ask',
        reason:
          'This command performs irreversible operations without sandbox protection.',
      }
    case 'Destructive_protected':
      return {
        behavior: 'ask',
        reason:
          'This command is destructive and may target protected resources.',
      }
  }
}
