'use client';
import { useEffect, useState, type CSSProperties } from 'react';

// Если положить готовый логотип в public/images/logo.png, он подхватится автоматически.
// Иначе рисуется логотип на чистом CSS (без SVG и эмодзи).
const CUSTOM_LOGO = '/images/logo.png';

const GEMS = [
  { x: 56.7, y: 18.7, w: 7, h: 24, r: 6 }, { x: 43.3, y: 18.7, w: 7, h: 24, r: -6 },
  { x: 68.7, y: 23.4, w: 7, h: 20, r: 10 }, { x: 31.3, y: 23.4, w: 7, h: 20, r: -10 },
  { x: 80.5, y: 28.1, w: 6, h: 17, r: 16 }, { x: 19.5, y: 28.1, w: 6, h: 17, r: -16 },
];
const SPARKS: [number, number][] = [[30, 3], [37, 8], [47, 1], [54, 2], [63, 8], [70, 3], [86, 14], [14, 14]];

function useCustomLogo() {
  const [ok, setOk] = useState(false);
  useEffect(() => { const im = new Image(); im.onload = () => setOk(true); im.src = CUSTOM_LOGO; }, []);
  return ok;
}

function Word() {
  return (<><b>C</b><span className="sm">ROWNFAL</span><b>L</b></>);
}

export function Wordmark({ size }: { size?: number | string }) {
  return (
    <span className="lg-wm" style={size ? { fontSize: size } : undefined}>
      <span className="lg-wm-back" aria-hidden="true"><Word /></span>
      <span className="lg-wm-front"><Word /></span>
    </span>
  );
}

function CrownParts() {
  return (
    <div className="lg-crownbox">
      <div className="lg-crown"><i className="lg-gold" /><i className="lg-fill" /></div>
      <i className="lg-spine" />
      {GEMS.map((g, i) => <i key={i} className="lg-flame" style={{ left: `${g.x - g.w / 2}%`, top: `${g.y - g.h / 2}%`, width: `${g.w}%`, height: `${g.h}%`, transform: `rotate(${g.r}deg)` }} />)}
      <i className="lg-top-gem" />
      <div className="lg-band"><i className="lg-band-in" /><i className="lg-lattice" /></div>
      <div className="lg-diamond"><i className="lg-d-out" /><i className="lg-d-in" /></div>
      {SPARKS.map(([x, y], i) => <i key={i} className="lg-spark" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.37}s` }} />)}
    </div>
  );
}

export default function Logo({ width = 280, variant = 'full' }: { width?: number | string; variant?: 'full' | 'mark' }) {
  const custom = useCustomLogo();
  const w = typeof width === 'number' ? `${width}px` : width;
  if (custom && variant === 'full') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="lg-img" src={CUSTOM_LOGO} alt="Crownfall" style={{ width: w }} />;
  }
  return (
    <div className={`lg lg-${variant}`} style={{ '--lg-w': w } as CSSProperties} role="img" aria-label="Crownfall">
      <div className="lg-in">
        <CrownParts />
        {variant === 'full' && (
          <>
            <div className="lg-tip"><i className="lg-tip-in" /><i className="lg-tip-gem" /></div>
            <div className="lg-title"><Wordmark /></div>
          </>
        )}
      </div>
    </div>
  );
}

export function LogoInline({ size = 24 }: { size?: number }) {
  const custom = useCustomLogo();
  if (custom) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="lg-img-inline" src={CUSTOM_LOGO} alt="Crownfall" style={{ height: size * 2 }} />;
  }
  return (
    <span className="lg-inline" role="img" aria-label="Crownfall">
      <Logo variant="mark" width={size * 2.5} />
      <Wordmark size={size} />
    </span>
  );
}
