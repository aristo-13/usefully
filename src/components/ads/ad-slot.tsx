'use client'

import { useEffect, useRef } from 'react'

import { cn } from '@/lib/utils'

type AdsWindow = Window & { adsbygoogle?: unknown[] }

/**
 * A responsive in-article AdSense unit, labelled as an advertisement and kept
 * clear of links and buttons so it is never clicked by accident. Each unit is
 * requested once it is on the page, which also covers pages opened by client
 * side navigation (Auto ads only run on full page loads).
 */
export function AdSlot({ client, slot, className }: { client: string; slot: string; className?: string }) {
  const ref = useRef<HTMLModElement>(null)

  useEffect(() => {
    // An unit that already has an ad (or a request in flight) must not be pushed again.
    if (!ref.current || ref.current.dataset.adsbygoogleStatus) return
    try {
      const adsWindow = window as AdsWindow
      adsWindow.adsbygoogle = adsWindow.adsbygoogle ?? []
      adsWindow.adsbygoogle.push({})
    } catch {
      // Blocked by an ad blocker or not loaded: the unit stays empty and takes no space (.ad-slot in globals.css).
    }
  }, [])

  return (
    <aside aria-label="Advertisement" className={cn('interlude ad-slot', className)}>
      <p className="mb-1.5 text-center text-[0.7rem] tracking-wider text-muted-foreground uppercase">Advertisement</p>
      <ins
        ref={ref}
        className="adsbygoogle"
        style={{ display: 'block', textAlign: 'center' }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-layout="in-article"
        data-ad-format="fluid"
      />
    </aside>
  )
}
