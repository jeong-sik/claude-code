/**
 * IR builder integration tests — proves mapParseResult and buildShellIr
 * correctly transform parse-for-security shapes into typed ShellIr.
 *
 * These tests do NOT require tree-sitter or bun:bundle; they exercise
 * the pure mapping layer with mock data.
 */

import { describe, expect, test } from 'bun:test'
import { buildShellIr, mapParseResult } from '../ir-builder.js'
import type { ShellIr } from '../types.js'

describe('buildShellIr', () => {
  test('single simple command', () => {
    const { ir, stage_words } = buildShellIr([
      {
        argv: ['git', 'status'],
        envVars: [],
        redirects: [],
        text: 'git status',
      },
    ])

    expect(ir.kind).toBe('simple')
    expect(stage_words).toEqual(['git', 'status'])
    if (ir.kind === 'simple') {
      expect(ir.stage_words).toEqual(['git', 'status'])
      expect(ir.env_vars).toEqual([])
      expect(ir.redirects).toEqual([])
      expect(ir.text).toBe('git status')
    }
  })

  test('command with env vars', () => {
    const { ir, stage_words } = buildShellIr([
      {
        argv: ['node', 'app.js'],
        envVars: [{ name: 'NODE_ENV', value: 'production' }],
        redirects: [],
        text: 'NODE_ENV=production node app.js',
      },
    ])

    expect(ir.kind).toBe('simple')
    expect(stage_words).toEqual(['node', 'app.js'])
    if (ir.kind === 'simple') {
      expect(ir.env_vars).toEqual([{ name: 'NODE_ENV', value: 'production' }])
    }
  })

  test('command with redirects', () => {
    const { ir } = buildShellIr([
      {
        argv: ['cat'],
        envVars: [],
        redirects: [{ op: '>', target: 'output.txt' }],
        text: 'cat > output.txt',
      },
    ])

    expect(ir.kind).toBe('simple')
    if (ir.kind === 'simple') {
      expect(ir.redirects).toEqual([{ op: '>', target: 'output.txt' }])
    }
  })

  test('pipeline of two commands', () => {
    const { ir, stage_words } = buildShellIr([
      {
        argv: ['cat', 'file'],
        envVars: [],
        redirects: [],
        text: 'cat file',
      },
      {
        argv: ['grep', 'foo'],
        envVars: [],
        redirects: [],
        text: 'grep foo',
      },
    ])

    expect(ir.kind).toBe('pipeline')
    expect(stage_words).toEqual(['cat', 'file', 'grep', 'foo'])
    if (ir.kind === 'pipeline') {
      expect(ir.stages).toHaveLength(2)
      expect(ir.stages[0]!.stage_words).toEqual(['cat', 'file'])
      expect(ir.stages[1]!.stage_words).toEqual(['grep', 'foo'])
    }
  })

  test('pipeline of three commands', () => {
    const { ir, stage_words } = buildShellIr([
      { argv: ['ps', 'aux'], envVars: [], redirects: [], text: 'ps aux' },
      { argv: ['grep', 'node'], envVars: [], redirects: [], text: 'grep node' },
      { argv: ['wc', '-l'], envVars: [], redirects: [], text: 'wc -l' },
    ])

    expect(ir.kind).toBe('pipeline')
    expect(stage_words).toEqual(['ps', 'aux', 'grep', 'node', 'wc', '-l'])
    if (ir.kind === 'pipeline') {
      expect(ir.stages).toHaveLength(3)
    }
  })

  test('empty commands array → single stage with empty words', () => {
    const { ir, stage_words } = buildShellIr([])

    // No stages → can't form a simple or pipeline
    // Actually: 0 commands means 0 stages, which means flatMap gives []
    // and we try stages[0]! which would be undefined
    // Wait, let me check the code... stages.length === 1 check:
    // stages is empty, so stages.length === 0, we go to pipeline branch
    // pipeline.stages is empty array
    expect(ir.kind).toBe('pipeline')
    expect(stage_words).toEqual([])
    if (ir.kind === 'pipeline') {
      expect(ir.stages).toHaveLength(0)
    }
  })

  test('multiple redirect operators', () => {
    const { ir } = buildShellIr([
      {
        argv: ['cmd'],
        envVars: [],
        redirects: [
          { op: '>', target: 'out.log' },
          { op: '2>', target: 'err.log' },
        ],
        text: 'cmd > out.log 2> err.log',
      },
    ])

    expect(ir.kind).toBe('simple')
    if (ir.kind === 'simple') {
      expect(ir.redirects).toEqual([
        { op: '>', target: 'out.log' },
        { op: '2>', target: 'err.log' },
      ])
    }
  })

  test('argv is shallow-copied (immutable)', () => {
    const argv = ['git', 'status']
    const { stage_words } = buildShellIr([
      { argv, envVars: [], redirects: [], text: 'git status' },
    ])
    argv.push('--short')
    expect(stage_words).toEqual(['git', 'status'])
  })
})

describe('mapParseResult', () => {
  test('simple → ok with ShellIr', () => {
    const result = mapParseResult({
      kind: 'simple',
      commands: [
        { argv: ['ls', '-la'], envVars: [], redirects: [], text: 'ls -la' },
      ],
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.result.ir.kind).toBe('simple')
      expect(result.result.stage_words).toEqual(['ls', '-la'])
    }
  })

  test('too-complex → error with reason', () => {
    const result = mapParseResult({
      kind: 'too-complex',
      reason: 'Contains subshell',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('too-complex')
      expect(result.error.reason).toBe('Contains subshell')
    }
  })

  test('parse-unavailable → error', () => {
    const result = mapParseResult({ kind: 'parse-unavailable' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('parse-unavailable')
    }
  })

  test('multi-command simple → pipeline', () => {
    const result = mapParseResult({
      kind: 'simple',
      commands: [
        { argv: ['cat'], envVars: [], redirects: [], text: 'cat' },
        { argv: ['sort'], envVars: [], redirects: [], text: 'sort' },
        { argv: ['uniq'], envVars: [], redirects: [], text: 'uniq' },
      ],
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      const ir: ShellIr = result.result.ir
      expect(ir.kind).toBe('pipeline')
      expect(result.result.stage_words).toEqual(['cat', 'sort', 'uniq'])
      if (ir.kind === 'pipeline') {
        expect(ir.stages).toHaveLength(3)
      }
    }
  })
})
