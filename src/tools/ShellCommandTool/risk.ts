/**
 * Risk classification for Shell IR — ported from masc-mcp's
 * Shell_ir_risk.classify + Exec_policy_mutation_classifier.
 *
 * Maps flattened stage words to RiskClass (R0/R1/R2/Destructive_protected).
 * This is the typed replacement for the 25+ regex validators in
 * shellSecurity.ts.
 */

import type { RiskBrandedIr, RiskClass, ShellIr } from './types.js'
import { getBaseCommand, getAllBaseCommands } from './parser.js'

/**
 * Classify a command from its flattened stage words.
 *
 * Ported from OCaml Shell_ir_risk.classify_write_detail
 * and Exec_policy_mutation_classifier.is_destructive_bash_operation.
 *
 * Classification hierarchy:
 *   R0_Read                  — default for unrecognized commands
 *   R1_Reversible_mutation   — writes that can be undone (git, package managers, file ops)
 *   R2_Irreversible          — destructive operations (rm, reset, dd, shred)
 *   Destructive_protected    — destructive + targets protected resources (git push --force to main, rm -rf, git reset --hard)
 */
export function classifyRisk(words: string[]): RiskClass {
  if (words.length === 0) {
    return 'R0_Read'
  }

  const base = words[0]!.toLowerCase()

  // --- Git commands --------------------------------------------------------
  if (base === 'git' && words.length >= 2) {
    const sub = words[1]!.toLowerCase()

    // Destructive_protected: git push --force / --force-with-lease
    if (sub === 'push') {
      const rest = words.slice(2)
      const hasForce = rest.some(
        arg =>
          arg === '--force' ||
          arg === '-f' ||
          arg.startsWith('--force-with-lease'),
      )
      const targetsProtected = rest.some(isProtectedBranchTarget)
      if (hasForce || targetsProtected) {
        return 'Destructive_protected'
      }
      return 'R1_Reversible_mutation'
    }

    // Destructive_protected: git reset --hard
    if (sub === 'reset') {
      const rest = words.slice(2)
      if (rest.includes('--hard')) {
        return 'Destructive_protected'
      }
      return 'R2_Irreversible'
    }

    // R2_Irreversible: git clean (removes untracked files)
    if (sub === 'clean') {
      return 'R2_Irreversible'
    }

    // R1: other git write operations
    if (
      [
        'push',
        'merge',
        'rebase',
        'commit',
        'checkout',
        'branch',
        'tag',
        'stash',
        'clone',
        'init',
        'add',
        'mv',
        'rm',
        'remote',
        'fetch',
        'pull',
      ].includes(sub)
    ) {
      return 'R1_Reversible_mutation'
    }

    // R0: git read operations
    if (
      [
        'log',
        'show',
        'diff',
        'status',
        'blame',
        'grep',
        'ls-files',
        'ls-tree',
        'rev-parse',
        'describe',
        'config',
        'help',
      ].includes(sub)
    ) {
      return 'R0_Read'
    }

    // Unknown git subcommand — conservative default
    return 'R1_Reversible_mutation'
  }

  // --- Package managers / build tools --------------------------------------
  if (
    [
      'npm',
      'pnpm',
      'yarn',
      'bun',
      'deno',
      'dune',
      'opam',
      'make',
      'cmake',
      'cargo',
      'go',
      'uv',
    ].includes(base)
  ) {
    return 'R1_Reversible_mutation'
  }

  // --- Container / orchestration -------------------------------------------
  if (
    ['docker', 'docker-compose', 'podman', 'kubectl', 'helm'].includes(base)
  ) {
    return 'R1_Reversible_mutation'
  }

  // --- File operations: reversible -----------------------------------------
  if (
    ['mv', 'cp', 'mkdir', 'touch', 'chmod', 'chown', 'chgrp'].includes(base)
  ) {
    return 'R1_Reversible_mutation'
  }

  // --- File operations: irreversible ---------------------------------------
  if (base === 'rmdir') {
    return 'R2_Irreversible'
  }

  // Destructive_protected: rm -rf (recursive + force)
  if (base === 'rm') {
    const rest = words.slice(1)
    const optionArgs = rest.filter(arg => arg.length > 0 && arg[0] === '-')
    const hasRecursive = optionArgs.some(
      arg =>
        arg === '--recursive' ||
        hasShortFlag('r', arg) ||
        hasShortFlag('R', arg),
    )
    const hasForce = optionArgs.some(
      arg => arg === '--force' || hasShortFlag('f', arg),
    )
    if (hasRecursive && hasForce) {
      return 'Destructive_protected'
    }
    return 'R2_Irreversible'
  }

  if (['ln', 'unlink', 'install'].includes(base)) {
    return 'R2_Irreversible'
  }

  // --- Disk / data destruction ---------------------------------------------
  if (['dd', 'shred', 'fdisk', 'parted'].includes(base) || base === 'mkfs' || base.startsWith('mkfs.')) {
    return 'R2_Irreversible'
  }

  // --- Read-only commands (explicit allowlist) -----------------------------
  if (
    [
      'cat',
      'head',
      'tail',
      'less',
      'more',
      'grep',
      'rg',
      'find',
      'ls',
      'll',
      'wc',
      'stat',
      'file',
      'strings',
      'which',
      'whereis',
      'echo',
      'printf',
      'true',
      'false',
      'pwd',
      'whoami',
      'id',
      'uname',
      'env',
      'ps',
      'top',
      'htop',
      'jq',
      'awk',
      'sed',
      'cut',
      'sort',
      'uniq',
      'tr',
      'xargs',
      'diff',
      'cmp',
      'hexdump',
      'od',
      'base64',
      'tar',
      'gzip',
      'gunzip',
      'zip',
      'unzip',
      'curl',
      'wget',
      'ping',
      'netstat',
      'ss',
      'lsof',
      'df',
      'du',
      'free',
      'uptime',
      'date',
      'cal',
      'man',
    ].includes(base)
  ) {
    return 'R0_Read'
  }

  // --- Shell internals: cd is neutral (context change only) ----------------
  if (base === 'cd' || base === 'pushd' || base === 'popd') {
    return 'R0_Read'
  }

  // --- Default: conservative -----------------------------------------------
  return 'R0_Read'
}

/**
 * Classify risk from parsed Shell IR.
 *
 * Uses all stage words (flattened across pipeline) for classification,
 * but considers each stage's base command for pipeline-wide assessment.
 */
export function classifyShellIr(ir: ShellIr): RiskClass {
  const allWords = ir.kind === 'simple'
    ? ir.stage_words
    : ir.stages.flatMap(s => s.stage_words)

  if (allWords.length === 0) {
    return 'R0_Read'
  }

  // Pipeline: classify each stage independently, take the highest risk
  if (ir.kind === 'pipeline') {
    const stageRisks = ir.stages.map(stage => classifyRisk(stage.stage_words))
    return maxRisk(stageRisks)
  }

  return classifyRisk(allWords)
}

/**
 * Classify + brand a ShellIr with its RiskClass at the type level.
 *
 * Returns the same ShellIr object at runtime (no allocation), but typed
 * as RiskBrandedIr so downstream functions can demand specific risk levels
 * at compile time.
 *
 * Example:
 *   const branded = classifyAndBrand(ir)
 *   function onlyRead(ir: RiskBrandedIr<'R0_Read'>) { ... }
 */
export function classifyAndBrand(ir: ShellIr): RiskBrandedIr<RiskClass> {
  const riskClass = classifyShellIr(ir)
  return ir as RiskBrandedIr<typeof riskClass>
}

/**
 * Check if a command is a read operation (R0).
 */
export function isReadOperation(riskClass: RiskClass): boolean {
  return riskClass === 'R0_Read'
}

/**
 * Check if a command is destructive (R2 or Destructive_protected).
 */
export function isDestructive(riskClass: RiskClass): boolean {
  return riskClass === 'R2_Irreversible' || riskClass === 'Destructive_protected'
}

// ---- Helpers -------------------------------------------------------------

/** Check if a short-option string contains a given flag character. */
function hasShortFlag(flag: string, arg: string): boolean {
  return (
    arg.length > 1 && arg[0] === '-' && arg[1] !== '-' && arg.includes(flag)
  )
}

/** Check if an argument targets a protected branch. */
function isProtectedBranchTarget(arg: string): boolean {
  const target = arg.toLowerCase()
  const protectedBranches = [
    'main',
    'master',
    'origin/main',
    'origin/master',
    'refs/heads/main',
    'refs/heads/master',
  ]
  const protectedSuffixes = [
    ':main',
    ':master',
    ':origin/main',
    ':origin/master',
    ':refs/heads/main',
    ':refs/heads/master',
  ]
  return (
    protectedBranches.includes(target) ||
    protectedSuffixes.some(suffix => target.endsWith(suffix))
  )
}

/** Risk ordering: R0 < R1 < R2 < Destructive_protected */
const RISK_ORDER: Record<RiskClass, number> = {
  R0_Read: 0,
  R1_Reversible_mutation: 1,
  R2_Irreversible: 2,
  Destructive_protected: 3,
}

/** Return the highest risk from a list. */
function maxRisk(risks: RiskClass[]): RiskClass {
  if (risks.length === 0) return 'R0_Read'
  return risks.reduce((max, r) =>
    RISK_ORDER[r] > RISK_ORDER[max] ? r : max,
  )
}
