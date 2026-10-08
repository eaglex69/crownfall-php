// Набор игровых иконок, нарисованных на чистом CSS (без эмодзи и SVG).
export type IconName = 'crown' | 'swords' | 'cards' | 'chest' | 'shield' | 'friends' | 'trophy' | 'scroll' | 'gear' | 'coin' | 'gem' | 'elixir' | 'star' | 'arrow' | 'chat' | 'more';

export default function Icon({ name, size = 28, className = '' }: { name: IconName; size?: number; className?: string }) {
  return (
    <span className={`ico ico-${name} ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      <i className="p1" /><i className="p2" /><i className="p3" /><i className="p4" />
    </span>
  );
}
