import MediaInfoFactory, { type MediaInfo } from "mediainfo.js";
import wasmUrl from "mediainfo.js/MediaInfoModule.wasm?url";

export interface VideoMetaExtracted {
  duration_ms?: number;
  resolution?: string;
  framerate?: string;
  video_codec?: string;
  audio_codec?: string;
}

let _instance: MediaInfo<"object"> | null = null;

async function getInstance(): Promise<MediaInfo<"object">> {
  if (!_instance) {
    _instance = await MediaInfoFactory({ format: "object", locateFile: () => wasmUrl });
  }
  return _instance;
}

export async function extractVideoMeta(file: File): Promise<VideoMetaExtracted> {
  const mi = await getInstance();

  const readChunk = (offset: number, size: number): Promise<Uint8Array> =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(new Uint8Array(e.target!.result as ArrayBuffer));
      reader.readAsArrayBuffer(file.slice(offset, offset + size));
    });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (await mi.analyzeData(() => file.size, readChunk)) as any;
  const tracks: Record<string, unknown>[] = result?.media?.track ?? [];

  const general = tracks.find((t) => t["@type"] === "General");
  const video = tracks.find((t) => t["@type"] === "Video");
  const audio = tracks.find((t) => t["@type"] === "Audio");

  const meta: VideoMetaExtracted = {};

  if (general?.Duration) {
    meta.duration_ms = Math.round(Number(general.Duration) * 1000);
  }
  if (video) {
    const w = video.Width;
    const h = video.Height;
    if (w && h) meta.resolution = `${w}x${h}`;
    if (video.FrameRate) meta.framerate = String(video.FrameRate);
    if (video.Format) meta.video_codec = String(video.Format);
  }
  if (audio?.Format) {
    meta.audio_codec = String(audio.Format);
  }

  return meta;
}
