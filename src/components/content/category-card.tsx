import Link from 'next/link'

import type { CategoryCardData } from '@/lib/content/feeds'

export const categoryGridClass = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'

export function categoryBlurb(category: Pick<CategoryCardData, 'name' | 'description'>) {
  return category.description || `Articles, tutorials, resources and downloads about ${category.name}.`
}

export function CategoryCard({ category }: { category: CategoryCardData }) {
  return (
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
        {categoryBlurb(category)}
      </span>
    </Link>
  )
}
