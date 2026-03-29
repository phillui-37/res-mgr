interface AudioPlayerProps {
  src: string;
  name: string;
}

export function AudioPlayer({ src, name }: AudioPlayerProps) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-4">
      <div className="text-sm text-gray-400 mb-3 truncate">{name}</div>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio controls src={src} className="w-full" />
    </div>
  );
}
