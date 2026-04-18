// ============================================================
// SERPER.DEV GOOGLE SHOPPING API
//
// One search call returns the top product match plus
// alternative listings from other stores — used for both
// the product preview on the home screen and Step 3 alternatives.
//
// Credentials are read from .env:
//   VITE_SERPER_API_KEY → your Serper API key from serper.dev
// ============================================================

// Extract a readable search query from an e-commerce or Google Shopping URL.
export function urlToSearchQuery(url: string): string {
  try {
    const { hostname, pathname, searchParams } = new URL(url)

    // ── Google Shopping URLs ──────────────────────────────────────────────
    // e.g. https://www.google.com/shopping/product/...?q=sony+headphones
    if (hostname.includes('google.com')) {
      const q = searchParams.get('q') || searchParams.get('query')
      if (q) return q.trim()
    }

    // ── Amazon URLs ───────────────────────────────────────────────────────
    // e.g. /Sony-WH-1000XM5-Canceling-Headphones/dp/B0CH7PVPZ5/
    // The product name is always the segment immediately before /dp/
    if (hostname.includes('amazon')) {
      const parts = pathname.split('/')
      const dpIndex = parts.indexOf('dp')
      if (dpIndex > 0 && parts[dpIndex - 1]) {
        return parts[dpIndex - 1]
          .replace(/[-_]/g, ' ')
          .replace(/[^a-zA-Z0-9 ]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      }
    }

    // ── Generic fallback ──────────────────────────────────────────────────
    // Try the q/query param first (works for many search-based store URLs)
    const q = searchParams.get('q') || searchParams.get('query') || searchParams.get('search')
    if (q) return q.trim()

    // Otherwise pick the longest path segment that looks like a product name
    const segments = pathname.split('/').filter(Boolean)
    const best = segments
      .filter(s => s.length > 5 && /[a-zA-Z]/.test(s) && !/^\d+$/.test(s))
      .sort((a, b) => b.length - a.length)[0] || ''

    return best
      .replace(/[-_]/g, ' ')
      .replace(/[^a-zA-Z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  } catch {
    return ''
  }
}

// Search Google Shopping via Serper.
// Returns the top result as `product` and remaining results as `alternatives`.
export async function searchShopping(query: string) {
  const res = await fetch('/api/shopping', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query }),
  })

  if (!res.ok) throw new Error(`SERPER_ERROR:${res.status}`)

  const data = await res.json()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (data.shopping || []).map((item: any) => ({
    title:       item.title,
    price:       parseFloat((item.price || '0').replace(/[^0-9.]/g, '')) || 0,
    priceStr:    item.price || null,
    rating:      item.rating   || null, // 0–5
    ratingCount: item.ratingCount || 0,
    source:      item.source   || 'Unknown store',
    link:        item.link,
    imageUrl:    item.imageUrl || null,
  }))

  return {
    product:      items[0]    || null,
    alternatives: items.slice(1),
  }
}
