import * as mm from "music-metadata-browser";

export interface MusicMetaExtracted {
  artist?: string;
  album_artist?: string;
  album?: string;
  track_number?: number;
  disc_number?: number;
  year?: number;
  genre?: string;
  duration_ms?: number;
  bitrate?: number;
  sample_rate?: number;
  composer?: string;
  isrc?: string;
  /** Title tag — useful for auto-filling the resource name. */
  title?: string;
}

export async function extractMusicMeta(file: File): Promise<MusicMetaExtracted> {
  const result = await mm.parseBlob(file, { skipCovers: true });
  const c = result.common;
  const f = result.format;

  const meta: MusicMetaExtracted = {};

  if (c.artist) meta.artist = c.artist;
  if (c.albumartist) meta.album_artist = c.albumartist;
  if (c.album) meta.album = c.album;
  if (c.track?.no != null) meta.track_number = c.track.no;
  if (c.disk?.no != null) meta.disc_number = c.disk.no;
  if (c.year) meta.year = c.year;
  if (c.genre?.length) meta.genre = c.genre[0];
  if (c.composer?.length) meta.composer = c.composer[0];
  if (c.isrc?.length) meta.isrc = c.isrc[0];
  if (c.title) meta.title = c.title;

  if (f.duration != null) meta.duration_ms = Math.round(f.duration * 1000);
  if (f.bitrate != null) meta.bitrate = Math.round(f.bitrate);
  if (f.sampleRate != null) meta.sample_rate = f.sampleRate;

  return meta;
}
