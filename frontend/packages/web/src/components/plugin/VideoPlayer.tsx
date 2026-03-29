interface VideoPlayerProps {
  src: string;
  name: string;
}

export function VideoPlayer({ src, name }: VideoPlayerProps) {
  return (
    <div className="bg-black rounded-xl overflow-hidden mb-4">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        controls
        src={src}
        className="w-full max-h-[480px]"
        title={name}
      />
    </div>
  );
}
