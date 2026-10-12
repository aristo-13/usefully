'use client'

import Image from 'next/image'
import { useState } from 'react'
import { Play } from 'lucide-react'

import type { ImageRef } from '@/lib/content/types'
import { videoEmbedUrl, videoThumbnailUrl, type VideoSource } from '@/lib/media'
import { cn } from '@/lib/utils'

/**
 * Plays a featured video. YouTube and Vimeo load only when the visitor presses
 * play (a still image stands in until then), which keeps pages fast and sends
 * nothing to those sites unless the video is watched.
 */
export function VideoPlayer({
  video,
  title,
  poster,
  className,
  onError,
}: {
  video: VideoSource
  title: string
  poster?: ImageRef | null
  className?: string
  /** Called when a video file cannot be loaded (used by the editor preview). */
  onError?: () => void
}) {
  const [playing, setPlaying] = useState(false)
  const frame = cn('relative block aspect-video w-full overflow-hidden rounded-lg border border-border bg-black', className)

  if (video.provider === 'file') {
    return (
      <div className={frame}>
        <video
          src={video.url}
          poster={poster?.src}
          controls
          playsInline
          preload="metadata"
          aria-label={`Video: ${title}`}
          onError={onError}
          className="size-full"
        />
      </div>
    )
  }

  if (playing) {
    return (
      <div className={frame}>
        <iframe
          src={videoEmbedUrl(video, true)}
          title={`Video: ${title}`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
          className="absolute inset-0 size-full"
        />
      </div>
    )
  }

  const still = poster ?? (videoThumbnailUrl(video) ? { src: videoThumbnailUrl(video) ?? '', optimize: false } : null)
  return (
    <button type="button" onClick={() => setPlaying(true)} className={cn(frame, 'group cursor-pointer')}>
      <span className="sr-only">Play video: {title}</span>
      {still ? (
        <Image
          src={still.src}
          alt=""
          fill
          sizes="(min-width: 1024px) 48rem, 100vw"
          unoptimized={!still.optimize}
          className="object-cover opacity-90 transition-opacity group-hover:opacity-100"
        />
      ) : null}
      <span className="absolute inset-0 grid place-items-center">
        <span className="grid size-16 place-items-center rounded-full bg-black/70 text-white ring-1 ring-white/40 transition-transform group-hover:scale-105 group-focus-visible:scale-105">
          <Play aria-hidden className="ml-1 size-7 fill-current" />
        </span>
      </span>
      <span className="absolute right-2 bottom-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
        {video.provider === 'youtube' ? 'YouTube' : 'Vimeo'}
      </span>
    </button>
  )
}
