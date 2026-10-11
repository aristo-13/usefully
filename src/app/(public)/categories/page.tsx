import type { Metadata } from 'next'
import Link from 'next/link'

import { Breadcrumbs } from '@/components/content/breadcrumbs'
import { EmptyState } from '@/components/content/listing'
import { categoryDescription } from '@/components/content/taxonomy-listing'
import { Container } from '@/components/ui/container'
import { getCategories } from '@/lib/content/queries'
import { pageMetadata } from '@/lib/seo'

const description = 'Browse every topic covered on the site, with the number of published pages in each.'

export async function generateMetadata(): Promise<Metadata> {
  const categories = await getCategories()
  return pageMetadata({
    title: 'Categories',
    description,
    path: '/categories',
    noindex: !categories.some((category) => category.count > 0),
  })
}

export default async function CategoriesPage() {
  const categories = (await getCategories()).filter((category) => category.count > 0)

  return (
    <Container className="py-8 md:py-10">
      <Breadcrumbs items={[{ name: 'Categories' }]} />
      <header className="mt-6 max-w-3xl">
        <h1 className="font-heading text-3xl font-semibold text-foreground md:text-[2.6rem]">Categories</h1>
        <p className="mt-3 text-lg leading-relaxed text-muted-foreground">{description}</p>
      </header>

      <div className="mt-8">
        {categories.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/categories/${category.slug}`}
                  className="block h-full rounded-lg border border-border p-5 transition-colors hover:border-foreground/30 hover:bg-accent/50"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-lg font-semibold text-foreground">{category.name}</span>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {category.count} {category.count === 1 ? 'page' : 'pages'}
                    </span>
                  </span>
                  <span className="mt-2 line-clamp-3 block text-sm leading-relaxed text-muted-foreground">
                    {categoryDescription(category)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No categories have published content yet." />
        )}
      </div>
    </Container>
  )
}
