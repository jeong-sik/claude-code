import type { FileStateCache } from '../../utils/fileStateCache.js'

export type TipContext = {
  shellCommandTools?: Set<string>
  readFileState?: FileStateCache
  theme?: string
}

export type Tip = {
  id: string
  content: (ctx?: TipContext) => Promise<string>
  cooldownSessions: number
  isRelevant: (ctx?: TipContext) => Promise<boolean>
}
