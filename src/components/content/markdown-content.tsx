import Link from 'next/link'
import Markdown, { type Components } from 'react-markdown'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'

import { cn } from '@/lib/utils'

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
    if (href.startsWith('/') && !href.startsWith('//')) {
      return (
        <Link href={href} {...props}>
          {children}
        </Link>
      )
    }
    const external = /^https?:\/\//i.test(href)
    return (
      <a href={href} {...props} {...(external ? { rel: 'noopener noreferrer' } : {})}>
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

export function MarkdownContent({ source, className }: { source: string; className?: string }) {
  return (
    <div className={cn('prose-content', className)}>
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]} components={components} skipHtml>
        {source}
      </Markdown>
    </div>
  )
}
