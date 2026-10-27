import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api.ts';
import { navigate } from '../lib/router.ts';
import { t } from '../i18n/index.ts';
import { Button, Field, Notice, PhoneField, Wordmark } from '../ui/kit.tsx';
import { Back, Check } from '../ui/icons.tsx';

type Step = 'details' | 'code' | 'name' | 'done';

/**
 * One flow for both "Get my card" (name + mobile) and "I already have a card" (mobile only).
 * Both verify the number with a one-time code. If someone tries to sign in with a
 * number that has no card yet, they're asked for a name after verifying — the server
 * never reveals beforehand whether a number is registered.
 */
export function AuthFlow({ mode, region, onSignedIn }: { mode: 'join' | 'sign_in'; region: string; onSignedIn: () => void }) {
  const [step, setStep] = useState<Step>('details');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [resumeToken, setResumeToken] = useState('');
  const [created, setCreated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function sendCode(e?: Event) {
    e?.preventDefault();
    setBusy(true); setError(null);
    try {
      const r = await api.post<{ challengeId: string }>('/api/customer/otp/request', { purpose: mode, phone, ...(mode === 'join' ? { name } : {}) });
      setChallengeId(r.challengeId);
      setCode('');
      setStep('code');
      setCooldown(45);
    } catch (err) { setError(err as ApiError); } finally { setBusy(false); }
  }

  async function verify(value = code) {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const r = await api.post<{ needsName: boolean; resumeToken?: string; created?: boolean }>('/api/customer/otp/verify', { challengeId, code: value });
      if (r.needsName) { setResumeToken(r.resumeToken!); setStep('name'); }
      else { setCreated(!!r.created); setStep('done'); }
    } catch (err) { setError(err as ApiError); setCode(''); } finally { setBusy(false); }
  }

  async function finishName(e: Event) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const r = await api.post<{ created: boolean }>('/api/customer/join/complete', { resumeToken, name });
      setCreated(r.created); setStep('done');
    } catch (err) { setError(err as ApiError); } finally { setBusy(false); }
  }

  const stepIndex = { details: 0, code: 1, name: 2, done: 2 }[step];
  const back = () => {
    setError(null);
    if (step === 'code') setStep('details'); else navigate('/');
  };
  const fields = error?.fields ?? {};

  return (
    <main className="flow">
      <div className="flow__head">
        {step !== 'done' ? <button className="icon-btn" onClick={back} aria-label={t('common.back')}><Back /></button> : null}
        <Wordmark />
        {step !== 'done' ? (
          <div className="flow__progress" aria-hidden="true">
            {[0, 1, 2].map((i) => <span key={i} data-on={String(i <= stepIndex)} />)}
          </div>
        ) : null}
      </div>

      {step === 'details' ? (
        <form className="form" onSubmit={sendCode} noValidate>
          <div>
            <h1>{mode === 'join' ? t('join.title') : t('signIn.title')}</h1>
            <p className="flow__lead">{mode === 'join' ? t('join.lead') : t('signIn.lead')}</p>
          </div>
          {error && !Object.keys(fields).length ? <Notice kind="error">{error.code === 'SELF_REGISTRATION_OFF' ? t('join.selfOff') : error.message}</Notice> : null}
          {mode === 'join' ? (
            <Field label={t('join.name')} hint={t('join.nameHint')} value={name} onChange={setName}
              autoComplete="given-name" autoFocus maxLength={80} error={fields.name} />
          ) : null}
          <PhoneField label={t('join.phone')} hint={t('join.phoneHint')} value={phone} onChange={setPhone}
            region={region} autoFocus={mode === 'sign_in'} placeholder="50 123 4567" error={fields.phone} />
          <Button type="submit" size="xl" block loading={busy} disabled={!phone.trim() || (mode === 'join' && name.trim().length < 2)}>
            {t('join.send')}
          </Button>
        </form>
      ) : null}

      {step === 'code' ? (
        <form className="form" onSubmit={(e: Event) => { e.preventDefault(); verify(); }} noValidate>
          <div>
            <h1>{t('otp.title')}</h1>
            <p className="flow__lead">{t('otp.lead', { phone: phone.trim() })}</p>
          </div>
          {error ? <Notice kind="error">{error.message}</Notice> : null}
          <Field label={t('otp.label')} value={code} className="input--code" inputMode="numeric" autoComplete="one-time-code"
            maxLength={6} autoFocus dir="ltr"
            onChange={(v) => { const d = v.replace(/\D/g, '').slice(0, 6); setCode(d); if (d.length === 6) verify(d); }} />
          <Button type="submit" size="xl" block loading={busy} disabled={code.length !== 6}>{t('otp.verify')}</Button>
          <div className="spread">
            <Button variant="ghost" onClick={() => sendCode()} disabled={cooldown > 0 || busy}>
              {cooldown > 0 ? t('otp.resendIn', { s: cooldown }) : t('otp.resend')}
            </Button>
            <Button variant="ghost" onClick={() => { setStep('details'); setError(null); }}>{t('otp.changeNumber')}</Button>
          </div>
        </form>
      ) : null}

      {step === 'name' ? (
        <form className="form" onSubmit={finishName} noValidate>
          <div>
            <h1>{t('name.title')}</h1>
            <p className="flow__lead">{t('name.lead')}</p>
          </div>
          {error && !fields.name ? <Notice kind="error">{error.message}</Notice> : null}
          <Field label={t('join.name')} value={name} onChange={setName} autoComplete="given-name" autoFocus maxLength={80} error={fields.name} />
          <Button type="submit" size="xl" block loading={busy} disabled={name.trim().length < 2}>{t('name.continue')}</Button>
        </form>
      ) : null}

      {step === 'done' ? <Done created={created} onOpen={onSignedIn} /> : null}
    </main>
  );
}

function Done({ created, onOpen }: { created: boolean; onOpen: () => void }) {
  const [first, setFirst] = useState('');
  useEffect(() => {
    api.get<{ state: { customer: { firstName: string } } }>('/api/customer/me').then((r) => setFirst(r.state.customer.firstName), () => {});
  }, []);
  return (
    <div className="form" aria-live="polite">
      <div className="success-mark"><Check /></div>
      <div>
        <h1>{created ? t('done.newTitle', { name: first }) : t('done.backTitle', { name: first })}</h1>
        <p className="flow__lead">{created ? t('done.newLead') : t('done.backLead')}</p>
      </div>
      <Button size="xl" block onClick={onOpen} autoFocus>{t('done.open')}</Button>
    </div>
  );
}
