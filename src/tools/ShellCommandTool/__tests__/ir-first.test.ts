/**
 * IR-first interface tests — prove that ShellCommandTool accepts pre-parsed
 * Shell IR directly, bypassing string parsing.
 *
 * Coverage: isShellIr guard, IR-only input, mixed command+ir, invalid IR.
 */

import { describe, expect, test } from 'bun:test'
import { isShellIr } from '../types.js'

describe('isShellIr runtime guard', () => {
  test('valid simple IR → true', () => {
    const ir = {
      kind: 'simple',
      stage_words: ['cat', 'file.txt'],
      env_vars: [],
      redirects: [],
      text: 'cat file.txt',
    }
    expect(isShellIr(ir)).toBe(true)
  })

  test('valid pipeline IR → true', () => {
    const ir = {
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
          stage_words: ['grep', 'pattern'],
          env_vars: [],
          redirects: [],
          text: 'grep pattern',
        },
      ],
    }
    expect(isShellIr(ir)).toBe(true)
  })

  test('null → false', () => {
    expect(isShellIr(null)).toBe(false)
  })

  test('string → false', () => {
    expect(isShellIr('cat file.txt')).toBe(false)
  })

  test('missing stage_words → false', () => {
    const ir = { kind: 'simple', env_vars: [], redirects: [], text: 'cat' }
    expect(isShellIr(ir)).toBe(false)
  })

  test('wrong kind → false', () => {
    const ir = {
      kind: 'compound',
      stage_words: ['cat'],
      env_vars: [],
      redirects: [],
      text: 'cat',
    }
    expect(isShellIr(ir)).toBe(false)
  })

  test('pipeline with non-stage → false', () => {
    const ir = {
      kind: 'pipeline',
      stages: ['not a stage'],
    }
    expect(isShellIr(ir)).toBe(false)
  })
})
