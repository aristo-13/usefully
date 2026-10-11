import type { Metadata } from 'next'
import Link from 'next/link'

import { MediaCard } from '@/components/admin/media-card'
import { MediaUploader } from '@/components/admin/media-uploader'
import { PageHeader, Panel } from '@/components/admin/ui'
import { listMedia } from '@/lib/admin/queries'
import { requireAdmin } from '@/lib/auth'

export const metadata: Metadata = { title: 'Media' }

export default async function AdminMediaPage({ searchParams }: PageProps<'/admin/media'>) {
  await requireAdmin()
  const params = await searchParams
  const pageParam = Array.isArray(params.page) ? params.page[0] : params.page
  const page = Math.max(1, Math.min(10000, Number.parseInt(pageParam ?? '', 10) || 1))
  const { items, totalPages } = await listMedia(page)

  return (
    <>
      <PageHeader
        title="Media"
        description="Images for cover photos and article bodies. Copy the Markdown snippet to place an image inside an article."
      />
      <Panel title="Upload an image">
        <MediaUploader />
      </Panel>

      {items.length ? (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {items.map((item) => (
            <li key={item.id}>
              <MediaCard item={item} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 rounded-lg border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
          No images yet.
        </p>
      )}

      {totalPages > 1 ? (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={`/admin/media?page=${page - 1}`} className="text-link hover:underline">
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={`/admin/media?page=${page + 1}`} className="text-link hover:underline">
              Older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  )
}
