import { parseArt } from '@/lib/cards';

export default function CardArt({ image, alt, className = '' }: { image: string; alt: string; className?: string }) {
  const a = parseArt(image);
  return (
    <span role="img" aria-label={alt} className={'card-art ' + className}>
      <i style={{ backgroundImage: `url(${a.src})`, filter: a.hue ? `hue-rotate(${a.hue}deg)` : undefined }} />
    </span>
  );
}
