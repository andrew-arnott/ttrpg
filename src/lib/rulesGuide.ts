import guide from '../../docs/PLAYERS_GUIDE.md?raw'
import { parseMarkdown, type Block } from './markdown'

/** The Player's Guide, ready to browse. */
export const GUIDE_BLOCKS: Block[] = parseMarkdown(guide)
