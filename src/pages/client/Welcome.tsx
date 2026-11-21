import AnimatedLogo from '../../components/AnimatedLogo';
import { Icon } from '../../components/ui';

/** First screen for visitors who are not signed in yet. */
export default function Welcome({ onPick }: { onPick: (path: string) => void }) {
  return (
    <div className="app" style={{ paddingBottom: 24 }}>
      <div className="welcome-screen intro">
        <AnimatedLogo />
        <p className="greet rise" style={{ '--d': '1.9s' } as React.CSSProperties}>عناية ببشرتك، بموعد يناسبك</p>
        <div className="intro-actions">
          <button className="btn primary rise" style={{ '--d': '2.05s' } as React.CSSProperties} onClick={() => onPick('/book')}>
            {Icon.plus} حجز موعد جديد
          </button>
          <button className="btn dark rise" style={{ '--d': '2.2s' } as React.CSSProperties} onClick={() => onPick('/appointments')}>
            {Icon.calendar} زياراتي
          </button>
        </div>
      </div>
    </div>
  );
}
