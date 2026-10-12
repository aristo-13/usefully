import Link from 'next/link'
import { notFound } from 'next/navigation'

import { DeleteButton } from '@/components/admin/delete-button'
import { TaxonomyForm } from '@/components/admin/taxonomy-form'
import { EmptyRow, Notice, PageHeader, Panel, tableClass, tdClass, thClass } from '@/components/admin/ui'
import { getTaxonomyItem, listTaxonomy } from '@/lib/admin/queries'
import { deleteCategory, deleteTag } from '@/lib/admin/taxonomy-actions'
import { requireAdmin } from '@/lib/auth'
import { cn, formatShortDate } from '@/lib/utils'

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const copy = {
  category: {
    table: 'categories',
    title: 'Categories',
    singular: 'category',
    description: 'Every item belongs to at most one category. Each category gets its own page.',
    publicBase: '/categories',
    adminBase: '/admin/categories',
    deleteNote: 'Items in this category become uncategorized; they are not deleted.',
  },
  tag: {
    table: 'tags',
    title: 'Tags',
    singular: 'tag',
    description: `Tags group related items across categories. Tag pages with fewer than two published items are kept out of search engines.`,
    publicBase: '/tags',
    adminBase: '/admin/tags',
    deleteNote: 'The tag is removed from all items; the items themselves are not deleted.',
  },
} as const

type Kind = keyof typeof copy

export async function TaxonomyIndex({
  kind,
  searchParams,
}: {
  kind: Kind
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdmin()
  const text = copy[kind]
  const [rows, params] = await Promise.all([listTaxonomy(text.table), searchParams])

  return (
    <>
      <PageHeader title={text.title} description={text.description} />
      {params.deleted ? <Notice tone="success">The {text.singular} was deleted.</Notice> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className={tableClass}>
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className={thClass}>
                  Name
                </th>
                <th scope="col" className={thClass}>
                  Slug
                </th>
                <th scope="col" className={cn(thClass, 'text-right')}>
                  Published items
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/30">
                    <td className={tdClass}>
                      <Link href={`${text.adminBase}/${row.id}`} className="font-medium text-foreground hover:underline">
                        {row.name}
                      </Link>
                      {kind === 'category' && !row.description ? (
                        <p className="mt-0.5 text-xs text-warning">No description yet</p>
                      ) : null}
                    </td>
                    <td className={cn(tdClass, 'text-muted-foreground')}>{row.slug}</td>
                    <td className={cn(tdClass, 'text-right tabular-nums')}>{row.publishedCount}</td>
                  </tr>
                ))
              ) : (
                <EmptyRow colSpan={3}>No {text.title.toLowerCase()} yet.</EmptyRow>
              )}
            </tbody>
          </table>
        </div>
        <Panel title={`Add a ${text.singular}`}>
          <TaxonomyForm kind={kind} />
        </Panel>
      </div>
    </>
  )
}

export async function TaxonomyEdit({ kind, params }: { kind: Kind; params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  if (!GUID.test(id)) notFound()
  const text = copy[kind]
  const item = await getTaxonomyItem(text.table, id)
  if (!item) notFound()

  return (
    <>
      <PageHeader
        backHref={text.adminBase}
        backLabel={text.title}
        title={item.name}
        description={`Last updated ${formatShortDate(item.updated_at)}`}
        actions={
          <a href={`${text.publicBase}/${item.slug}`} target="_blank" rel="noopener" className="text-sm text-link hover:underline">
            View on site<span className="sr-only"> (opens in a new tab)</span>
          </a>
        }
      />
      <div className="max-w-2xl space-y-10">
        <Panel>
          <TaxonomyForm kind={kind} item={item} />
        </Panel>
        <section className="space-y-3 border-t border-border pt-6">
          <h2 className="text-base font-semibold text-foreground">Delete this {text.singular}</h2>
          <p className="text-sm text-muted-foreground">{text.deleteNote}</p>
          <DeleteButton
            action={(kind === 'category' ? deleteCategory : deleteTag).bind(null, item.id)}
            confirmMessage={`Delete the ${text.singular} “${item.name}”? ${text.deleteNote}`}
            label={`Delete ${text.singular}`}
          />
        </section>
      </div>
    </>
  )
}
