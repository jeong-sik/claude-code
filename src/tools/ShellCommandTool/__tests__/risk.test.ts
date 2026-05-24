/**
 * Risk classification tests — prove correctness of classifyRisk and classifyShellIr.
 *
 * Coverage: all RiskClass variants, all command categories, edge cases.
 */

import { describe, expect, test } from 'bun:test'
import { classifyRisk, classifyShellIr, classifyAndBrand, isReadOperation, isDestructive } from '../risk.js'
import type { RiskClass, ShellIr } from '../types.js'

// -----------------------------------------------------------------------------
// classifyRisk — single-command word arrays

// -----------------------------------------------------------------------------

describe('classifyRisk — R0_Read (read-only commands)', () => {
  const r0Commands = [
    ['cat', 'file.txt'],
    ['head', '-n', '10', 'log.txt'],
    ['tail', '-f', 'app.log'],
    ['less', 'README.md'],
    ['grep', 'pattern', '*.ts'],
    ['rg', 'classifyRisk'],
    ['find', '.', '-name', '*.test.ts'],
    ['ls', '-la'],
    ['ll'],
    ['wc', '-l', 'file.ts'],
    ['stat', 'package.json'],
    ['file', 'binary'],
    ['which', 'bun'],
    ['whereis', 'node'],
    ['echo', 'hello'],
    ['printf', '%s', 'test'],
    ['true'],
    ['false'],
    ['pwd'],
    ['whoami'],
    ['id'],
    ['uname', '-a'],
    ['env'],
    ['ps', 'aux'],
    ['top', '-n', '1'],
    ['jq', '.name', 'package.json'],
    ['awk', '{print $1}', 'file.txt'],
    ['sed', 's/a/b/g', 'file.txt'],
    ['cut', '-d:', '-f1', '/etc/passwd'],
    ['sort', 'file.txt'],
    ['uniq', 'file.txt'],
    ['tr', 'a-z', 'A-Z'],
    ['xargs', 'echo'],
    ['diff', 'a.txt', 'b.txt'],
    ['cmp', 'a.txt', 'b.txt'],
    ['hexdump', '-C', 'binary'],
    ['od', '-c', 'file.txt'],
    ['base64', 'image.png'],
    ['tar', '-tf', 'archive.tar'],
    ['gzip', '-l', 'archive.gz'],
    ['gunzip', '-l', 'archive.gz'],
    ['zip', '-l', 'archive.zip'],
    ['unzip', '-l', 'archive.zip'],
    ['curl', '-I', 'https://example.com'],
    ['wget', '--spider', 'https://example.com'],
    ['ping', '-c', '1', 'example.com'],
    ['netstat', '-tlnp'],
    ['ss', '-tlnp'],
    ['lsof', '-i'],
    ['df', '-h'],
    ['du', '-sh', '.'],
    ['free', '-h'],
    ['uptime'],
    ['date'],
    ['cal'],
    ['man', 'ls'],
    ['cd', '/tmp'],
    ['pushd', '/tmp'],
    ['popd'],
  ]

  for (const words of r0Commands) {
    test(`${words.join(' ')} ← R0_Read`, () => {
      expect(classifyRisk(words)).toBe('R0_Read')
    })
  }

  test('empty array ← R0_Read', () => {
    expect(classifyRisk([])).toBe('R0_Read')
  })
})

describe('classifyRisk — R1_Reversible_mutation', () => {
  const r1Commands = [
    ['git', 'push'],
    ['git', 'merge', 'feature-branch'],
    ['git', 'rebase', 'main'],
    ['git', 'commit', '-m', 'fix'],
    ['git', 'checkout', '-b', 'new-branch'],
    ['git', 'branch', 'new-branch'],
    ['git', 'tag', 'v1.0'],
    ['git', 'stash'],
    ['git', 'clone', 'https://github.com/foo/bar'],
    ['git', 'init'],
    ['git', 'add', '.'],
    ['git', 'mv', 'a.ts', 'b.ts'],
    ['git', 'rm', 'old.ts'],
    ['git', 'remote', 'add', 'origin', 'https://github.com/foo/bar'],
    ['git', 'fetch'],
    ['git', 'pull'],
    ['npm', 'install'],
    ['pnpm', 'add', 'lodash'],
    ['yarn', 'add', 'react'],
    ['bun', 'install'],
    ['deno', 'run', 'script.ts'],
    ['dune', 'build'],
    ['opam', 'install', 'lwt'],
    ['make', 'all'],
    ['cmake', '--build', 'build'],
    ['cargo', 'build'],
    ['go', 'build'],
    ['docker', 'ps'],
    ['docker-compose', 'up', '-d'],
    ['podman', 'run', 'ubuntu'],
    ['kubectl', 'get', 'pods'],
    ['helm', 'install', 'myapp', './chart'],
    ['uv', 'a.txt', 'b.txt'],
    ['cp', 'a.txt', 'b.txt'],
    ['mkdir', '-p', 'new-dir'],
    ['touch', 'new-file'],
    ['chmod', '+x', 'script.sh'],
    ['chown', 'user:group', 'file'],
    ['chgrp', 'group', 'file'],
  ]

  for (const words of r1Commands) {
    test(`${words.join(' ')} ← R1_Reversible_mutation`, () => {
      expect(classifyRisk(words)).toBe('R1_Reversible_mutation')
    })
  }
})

describe('classifyRisk — R2_Irreversible', () => {
  const r2Commands = [
    ['rmdir', 'old-dir'],
    ['rm', 'file.txt'],
    ['rm', '-i', 'file.txt'],
    ['ln', '-s', 'a', 'b'],
    ['unlink', 'file.txt'],
    ['install', 'source', 'dest'],
    ['dd', 'if=/dev/zero', 'of=/dev/sda'],
    ['shred', '-u', 'file.txt'],
    ['mkfs.ext4', '/dev/sda1'],
    ['fdisk', '/dev/sda'],
    ['parted', '/dev/sda'],
  ]

  for (const words of r2Commands) {
    test(`${words.join(' ')} ← R2_Irreversible`, () => {
      expect(classifyRisk(words)).toBe('R2_Irreversible')
    })
  }
})

describe('classifyRisk — Destructive_protected', () => {
  const dpCommands = [
    ['rm', '-rf', '/'],
    ['rm', '-r', '-f', 'dir'],
    ['rm', '-Rf', 'dir'],
    ['rm', '--recursive', '--force', 'dir'],
    ['git', 'push', '--force'],
    ['git', 'push', '-f'],
    ['git', 'push', '--force-with-lease'],
    ['git', 'push', '--force-with-lease=main'],
    ['git', 'push', 'origin', 'main'],
    ['git', 'reset', '--hard', 'HEAD~1'],
  ]

  for (const words of dpCommands) {
    test(`${words.join(' ')} ← Destructive_protected`, () => {
      expect(classifyRisk(words)).toBe('Destructive_protected')
    })
  }
})

describe('classifyRisk — git subcommands', () => {
  test('git read ops', () => {
    const reads = ['log', 'show', 'diff', 'status', 'blame', 'grep', 'ls-files', 'ls-tree', 'rev-parse', 'describe', 'config', 'help']
    for (const sub of reads) {
      expect(classifyRisk(['git', sub])).toBe('R0_Read')
    }
  })

  test('git write ops', () => {
    const writes = ['push', 'merge', 'rebase', 'commit', 'checkout', 'branch', 'tag', 'stash', 'clone', 'init', 'add', 'mv', 'rm', 'remote', 'fetch', 'pull']
    for (const sub of writes) {
      expect(classifyRisk(['git', sub])).toBe('R1_Reversible_mutation')
    }
  })

  test('git clean ← R2', () => {
    expect(classifyRisk(['git', 'clean', '-fd'])).toBe('R2_Irreversible')
  })

  test('git unknown subcommand ← R1 (conservative)', () => {
    expect(classifyRisk(['git', 'fsck'])).toBe('R1_Reversible_mutation')
  })
})

// -----------------------------------------------------------------------------
// classifyShellIr — structured IR
// -----------------------------------------------------------------------------

describe('classifyShellIr', () => {
  test('simple command', () => {
    const ir: ShellIr = {
      kind: 'simple',
      stage_words: ['rm', '-rf', '/tmp'],
      env_vars: [],
      redirects: [],
      text: 'rm -rf /tmp',
    }
    expect(classifyShellIr(ir)).toBe('Destructive_protected')
  })

  test('pipeline — takes highest risk', () => {
    const ir: ShellIr = {
      kind: 'pipeline',
      stages: [
        {
          kind: 'simple',
          stage_words: ['cat', 'file.txt'],
          env_vars: [],
          redirects: [],
          text: 'cat file.txt',
        },
        {
          kind: 'simple',
          stage_words: ['rm', '-rf', '/'],
          env_vars: [],
          redirects: [],
          text: 'rm -rf /',
        },
      ],
    }
    expect(classifyShellIr(ir)).toBe('Destructive_protected')
  })

  test('pipeline ← all R0', () => {
    const ir: ShellIr = {
      kind: 'pipeline',
      stages: [
        {
          kind: 'simple',
          stage_words: ['cat', 'a.txt'],
          env_vars: [],
          redirects: [],
          text: 'cat a.txt',
        },
        {
          kind: 'simple',
          stage_words: ['grep', 'pattern'],
          env_vars: [],
          redirects: [],
          text: 'grep pattern',
        },
      ],
    }
    expect(classifyShellIr(ir)).toBe('R0_Read')
  })

  test('empty simple ← R1', () => {
    const ir: ShellIr = {
      kind: 'simple',
      stage_words: [],
      env_vars: [],
      redirects: [],
      text: '',
    }
    expect(classifyShellIr(ir)).toBe('R0_Read')
  })
})

// -----------------------------------------------------------------------------
// isReadOperation / isDestructive
// -----------------------------------------------------------------------------

describe('isReadOperation', () => {
  test('R0 ← true', () => expect(isReadOperation('R0_Read')).toBe(true))
  test('R1 ← false', () => expect(isReadOperation('R1_Reversible_mutation')).toBe(false))
  test('R2 ← false', () => expect(isReadOperation('R2_Irreversible')).toBe(false))
  test('DP ← false', () => expect(isReadOperation('Destructive_protected')).toBe(false))
})

describe('classifyAndBrand', () => {
  test('brands R0 without allocation', () => {
    const ir: ShellIr = {
      kind: 'simple',
      stage_words: ['cat', 'file.txt'],
      env_vars: [],
      redirects: [],
      text: 'cat file.txt',
    }
    const branded = classifyAndBrand(ir)
    expect(branded).toBe(ir) // same object, no allocation
    expect(classifyShellIr(branded)).toBe('R0_Read')
  })

  test('brands R2 without allocation', () => {
    const ir: ShellIr = {
      kind: 'simple',
      stage_words: ['rm', '-rf', '/'],
      env_vars: [],
      redirects: [],
      text: 'rm -rf /',
    }
    const branded = classifyAndBrand(ir)
    expect(branded).toBe(ir)
    expect(classifyShellIr(branded)).toBe('Destructive_protected')
  })

  test('brands pipeline — highest risk wins', () => {
    const ir: ShellIr = {
      kind: 'pipeline',
      stages: [
        {
          kind: 'simple',
          stage_words: ['cat', 'a.txt'],
          env_vars: [],
          redirects: [],
          text: 'cat a.txt',
        },
        {
          kind: 'simple',
          stage_words: ['rm', 'b.txt'],
          env_vars: [],
          redirects: [],
          text: 'rm b.txt',
        },
      ],
    }
    const branded = classifyAndBrand(ir)
    expect(branded).toBe(ir)
    expect(classifyShellIr(branded)).toBe('R2_Irreversible')
  })
})

describe('isDestructive', () => {
  test('R0 ← false', () => expect(isDestructive('R0_Read')).toBe(false))
  test('R1 ← false', () => expect(isDestructive('R1_Reversible_mutation')).toBe(false))
  test('R2 ← true', () => expect(isDestructive('R2_Irreversible')).toBe(true))
  test('DP ← true', () => expect(isDestructive('Destructive_protected')).toBe(true))
})
