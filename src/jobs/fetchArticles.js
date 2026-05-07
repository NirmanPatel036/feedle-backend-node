import cron from "node-cron";
import axios from "axios";
import crypto from "crypto";
import Article from "../models/Article.js";
import Parser from "rss-parser";

const parser = new Parser({
  customFields: {
    item: [
      ["media:content", "media:content", { keepArray: false }],
      ["media:thumbnail", "media:thumbnail", { keepArray: false }],
      ["itunes:image", "itunes:image", { keepArray: false }],
    ],
  },
});
const CATEGORIES = [
  "technology",
  "business",
  "world",
  "politics",
  "science",
  "health",
  "sports",
  "environment",
  "culture",
  "travel",
  "entertainment",
];

const NEWS_API_CATEGORIES = new Set([
  "technology",
  "business",
  "health",
  "science",
  "sports",
  "entertainment",
  "general",
]);

const GNEWS_CATEGORY_MAP = {
  technology: "technology",
  business: "business",
  world: "world",
  politics: "nation",
  science: "science",
  health: "health",
  sports: "sports",
  entertainment: "entertainment",
  environment: "science",
  culture: "entertainment",
  travel: "general",
};

const GUARDIAN_SECTION_MAP = {
  technology: "technology",
  business: "business",
  world: "world",
  politics: "politics",
  science: "science",
  health: "society",
  sports: "sport",
  environment: "environment",
  culture: "culture",
  travel: "travel",
  entertainment: "culture",
};

const RSS_FEEDS = {
  technology: "https://feeds.feedburner.com/TechCrunch",
  business: "https://feeds.bbci.co.uk/news/business/rss.xml",
  world: "https://feeds.bbci.co.uk/news/world/rss.xml",
  politics: "https://feeds.bbci.co.uk/news/politics/rss.xml",
  health: "https://rss.nytimes.com/services/xml/rss/nyt/Health.xml",
  science: "https://rss.nytimes.com/services/xml/rss/nyt/Science.xml",
  sports: "https://www.espn.com/espn/rss/news",
  environment: "https://www.theguardian.com/environment/rss",
  culture: "https://www.theguardian.com/culture/rss",
  travel: "https://www.theguardian.com/travel/rss",
  entertainment: "https://www.theguardian.com/film/rss",
};

function stripHtml(value = "") {
  return value.replace(/<[^>]*>/g, "").trim();
}

function enhanceBbcImage(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    if (!host.includes("bbc")) return url;

    if (host.includes("ichef.bbci.co.uk")) {
      const upgraded = parsed.pathname
        .replace(/\/news\/\d+\//, "/news/1024/")
        .replace(/\/images\/ic\/\d+x\d+\//, "/images/ic/1024x576/");
      parsed.pathname = upgraded;
      return parsed.toString();
    }

    return url;
  } catch {
    return url;
  }
}

function enhanceGuardianImage(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    if (!host.includes("guim.co.uk") && !host.includes("guardian")) {
      return url;
    }
    parsed.searchParams.set("width", "1600");
    parsed.searchParams.set("quality", "85");
    parsed.searchParams.set("dpr", "2");
    parsed.searchParams.set("fit", "max");
    parsed.searchParams.set("auto", "format");
    return parsed.toString();
  } catch {
    return url;
  }
}

function normalizeImage(url) {
  return enhanceGuardianImage(enhanceBbcImage(url));
}

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

async function fetchFromNewsAPI(category) {
  if (!process.env.NEWS_API_KEY || !NEWS_API_CATEGORIES.has(category))
    return [];
  const { data } = await axios.get("https://newsapi.org/v2/top-headlines", {
    params: {
      category,
      language: "en",
      pageSize: 20,
      apiKey: process.env.NEWS_API_KEY,
    },
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  return data.articles.map((a) => ({
    ...a,
    category,
    source: a.source.name,
    urlToImage: normalizeImage(a.urlToImage),
  }));
}

async function fetchFromGNews(category) {
  if (!process.env.GNEWS_API_KEY) return [];
  const gnewsCategory = GNEWS_CATEGORY_MAP[category];
  if (!gnewsCategory) return [];
  const { data } = await axios.get("https://gnews.io/api/v4/top-headlines", {
    params: {
      category: gnewsCategory,
      lang: "en",
      max: 20,
      apikey: process.env.GNEWS_API_KEY,
    },
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  return (data.articles ?? []).map((a) => ({
    title: a.title,
    description: a.description,
    url: a.url,
    urlToImage: normalizeImage(a.image) || null,
    source: a.source?.name || "GNews",
    publishedAt: a.publishedAt,
    category,
  }));
}

async function fetchFromGuardian(category) {
  if (!process.env.GUARDIAN_API_KEY) return [];
  const section = GUARDIAN_SECTION_MAP[category];
  if (!section) return [];
  const today = formatDateOnly(new Date());
  const { data } = await axios.get("https://content.guardianapis.com/search", {
    params: {
      section,
      "from-date": today,
      "order-by": "newest",
      "page-size": 20,
      "show-fields": "thumbnail,trailText",
      "show-elements": "image",
      "api-key": process.env.GUARDIAN_API_KEY,
    },
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  const results = data?.response?.results ?? [];
  return results.map((item) => ({
    title: item.webTitle,
    description: stripHtml(item.fields?.trailText || ""),
    url: item.webUrl,
    urlToImage: extractGuardianImage(item) || null,
    source: "The Guardian",
    publishedAt: item.webPublicationDate,
    category,
  }));
}

function extractGuardianImage(item) {
  const imageEl = item.elements?.find((el) => el.type === "image");
  const bestAsset = [...(imageEl?.assets ?? [])]
    .filter((asset) => asset.file && (asset.typeData?.width ?? 0) > 0)
    .sort((a, b) => (b.typeData?.width ?? 0) - (a.typeData?.width ?? 0))[0];
  const url = bestAsset?.file || item.fields?.thumbnail || null;
  return normalizeImage(url);
}

function extractImage(item) {
  const url =
    item["media:content"]?.$?.url ||
    item["media:thumbnail"]?.$?.url ||
    item.enclosure?.url ||
    item["itunes:image"]?.href ||
    null;
  return normalizeImage(url);
}

async function fetchFromRSS(category) {
  const url = RSS_FEEDS[category];
  if (!url) return [];
  const feed = await parser.parseURL(url);
  return feed.items.map((item) => ({
    title: item.title,
    description: item.contentSnippet,
    url: item.link,
    urlToImage: extractImage(item),
    source: feed.title,
    publishedAt: item.pubDate,
    category,
  }));
}

async function upsertArticles(articles) {
  await Promise.all(
    articles.map((a) => {
      const urlHash = crypto.createHash("md5").update(a.url).digest("hex");
      return Article.updateOne(
        { urlHash },
        { $setOnInsert: { ...a, urlHash, fetchedAt: new Date() } },
        { upsert: true },
      );
    }),
  );
}

export async function fetchAllCategories() {
  for (const cat of CATEGORIES) {
    const [apiArticles, rssArticles, gnewsArticles, guardianArticles] =
      await Promise.all([
        fetchFromNewsAPI(cat).catch((e) => {
          console.error(`NewsAPI error [${cat}]:`, e.message);
          return [];
        }),
        fetchFromRSS(cat).catch((e) => {
          console.error(`RSS error [${cat}]:`, e.message);
          return [];
        }),
        fetchFromGNews(cat).catch((e) => {
          console.error(`GNews error [${cat}]:`, e.message);
          return [];
        }),
        fetchFromGuardian(cat).catch((e) => {
          console.error(`Guardian error [${cat}]:`, e.message);
          return [];
        }),
      ]);
    await upsertArticles([
      ...apiArticles,
      ...rssArticles,
      ...gnewsArticles,
      ...guardianArticles,
    ]);
    console.log(
      `[fetch] ${cat}: ${apiArticles.length} NewsAPI + ${rssArticles.length} RSS + ${gnewsArticles.length} GNews + ${guardianArticles.length} Guardian articles`,
    );
  }
  console.log("[cron] Articles refreshed at", new Date().toISOString());
}

cron.schedule("*/15 * * * *", fetchAllCategories);
