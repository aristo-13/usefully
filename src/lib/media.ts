// Media rules shared by the browser (uploads, previews) and the server
// (validation, rendering). Kept free of server-only imports.

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'] as const
export const VIDEO_TYPES = ['video/mp4', 'video/webm'] as const
export type ImageType = (typeof IMAGE_TYPES)[number]
export type VideoType = (typeof VIDEO_TYPES)[number]
export type MediaType = ImageType | VideoType

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024

export const MEDIA_EXTENSIONS: Record<MediaType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
}

export function isImageType(value: string): value is ImageType {
  return (IMAGE_TYPES as readonly string[]).includes(value)
}

export function isVideoType(value: string): value is VideoType {
  return (VIDEO_TYPES as readonly string[]).includes(value)
}

/** Why a file cannot be uploaded as `kind`, or null when it can. */
export function uploadProblem(file: { type: string; size: number }, kind: 'image' | 'video'): string | null {
  if (kind === 'image') {
    if (!isImageType(file.type)) return 'Use a JPEG, PNG, WebP, GIF or AVIF image.'
    if (file.size > MAX_IMAGE_BYTES) return 'Images must be 5 MB or smaller.'
  } else {
    if (!isVideoType(file.type)) return 'Use an MP4 or WebM video.'
    if (file.size > MAX_VIDEO_BYTES) return 'Videos must be 50 MB or smaller.'
  }
  return null
}

/** Pixel size of an image file, read in the browser before uploading. */
export async function readImageDimensions(file: File): Promise<{ width: number | null; height: number | null }> {
  try {
    const bitmap = await createImageBitmap(file)
    const size = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return size
  } catch {
    return { width: null, height: null }
  }
}

/** A video to play: an embed from YouTube or Vimeo, or a video file played directly. */
export type VideoSource =
  | { provider: 'youtube'; id: string; url: string }
  | { provider: 'vimeo'; id: string; hash: string | null; url: string }
  | { provider: 'file'; url: string }

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
])
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/
const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'])

/** Recognises YouTube and Vimeo links; any other https link is treated as a video file. */
export function parseVideoUrl(value: string | null | undefined): VideoSource | null {
  if (!value) return null
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null

  const host = url.hostname.toLowerCase()
  const parts = url.pathname.split('/').filter(Boolean)

  if (host === 'youtu.be' || YOUTUBE_HOSTS.has(host)) {
    let id = ''
    if (host === 'youtu.be') id = parts[0] ?? ''
    else if (parts[0] === 'watch') id = url.searchParams.get('v') ?? ''
    else if (['embed', 'shorts', 'live', 'v'].includes(parts[0] ?? '')) id = parts[1] ?? ''
    return YOUTUBE_ID.test(id) ? { provider: 'youtube', id, url: value } : null
  }

  if (VIMEO_HOSTS.has(host)) {
    const index = parts.findIndex((part) => /^\d{1,12}$/.test(part))
    if (index === -1) return null
    const hash = host === 'player.vimeo.com' ? url.searchParams.get('h') : (parts[index + 1] ?? null)
    return {
      provider: 'vimeo',
      id: parts[index],
      hash: hash && /^[0-9a-f]{6,20}$/i.test(hash) ? hash : null,
      url: value,
    }
  }

  return { provider: 'file', url: value }
}

/** Privacy-friendly player URL for a YouTube or Vimeo video. */
export function videoEmbedUrl(video: Exclude<VideoSource, { provider: 'file' }>, autoplay = false): string {
  if (video.provider === 'youtube') {
    return `https://www.youtube-nocookie.com/embed/${video.id}?rel=0${autoplay ? '&autoplay=1' : ''}`
  }
  const params = new URLSearchParams({ dnt: '1' })
  if (video.hash) params.set('h', video.hash)
  if (autoplay) params.set('autoplay', '1')
  return `https://player.vimeo.com/video/${video.id}?${params.toString()}`
}

/** Still image for a video, where one is available without an API call. */
export function videoThumbnailUrl(video: VideoSource | null): string | null {
  return video?.provider === 'youtube' ? `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg` : null
}
