// Shared metadata field definitions — used by ResourceFormPage (create) and MetaPanel (edit).

export interface MetaField {
  key: string;
  label: string;
  type?: "text" | "number";
}

export const PLUGIN_META_FIELDS: Record<string, MetaField[]> = {
  ebook: [
    { key: "author", label: "Author" },
    { key: "illustrator", label: "Illustrator" },
    { key: "publisher", label: "Publisher" },
    { key: "published_date", label: "Published Date" },
    { key: "language", label: "Language" },
    { key: "isbn", label: "ISBN" },
    { key: "page_count", label: "Page Count", type: "number" },
    { key: "genre", label: "Genre" },
    { key: "description", label: "Description" },
  ],
  music: [
    { key: "artist", label: "Artist" },
    { key: "album_artist", label: "Album Artist" },
    { key: "album", label: "Album" },
    { key: "track_number", label: "Track #", type: "number" },
    { key: "disc_number", label: "Disc #", type: "number" },
    { key: "year", label: "Year", type: "number" },
    { key: "genre", label: "Genre" },
    { key: "duration_ms", label: "Duration (ms)", type: "number" },
    { key: "bitrate", label: "Bitrate", type: "number" },
    { key: "sample_rate", label: "Sample Rate", type: "number" },
    { key: "composer", label: "Composer" },
    { key: "label", label: "Label" },
    { key: "isrc", label: "ISRC" },
  ],
  video: [
    { key: "director", label: "Director" },
    { key: "studio", label: "Studio" },
    { key: "year", label: "Year", type: "number" },
    { key: "duration_ms", label: "Duration (ms)", type: "number" },
    { key: "resolution", label: "Resolution" },
    { key: "framerate", label: "Framerate" },
    { key: "video_codec", label: "Video Codec" },
    { key: "audio_codec", label: "Audio Codec" },
    { key: "subtitle_languages", label: "Subtitle Languages" },
    { key: "audio_languages", label: "Audio Languages" },
    { key: "genre", label: "Genre" },
    { key: "description", label: "Description" },
  ],
  game: [
    { key: "developer", label: "Developer" },
    { key: "publisher", label: "Publisher" },
    { key: "release_date", label: "Release Date" },
    { key: "genre", label: "Genre" },
    { key: "language", label: "Language" },
    { key: "steam_app_id", label: "Steam App ID" },
    { key: "dlsite_id", label: "DLSite ID" },
    { key: "launcher", label: "Launcher" },
    { key: "executable_path", label: "Executable Path" },
    { key: "description", label: "Description" },
  ],
  pic: [
    { key: "creator", label: "Creator" },
    { key: "circle", label: "Circle" },
    { key: "language", label: "Language" },
    { key: "event", label: "Event" },
    { key: "series_title", label: "Series Title" },
    { key: "image_count", label: "Image Count", type: "number" },
    { key: "cover_path", label: "Cover Path" },
  ],
  online_viewer: [
    { key: "title", label: "Title" },
    { key: "description", label: "Description" },
    { key: "thumbnail_url", label: "Thumbnail URL" },
    { key: "original_url", label: "Original URL" },
    { key: "language", label: "Language" },
  ],
};
