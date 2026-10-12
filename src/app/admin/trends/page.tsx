import type { Metadata } from 'next'
import { Suspense } from 'react'

import { RefreshButton } from '@/components/admin/refresh-button'
import {
  ConnectSources,
  HeadlineList,
  OtherNetworks,
  ReadingList,
  RegionTabs,
  SearchTrendList,
  SectionSkeleton,
  SocialTrendList,
  TrendSection,
  VideoList,
} from '@/components/admin/trends'
import { AdminPageSkeleton, PageHeader } from '@/components/admin/ui'
import { refreshTrends } from '@/lib/admin/growth-actions'
import { listPostTitles } from '@/lib/admin/queries'
import type { PostTitle } from '@/lib/admin/types'
import { aiSetup } from '@/lib/ai/writer'
import { requireAdmin } from '@/lib/auth'
import { getHeadlines, getMostRead, getSearchTrends, getTrendingVideos, getXTrends, type Region } from '@/lib/trends'
import { GLOBAL_MARKETS, GLOBAL_VIDEO_MARKETS } from '@/lib/trends/sources'

export const metadata: Metadata = { title: 'Trends' }

export default function AdminTrendsPage(props: PageProps<'/admin/trends'>) {
  return (
    <Suspense fallback={<AdminPageSkeleton title="Trends" />}>
      <Trends {...props} />
    </Suspense>
  )
}

async function Trends({ searchParams }: PageProps<'/admin/trends'>) {
  await requireAdmin()
  const [params, posts] = await Promise.all([searchParams, listPostTitles()])
  const region: Region = params.region === 'global' ? 'global' : 'ghana'
  const place = region === 'ghana' ? 'in Ghana' : 'worldwide'
  const ai = aiSetup().enabled

  return (
    <>
      <PageHeader
        title="Trends"
        description={`What people are searching for and talking about right now. Start a post from any topic: the title, keywords and source are filled in for you${ai ? ", or Draft with AI to have the whole post researched and written for you to review" : ""}. Topics you have already written about are marked Covered.`}
        actions={<RefreshButton action={refreshTrends} />}
      />
      <RegionTabs region={region} />

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <TrendSection
          id="searches"
          title={`Top Google searches ${place}`}
          source={region === 'ghana' ? 'Google Trends, last 24 hours' : `Google Trends in ${GLOBAL_MARKETS.length} large markets`}
        >
          <Suspense fallback={<SectionSkeleton />}>
            <SearchTrends region={region} posts={posts} ai={ai} />
          </Suspense>
        </TrendSection>

        <TrendSection id="news" title={region === 'ghana' ? 'Top news in Ghana' : 'Top world news'} source="Google News">
          <Suspense fallback={<SectionSkeleton />}>
            <Headlines region={region} ai={ai} />
          </Suspense>
        </TrendSection>

        <TrendSection
          id="videos"
          title={`Popular on YouTube ${place}`}
          source={region === 'ghana' ? 'YouTube, Ghana' : `YouTube: ${GLOBAL_VIDEO_MARKETS.map((market) => market.name).join(', ')}`}
        >
          <Suspense fallback={<SectionSkeleton rows={3} />}>
            <Videos region={region} posts={posts} ai={ai} />
          </Suspense>
        </TrendSection>

        <TrendSection id="x" title={`Trending on X ${place}`} source="X API">
          <Suspense fallback={<SectionSkeleton />}>
            <XTrends region={region} posts={posts} ai={ai} />
          </Suspense>
        </TrendSection>

        {region === 'global' ? (
          <TrendSection id="wikipedia" title="Most read on Wikipedia" source="English Wikipedia, yesterday">
            <Suspense fallback={<SectionSkeleton />}>
              <MostRead posts={posts} ai={ai} />
            </Suspense>
          </TrendSection>
        ) : null}

        <OtherNetworks region={region} />
      </div>

      <ConnectSources />
    </>
  )
}

type ListProps = { region: Region; posts: PostTitle[]; ai: boolean }

async function SearchTrends({ region, posts, ai }: ListProps) {
  return <SearchTrendList result={await getSearchTrends(region)} region={region} posts={posts} aiEnabled={ai} />
}

async function Headlines({ region, ai }: Omit<ListProps, 'posts'>) {
  return <HeadlineList result={await getHeadlines(region)} region={region} aiEnabled={ai} />
}

async function Videos({ region, posts, ai }: ListProps) {
  return <VideoList result={await getTrendingVideos(region)} region={region} posts={posts} aiEnabled={ai} />
}

async function XTrends({ region, posts, ai }: ListProps) {
  return <SocialTrendList result={await getXTrends(region)} region={region} posts={posts} aiEnabled={ai} />
}

async function MostRead({ posts, ai }: Omit<ListProps, 'region'>) {
  return <ReadingList result={await getMostRead()} posts={posts} aiEnabled={ai} />
}
