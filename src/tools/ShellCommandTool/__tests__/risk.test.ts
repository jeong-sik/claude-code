/**
 * Risk classification tests — proves equivalence with masc-mcp's
 * Shell_ir_risk.classify + Exec_policy_mutation_classifier.
 *
 * These tests are the "proof level" that makes ShellCommandTool a
 * first-class citizen. Every classification must match the OCaml SSOT.
 */

import { describe, expect, test } from 'bun:test'
import { classifyRisk, isReadOperation, isDestructive } from '../risk.js'
import type { RiskClass } from '../types.js'

type TestCase = {
  words: string[]
  expected: RiskClass
  description: string
}

const R0_CASES: TestCase[] = [
  { words: ['cat', 'file.txt'], expected: 'R0_Read', description: 'cat read' },
  { words: ['ls', '-la'], expected: 'R0_Read', description: 'ls list' },
  { words: ['grep', 'foo', 'bar'], expected: 'R0_Read', description: 'grep search' },
  { words: ['rg', 'pattern'], expected: 'R0_Read', description: 'rg search' },
  { words: ['find', '.', '-name', '*.ts'], expected: 'R0_Read', description: 'find search' },
  { words: ['head', '-20', 'file'], expected: 'R0_Read', description: 'head read' },
  { words: ['tail', '-f', 'log'], expected: 'R0_Read', description: 'tail read' },
  { words: ['wc', '-l'], expected: 'R0_Read', description: 'wc count' },
  { words: ['stat', 'file'], expected: 'R0_Read', description: 'stat info' },
  { words: ['echo', 'hello'], expected: 'R0_Read', description: 'echo output' },
  { words: ['pwd'], expected: 'R0_Read', description: 'pwd read' },
  { words: ['whoami'], expected: 'R0_Read', description: 'whoami read' },
  { words: ['env'], expected: 'R0_Read', description: 'env read' },
  { words: ['jq', '.'], expected: 'R0_Read', description: 'jq parse' },
  { words: ['awk', '{print $1}'], expected: 'R0_Read', description: 'awk process' },
  { words: ['sed', 's/old/new/'], expected: 'R0_Read', description: 'sed stream edit' },
  { words: ['diff', 'a', 'b'], expected: 'R0_Read', description: 'diff compare' },
  { words: ['curl', 'https://example.com'], expected: 'R0_Read', description: 'curl fetch' },
  { words: ['wget', 'https://example.com'], expected: 'R0_Read', description: 'wget fetch' },
  { words: ['tar', '-tf', 'archive.tar'], expected: 'R0_Read', description: 'tar list' },
  { words: ['gzip', '-l', 'file.gz'], expected: 'R0_Read', description: 'gzip info' },
  { words: ['cd', '..'], expected: 'R0_Read', description: 'cd context change' },
  { words: ['git', 'log'], expected: 'R0_Read', description: 'git log read' },
  { words: ['git', 'show'], expected: 'R0_Read', description: 'git show read' },
  { words: ['git', 'diff'], expected: 'R0_Read', description: 'git diff read' },
  { words: ['git', 'status'], expected: 'R0_Read', description: 'git status read' },
  { words: ['git', 'blame'], expected: 'R0_Read', description: 'git blame read' },
  { words: ['git', 'config', '--list'], expected: 'R0_Read', description: 'git config read' },
]

const R1_CASES: TestCase[] = [
  { words: ['git', 'push'], expected: 'R1_Reversible_mutation', description: 'git push normal' },
  { words: ['git', 'push', 'origin', 'feature'], expected: 'R1_Reversible_mutation', description: 'git push branch' },
  { words: ['git', 'merge', 'feature'], expected: 'R1_Reversible_mutation', description: 'git merge' },
  { words: ['git', 'rebase', 'main'], expected: 'R1_Reversible_mutation', description: 'git rebase' },
  { words: ['git', 'commit', '-m', 'fix'], expected: 'R1_Reversible_mutation', description: 'git commit' },
  { words: ['git', 'checkout', '-b', 'feature'], expected: 'R1_Reversible_mutation', description: 'git checkout' },
  { words: ['git', 'branch', 'feature'], expected: 'R1_Reversible_mutation', description: 'git branch create' },
  { words: ['git', 'tag', 'v1.0'], expected: 'R1_Reversible_mutation', description: 'git tag' },
  { words: ['git', 'stash'], expected: 'R1_Reversible_mutation', description: 'git stash' },
  { words: ['git', 'clone', 'url'], expected: 'R1_Reversible_mutation', description: 'git clone' },
  { words: ['git', 'init'], expected: 'R1_Reversible_mutation', description: 'git init' },
  { words: ['git', 'add', 'file'], expected: 'R1_Reversible_mutation', description: 'git add' },
  { words: ['git', 'mv', 'old', 'new'], expected: 'R1_Reversible_mutation', description: 'git mv' },
  { words: ['git', 'rm', 'file'], expected: 'R1_Reversible_mutation', description: 'git rm' },
  { words: ['git', 'fetch'], expected: 'R1_Reversible_mutation', description: 'git fetch' },
  { words: ['git', 'pull'], expected: 'R1_Reversible_mutation', description: 'git pull' },
  { words: ['git', 'remote', 'add', 'origin', 'url'], expected: 'R1_Reversible_mutation', description: 'git remote add' },
  { words: ['npm', 'install'], expected: 'R1_Reversible_mutation', description: 'npm install' },
  { words: ['pnpm', 'add', 'pkg'], expected: 'R1_Reversible_mutation', description: 'pnpm add' },
  { words: ['yarn', 'add', 'pkg'], expected: 'R1_Reversible_mutation', description: 'yarn add' },
  { words: ['bun', 'install'], expected: 'R1_Reversible_mutation', description: 'bun install' },
  { words: ['deno', 'install'], expected: 'R1_Reversible_mutation', description: 'deno install' },
  { words: ['dune', 'build'], expected: 'R1_Reversible_mutation', description: 'dune build' },
  { words: ['opam', 'install'], expected: 'R1_Reversible_mutation', description: 'opam install' },
  { words: ['make'], expected: 'R1_Reversible_mutation', description: 'make build' },
  { words: ['cmake', '--build'], expected: 'R1_Reversible_mutation', description: 'cmake build' },
  { words: ['cargo', 'build'], expected: 'R1_Reversible_mutation', description: 'cargo build' },
  { words: ['go', 'build'], expected: 'R1_Reversible_mutation', description: 'go build' },
  { words: ['mv', 'a', 'b'], expected: 'R1_Reversible_mutation', description: 'mv file' },
  { words: ['cp', 'a', 'b'], expected: 'R1_Reversible_mutation', description: 'cp file' },
  { words: ['mkdir', 'dir'], expected: 'R1_Reversible_mutation', description: 'mkdir' },
  { words: ['touch', 'file'], expected: 'R1_Reversible_mutation', description: 'touch' },
  { words: ['chmod', '+x', 'script'], expected: 'R1_Reversible_mutation', description: 'chmod' },
  { words: ['chown', 'user', 'file'], expected: 'R1_Reversible_mutation', description: 'chown' },
  { words: ['docker', 'run', 'image'], expected: 'R1_Reversible_mutation', description: 'docker run' },
  { words: ['docker-compose', 'up'], expected: 'R1_Reversible_mutation', description: 'docker-compose up' },
  { words: ['kubectl', 'apply', '-f', 'pod.yaml'], expected: 'R1_Reversible_mutation', description: 'kubectl apply' },
  { words: ['helm', 'install', 'chart'], expected: 'R1_Reversible_mutation', description: 'helm install' },
]

const R2_CASES: TestCase[] = [
  { words: ['git', 'reset', 'HEAD~1'], expected: 'R2_Irreversible', description: 'git reset soft' },
  { words: ['git', 'reset', '--soft', 'HEAD~1'], expected: 'R2_Irreversible', description: 'git reset --soft' },
  { words: ['git', 'clean', '-fd'], expected: 'R2_Irreversible', description: 'git clean' },
  { words: ['rm', 'file'], expected: 'R2_Irreversible', description: 'rm single file' },
  { words: ['rm', '-i', 'file'], expected: 'R2_Irreversible', description: 'rm interactive' },
  { words: ['rmdir', 'dir'], expected: 'R2_Irreversible', description: 'rmdir' },
  { words: ['ln', '-s', 'a', 'b'], expected: 'R2_Irreversible', description: 'ln symlink' },
  { words: ['unlink', 'file'], expected: 'R2_Irreversible', description: 'unlink' },
  { words: ['install', 'binary', 'dest'], expected: 'R2_Irreversible', description: 'install' },
  { words: ['dd', 'if=/dev/zero', 'of=disk'], expected: 'R2_Irreversible', description: 'dd write' },
  { words: ['shred', 'file'], expected: 'R2_Irreversible', description: 'shred' },
  { words: ['mkfs', '/dev/sda1'], expected: 'R2_Irreversible', description: 'mkfs' },
  { words: ['fdisk', '/dev/sda'], expected: 'R2_Irreversible', description: 'fdisk' },
  { words: ['parted', '/dev/sda'], expected: 'R2_Irreversible', description: 'parted' },
]

const DESTRUCTIVE_PROTECTED_CASES: TestCase[] = [
  { words: ['git', 'push', '--force'], expected: 'Destructive_protected', description: 'git push --force' },
  { words: ['git', 'push', '-f'], expected: 'Destructive_protected', description: 'git push -f' },
  { words: ['git', 'push', '--force-with-lease'], expected: 'Destructive_protected', description: 'git push --force-with-lease' },
  { words: ['git', 'push', 'origin', 'main'], expected: 'Destructive_protected', description: 'git push to main' },
  { words: ['git', 'push', 'origin', 'master'], expected: 'Destructive_protected', description: 'git push to master' },
  { words: ['git', 'push', 'origin', 'refs/heads/main'], expected: 'Destructive_protected', description: 'git push to refs/heads/main' },
  { words: ['git', 'reset', '--hard', 'HEAD~1'], expected: 'Destructive_protected', description: 'git reset --hard' },
  { words: ['rm', '-rf', 'dir'], expected: 'Destructive_protected', description: 'rm -rf' },
  { words: ['rm', '-r', '-f', 'dir'], expected: 'Destructive_protected', description: 'rm -r -f' },
  { words: ['rm', '--recursive', '--force', 'dir'], expected: 'Destructive_protected', description: 'rm --recursive --force' },
]

describe('classifyRisk', () => {
  const allCases = [
    ...R0_CASES,
    ...R1_CASES,
    ...R2_CASES,
    ...DESTRUCTIVE_PROTECTED_CASES,
  ]

  for (const { words, expected, description } of allCases) {
    test(`${description} → ${expected}`, () => {
      const result = classifyRisk(words)
      expect(result).toBe(expected)
    })
  }

  test('empty words → R0_Read', () => {
    expect(classifyRisk([])).toBe('R0_Read')
  })

  test('unknown command → R0_Read', () => {
    expect(classifyRisk(['unknown_tool'])).toBe('R0_Read')
    expect(classifyRisk(['foobar'])).toBe('R0_Read')
  })
})

describe('isReadOperation', () => {
  test('R0 is read', () => {
    expect(isReadOperation('R0_Read')).toBe(true)
  })
  test('R1 is not read', () => {
    expect(isReadOperation('R1_Reversible_mutation')).toBe(false)
  })
  test('R2 is not read', () => {
    expect(isReadOperation('R2_Irreversible')).toBe(false)
  })
  test('Destructive_protected is not read', () => {
    expect(isReadOperation('Destructive_protected')).toBe(false)
  })
})

describe('isDestructive', () => {
  test('R0 is not destructive', () => {
    expect(isDestructive('R0_Read')).toBe(false)
  })
  test('R1 is not destructive', () => {
    expect(isDestructive('R1_Reversible_mutation')).toBe(false)
  })
  test('R2 is destructive', () => {
    expect(isDestructive('R2_Irreversible')).toBe(true)
  })
  test('Destructive_protected is destructive', () => {
    expect(isDestructive('Destructive_protected')).toBe(true)
  })
})
