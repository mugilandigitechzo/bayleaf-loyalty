import { Button, Wordmark } from '../ui/kit.tsx';
import { Clock, Leaf, Star } from '../ui/icons.tsx';
import { linkProps, navigate } from '../lib/router.ts';
import { t } from '../i18n/index.ts';

function Pattern() {
  // A quiet lattice of bay leaves, echoing the card watermark.
  const leaves = [];
  for (let y = 0; y < 9; y++) for (let x = 0; x < 6; x++) {
    leaves.push(<use key={`${x}-${y}`} href="#bl-leaf" x={x * 80 + (y % 2) * 40} y={y * 90} />);
  }
  return (
    <svg className="welcome__pattern" viewBox="0 0 480 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <g id="bl-leaf"><path transform="translate(14 10) rotate(28 12 12)" d="M12 2.5C7.2 5.6 5 10.2 6 15.4c.6 3.1 2.8 5.2 6 6.1 3.2-.9 5.4-3 6-6.1 1-5.2-1.2-9.8-6-12.9Z" fill="none" stroke="currentColor" strokeWidth="1" /></g>
      </defs>
      {leaves}
    </svg>
  );
}

export function Welcome({ selfRegistration }: { selfRegistration: boolean }) {
  return (
    <main className="welcome">
      <Pattern />
      <div className="welcome__inner">
        <Wordmark large onDark />
        <h1>{t('welcome.title')}</h1>
        <p className="welcome__lead">{t('welcome.lead')}</p>
        <ul className="welcome__steps">
          <li><Leaf />{t('welcome.step1')}</li>
          <li><Star filled />{t('welcome.step2')}</li>
          <li><Clock />{t('welcome.step3')}</li>
        </ul>
      </div>
      <div className="welcome__actions">
        {selfRegistration ? <Button variant="gold" size="xl" block onClick={() => navigate('/join')}>{t('welcome.join')}</Button> : null}
        <Button variant="secondary" size="xl" block onClick={() => navigate('/sign-in')}>{t('welcome.signIn')}</Button>
        <p className="welcome__staff">{t('welcome.staff')}? <a {...linkProps('/staff')}>{t('welcome.staffLink')}</a></p>
      </div>
    </main>
  );
}
