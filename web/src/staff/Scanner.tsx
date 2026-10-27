import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n/index.ts';
import { Button } from '../ui/kit.tsx';
import { Close } from '../ui/icons.tsx';

/**
 * In-app QR scanning uses the browser's BarcodeDetector (Chrome/Edge on Android,
 * Samsung Internet, recent Safari on some platforms). Where it isn't available the
 * staff member uses the phone's own camera app instead: the QR holds a link that
 * opens this counter screen directly. Manual lookup is always one tap away.
 */
export function scannerSupported(): boolean {
  return typeof (window as any).BarcodeDetector === 'function' && !!navigator.mediaDevices?.getUserMedia;
}

export function Scanner({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement | null>(null);
  const [problem, setProblem] = useState<string | null>(scannerSupported() ? null : t('scanner.unsupported'));

  useEffect(() => {
    if (problem) return;
    let stream: MediaStream | null = null;
    let stopped = false;
    let timer: any;
    (async () => {
      try {
        const formats: string[] = await (window as any).BarcodeDetector.getSupportedFormats?.() ?? ['qr_code'];
        if (!formats.includes('qr_code')) { setProblem(t('scanner.unsupported')); return; }
        // Camera permission is requested only now, when the staff member opens the scanner.
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (stopped) { stream.getTracks().forEach((tr) => tr.stop()); return; }
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        const tick = async () => {
          if (stopped) return;
          try {
            const codes = await detector.detect(v);
            if (codes.length && codes[0].rawValue) { stopped = true; navigator.vibrate?.(40); onResult(codes[0].rawValue); return; }
          } catch { /* frame not ready */ }
          timer = setTimeout(tick, 180);
        };
        tick();
      } catch (e: any) {
        setProblem(e?.name === 'NotAllowedError' || e?.name === 'SecurityError' ? t('scanner.denied')
          : e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError' ? t('scanner.noCamera') : t('scanner.unsupported'));
      }
    })();
    return () => { stopped = true; clearTimeout(timer); stream?.getTracks().forEach((tr) => tr.stop()); };
  }, [problem]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="scanner" role="dialog" aria-modal="true" aria-label={t('scanner.title')}>
      <div className="scanner__bar">
        <strong>{t('scanner.title')}</strong>
        <button className="icon-btn" style={{ color: '#fff' }} onClick={onClose} aria-label={t('scanner.close')} autoFocus><Close /></button>
      </div>
      <div className="scanner__view">
        {problem ? null : <video ref={video} playsInline muted />}
        {problem ? null : <div className="scanner__frame"><div /></div>}
      </div>
      <div className="scanner__help">
        <p style={{ marginBottom: problem ? 16 : 0 }}>{problem ?? t('scanner.hint')}</p>
        {problem ? <Button variant="gold" block onClick={onClose}>{t('scanner.manual')}</Button> : null}
      </div>
    </div>
  );
}
