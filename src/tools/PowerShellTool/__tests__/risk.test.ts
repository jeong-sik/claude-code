/**
 * PowerShell RiskClass tests — prove that PowerShell cmdlets map correctly
 * to the unified RiskClass taxonomy (R0/R1/R2/Destructive_protected).
 */

import { describe, expect, test } from 'bun:test'
import { classifyPowerShellRisk, isReadOperation, isDestructive } from '../risk.js'
import type { RiskClass } from '../../ShellCommandTool/types.js'

describe('classifyPowerShellRisk — R0_Read', () => {
  const cases: [string, string[], RiskClass][] = [
    ['get-content', ['file.txt'], 'R0_Read'],
    ['get-item', ['path'], 'R0_Read'],
    ['test-path', ['path'], 'R0_Read'],
    ['resolve-path', ['path'], 'R0_Read'],
    ['get-location', [], 'R0_Read'],
    ['get-filehash', ['file.txt'], 'R0_Read'],
    ['get-acl', ['path'], 'R0_Read'],
    ['format-hex', ['file.bin'], 'R0_Read'],
    ['select-string', ['pattern'], 'R0_Read'],
    ['get-childitem', ['-Recurse'], 'R0_Read'],
    ['get-process', [], 'R0_Read'],
    ['get-service', [], 'R0_Read'],
    ['where-object', [], 'R0_Read'],
    ['sort-object', [], 'R0_Read'],
    ['measure-object', [], 'R0_Read'],
    ['group-object', [], 'R0_Read'],
    ['compare-object', [], 'R0_Read'],
    ['convertto-json', [], 'R0_Read'],
    ['convertfrom-json', [], 'R0_Read'],
    ['out-host', [], 'R0_Read'],
    ['write-output', ['hello'], 'R0_Read'],
    ['write-host', ['hello'], 'R0_Read'],
    ['invoke-restmethod', ['https://example.com'], 'R0_Read'],
    ['invoke-webrequest', ['https://example.com'], 'R0_Read'],
    ['start-sleep', ['5'], 'R0_Read'],
    ['start-transcript', ['log.txt'], 'R0_Read'],
    ['stop-transcript', [], 'R0_Read'],
  ]

  for (const [cmdlet, words, expected] of cases) {
    test(`${cmdlet} → ${expected}`, () => {
      expect(classifyPowerShellRisk(cmdlet, words)).toBe(expected)
    })
  }
})

describe('classifyPowerShellRisk — R1_Reversible_mutation', () => {
  const cases: [string, string[], RiskClass][] = [
    ['new-item', ['-ItemType', 'Directory', 'foo'], 'R1_Reversible_mutation'],
    ['copy-item', ['a.txt', 'b.txt'], 'R1_Reversible_mutation'],
    ['move-item', ['a.txt', 'b.txt'], 'R1_Reversible_mutation'],
    ['rename-item', ['a.txt', 'b.txt'], 'R1_Reversible_mutation'],
    ['add-content', ['file.txt', 'text'], 'R1_Reversible_mutation'],
    ['install-module', ['Foo'], 'R1_Reversible_mutation'],
    ['publish-module', ['Foo'], 'R1_Reversible_mutation'],
    ['enable-psremoting', [], 'R1_Reversible_mutation'],
  ]

  for (const [cmdlet, words, expected] of cases) {
    test(`${cmdlet} → ${expected}`, () => {
      expect(classifyPowerShellRisk(cmdlet, words)).toBe(expected)
    })
  }
})

describe('classifyPowerShellRisk — R2_Irreversible', () => {
  const cases: [string, string[], RiskClass][] = [
    ['remove-item', ['file.txt'], 'R2_Irreversible'],
    ['clear-content', ['file.txt'], 'R2_Irreversible'],
    ['delete-variable', ['x'], 'R2_Irreversible'],
    ['disable-psremoting', [], 'R2_Irreversible'],
    ['stop-process', ['-Name', 'notepad'], 'R2_Irreversible'],
    ['restart-service', ['spooler'], 'R2_Irreversible'],
    ['stop-service', ['spooler'], 'R2_Irreversible'],
    ['uninstall-module', ['Foo'], 'R2_Irreversible'],
  ]

  for (const [cmdlet, words, expected] of cases) {
    test(`${cmdlet} → ${expected}`, () => {
      expect(classifyPowerShellRisk(cmdlet, words)).toBe(expected)
    })
  }
})

describe('classifyPowerShellRisk — Destructive_protected', () => {
  const cases: [string, string[], RiskClass][] = [
    // Flag-based elevation
    ['remove-item', ['-Recurse', '-Force', 'dir'], 'Destructive_protected'],
    ['remove-item', ['-r', '-f', 'dir'], 'Destructive_protected'],
    ['remove-item', ['C:\\Windows'], 'Destructive_protected'],
    ['remove-item', ['/system'], 'Destructive_protected'],
    // DP overrides
    ['format-volume', ['-DriveLetter', 'C'], 'Destructive_protected'],
    ['clear-disk', ['-Number', '0'], 'Destructive_protected'],
    ['initialize-disk', ['-Number', '0'], 'Destructive_protected'],
    ['remove-computer', [], 'Destructive_protected'],
    ['restart-computer', [], 'Destructive_protected'],
    ['stop-computer', [], 'Destructive_protected'],
  ]

  for (const [cmdlet, words, expected] of cases) {
    test(`${cmdlet} ${words.join(' ')} → ${expected}`, () => {
      expect(classifyPowerShellRisk(cmdlet, words)).toBe(expected)
    })
  }
})

describe('isReadOperation', () => {
  test('R0 → true', () => {
    expect(isReadOperation('R0_Read')).toBe(true)
  })
  test('R1 → false', () => {
    expect(isReadOperation('R1_Reversible_mutation')).toBe(false)
  })
  test('R2 → false', () => {
    expect(isReadOperation('R2_Irreversible')).toBe(false)
  })
  test('DP → false', () => {
    expect(isReadOperation('Destructive_protected')).toBe(false)
  })
})

describe('isDestructive', () => {
  test('R0 → false', () => {
    expect(isDestructive('R0_Read')).toBe(false)
  })
  test('R1 → false', () => {
    expect(isDestructive('R1_Reversible_mutation')).toBe(false)
  })
  test('R2 → true', () => {
    expect(isDestructive('R2_Irreversible')).toBe(true)
  })
  test('DP → true', () => {
    expect(isDestructive('Destructive_protected')).toBe(true)
  })
})
