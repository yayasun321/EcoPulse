import { useState, useEffect } from "react";
import "./index.css";
import { urlToSearchQuery, searchShopping } from "./serper";
import Button from "./Button";
// ── Types ────────────────────────────────────────────────────────────────────

interface Alternative {
  title: string;
  price: number;
  priceStr?: string;
  rating?: number;
  source?: string;
  imageUrl?: string;
}

interface Product {
  name: string;
  price: number;
  priceStr: string | null;
  rating: number | null;
  ratingCount: number;
  site: string;
  url: string;
  icon?: string;
  alternatives: Alternative[];
}

interface LogEntry {
  name: string;
  price: number;
  verdict: string;
  date: string;
}

interface VerdictInfo {
  icon: string;
  label: string;

  headline: string;
  reason: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getSiteName(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "online store";
  }
}

async function fetchProduct(url: string): Promise<Product> {
  let name = "";
  let price = 0;
  let priceStr: string | null = null;

  try {
    const { origin, pathname } = new URL(url);
    const match = pathname.match(/^\/products\/([^/?]+)/);
    if (match) {
      const jsonUrl = `${origin}/products/${match[1]}.json`;
      const res = await fetch(jsonUrl);
      if (res.ok) {
        const data = await res.json();
        const p = data.product;
        const variant = p?.variants?.[0];
        if (p?.title) {
          const cleanTitle = p.title.replace(/\s+/g, " ").trim();
          const type = p.product_type?.replace(/\s+/g, " ").trim();
          name =
            type &&
            cleanTitle.split(" ").length <= 2 &&
            !cleanTitle.toLowerCase().includes(type.toLowerCase())
              ? `${cleanTitle} ${type}`
              : cleanTitle;
        }
        if (variant?.price) {
          price = parseFloat(variant.price) || 0;
          priceStr = `$${parseFloat(variant.price).toFixed(2)}`;
        }
      }
    }
  } catch {}

  if (!name) name = urlToSearchQuery(url);

  if (!priceStr && price === 0) {
    try {
      const cleanUrl = (() => {
        const u = new URL(url);
        [
          "com_cvv",
          "utm_source",
          "utm_medium",
          "utm_campaign",
          "utm_content",
          "currency",
        ].forEach((p) => u.searchParams.delete(p));
        return u.toString();
      })();
      const ml = await fetch(
        `https://api.microlink.io/?url=${encodeURIComponent(cleanUrl)}`,
      );
      const json = await ml.json();
      const data = json.data || {};
      const raw: string | undefined = data.price?.amount;
      if (raw) {
        price = parseFloat(raw.replace(/[^0-9.]/g, "")) || 0;
        priceStr = raw;
      }
    } catch {}
  }

  if (!name) name = "Product from link";

  let rating: number | null = null;
  let ratingCount = 0;
  let alternatives: Alternative[] = [];

  try {
    const results = await searchShopping(name);
    rating = results.product?.rating ?? null;
    ratingCount = results.product?.ratingCount ?? 0;
    alternatives = results.alternatives ?? [];

    if (!priceStr && price === 0 && results.product?.price > 0) {
      price = results.product.price;
      priceStr = results.product.priceStr;
    }
  } catch {}

  return {
    name,
    price,
    priceStr,
    rating,
    ratingCount,
    site: getSiteName(url),
    url,
    alternatives,
  };
}

// ── App ──────────────────────────────────────────────────────────────────────

export default function AppAntara() {
  const [page, setPage] = useState<"home" | "flow" | "verdict">("home");
  const [product, setProduct] = useState<Product | null>(null);
  const [budgetMin, setBudgetMin] = useState<number>(0);
  const [budgetMax, setBudgetMax] = useState<number>(0);
  const [avgScore, setAvgScore] = useState<number | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("eva_logs") ?? "[]") || [];
    } catch {
      return [];
    }
  });
  const [streak, setStreak] = useState<number>(() =>
    parseInt(localStorage.getItem("eva_streak") ?? "0", 10),
  );
  const [saved, setSaved] = useState<number>(() =>
    parseFloat(localStorage.getItem("eva_saved") ?? "0"),
  );
  const [verdict, setVerdict] = useState<string | null>(null);
  const [selectedAlt, setSelectedAlt] = useState<Alternative | null>(null);

  useEffect(() => {
    localStorage.setItem("eva_logs", JSON.stringify(logs));
  }, [logs]);
  useEffect(() => {
    localStorage.setItem("eva_streak", String(streak));
  }, [streak]);
  useEffect(() => {
    localStorage.setItem("eva_saved", String(saved));
  }, [saved]);

  function getVerdict(): string {
    if (product && budgetMax > 0 && product.price > budgetMax)
      return "do not buy";
    if (avgScore !== null && avgScore > 6) return "buy";
    return "do not buy";
  }

  function startFlow(chosenProduct: Product): void {
    setProduct(chosenProduct);
    setBudgetMin(0);
    setBudgetMax(0);
    setAvgScore(null);
    setPage("flow");
  }

  function goToVerdict(alt: Alternative | null): void {
    setSelectedAlt(alt);
    setVerdict(getVerdict());
    setPage("verdict");
  }

  function saveDecision(choice: string): void {
    const v = choice || verdict || "opt out";

    const today = new Date();
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const dateStr = `${months[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;

    const logName =
      v === "buy-alt" && selectedAlt ? selectedAlt.title : product!.name;
    const logPrice =
      v === "buy-alt" && selectedAlt ? selectedAlt.price : product!.price;
    const logVerdict = v === "buy-alt" ? "buy" : v;

    setLogs((old) => [
      { name: logName, price: logPrice, verdict: logVerdict, date: dateStr },
      ...old,
    ]);

    const altCheaper =
      (selectedAlt?.price ?? 0) > 0 &&
      (product?.price ?? 0) > 0 &&
      (selectedAlt?.price ?? 0) < product!.price;
    const altBetterRated =
      (selectedAlt?.rating ?? 0) > 0 &&
      (product?.rating ?? 0) > 0 &&
      (selectedAlt?.rating ?? 0) > (product?.rating ?? 0);
    const altIsBetterDeal = v === "buy-alt" && (altCheaper || altBetterRated);

    if (logVerdict === "opt out" || logVerdict === "wait" || altIsBetterDeal) {
      setSaved((old) => old + (logPrice || 0));
      setStreak((old) => old + 1);
    } else {
      setStreak(0);
    }

    setVerdict(null);
    setProduct(null);
    setPage("home");
  }

  if (page === "home") {
    return (
      <HomePage logs={logs} streak={streak} saved={saved} onStart={startFlow} />
    );
  }

  if (page === "flow") {
    return (
      <FlowPage
        product={product!}
        budgetMin={budgetMin}
        budgetMax={budgetMax}
        setBudgetMin={setBudgetMin}
        setBudgetMax={setBudgetMax}
        onAvgScore={setAvgScore}
        onBack={() => setPage("home")}
        onDone={goToVerdict}
      />
    );
  }

  if (page === "verdict") {
    return (
      <VerdictPage
        product={product!}
        verdict={verdict!}
        selectedAlt={selectedAlt}
        onSave={saveDecision}
        onHome={() => setPage("home")}
      />
    );
  }

  return null;
}

// ── Home Page ────────────────────────────────────────────────────────────────

const EXAMPLE_URL =
  "https://fifthandninth.com/products/blue-light-blocking-glasses-boston?variant=32219277754446&country=US&currency=USD&utm_medium=product_sync&utm_source=google&utm_content=sag_organic&utm_campaign=sag_organic&srsltid=AfmBOopt6-hUCKOSNN3QaxN_76kvtDJd9zFvZvWqbYT88PzQ1GoCDfyq6XY";

interface HomePageProps {
  logs: LogEntry[];
  streak: number;
  saved: number;
  onStart: (product: Product) => void;
}

function HomePage({ logs, streak, saved, onStart }: HomePageProps) {
  const [url, setUrl] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "loading" | "ready">("idle");
  const [product, setProduct] = useState<Product | null>(null);
  const [manualPrice, setManualPrice] = useState<string>("");

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Tab" && !url) {
      e.preventDefault();
      handleUrlChange({
        target: { value: EXAMPLE_URL },
      } as React.ChangeEvent<HTMLInputElement>);
    }
  }

  async function handleUrlChange(
    e: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const typed = e.target.value;
    setUrl(typed);
    setProduct(null);
    setStatus("idle");
    setManualPrice("");

    if (!typed.startsWith("http")) return;

    setStatus("loading");
    try {
      const fetched = await fetchProduct(typed);
      setProduct(fetched);
      setStatus("ready");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      const name =
        message === "Could not extract product name from URL"
          ? "Could not read this URL — try the direct product page link"
          : "Product from link";
      setProduct({
        name,
        price: 0,
        priceStr: null,
        rating: null,
        ratingCount: 0,
        site: getSiteName(typed),
        url: typed,
        alternatives: [],
      });
      setStatus("ready");
    }
  }

  const optedOutCount = logs.filter((log) => log.verdict !== "buy").length;
  const [showEvaluation, setShowEvaluation] = useState(false);
  return (
    <div className="page">
      <div className="home-wrap">
        <div className="home-head">
          <h1 className="home-title">
            Think before
            <br />
            you <em>buy.</em>
          </h1>
          <p className="home-sub">
            Eva helps you slow down, weigh the real cost and quality, and make a
            decision you won't regret.
          </p>
        </div>

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
            <div className="stat-val teal">
              {streak}
              {streak > 0 ? "🔥" : ""}
            </div>
            <div className="stat-lbl">Streak</div>
          </div>
        </div>

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
            <button
              className="enter-btn"
              onClick={() => {
                if (!product) return;
                const price =
                  product.price > 0
                    ? product.price
                    : parseFloat(manualPrice) || 0;
                onStart({ ...product, price });
              }}
              disabled={
                status !== "ready" ||
                (!product?.priceStr &&
                  (product?.price ?? 0) === 0 &&
                  !manualPrice)
              }
            >
              Analyse →
            </button>
          </div>

          {status === "loading" && (
            <div className="fetch-status visible">
              <div className="fetch-spinner" />
              <div className="fetch-text">Fetching product info…</div>
            </div>
          )}

          {status === "ready" && product && (
            <div className="fetch-preview visible">
              <div className="fetch-preview-icon">{product.icon}</div>
              <div className="fetch-preview-info">
                <div className="fetch-preview-name">{product.name}</div>
                <div className="fetch-preview-meta">{product.site}</div>
              </div>
              {product.priceStr || product.price > 0 ? (
                <div className="fetch-preview-price">
                  {product.priceStr || `$${product.price}`}
                </div>
              ) : (
                <input
                  className="range-input"
                  type="number"
                  placeholder="Price $"
                  min="0"
                  value={manualPrice}
                  onChange={(e) => setManualPrice(e.target.value)}
                  style={{ width: "80px" }}
                />
              )}
            </div>
          )}

          {status === "idle" && (
            <div className="enter-hint">Paste a link from Google Shopping</div>
          )}
        </div>
        <Button onClick={() => setShowEvaluation(true)}>
          Return to Home Page
        </Button>
      </div>
    </div>
  );
}

// ── Flow Page ────────────────────────────────────────────────────────────────

interface FlowPageProps {
  product: Product;
  budgetMin: number;
  budgetMax: number;
  setBudgetMin: (v: number) => void;
  setBudgetMax: (v: number) => void;
  onAvgScore: (score: number | null) => void;
  onBack: () => void;
  onDone: (alt: Alternative | null) => void;
}

function FlowPage({
  product,
  budgetMin,
  budgetMax,
  setBudgetMin,
  setBudgetMax,
  onAvgScore,
  onBack,
  onDone,
}: FlowPageProps) {
  const [step, setStep] = useState<number>(0);

  const progressPercent = ((step + 1) / 3) * 100;

  return (
    <div className="page flow-page">
      <div className="flow-topbar">
        <div className="back-btn" onClick={onBack}>
          ←
        </div>
        <div className="flow-product-name">{product?.name}</div>
        <div className="flow-step-indicator">Step {step + 1} of 3</div>
      </div>

      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="flow-body">
        {step === 0 && (
          <Step1CostAndQuality
            product={product}
            onAvgScore={onAvgScore}
            onNext={() => setStep(1)}
          />
        )}
        {step === 1 && (
          <Step2Budget
            product={product}
            budgetMin={budgetMin}
            budgetMax={budgetMax}
            setBudgetMin={setBudgetMin}
            setBudgetMax={setBudgetMax}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <Step3Alternatives
            product={product}
            budgetMin={budgetMin}
            budgetMax={budgetMax}
            onDone={onDone}
          />
        )}
      </div>
    </div>
  );
}

// ── Step 1 ───────────────────────────────────────────────────────────────────

interface Step1Props {
  product: Product;
  onAvgScore: (score: number | null) => void;
  onNext: () => void;
}

function Step1CostAndQuality({ product, onAvgScore, onNext }: Step1Props) {
  const price = product?.price || 0;
  const rating = product?.rating ?? null;
  const ratingCount = product?.ratingCount || 0;

  const satisfactionScore = rating !== null ? Math.round(rating * 2) : null;

  const altPrices = (product?.alternatives || [])
    .map((a) => a.price)
    .filter((p) => p > 0);
  const avgAltPrice = altPrices.length
    ? altPrices.reduce((a, b) => a + b, 0) / altPrices.length
    : 0;
  const priceScore =
    price > 0 && avgAltPrice > 0
      ? Math.min(10, (avgAltPrice / price) * 5)
      : null;
  const ratingScore = rating !== null ? rating * 2 : null;

  const valueComponents = (
    [priceScore, ratingScore] as (number | null)[]
  ).filter((v): v is number => v !== null);
  const valueScore = valueComponents.length
    ? Math.round(
        valueComponents.reduce((a, b) => a + b, 0) / valueComponents.length,
      )
    : null;

  interface Metric {
    label: string;
    score: number;
    color: string;
  }
  const metrics: Metric[] = (
    [
      satisfactionScore !== null && {
        label: "Customer satisfaction",
        score: satisfactionScore,
        color:
          satisfactionScore >= 7
            ? "green"
            : satisfactionScore >= 5
              ? "amber"
              : "red",
      },
      valueScore !== null && {
        label: "Value for money",
        score: valueScore,
        color: valueScore >= 7 ? "green" : valueScore >= 5 ? "amber" : "red",
      },
    ] as (Metric | false)[]
  ).filter((m): m is Metric => Boolean(m));

  const avgScore: number | null = metrics.length
    ? parseFloat(
        (metrics.reduce((s, m) => s + m.score, 0) / metrics.length).toFixed(1),
      )
    : null;

  let qualityLabel: string, pillClass: string;
  if (avgScore === null) {
    qualityLabel = "No rating data available";
    pillClass = "pill-mixed";
  } else if (avgScore >= 6.5) {
    qualityLabel = "Good overall quality";
    pillClass = "pill-good";
  } else if (avgScore >= 4.5) {
    qualityLabel = "Mixed quality signals";
    pillClass = "pill-mixed";
  } else {
    qualityLabel = "Quality concerns found";
    pillClass = "pill-poor";
  }

  function handleNext(): void {
    onAvgScore(avgScore);
    onNext();
  }

  return (
    <>
      <div className="cost-hero">
        <div className="cost-label">You're about to spend</div>
        <div className="cost-price">
          {price > 0 ? `$${price.toLocaleString()}` : "?"}
        </div>
        {price > 0 && (
          <>
            <div className="cost-divider" />
            <div className="cost-breakdown">
              <div className="cost-cell">
                <div className="cost-cell-lbl">Per month</div>
                <div className="cost-cell-val">
                  ${(price / 12).toFixed(0)}/mo
                </div>
              </div>
              <div className="cost-cell">
                <div className="cost-cell-lbl">If used daily</div>
                <div className="cost-cell-val">
                  ${(price / 365).toFixed(2)}/day
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="quality-card">
        <div className="quality-title">
          Quality breakdown · {product?.name}
          {ratingCount > 0 && (
            <span
              style={{
                fontWeight: 400,
                color: "var(--ink3)",
                marginLeft: "6px",
              }}
            >
              ({ratingCount.toLocaleString()} reviews)
            </span>
          )}
        </div>

        {metrics.length === 0 ? (
          <div
            style={{ fontSize: "13px", color: "var(--ink3)", padding: "8px 0" }}
          >
            No review data found on Google Shopping for this product.
          </div>
        ) : (
          metrics.map((m, i) => (
            <div className="quality-row" key={i}>
              <div className="quality-label">{m.label}</div>
              <div className="quality-bar-wrap">
                <div
                  className={`quality-bar bar-${m.color}`}
                  style={{ width: `${m.score * 10}%` }}
                />
              </div>
              <div className={`quality-score score-${m.color}`}>
                {m.score}/10
              </div>
            </div>
          ))
        )}

        <div className={`quality-verdict-pill ${pillClass}`}>
          {qualityLabel}
          {avgScore !== null ? ` · avg ${avgScore}/10` : ""}
        </div>
      </div>

      <button className="next-btn ready" onClick={handleNext}>
        Set my budget range →
      </button>
    </>
  );
}

// ── Step 2 ───────────────────────────────────────────────────────────────────

interface Step2Props {
  product: Product;
  budgetMin: number;
  budgetMax: number;
  setBudgetMin: (v: number) => void;
  setBudgetMax: (v: number) => void;
  onNext: () => void;
}

function Step2Budget({
  product,
  budgetMin,
  budgetMax,
  setBudgetMin,
  setBudgetMax,
  onNext,
}: Step2Props) {
  const price = product?.price || 0;

  let budgetMessage: React.ReactNode = null;
  if (price > 0 && budgetMax > 0) {
    if (price > budgetMax) {
      budgetMessage = (
        <span className="range-over">
          ⚠ Warning ${price} is ${price - budgetMax} over your max budget
        </span>
      );
    } else if (budgetMin > 0 && price < budgetMin) {
      budgetMessage = (
        <span className="range-under">
          ✓ ${price} is below your minimum — great value
        </span>
      );
    } else {
      budgetMessage = (
        <span className="range-ok">✓ ${price} fits your budget range</span>
      );
    }
  }

  return (
    <div className="eva-card">
      <div className="eva-header">
        <div className="eva-avatar-sm">🌿</div>
        <div>
          <div className="eva-name-sm">Eva</div>
          <div className="eva-step">Step 2 of 3</div>
        </div>
      </div>

      <div className="eva-question">What's your budget range for this?</div>

      {price > 0 && (
        <div
          style={{
            textAlign: "center",
            fontSize: "12px",
            color: "var(--ink3)",
            margin: "10px 0",
          }}
        >
          Product price:{" "}
          <strong style={{ color: "var(--ink)" }}>
            ${price.toLocaleString()}
          </strong>
        </div>
      )}

      <div className="range-row">
        <input
          className="range-input"
          type="number"
          placeholder="Min $"
          min="0"
          value={budgetMin || ""}
          onChange={(e) => setBudgetMin(parseFloat(e.target.value) || 0)}
        />
        <span className="range-sep">—</span>
        <input
          className="range-input"
          type="number"
          placeholder="Max $"
          min="0"
          value={budgetMax || ""}
          onChange={(e) => setBudgetMax(parseFloat(e.target.value) || 0)}
        />
      </div>

      <div className="range-status">{budgetMessage}</div>

      <button
        className={`next-btn${budgetMax > 0 ? " ready" : ""}`}
        onClick={() => {
          if (budgetMax > 0) onNext();
        }}
      >
        See alternatives →
      </button>
    </div>
  );
}

// ── Step 3 ───────────────────────────────────────────────────────────────────

interface Step3Props {
  product: Product;
  budgetMin: number;
  budgetMax: number;
  onDone: (alt: Alternative | null) => void;
}

function Step3Alternatives({
  product,
  budgetMin,
  budgetMax,
  onDone,
}: Step3Props) {
  const [picked, setPicked] = useState<number | null>(null);

  const alternatives = (product?.alternatives || []).filter((item) => {
    if (item.price === 0) return true;
    if (budgetMax > 0 && item.price > budgetMax) return false;
    if (budgetMin > 0 && item.price < budgetMin) return false;
    return true;
  });

  return (
    <>
      <div className="eva-card" style={{ marginBottom: "10px" }}>
        <div className="eva-header">
          <div className="eva-avatar-sm">🌿</div>
          <div>
            <div className="eva-name-sm">Eva</div>
            <div className="eva-step">Step 3 of 3</div>
          </div>
        </div>
        <div className="eva-question">
          Before you decide, here are alternatives from Google Shopping.
        </div>
      </div>

      {alternatives.length === 0 ? (
        <div
          className="enter-hint"
          style={{ textAlign: "center", padding: "20px 0" }}
        >
          {budgetMax > 0
            ? `No alternatives found within your $${budgetMin}–$${budgetMax} budget.`
            : "No alternatives found for this product."}
        </div>
      ) : (
        <div className="alts-step-grid">
          {alternatives.map((item, i) => {
            const isCheaper =
              product?.price > 0 &&
              item.price > 0 &&
              item.price < product.price;
            const saving = isCheaper
              ? Math.round(((product.price - item.price) / product.price) * 100)
              : null;

            return (
              <div
                key={i}
                className={`alt-step-card${picked === i ? " picked" : ""}`}
                onClick={() => setPicked(i)}
                style={{ cursor: "pointer" }}
              >
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt=""
                    style={{
                      width: "48px",
                      height: "48px",
                      objectFit: "contain",
                      borderRadius: "6px",
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div className="alt-step-icon">🛍️</div>
                )}
                <div className="alt-step-info">
                  <div className="alt-step-name">{item.title}</div>
                  <div className="alt-step-desc">{item.source}</div>
                  <div className="alt-step-price-row">
                    <span className="alt-step-price">
                      {item.price > 0
                        ? `$${item.price.toFixed(2)}`
                        : item.priceStr || "See site"}
                    </span>
                    {item.rating && (
                      <span className="alt-step-rating">⭐ {item.rating}</span>
                    )}
                  </div>
                  {saving !== null && (
                    <span className="alt-step-tag tag-cheap">
                      Save {saving}%
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button
        className="next-btn ready"
        onClick={() => onDone(picked !== null ? alternatives[picked] : null)}
      >
        Get my verdict →
      </button>
    </>
  );
}

// ── Verdict Page ─────────────────────────────────────────────────────────────

const VERDICT_INFO: Record<string, VerdictInfo> = {
  "do not buy": {
    icon: "⏸️",
    label: "Eva says: Hold off",
    headline: "This doesn't look like the right purchase right now.",
    reason:
      "Either it's over budget or the quality signals aren't strong enough.",
  },
  wait: {
    icon: "⏸️",
    label: "Eva says: There are better options here",
    headline: "You might want this but I'm not sure it's best for you.",
    reason: "This product may not offer the best value for its price.",
  },
  buy: {
    icon: "✅",
    label: "Eva says: Go ahead",
    headline: "This looks like a considered purchase.",
    reason: "You've thought this through and it fits your budget. Go for it.",
  },
};

interface VerdictPageProps {
  product: Product;
  verdict: string;
  selectedAlt: Alternative | null;
  onSave: (choice: string) => void;
  onHome: () => void;
}

function VerdictPage({
  product,
  verdict,
  selectedAlt,
  onSave,
  onHome,
}: VerdictPageProps) {
  const v = verdict || "buy";
  const info = VERDICT_INFO[v];

  return (
    <div className="page">
      <div className="verdict-wrap">
        <div className={`verdict-card ${v}`}>
          <div className="verdict-icon">{info.icon}</div>
          <div className="verdict-label">{info.label}</div>
          <div className="verdict-headline">{info.headline}</div>
          <div className="verdict-reason">{info.reason}</div>
        </div>

        {selectedAlt && (
          <div style={{ margin: "14px 0 4px" }}>
            <div className="alts-title" style={{ marginBottom: "8px" }}>
              Your chosen alternative
            </div>
            <div
              className="alt-step-card picked"
              style={{
                display: "flex",
                gap: "12px",
                alignItems: "center",
                cursor: "default",
              }}
            >
              {selectedAlt.imageUrl ? (
                <img
                  src={selectedAlt.imageUrl}
                  alt=""
                  style={{
                    width: "48px",
                    height: "48px",
                    objectFit: "contain",
                    borderRadius: "6px",
                    flexShrink: 0,
                  }}
                />
              ) : (
                <div className="alt-step-icon">🛍️</div>
              )}
              <div className="alt-step-info">
                <div className="alt-step-name">{selectedAlt.title}</div>
                <div className="alt-step-desc">{selectedAlt.source}</div>
                <div className="alt-step-price">
                  {selectedAlt.price > 0
                    ? `$${selectedAlt.price.toFixed(2)}`
                    : selectedAlt.priceStr || "See site"}
                </div>
              </div>
            </div>
          </div>
        )}

        <div
          className="alts-title"
          style={{ marginBottom: "10px", marginTop: "14px" }}
        >
          What do you want to do?
        </div>
        <div className="verdict-actions">
          <button className="vbtn vbtn-primary" onClick={() => onSave("buy")}>
            Buy original
            {selectedAlt && product?.price > 0 ? ` · $${product.price}` : ""}
          </button>
          {selectedAlt && (
            <button
              className="vbtn vbtn-primary"
              onClick={() => onSave("buy-alt")}
            >
              Buy alternative
              {selectedAlt.price > 0
                ? ` · $${selectedAlt.price.toFixed(2)}`
                : ""}
            </button>
          )}
          <button className="vbtn vbtn-ghost" onClick={() => onSave("opt out")}>
            opt out it
          </button>
        </div>

        <button
          className="vbtn vbtn-ghost"
          style={{ marginTop: "8px" }}
          onClick={onHome}
        >
          ← Start over
        </button>
      </div>
    </div>
  );
}
