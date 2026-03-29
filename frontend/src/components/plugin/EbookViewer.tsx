import { useEffect, useRef } from "react";
import ePub from "epubjs";

interface EbookViewerProps {
  url: string;
}

export function EbookViewer({ url }: EbookViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!viewerRef.current) return;
    const book = ePub(url);
    const rendition = book.renderTo(viewerRef.current, {
      width: "100%",
      height: "100%",
    });
    void rendition.display();
    return () => {
      book.destroy();
    };
  }, [url]);

  return (
    <div
      ref={viewerRef}
      className="bg-white rounded-xl overflow-hidden mb-4"
      style={{ height: "600px" }}
    />
  );
}
