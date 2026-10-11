import type { Metadata } from 'next'

import { ContentTypeListing } from '@/components/content/listing'
import { getPageCount } from '@/lib/content/queries'
import { contentTypeConfig } from '@/lib/content/types'
import { pageMetadata } from '@/lib/seo'

const TYPE = 'resource'

export async function generateMetadata(): Promise<Metadata> {
  const config = contentTypeConfig[TYPE]
  const pages = await getPageCount({ type: TYPE })
  return pageMetadata({
    title: config.plural,
    description: config.description,
    path: config.path,
    // An empty section has nothing worth indexing yet.
    noindex: pages === 0,
  })
}

export default function ResourcesPage() {
  return <ContentTypeListing type={TYPE} page={1} />
}
