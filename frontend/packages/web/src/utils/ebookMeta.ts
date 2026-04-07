import ePub from "epubjs";

export interface EbookMetaExtracted {
  author?: string;
  publisher?: string;
  language?: string;
  published_date?: string;
  isbn?: string;
  description?: string;
  /** Title from epub metadata — useful for auto-filling the resource name. */
  title?: string;
}

export interface EbookExtracted {
  meta: EbookMetaExtracted;
  /** Resized cover JPEG blob, or null if no cover found. */
  coverBlob: Blob | null;
}

async function resizeCover(blobUrl: string, maxWidth = 300): Promise<Blob | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(null); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.82);
    };
    img.onerror = () => resolve(null);
    img.src = blobUrl;
  });
}

export async function extractEbookMeta(file: File): Promise<EbookMetaExtracted> {
  return (await extractEbook(file)).meta;
}

const EPUB_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const race = Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]);
  return race.finally(() => clearTimeout(timer));
}

export async function extractEbook(file: File): Promise<EbookExtracted> {
  const buf = await withTimeout(file.arrayBuffer(), EPUB_TIMEOUT_MS, "arrayBuffer");
  const book = ePub(buf as unknown as string);

  try {
    await withTimeout(book.opened as Promise<unknown>, EPUB_TIMEOUT_MS, "book.opened");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m: Record<string, unknown> = (book as any).packaging?.metadata ?? {};

    const meta: EbookMetaExtracted = {};
    if (m.title && typeof m.title === "string") meta.title = m.title;
    if (m.creator && typeof m.creator === "string") meta.author = m.creator;
    if (m.publisher && typeof m.publisher === "string") meta.publisher = m.publisher;
    if (m.language && typeof m.language === "string") meta.language = m.language;
    if (m.pubdate && typeof m.pubdate === "string") meta.published_date = m.pubdate;
    if (m.description && typeof m.description === "string") meta.description = m.description;
    const identifier = m.identifier ?? m.ISBN ?? m.isbn;
    if (identifier && typeof identifier === "string") meta.isbn = identifier;

    let coverBlob: Blob | null = null;
    try {
      const coverUrl = await withTimeout(book.coverUrl(), EPUB_TIMEOUT_MS, "coverUrl");
      if (coverUrl) coverBlob = await resizeCover(coverUrl);
    } catch { /* no cover */ }

    return { meta, coverBlob };
  } finally {
    // Always destroy to release memory, even if extraction fails or times out
    try { book.destroy(); } catch { /* ignore */ }
  }
}
