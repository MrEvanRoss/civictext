import { NextResponse } from "next/server";

/**
 * GET /api/og-preview?url=<encoded-url>
 *
 * Fetches the target URL server-side, parses Open Graph meta tags, and returns
 * { title, description, image, domain }. This avoids CORS issues with
 * client-side fetching.
 */

const OG_FETCH_TIMEOUT = 5000; // 5 seconds max

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url");

  if (!rawUrl) {
    return NextResponse.json(
      { error: "Missing url parameter" },
      { status: 400 }
    );
  }

  // Ensure URL has protocol
  let targetUrl = rawUrl;
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = `https://${targetUrl}`;
  }

  // Validate URL
  try {
    new URL(targetUrl);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OG_FETCH_TIMEOUT);

    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; CivicTextBot/1.0; +https://civictext.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json(
        { title: null, description: null, image: null, domain: getDomain(targetUrl) },
        {
          headers: { "Cache-Control": "public, max-age=300" },
        }
      );
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return NextResponse.json(
        { title: null, description: null, image: null, domain: getDomain(targetUrl) },
        {
          headers: { "Cache-Control": "public, max-age=300" },
        }
      );
    }

    // Only read the first 50KB to find meta tags — no need to download the
    // entire page.
    const reader = res.body?.getReader();
    if (!reader) {
      return NextResponse.json(
        { title: null, description: null, image: null, domain: getDomain(targetUrl) },
        { headers: { "Cache-Control": "public, max-age=300" } }
      );
    }

    let html = "";
    const decoder = new TextDecoder();
    const MAX_BYTES = 50 * 1024; // 50KB
    let bytesRead = 0;

    while (bytesRead < MAX_BYTES) {
      const { value, done } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      bytesRead += value.length;
      // Stop early if we've found </head>
      if (html.includes("</head>")) break;
    }

    reader.cancel();

    const ogTitle = extractMeta(html, "og:title") || extractTitle(html);
    const ogDescription =
      extractMeta(html, "og:description") || extractMeta(html, "description");

    // Image fallback chain: og:image → twitter:image → apple-touch-icon → large favicon → Google favicon
    const ogImage =
      extractMeta(html, "og:image") ||
      extractMeta(html, "twitter:image") ||
      extractLinkHref(html, "apple-touch-icon") ||
      extractLinkHref(html, "icon", "image/png") ||
      extractLinkHref(html, "shortcut icon");

    // Resolve relative image URLs
    let resolvedImage = ogImage;
    if (ogImage && !ogImage.startsWith("http")) {
      try {
        resolvedImage = new URL(ogImage, targetUrl).href;
      } catch {
        resolvedImage = null;
      }
    }

    // Determine image type: "og" for full-size images, "icon" for small fallbacks
    const imageType = extractMeta(html, "og:image") || extractMeta(html, "twitter:image")
      ? "og"
      : resolvedImage
        ? "icon"
        : null;

    // If still no image at all, use Google's high-res favicon API
    const finalImage = resolvedImage || `https://www.google.com/s2/favicons?domain=${getDomain(targetUrl)}&sz=128`;
    const finalImageType = imageType || "icon";

    return NextResponse.json(
      {
        title: ogTitle || null,
        description: ogDescription || null,
        image: finalImage,
        imageType: finalImageType,
        domain: getDomain(targetUrl),
      },
      {
        headers: {
          "Cache-Control": "public, max-age=3600", // Cache for 1 hour
        },
      }
    );
  } catch (err: unknown) {
    // Timeout or network error — return empty metadata
    return NextResponse.json(
      {
        title: null,
        description: null,
        image: null,
        domain: getDomain(targetUrl),
      },
      {
        headers: { "Cache-Control": "public, max-age=300" },
      }
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Extract an Open Graph or standard meta tag value.
 */
function extractMeta(html: string, property: string): string | null {
  // Try property= (Open Graph style)
  const propRegex = new RegExp(
    `<meta[^>]*property=["']${escapeRegex(property)}["'][^>]*content=["']([^"']*)["']`,
    "i"
  );
  let match = propRegex.exec(html);
  if (match) return decodeHtmlEntities(match[1]);

  // Try content= before property= (reverse attribute order)
  const propRegexReverse = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${escapeRegex(property)}["']`,
    "i"
  );
  match = propRegexReverse.exec(html);
  if (match) return decodeHtmlEntities(match[1]);

  // Try name= (standard meta tags like "description")
  const nameRegex = new RegExp(
    `<meta[^>]*name=["']${escapeRegex(property)}["'][^>]*content=["']([^"']*)["']`,
    "i"
  );
  match = nameRegex.exec(html);
  if (match) return decodeHtmlEntities(match[1]);

  // Try name= reverse order
  const nameRegexReverse = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${escapeRegex(property)}["']`,
    "i"
  );
  match = nameRegexReverse.exec(html);
  if (match) return decodeHtmlEntities(match[1]);

  return null;
}

/**
 * Extract href from a <link> tag by rel attribute.
 * Optionally filter by type attribute (e.g., "image/png").
 */
function extractLinkHref(html: string, rel: string, type?: string): string | null {
  // Build regex to match <link> with the specified rel
  const typeFilter = type ? `[^>]*type=["']${escapeRegex(type)}["']` : "";
  const regex = new RegExp(
    `<link[^>]*rel=["'][^"']*${escapeRegex(rel)}[^"']*["']${typeFilter}[^>]*href=["']([^"']*)["']`,
    "i"
  );
  let match = regex.exec(html);
  if (match) return decodeHtmlEntities(match[1]);

  // Try reverse attribute order (href before rel)
  const regexReverse = new RegExp(
    `<link[^>]*href=["']([^"']*)["'][^>]*rel=["'][^"']*${escapeRegex(rel)}[^"']*["']`,
    "i"
  );
  match = regexReverse.exec(html);
  if (match) return decodeHtmlEntities(match[1]);

  return null;
}

/**
 * Extract <title> tag content as fallback.
 */
function extractTitle(html: string): string | null {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return match ? decodeHtmlEntities(match[1].trim()) : null;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");
}
