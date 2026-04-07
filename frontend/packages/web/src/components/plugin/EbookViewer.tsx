import { useEffect, useRef, useState } from "react";
import ePub from "epubjs";
import { http } from "@/api/client.ts";

interface EbookViewerProps {
  url: string;
}

export function EbookViewer({ url }: EbookViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!viewerRef.current) return;
    let book: ReturnType<typeof ePub> | null = null;
    let cancelled = false;

    http.get<ArrayBuffer>(url, { responseType: "arraybuffer" })
      .then(({ data }) => {
        if (cancelled || !viewerRef.current) return;
        book = ePub(data);
        const rendition = book.renderTo(viewerRef.current, {
          width: "100%",
          height: "100%",
        });
        void rendition.display();
      })
      .catch((err) => {
        if (!cancelled) setError(String(err?.response?.status ?? err?.message ?? err));
      });

    return () => {
      cancelled = true;
      book?.destroy();
    };
  }, [url]);

  if (error) {
    return (
      <div className="bg-gray-900 rounded-xl border border-red-800 p-4 mb-4 text-sm text-red-400">
        Failed to load epub: {error}
      </div>
    );
  }

  return (
    <div
      ref={viewerRef}
      className="bg-white rounded-xl overflow-hidden mb-4"
      style={{ height: "600px" }}
    />
  );
}
