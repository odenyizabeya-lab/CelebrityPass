/**
 * Static company catalog for the Invest/Markets screens. Factual identity
 * (name, exchange, sector tags, exchange profile URLs) — pricing lives in
 * MarketDataService, never here.
 */

export type Company = {
  symbol: string;
  name: string;
  exchange: string;
  sectorTags: string[];
  description: string;
  profileUrl: string; // official market data page (exchange/NASDAQ)
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
];

export function getCompany(symbol: string): Company | null {
  const s = symbol.toUpperCase();
  return COMPANY_CATALOG.find((c) => c.symbol === s) ?? null;
}