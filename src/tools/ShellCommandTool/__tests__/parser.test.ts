/**
 * Parser tests — proves getBaseCommand and getAllBaseCommands work
 * correctly with typed ShellIr.
 *
 * parseToShellIr delegates to parseForSecurity (tree-sitter) and is
 * covered by integration tests. These unit tests cover the pure
 * IR-to-words extraction logic.
 */

import { describe, expect, test } from 'bun:test'
import { getBaseCommand, getAllBaseCommands } from '../ir-helpers.js'
import type { ShellIr } from '../types.js'

describe('getBaseCommand', () => {
  test('simple command → argv[0]', () => {
    const ir: ShellIr = {
      kind: 'simple',
      stage_words: ['git', 'push', 'origin', 'main'],
      env_vars: [],
      redirects: [],
      text: 'git push origin main',
    }
    expect(getBaseCommand(ir)).toBe('git')
  })

  test('simple command with no words → empty string', () => {
    const ir: ShellIr = {
      kind: 'simple',
      stage_words: [],
      env_vars: [],
      redirects: [],
      text: '',
    }
    expect(getBaseCommand(ir)).toBe('')
  })

  test('pipeline → first stage argv[0]', () => {
    const ir: ShellIr = {
      kind: 'pipeline',
      stages: [
        {
          kind: 'simple',
          stage_words: ['cat', 'file'],
          env_vars: [],
          redirects: [],
          text: 'cat file',
        },
        {
          kind: 'simple',
          stage_words: ['grep', 'foo'],
          env_vars: [],
          redirects: [],
          text: 'grep foo',
        },
      ],
    }
    expect(getBaseCommand(ir)).toBe('cat')
  })

  test('empty pipeline → empty string', () => {
    const ir: ShellIr = {
      kind: 'pipeline',
      stages: [],
    }
    expect(getBaseCommand(ir)).toBe('')
  })
})

describe('getAllBaseCommands', () => {
  test('simple command → [argv[0]]', () => {
    const ir: ShellIr = {
      kind: 'simple',
      stage_words: ['git', 'push'],
      env_vars: [],
      redirects: [],
      text: 'git push',
    }
    expect(getAllBaseCommands(ir)).toEqual(['git'])
  })

  test('pipeline → one per stage', () => {
    const ir: ShellIr = {
      kind: 'pipeline',
      stages: [
        {
          kind: 'simple',
          stage_words: ['cat', 'file'],
          env_vars: [],
          redirects: [],
          text: 'cat file',
        },
        {
          kind: 'simple',
          stage_words: ['grep', 'foo'],
          env_vars: [],
          redirects: [],
          text: 'grep foo',
        },
        {
          kind: 'simple',
          stage_words: ['wc', '-l'],
          env_vars: [],
          redirects: [],
          text: 'wc -l',
        },
      ],
    }
    expect(getAllBaseCommands(ir)).toEqual(['cat', 'grep', 'wc'])
  })

  test('empty stages are skipped', () => {
    const ir: ShellIr = {
      kind: 'pipeline',
      stages: [
        {
          kind: 'simple',
          stage_words: [],
          env_vars: [],
          redirects: [],
          text: '',
        },
        {
          kind: 'simple',
          stage_words: ['echo', 'hi'],
          env_vars: [],
          redirects: [],
          text: 'echo hi',
        },
      ],
    }
    expect(getAllBaseCommands(ir)).toEqual(['echo'])
  })
})
