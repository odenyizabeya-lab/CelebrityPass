/**
 * Static company catalog for the Invest/Markets screens. Factual identity
 * (name, exchange, sector tags, exchange profile URLs) — pricing lives in
 * MarketDataService, never here.
 */

/**
 * Asset type token — drives which honest market-data provider serves a symbol.
 * CRYPTO → CoinGecko (free, no API key, no card). The rest → TwelveData free
 * tier. Prices are ALWAYS real/current from the configured provider; the
 * instant a provider can't answer, the UI shows "unavailable" — never an
 * invented number.
 */
export type CompanyType = "STOCK" | "ETF" | "CRYPTO" | "COMMODITY" | "INDEX";

export type Company = {
  symbol: string;
  name: string;
  exchange: string;
  /** Stock-type label shown on cards: "NASDAQ · STOCK" etc. Defaults to "STOCK". */
  type?: CompanyType;
  sectorTags: string[];
  description: string;
  profileUrl: string; // official market data page (exchange/NASDAQ or provider)
  accent: string; // tailwind-ish hex for the logo tile background
  mono: string; // short display string for logo tiles (e.g. "TSLA")
};

export const COMPANY_CATALOG: Company[] = [
  {
    symbol: "TSLA",
    name: "Tesla, Inc.",
    exchange: "NASDAQ",
    sectorTags: ["Electric Vehicles", "Clean Energy", "AI", "Robotics"],
    description:
      "Help power a cleaner, more sustainable future with Tesla, a global leader in electric vehicles, energy generation and storage, and AI-driven autonomy.",
    profileUrl: "https://www.nasdaq.com/market-activity/stocks/TSLA",
    accent: "#e82127",
    mono: "TSLA",
  },
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    exchange: "NASDAQ",
    sectorTags: ["Consumer Electronics", "Software", "Services"],
    description:
      "Designs, manufactures and markets smartphones, personal computers, wearables and digital services worldwide.",
    profileUrl: "https://www.nasdaq.com/market-activity/stocks/AAPL",
    accent: "#111827",
    mono: "AAPL",
  },
  {
    symbol: "MSFT",
    name: "Microsoft Corporation",
    exchange: "NASDAQ",
    sectorTags: ["Software", "Cloud", "AI"],
    description:
      "Develops and licenses software, devices and cloud services; a leading global enterprise technology company.",
    profileUrl: "https://www.nasdaq.com/market-activity/stocks/MSFT",
    accent: "#185abd",
    mono: "MSFT",
  },
  {
    symbol: "NVDA",
    name: "NVIDIA Corporation",
    exchange: "NASDAQ",
    sectorTags: ["Semiconductors", "AI", "GPU"],
    description:
      "Designs graphics and accelerated computing platforms powering gaming, data centers and artificial intelligence.",
    profileUrl: "https://www.nasdaq.com/market-activity/stocks/NVDA",
    accent: "#76b900",
    mono: "NVDA",
  },
  {
    symbol: "AMZN",
    name: "Amazon.com, Inc.",
    exchange: "NASDAQ",
    sectorTags: ["E-Commerce", "Cloud", "Logistics"],
    description:
      "Global e-commerce and cloud computing company spanning retail, AWS, devices and digital entertainment.",
    profileUrl: "https://www.nasdaq.com/market-activity/stocks/AMZN",
    accent: "#ff9900",
    mono: "AMZN",
  },
  {
    symbol: "GOOGL",
    name: "Alphabet Inc.",
    exchange: "NASDAQ",
    sectorTags: ["Search", "Cloud", "AI", "Advertising"],
    description:
      "Parent company of Google, spanning search, advertising, cloud computing, AI and autonomous vehicles.",
    profileUrl: "https://www.nasdaq.com/market-activity/stocks/GOOGL",
    accent: "#4285f4",
    mono: "GOOGL",
  },
  {
    symbol: "META",
    name: "Meta Platforms, Inc.",
    exchange: "NASDAQ",
    sectorTags: ["Social Media", "Advertising", "VR", "AI"],
    description:
      "Builds technologies that help people connect — Facebook, Instagram, WhatsApp and Reality Labs.",
    profileUrl: "https://www.nasdaq.com/market-activity/stocks/META",
    accent: "#0866ff",
    mono: "META",
  },
  /* ------------------------------------------------------------------ */
  /* Cryptocurrencies  — real-time & free via CoinGecko (no key, no card) */
  /* ------------------------------------------------------------------ */
  {
    symbol: "BTC",
    name: "Bitcoin",
    type: "CRYPTO",
    exchange: "CoinGecko",
    sectorTags: ["Crypto", "Store of Value", "Decentralized"],
    description:
      "The original decentralized digital currency, secured by proof-of-work and a global network of miners.",
    profileUrl: "https://www.coingecko.com/en/coins/bitcoin",
    accent: "#f7931a",
    mono: "₿",
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    type: "CRYPTO",
    exchange: "CoinGecko",
    sectorTags: ["Crypto", "Smart Contracts", "DeFi"],
    description:
      "A decentralized blockchain that runs smart contracts and powers the largest ecosystem of on-chain apps.",
    profileUrl: "https://www.coingecko.com/en/coins/ethereum",
    accent: "#627eea",
    mono: "Ξ",
  },
  {
    symbol: "SOL",
    name: "Solana",
    type: "CRYPTO",
    exchange: "CoinGecko",
    sectorTags: ["Crypto", "Smart Contracts", "Infrastructure"],
    description:
      "A high-performance blockchain designed for fast, low-cost transactions and a large DeFi/NFT ecosystem.",
    profileUrl: "https://www.coingecko.com/en/coins/solana",
    accent: "#9945ff",
    mono: "SOL",
  },
  {
    symbol: "XRP",
    name: "XRP",
    type: "CRYPTO",
    exchange: "CoinGecko",
    sectorTags: ["Crypto", "Payments", "Remittance"],
    description:
      "A digital asset built for fast, low-cost cross-border payments on the XRP Ledger.",
    profileUrl: "https://www.coingecko.com/en/coins/xrp",
    accent: "#23292f",
    mono: "XRP",
  },
  {
    symbol: "BNB",
    name: "BNB",
    type: "CRYPTO",
    exchange: "CoinGecko",
    sectorTags: ["Crypto", "Exchange Token", "Chain"],
    description:
      "The native token of BNB Chain and the Binance ecosystem, used for fees, staking and utilities.",
    profileUrl: "https://www.coingecko.com/en/coins/bnb",
    accent: "#f3ba2f",
    mono: "BNB",
  },
  {
    symbol: "TRUMP",
    name: "Official Trump",
    type: "CRYPTO",
    exchange: "CoinGecko",
    sectorTags: ["Crypto", "Meme Coin", "Solana"],
    description:
      "An official Solana-based meme coin issued under the TRUMP brand, tracked with live market data.",
    profileUrl: "https://www.coingecko.com/en/coins/official-trump",
    accent: "#c8102e",
    mono: "TRUMP",
  },
  /* ------------------------------------------------------------------ */
  /* ETFs — live pricing via the TwelveData free tier                      */
  /* ------------------------------------------------------------------ */
  {
    symbol: "SPY",
    name: "SPDR S&P 500 ETF",
    type: "ETF",
    exchange: "NYSE ARCA",
    sectorTags: ["ETF", "Broad Market", "S&P 500"],
    description:
      "An exchange-traded fund that tracks the S&P 500 — broad U.S. large-cap equity exposure in one ticker.",
    profileUrl: "https://www.ssga.com/us/en/intermediary/etfs/spdr-sp-500-etf-trust-spy",
    accent: "#0d5c2f",
    mono: "SPY",
  },
  {
    symbol: "QQQ",
    name: "Invesco QQQ Trust",
    type: "ETF",
    exchange: "NASDAQ",
    sectorTags: ["ETF", "Tech", "Nasdaq-100"],
    description:
      "An exchange-traded fund tracking the Nasdaq-100 Index — heavy-weight large-cap technology exposure.",
    profileUrl: "https://www.nasdaq.com/market-activity/funds-and-etfs/QQQ",
    accent: "#003b71",
    mono: "QQQ",
  },
  {
    symbol: "VOO",
    name: "Vanguard S&P 500 ETF",
    type: "ETF",
    exchange: "NYSE ARCA",
    sectorTags: ["ETF", "Broad Market", "S&P 500"],
    description:
      "Vanguard's low-cost S&P 500 index fund, offering diversified U.S. large-cap equity exposure.",
    profileUrl: "https://investor.vanguard.com/investment-products/etfs/profile/voo",
    accent: "#b8860b",
    mono: "VOO",
  },
  /* ------------------------------------------------------------------ */
  /* Commodities — real metal prices via the TwelveData free tier          */
  /* ------------------------------------------------------------------ */
  {
    symbol: "GLD",
    name: "SPDR Gold Shares",
    type: "COMMODITY",
    exchange: "NYSE ARCA",
    sectorTags: ["Commodity", "Gold", "Hedge"],
    description:
      "The largest gold-backed ETF, providing exposure to the spot price of physical gold.",
    profileUrl: "https://www.ssga.com/us/en/intermediary/etfs/spdr-gold-shares-gld",
    accent: "#c9a227",
    mono: "GLD",
  },
  {
    symbol: "SLV",
    name: "iShares Silver Trust",
    type: "COMMODITY",
    exchange: "NYSE ARCA",
    sectorTags: ["Commodity", "Silver", "Hedge"],
    description:
      "An exchange-traded trust investing in physical silver, tracking the silver spot market.",
    profileUrl: "https://www.blackrock.com/us/individual/products/239855/ishares-silver-trust-fund",
    accent: "#8f9399",
    mono: "SLV",
  },
  /* ------------------------------------------------------------------ */
  /* Indices — headline market level via the TwelveData free tier          */
  /* ------------------------------------------------------------------ */
  {
    symbol: "^GSPC",
    name: "S&P 500",
    type: "INDEX",
    exchange: "S&P",
    sectorTags: ["Index", "Broad Market", "Large Cap"],
    description:
      "The S&P 500 Index — 500 of the largest U.S.-listed companies, the benchmark for U.S. large-cap equities.",
    profileUrl: "https://www.spglobal.com/spdji/en/indices/equity/sp-500/",
    accent: "#b31b1b",
    mono: "500",
  },
  {
    symbol: "^IXIC",
    name: "Nasdaq Composite",
    type: "INDEX",
    exchange: "NASDAQ",
    sectorTags: ["Index", "Technology", "Broad Market"],
    description:
      "The Nasdaq Composite Index — more than 3,000 securities listed on Nasdaq, heavily weighted in technology.",
    profileUrl: "https://www.nasdaq.com/market-activity/index/comp",
    accent: "#28a745",
    mono: "IXIC",
  },
];

export function getCompany(symbol: string): Company | null {
  const s = symbol.toUpperCase();
  return COMPANY_CATALOG.find((c) => c.symbol === s) ?? null;
}

/** User-facing label for each asset type, shown in rows like "TSLA · NASDAQ · STOCK". */
export const TICKER_TYPE_LABEL: Record<CompanyType, string> = {
  STOCK: "STOCK",
  ETF: "ETF",
  CRYPTO: "CRYPTO",
  COMMODITY: "COMMODITY",
  INDEX: "INDEX",
};