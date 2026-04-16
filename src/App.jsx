import { useState, useRef, useEffect } from 'react'
import './index.css'
import { urlToSearchQuery, searchShopping } from './serper'


function getSiteName(url) {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return 'online store'
  }
}

// Extracts a search query from the pasted URL, searches Google
// Shopping, and returns the top result as the product plus
// remaining results as alternatives.
async function fetchProduct(url) {
  let name     = ''
  let price    = 0
  let priceStr = null

// shopify stores expose a free public JSON endpoint 
  try {
    const { origin, pathname } = new URL(url)
    const match = pathname.match(/^\/products\/([^/?]+)/)
    if (match) {
      const jsonUrl = `${origin}/products/${match[1]}.json`
      console.log('[Step 1] Trying Shopify JSON:', jsonUrl)
      const res = await fetch(jsonUrl)
      console.log('[Step 1] Shopify response status:', res.status)
      if (res.ok) {
        const data    = await res.json()
        const p       = data.product
        const variant = p?.variants?.[0]
        console.log('[Step 1] Shopify product:', p?.title, '| type:', p?.product_type, '| price:', variant?.price)
        if (p?.title) {
          // whitespace
          const cleanTitle = p.title.replace(/\s+/g, ' ').trim()
          // Append product_type if the title alone is not descriptive enough
          const type = p.product_type?.replace(/\s+/g, ' ').trim()
          name = (type && cleanTitle.split(' ').length <= 2 && !cleanTitle.toLowerCase().includes(type.toLowerCase()))
            ? `${cleanTitle} ${type}`
            : cleanTitle
        }
        if (variant?.price) {
          price    = parseFloat(variant.price) || 0
          priceStr = `$${parseFloat(variant.price).toFixed(2)}`
        }
      }
    } else {
      console.log('[Step 1] Not a Shopify URL — skipping')
    }
  } catch (e) { console.log('[Step 1] Shopify fetch failed:', e.message) }

  // Always prefer the URL path for the product name — it's more reliable than
  // page titles which can be the site name or require JavaScript to render
  if (!name) name = urlToSearchQuery(url)

  // Microlink fetches the page for price 
  if (!priceStr && price === 0) {
    console.log('[Step 2] Trying Microlink...')
    try {
      // Strip tracking params
      const cleanUrl = (() => {
        const u = new URL(url)
        ;['com_cvv', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'currency'].forEach(p => u.searchParams.delete(p))
        return u.toString()
      })()
      const ml   = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(cleanUrl)}`)
      const json = await ml.json()
      const data = json.data || {}
      console.log('[Step 2] Microlink price:', data.price)
      const raw = data.price?.amount
      if (raw) {
        price    = parseFloat(raw.replace(/[^0-9.]/g, '')) || 0
        priceStr = raw
      }
    } catch (e) { console.log('[Step 2] Microlink failed:', e.message) }
  }

  if (!name) name = 'Product from link'
  console.log('[After steps 1+2] name:', name, '| price:', price, '| priceStr:', priceStr)

  // Get ratings/alt. from Serper
  let rating       = null
  let ratingCount  = 0
  let alternatives = []

  try {
    console.log('[Step 3] Searching Serper for:', name)
    const results = await searchShopping(name)
    console.log('[Step 3] Serper top result:', results.product)
    rating       = results.product?.rating      || null
    ratingCount  = results.product?.ratingCount || 0
    alternatives = results.alternatives          || []

    if (!priceStr && price === 0 && results.product?.price > 0) {
      price    = results.product.price
      priceStr = results.product.priceStr
      console.log('[Step 3] Using Serper price:', priceStr)
    }
  } catch (e) { console.log('[Step 3] Serper failed:', e.message) }

  return {
    name,
    price,
    priceStr,
    rating,
    ratingCount,
    site: getSiteName(url),
    url,
    alternatives,
  }
}


export default function App() {
  const [page, setPage] = useState('home')      // which screen is showing right now
  const [product, setProduct] = useState(null)  // the product the user is evaluating
  const [budgetMin, setBudgetMin] = useState(0) // the user's minimum budget (from step 2)
  const [budgetMax, setBudgetMax] = useState(0) // the user's maximum budget (from step 2)
  // Load persisted values from localStorage on first render, fall back to empty defaults
  const [logs, setLogs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('eva_logs')) || [] } catch { return [] }
  })
  const [streak, setStreak] = useState(() => {
    return parseInt(localStorage.getItem('eva_streak') || '0', 10)
  })
  const [saved, setSaved] = useState(() => {
    return parseFloat(localStorage.getItem('eva_saved') || '0')
  })
  const [verdict, setVerdict] = useState(null)      
  const [selectedAlt, setSelectedAlt] = useState(null) 

  // Persist logs, streak, and saved to localStorage whenever they change
  useEffect(() => { localStorage.setItem('eva_logs',   JSON.stringify(logs)) }, [logs])
  useEffect(() => { localStorage.setItem('eva_streak', String(streak)) },       [streak])
  useEffect(() => { localStorage.setItem('eva_saved',  String(saved)) },        [saved])

  // Decide whether the user should buy or wait based on budget
  function getVerdict() {
    if (product && budgetMax > 0 && product.price > budgetMax) {
      return 'do not buy'
    }
    return 'buy'
  }

  // Called when the user clicks "Analyse →" on the home screen.
  // Sets the product and navigates to the flow screen.
  function startFlow(chosenProduct) {
    setProduct(chosenProduct)
    setBudgetMin(0)
    setBudgetMax(0)
    setPage('flow')
  }

  // Called when the user finishes all 3 flow steps.
  // Calculates the verdict and shows it.
  function goToVerdict(alt) {
    setSelectedAlt(alt || null)
    setVerdict(getVerdict())
    setPage('verdict')
  }

  // Called when the user clicks "Log my decision" on the verdict screen.
  // Saves the decision to the log and goes back home.
  function saveDecision(choice) {
    const v = choice || verdict || 'skip'

    // Build a date string like "Apr 15, 2026"
    const today = new Date()
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const dateStr = `${months[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`

    // When user picks "Buy this instead", log the alternative's details
    const logName  = v === 'buy-alt' && selectedAlt ? selectedAlt.title : product.name
    const logPrice = v === 'buy-alt' && selectedAlt ? selectedAlt.price : product.price
    const logVerdict = v === 'buy-alt' ? 'buy' : v

    // Create a new log entry object
    const newEntry = {
      name:    logName,
      price:   logPrice,
      verdict: logVerdict,
      date:    dateStr,
    }

    // Add the new entry to the TOP of the log list
    setLogs(old => [newEntry, ...old])

    // Alt counts as a streak win if it's cheaper and/or better rated than the original
    const altCheaper     = selectedAlt?.price  > 0 && product?.price  > 0 && selectedAlt.price  <  product.price
    const altBetterRated = selectedAlt?.rating > 0 && product?.rating > 0 && selectedAlt.rating >  product.rating
    const altIsBetterDeal = v === 'buy-alt' && (altCheaper || altBetterRated)

    if (logVerdict === 'skip' || logVerdict === 'wait' || altIsBetterDeal) {
      setSaved(old => old + (logPrice || 0))
      setStreak(old => old + 1)
    } else {
      setStreak(0) // buying at same/higher price resets the streak
    }

    // Clear the current product and go back to the home screen
    setVerdict(null)
    setProduct(null)
    setPage('home')
  }

  // Show the right screen based on the value of 'page'
  if (page === 'home') {
    return (
      <HomePage
        logs={logs}
        streak={streak}
        saved={saved}
        onStart={startFlow}
      />
    )
  }

  if (page === 'flow') {
    return (
      <FlowPage
        product={product}
        budgetMin={budgetMin}
        budgetMax={budgetMax}
        setBudgetMin={setBudgetMin}
        setBudgetMax={setBudgetMax}
        onBack={() => setPage('home')}
        onDone={goToVerdict}
      />
    )
  }

  if (page === 'verdict') {
    return (
      <VerdictPage
        product={product}
        verdict={verdict}
        selectedAlt={selectedAlt}
        onSave={saveDecision}
        onHome={() => setPage('home')}
      />
    )
  }
}


// HOME PAGE
// Shows the stats (saved/opted out/streak),
// a URL input box
const EXAMPLE_URL = 'https://fifthandninth.com/products/blue-light-blocking-glasses-boston?variant=32219277754446&country=US&currency=USD&utm_medium=product_sync&utm_source=google&utm_content=sag_organic&utm_campaign=sag_organic&srsltid=AfmBOopt6-hUCKOSNN3QaxN_76kvtDJd9zFvZvWqbYT88PzQ1GoCDfyq6XY'

function HomePage({ logs, streak, saved, onStart }) {
  const [url, setUrl] = useState('')           // what the user has typed in the box
  const [status, setStatus] = useState('idle') // 'idle' | 'loading' | 'ready'
  const [product, setProduct] = useState(null) // the product found from the URL
  const [manualPrice, setManualPrice] = useState('') // typed price when API can't find it

  // useRef lets us hold onto the timer ID so we can cancel it.
  // We use ref (not state) because changing it shouldn't re-render the page.
  const timerRef = useRef(null)

  function handleKeyDown(e) {
    if (e.key === 'Tab' && !url) {
      e.preventDefault()
      handleUrlChange({ target: { value: EXAMPLE_URL } })
    }
  }

  // Called every time the user types in the URL input box
  function handleUrlChange(e) {
    const typed = e.target.value
    setUrl(typed)
    setProduct(null)
    setStatus('idle')
    setManualPrice('')


    // Only start the fetch if it looks like a real URL
    if (!typed.startsWith('http')) return

    // Show the spinner, then wait 600ms after the user stops typing before fetching
    setStatus('loading')

    timerRef.current = setTimeout(async () => {
      try {
        const fetched = await fetchProduct(typed)
        setProduct(fetched)
        setStatus('ready')
      } catch (err) {
        // Show a specific message if we couldn't extract a product name from the URL
        const name = err.message === 'Could not extract product name from URL'
          ? 'Could not read this URL — try the direct product page link'
          : 'Product from link'
        setProduct({ name, price: 0, site: getSiteName(typed), url: typed, alternatives: [] })
        setStatus('ready')
      }
    }, 600)
  }

  // Count how many past decisions were NOT a buy (i.e. the user optedOut)
  const optedOutCount = logs.filter(log => log.verdict !== 'buy').length

  return (
    <div className="page">
      <div className="home-wrap">

        {/* ── Logo and title ── */}
        <div className="home-head">
          <h1 className="home-title">Think before<br />you <em>buy.</em></h1>
          <p className="home-sub">
            Eva helps you slow down, weigh the real cost and quality, and make a decision you won't regret.
          </p>
        </div>

        {/* ── Three stats: money saved, times opted out, current streak ── */}
        <div className="stats-bar">
          <div className="stat-card">
            <div className="stat-val green">${saved.toLocaleString()}</div>
            <div className="stat-lbl">Saved</div>
          </div>
          <div className="stat-card">
            <div className="stat-val amber">{optedOutCount}</div>
            <div className="stat-lbl">Opted out</div>
          </div>
          <div className="stat-card">
            <div className="stat-val teal">{streak}{streak > 0 ? '🔥' : ''}</div>
            <div className="stat-lbl">Streak</div>
          </div>
        </div>

        {/* ── URL input card ── */}
        <div className="enter-card">
          <div className="enter-label">Paste your product link</div>
          <div className="input-row">
            <input
              className="product-input"
              type="url"
              placeholder="https://fifthandninth.com/products/blue-light-blocking-glasses-boston…"
              value={url}
              onChange={handleUrlChange}
              onKeyDown={handleKeyDown}
            />
            {/* The button is disabled until a product has been loaded (and price is known if needed) */}
            <button
              className="enter-btn"
              onClick={() => {
                const price = product.price > 0 ? product.price : parseFloat(manualPrice) || 0
                onStart({ ...product, price })
              }}
              disabled={status !== 'ready' || (!product?.priceStr && product?.price === 0 && !manualPrice)}
            >
              Analyse →
            </button>
          </div>

          {/* Show a spinner while the product is "loading" */}
          {status === 'loading' && (
            <div className="fetch-status visible">
              <div className="fetch-spinner" />
              <div className="fetch-text">Fetching product info…</div>
            </div>
          )}

          {/* Show the product preview once it's ready */}
          {status === 'ready' && product && (
            <div className="fetch-preview visible">
              <div className="fetch-preview-icon">{product.icon}</div>
              <div className="fetch-preview-info">
                <div className="fetch-preview-name">{product.name}</div>
                <div className="fetch-preview-meta">{product.site}</div>
              </div>
              {product.priceStr || product.price > 0 ? (
                <div className="fetch-preview-price">{product.priceStr || `$${product.price}`}</div>
              ) : (
                <input
                  className="range-input"
                  type="number"
                  placeholder="Price $"
                  min="0"
                  value={manualPrice}
                  onChange={e => setManualPrice(e.target.value)}
                  style={{ width: '80px' }}
                />
              )}
            </div>
          )}

          {/* Show a hint when nothing has been typed yet */}
          {status === 'idle' && (
            <div className="enter-hint">
              Paste a link from Google Shopping
            </div>
          )}
        </div>


      </div>
    </div>
  )
}



//   Step 1 → price + quality breakdown
//   Step 2 → enter your budget range
//   Step 3 → see alternative options
function FlowPage({ product, budgetMin, budgetMax, setBudgetMin, setBudgetMax, onBack, onDone }) {
  const [step, setStep] = useState(0) // starts at step 0 (first step)

  // The progress bar fills up as steps are completed.
  const progressPercent = ((step + 1) / 3) * 100

  function goToNextStep() {
    setStep(step + 1)
  }

  return (
    <div className="page flow-page">

      {/* Top bar with back button, product name, and step counter */}
      <div className="flow-topbar">
        <div className="back-btn" onClick={onBack}>←</div>
        <div className="flow-product-name">{product?.name}</div>
        <div className="flow-step-indicator">Step {step + 1} of 3</div>
      </div>

      {/* Blue progress bar — grows wider with each step */}
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
      </div>

      {/* Show the correct step component based on the value of 'step' */}
      <div className="flow-body">
        {step === 0 && (
          <Step1CostAndQuality product={product} onNext={goToNextStep} />
        )}
        {step === 1 && (
          <Step2Budget
            product={product}
            budgetMin={budgetMin}
            budgetMax={budgetMax}
            setBudgetMin={setBudgetMin}
            setBudgetMax={setBudgetMax}
            onNext={goToNextStep}
          />
        )}
        {step === 2 && (
          <Step3Alternatives product={product} budgetMin={budgetMin} budgetMax={budgetMax} onDone={onDone} />
        )}
      </div>
    </div>
  )
}

// Price breakdown and the quality scores

function Step1CostAndQuality({ product, onNext }) {
  const price       = product?.price       || 0
  const rating      = product?.rating      || null  // 0–5 from Google Shopping
  const ratingCount = product?.ratingCount || 0

  // Scale 0–5 star rating to a 0–10 score
  const satisfactionScore = rating ? Math.round(rating * 2) : null

  // Value for money: combines price-vs-alternatives and rating
  const altPrices = (product?.alternatives || []).map(a => a.price).filter(p => p > 0)
  const avgAltPrice = altPrices.length
    ? altPrices.reduce((a, b) => a + b, 0) / altPrices.length
    : 0
  const priceScore  = price > 0 && avgAltPrice > 0
    ? Math.min(10, (avgAltPrice / price) * 5)
    : null
  const ratingScore = rating ? rating * 2 : null  // 0–5 stars → 0–10
  const valueComponents = [priceScore, ratingScore].filter(v => v !== null)
  const valueScore = valueComponents.length
    ? Math.round(valueComponents.reduce((a, b) => a + b, 0) / valueComponents.length)
    : null

  // metrics if data is provided
  const metrics = [
    satisfactionScore !== null && { label: 'Customer satisfaction', score: satisfactionScore, color: satisfactionScore >= 7 ? 'green' : satisfactionScore >= 5 ? 'amber' : 'red' },
    valueScore        !== null && { label: 'Value for money',        score: valueScore,        color: valueScore >= 7        ? 'green' : valueScore >= 5        ? 'amber' : 'red' },
  ].filter(Boolean)

  const avgScore = metrics.length
    ? (metrics.reduce((s, m) => s + m.score, 0) / metrics.length).toFixed(1)
    : null

  let qualityLabel, pillClass
  if (avgScore === null) {
    qualityLabel = 'No rating data available'
    pillClass = 'pill-mixed'
  } else if (avgScore >= 6.5) {
    qualityLabel = 'Good overall quality'
    pillClass = 'pill-good'
  } else if (avgScore >= 4.5) {
    qualityLabel = 'Mixed quality signals'
    pillClass = 'pill-mixed'
  } else {
    qualityLabel = 'Quality concerns found'
    pillClass = 'pill-poor'
  }

  return (
    <>
      {/* Big price display with per-month and per-day breakdown */}
      <div className="cost-hero">
        <div className="cost-label">You're about to spend</div>
        <div className="cost-price">
          {price > 0 ? `$${price.toLocaleString()}` : '?'}
        </div>
        {price > 0 && (
          <>
            <div className="cost-divider" />
            <div className="cost-breakdown">
              <div className="cost-cell">
                <div className="cost-cell-lbl">Per month</div>
                <div className="cost-cell-val">${(price / 12).toFixed(0)}/mo</div>
              </div>
              <div className="cost-cell">
                <div className="cost-cell-lbl">If used daily</div>
                <div className="cost-cell-val">${(price / 365).toFixed(2)}/day</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Quality card- data from Google Shopping */}
      <div className="quality-card">
        <div className="quality-title">
          Quality breakdown · {product?.name}
          {ratingCount > 0 && (
            <span style={{ fontWeight: 400, color: 'var(--ink3)', marginLeft: '6px' }}>
              ({ratingCount.toLocaleString()} reviews)
            </span>
          )}
        </div>

        {metrics.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--ink3)', padding: '8px 0' }}>
            No review data found on Google Shopping for this product.
          </div>
        ) : (
          metrics.map((m, i) => (
            <div className="quality-row" key={i}>
              <div className="quality-label">{m.label}</div>
              <div className="quality-bar-wrap">
                <div className={`quality-bar bar-${m.color}`} style={{ width: `${m.score * 10}%` }} />
              </div>
              <div className={`quality-score score-${m.color}`}>{m.score}/10</div>
            </div>
          ))
        )}

        <div className={`quality-verdict-pill ${pillClass}`}>
          {qualityLabel}{avgScore !== null ? ` · avg ${avgScore}/10` : ''}
        </div>
      </div>

      <button className="next-btn ready" onClick={onNext}>Set my budget range →</button>
    </>
  )
}

// Budget range

function Step2Budget({ product, budgetMin, budgetMax, setBudgetMin, setBudgetMax, onNext }) {
  const price = product?.price || 0

  // Build a message comparing the product price to the user's budget
  let budgetMessage = null
  if (price > 0 && budgetMax > 0) {
    if (price > budgetMax) {
      budgetMessage = (
        <span className="range-over">
           Warning ${price} is ${price - budgetMax} over your max budget
        </span>
      )
    } else if (budgetMin > 0 && price < budgetMin) {
      budgetMessage = (
        <span className="range-under">✓ ${price} is below your minimum — great value</span>
      )
    } else {
      budgetMessage = (
        <span className="range-ok">✓ ${price} fits your budget range</span>
      )
    }
  }

  return (
    <div className="eva-card">
      {/* Eva avatar header */}
      <div className="eva-header">
        <div className="eva-avatar-sm">🌿</div>
        <div>
          <div className="eva-name-sm">Eva</div>
          <div className="eva-step">Step 2 of 3</div>
        </div>
      </div>

      <div className="eva-question">What's your budget range for this?</div>

      {price > 0 && (
        <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--ink3)', margin: '10px 0' }}>
          Product price: <strong style={{ color: 'var(--ink)' }}>${price.toLocaleString()}</strong>
        </div>
      )}

      {/* Two number inputs side by side: Min and Max */}
      <div className="range-row">
        <input
          className="range-input"
          type="number"
          placeholder="Min $"
          min="0"
          value={budgetMin || ''}
          onChange={e => setBudgetMin(parseFloat(e.target.value) || 0)}
        />
        <span className="range-sep">—</span>
        <input
          className="range-input"
          type="number"
          placeholder="Max $"
          min="0"
          value={budgetMax || ''}
          onChange={e => setBudgetMax(parseFloat(e.target.value) || 0)}
        />
      </div>

      {/* Show the budget comparison message */}
      <div className="range-status">{budgetMessage}</div>

      {/* Button is only clickable once the user has typed a max budget */}
      <button
        className={`next-btn${budgetMax > 0 ? ' ready' : ''}`}
        onClick={() => { if (budgetMax > 0) onNext() }}
      >
        See alternatives →
      </button>
    </div>
  )
}

// ── Step 3: Alternative options ───────────────────────────────────────────

function Step3Alternatives({ product, budgetMin, budgetMax, onDone }) {
  const [picked, setPicked] = useState(null)

  // Filter to alternatives within the user's budget range
  const alternatives = (product?.alternatives || []).filter(item => {
    if (item.price === 0) return true // keep items with no price info
    if (budgetMax > 0 && item.price > budgetMax) return false
    if (budgetMin > 0 && item.price < budgetMin) return false
    return true
  })

  return (
    <>
      {/* Eva card header */}
      <div className="eva-card" style={{ marginBottom: '10px' }}>
        <div className="eva-header">
          <div className="eva-avatar-sm">🌿</div>
          <div>
            <div className="eva-name-sm">Eva</div>
            <div className="eva-step">Step 3 of 3</div>
          </div>
        </div>
        <div className="eva-question">Before you decide, here are alternatives from Google Shopping.</div>
      </div>

      {alternatives.length === 0 ? (
        <div className="enter-hint" style={{ textAlign: 'center', padding: '20px 0' }}>
          {budgetMax > 0
            ? `No alternatives found within your $${budgetMin}–$${budgetMax} budget.`
            : 'No alternatives found for this product.'}
        </div>
      ) : (
        <div className="alts-step-grid">
          {alternatives.map((item, i) => {
            const isCheaper = product?.price > 0 && item.price > 0 && item.price < product.price
            const saving    = isCheaper
              ? Math.round(((product.price - item.price) / product.price) * 100)
              : null

            return (
              <div
                key={i}
                className={`alt-step-card${picked === i ? ' picked' : ''}`}
                onClick={() => setPicked(i)}
                style={{ cursor: 'pointer' }}
              >
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt=""
                    style={{ width: '48px', height: '48px', objectFit: 'contain', borderRadius: '6px', flexShrink: 0 }}
                  />
                ) : (
                  <div className="alt-step-icon">🛍️</div>
                )}
                <div className="alt-step-info">
                  <div className="alt-step-name">{item.title}</div>
                  <div className="alt-step-desc">{item.source}</div>
                  <div className="alt-step-price">
                    {item.price > 0 ? `$${item.price.toFixed(2)}` : item.priceStr || 'See site'}
                  </div>
                  {saving !== null && (
                    <span className="alt-step-tag tag-cheap">Save {saving}%</span>
                  )}
                  {item.rating && (
                    <span className="alt-step-tag tag-best">⭐ {item.rating}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <button className="next-btn ready" onClick={() => onDone(picked !== null ? alternatives[picked] : null)}>Get my verdict →</button>
    </>
  )
}


// ============================================================
// VERDICT PAGE
//
// Shows the final recommendation: buy, wait 48 hours, or skip.
// Also shows alternative suggestions based on the verdict.
// ============================================================

// Text to display for each possible verdict
const VERDICT_INFO = {
  wait: {
    label: 'Eva says: There are better options here',
    headline: "You might want this but i'm not sure it's best for you.",
    reason: "This product may not offer the best value for its price.",
  },
  buy: {
    icon: '✅',
    label: 'Eva says: Go ahead',
    headline: 'This looks like a considered purchase.',
    reason: "You've thought this through and it fits your budget. Go for it.",
  },
}

function VerdictPage({ product, verdict, selectedAlt, onSave, onHome }) {
  const v    = verdict || 'buy'
  const info = VERDICT_INFO[v]

  return (
    <div className="page">
      <div className="verdict-wrap">

        {/* Main verdict card */}
        <div className={`verdict-card ${v}`}>
          <div className="verdict-icon">{info.icon}</div>
          <div className="verdict-label">{info.label}</div>
          <div className="verdict-headline">{info.headline}</div>
          <div className="verdict-reason">{info.reason}</div>
        </div>

        {/* If the user picked an alternative in Step 3, show it here */}
        {selectedAlt && (
          <div style={{ margin: '14px 0 4px' }}>
            <div className="alts-title" style={{ marginBottom: '8px' }}>Your chosen alternative</div>
            <div className="alt-step-card picked" style={{ display: 'flex', gap: '12px', alignItems: 'center', cursor: 'default' }}>
              {selectedAlt.imageUrl ? (
                <img
                  src={selectedAlt.imageUrl}
                  alt=""
                  style={{ width: '48px', height: '48px', objectFit: 'contain', borderRadius: '6px', flexShrink: 0 }}
                />
              ) : (
                <div className="alt-step-icon">🛍️</div>
              )}
              <div className="alt-step-info">
                <div className="alt-step-name">{selectedAlt.title}</div>
                <div className="alt-step-desc">{selectedAlt.source}</div>
                <div className="alt-step-price">
                  {selectedAlt.price > 0 ? `$${selectedAlt.price.toFixed(2)}` : selectedAlt.priceStr || 'See site'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* User makes the final call */}
        <div className="alts-title" style={{ marginBottom: '10px', marginTop: '14px' }}>What do you want to do?</div>
        <div className="verdict-actions">
          <button className="vbtn vbtn-primary" onClick={() => onSave('buy')}>
            Buy original{selectedAlt && product?.price > 0 ? ` · $${product.price}` : ''}
          </button>
          {selectedAlt ? (
            <button className="vbtn vbtn-primary" onClick={() => onSave('buy-alt')}>
              Buy alternative{selectedAlt.price > 0 ? ` · $${selectedAlt.price.toFixed(2)}` : ''}
            </button>
          ) : null}
          <button className="vbtn vbtn-ghost" onClick={() => onSave('skip')}>
            Skip it
          </button>
        </div>

        <button className="vbtn vbtn-ghost" style={{ marginTop: '8px' }} onClick={onHome}>
          ← Start over
        </button>

      </div>
    </div>
  )
}
