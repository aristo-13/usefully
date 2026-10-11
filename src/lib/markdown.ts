import 'server-only'

import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'

export type Heading = { id: string; text: string; level: 2 | 3 }

type HastNode = {
  type: string
  tagName?: string
  value?: string
  properties?: { id?: unknown }
  children?: HastNode[]
}

// Same plugins as <MarkdownContent>, so heading ids here match the rendered ids.
const processor = unified().use(remarkParse).use(remarkGfm).use(remarkRehype).use(rehypeSlug)

function textOf(node: HastNode): string {
  if (node.type === 'text') return node.value ?? ''
  return (node.children ?? []).map(textOf).join('')
}

/** Top-level sections (h1/h2 render as h2) and their subsections for a table of contents. */
export function extractHeadings(markdown: string): Heading[] {
  const tree = processor.runSync(processor.parse(markdown)) as unknown as HastNode
  const headings: Heading[] = []

  const visit = (node: HastNode) => {
    const tag = node.type === 'element' ? node.tagName : undefined
    if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
      const id = node.properties?.id
      const text = textOf(node).trim()
      if (typeof id === 'string' && text) {
        headings.push({ id, text, level: tag === 'h3' ? 3 : 2 })
      }
      return
    }
    node.children?.forEach(visit)
  }

  visit(tree)
  return headings
}
