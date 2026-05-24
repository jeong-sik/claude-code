/**
 * PowerShell cmdlet RiskClass classification.
 *
 * Maps PowerShell cmdlets to the same RiskClass taxonomy used by
 * ShellCommandTool (R0/R1/R2/Destructive_protected), enabling a unified
 * permission model across both shell backends.
 *
 * Classification is based on cmdlet verb (the prefix before the hyphen):
 *   Get-*, Test-*, Find-*        → R0_Read
 *   Set-*, Add-*, New-*, Copy-*  → R1_Reversible_mutation (with exceptions)
 *   Remove-*, Clear-*, Stop-*    → R2_Irreversible
 *   Remove-* -Recurse -Force     → Destructive_protected
 */

import type { RiskClass } from '../ShellCommandTool/types.js'

// ---------------------------------------------------------------------------
// Verb-based classification
// ---------------------------------------------------------------------------

const R0_VERBS = new Set([
  'get',
  'test',
  'find',
  'search',
  'select',
  'where',
  'format',
  'measure',
  'group',
  'sort',
  'compare',
  'convertfrom',
  'convertto',
  'export',
  'import',
  'out',
  'write',
  'read',
  'show',
  'list',
  'resolve',
  'invoke', // invoke-restmethod, invoke-webrequest — network I/O, not filesystem
])

const R1_VERBS = new Set([
  'new',
  'copy',
  'move',
  'rename',
  'add',
  'update',
  'install',
  'publish',
  'start', // Start-Sleep, Start-Process (with caveats)
  'enable',
])

const R2_VERBS = new Set([
  'remove',
  'clear',
  'delete',
  'disable',
  'stop',
  'restart',
  'reset',
  'uninstall',
  'dismount',
])

// ---------------------------------------------------------------------------
// Cmdlet-level overrides — verbs alone are insufficient
// ---------------------------------------------------------------------------

/** R0 overrides: these cmdlets are read-only despite their verb. */
const R0_OVERRIDES = new Set([
  'start-sleep', // Non-destructive delay
  'start-transcript', // Logging, reversible
  'stop-transcript', // Logging, reversible
])

/** R2 overrides: these are destructive despite being in R1 verbs. */
const R2_OVERRIDES = new Set([
  'new-partition', // Disk partitioning is destructive
  'format-volume',
  'initialize-disk',
  'clear-disk',
  'remove-partition',
  'repair-volume',
  'optimize-volume',
  'defrag',
  'clear-recyclebin',
])

/** Destructive_protected: always gated regardless of flags. */
const DP_OVERRIDES = new Set([
  'format-volume',
  'clear-disk',
  'initialize-disk',
  'remove-computer',
  'restart-computer',
  'stop-computer',
  'disable-computerrestore',
])

// ---------------------------------------------------------------------------
// Flag-based elevation: certain flag combinations bump risk up
// ---------------------------------------------------------------------------

/**
 * Detects if a Remove-* or Clear-* command targets a protected resource.
 * E.g., Remove-Item -Recurse -Force, Remove-Item C:\Windows
 */
function isDestructiveFlags(
  cmdlet: string,
  words: string[],
): boolean {
  const lower = words.map(w => w.toLowerCase())

  // Remove-Item with -Recurse and -Force
  if (cmdlet === 'remove-item') {
    const hasRecurse = lower.some(w => w === '-recurse' || w === '-r')
    const hasForce = lower.some(w => w === '-force' || w === '-f')
    if (hasRecurse && hasForce) return true

    // Targeting system/protected paths
    const hasSystemPath = lower.some(w =>
      w.startsWith('c:\\windows') ||
      w.startsWith('c:\\program') ||
      w === '/' ||
      w.startsWith('/system') ||
      w.startsWith('/usr') ||
      w.startsWith('/etc'),
    )
    if (hasSystemPath) return true
  }

  // Set-Content overwriting existing file (no -NoClobber)
  if (cmdlet === 'set-content') {
    const hasNoClobber = lower.includes('-noclobber')
    if (!hasNoClobber) return true
  }

  return false
}

// ---------------------------------------------------------------------------
// Main classifier
// ---------------------------------------------------------------------------

/**
 * Classify a PowerShell command (cmdlet + arguments) into RiskClass.
 *
 * @param cmdlet Canonical lowercase cmdlet name (e.g., 'get-content')
 * @param words All words in the command including flags and arguments
 * @returns RiskClass for this command
 */
export function classifyPowerShellRisk(
  cmdlet: string,
  words: string[],
): RiskClass {
  // DP overrides take highest priority
  if (DP_OVERRIDES.has(cmdlet)) {
    return 'Destructive_protected'
  }

  // R0 overrides next
  if (R0_OVERRIDES.has(cmdlet)) {
    return 'R0_Read'
  }

  // R2 overrides
  if (R2_OVERRIDES.has(cmdlet)) {
    return 'R2_Irreversible'
  }

  // Flag-based elevation for Remove-/Clear-
  if (isDestructiveFlags(cmdlet, words)) {
    return 'Destructive_protected'
  }

  // Verb-based classification
  const verb = cmdlet.split('-')[0]
  if (!verb) {
    return 'R0_Read' // Unknown command — conservative default
  }

  if (R2_VERBS.has(verb)) {
    return 'R2_Irreversible'
  }
  if (R1_VERBS.has(verb)) {
    return 'R1_Reversible_mutation'
  }
  if (R0_VERBS.has(verb)) {
    return 'R0_Read'
  }

  // Unknown verb — default to R0 (read-only) as conservative default
  return 'R0_Read'
}

/**
 * Check if a RiskClass represents a read-only operation.
 */
export function isReadOperation(riskClass: RiskClass): boolean {
  return riskClass === 'R0_Read'
}

/**
 * Check if a RiskClass represents a destructive operation.
 */
export function isDestructive(riskClass: RiskClass): boolean {
  return riskClass === 'R2_Irreversible' || riskClass === 'Destructive_protected'
}
