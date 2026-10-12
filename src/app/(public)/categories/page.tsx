import type { Metadata } from 'next'

import { Breadcrumbs } from '@/components/content/breadcrumbs'
import { CategoryCard, categoryGridClass } from '@/components/content/category-card'
import { EmptyState } from '@/components/content/listing'
import { LoadMore } from '@/components/content/load-more'
import { Container } from '@/components/ui/container'
import { getCategories } from '@/lib/content/queries'
import { PAGE_SIZE } from '@/lib/content/types'
import { pageMetadata } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const categories = await getCategories()
  return pageMetadata({
    title: 'Categories',
    description: 'Browse every topic covered on the site, with the number of published pages in each.',
    path: '/categories',
    noindex: !categories.some((category) => category.count > 0),
  })
}

export default async function CategoriesPage() {
  const categories = (await getCategories()).filter((category) => category.count > 0)
  const firstBatch = categories.slice(0, PAGE_SIZE)

  return (
    <Container className="py-8 md:py-10">
      <Breadcrumbs items={[{ name: 'Categories' }]} />
      <h1 className="sr-only">Categories</h1>

      <div className="mt-6">
        {firstBatch.length ? (
          <>
            <ul className={categoryGridClass}>
              {firstBatch.map((category) => (
                <li key={category.id}>
                  <CategoryCard category={category} />
                </li>
              ))}
            </ul>
            <LoadMore
              feed={{ kind: 'categories' }}
              nextPage={2}
              hasMore={categories.length > PAGE_SIZE}
              seenIds={firstBatch.map((category) => category.id)}
              layout="categories"
              label="Load more"
            />
          </>
        ) : (
          <EmptyState title="No categories have published content yet." />
        )}
      </div>
    </Container>
  )
}
