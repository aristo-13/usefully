import Link from 'next/link'
import type { ReactNode } from 'react'
import Markdown, { type Components } from 'react-markdown'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'

import { siteConfig } from '@/lib/site'
import { cn } from '@/lib/utils'

type HastNode = { type: string; tagName?: string; properties?: Record<string, unknown>; children?: HastNode[] }

/**
 * Marks where interludes go: before the 2nd, 3rd, 5th and 6th sections, or
 * after the 3rd, 6th, 9th and 12th paragraphs of a text without sections.
 * Only this plugin creates <aside> elements (Markdown HTML is skipped).
 */
function rehypeInterludes(count: number) {
  return () => (tree: unknown) => {
    const root = tree as HastNode
    const children = root.children ?? []
    const indexesOf = (tags: string[]) =>
      children.flatMap((node, index) => (node.type === 'element' && tags.includes(node.tagName ?? '') ? [index] : []))
    const headings = indexesOf(['h1', 'h2'])
    const paragraphs = indexesOf(['p'])
    const positions =
      headings.length >= 2
        ? [1, 2, 4, 5].flatMap((n) => (n < headings.length ? [headings[n]] : []))
        : [2, 5, 8, 11].flatMap((n) => (n < paragraphs.length - 1 ? [paragraphs[n] + 1] : []))
    // From the last to the first, so earlier positions stay valid.
    for (let slot = Math.min(count, positions.length) - 1; slot >= 0; slot--) {
      children.splice(positions[slot], 0, {
        type: 'element',
        tagName: 'aside',
        properties: { dataInterlude: slot },
        children: [],
      })
    }
  }
}

/** Links to this site written as full URLs open like any other internal link. */
function internalPath(href: string): string | null {
  if (href.startsWith('/') && !href.startsWith('//')) return href
  return href.startsWith(`${siteConfig.url}/`) ? href.slice(siteConfig.url.length) : null
}

// Raw HTML in Markdown is dropped (skipHtml) and unsafe URLs (javascript: etc.)
// are stripped by react-markdown's default URL transform.
const components: Components = {
  // The page title is the only <h1>; headings inside the body start at <h2>.
  h1: ({ node, ...props }) => {
    void node
    return <h2 {...props} />
  },
  a: ({ node, href, children, ...props }) => {
    void node
    // An empty href means the URL was removed as unsafe; keep only the text.
    if (!href) return <>{children}</>
    const path = internalPath(href)
    if (path) {
      return (
        <Link href={path} {...props}>
          {children}
        </Link>
      )
    }
    // Other sites open in a new tab, so the reader's place on this page is kept.
    if (/^https?:\/\//i.test(href)) {
      return (
        <a href={href} {...props} target="_blank" rel="noopener noreferrer">
          {children}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      )
    }
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  },
  img: ({ node, src, alt, title }) => {
    void node
    if (typeof src !== 'string' || !src) return null
    // Dimensions of inline images are unknown, so next/image cannot size them.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt ?? ''} title={title} loading="lazy" decoding="async" />
  },
  table: ({ node, ...props }) => {
    void node
    return (
      <div className="table-wrap">
        <table {...props} />
      </div>
    )
  },
}

export function MarkdownContent({
  source,
  className,
  id,
  interludes = [],
}: {
  source: string
  className?: string
  id?: string
  /** Blocks placed at natural breaks in the text, such as related links and ads, in order. */
  interludes?: ReactNode[]
}) {
  const withInterludes: Components = interludes.length
    ? {
        ...components,
        aside: ({ node }) => {
          const slot = node?.properties?.dataInterlude
          return typeof slot === 'number' ? <>{interludes[slot]}</> : null
        },
      }
    : components

  return (
    <div id={id} className={cn('prose-content', className)}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={interludes.length ? [rehypeSlug, rehypeInterludes(interludes.length)] : [rehypeSlug]}
        components={withInterludes}
        skipHtml
      >
        {source}
      </Markdown>
    </div>
  )
}
