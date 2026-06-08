import { useState, useEffect } from 'react';
import { Download, X, Share2 } from 'lucide-react';

const DISMISSED_KEY = 'flolux:install-dismissed';
const DELAY_MS = 30000; // показуємо не раніше 30с після завантаження

function isIOS() {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
}
function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

export default function InstallPrompt() {
  const [prompt, setPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [iosVisible, setIosVisible] = useState(false);

  useEffect(() => {
    if (isStandalone()) return undefined;
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return undefined;
    } catch { /* localStorage недоступний */ }

    // Android/Chrome шлях
    const handler = (e) => {
      e.preventDefault();
      setPrompt(e);
      setTimeout(() => setVisible(true), DELAY_MS);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS Safari — без beforeinstallprompt; покажемо інструкції
    let iosTimer = null;
    if (isIOS() && /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent)) {
      iosTimer = setTimeout(() => setIosVisible(true), DELAY_MS);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  const install = async () => {
    if (!prompt) return;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice?.outcome === 'accepted') {
        setVisible(false);
      }
    } catch { /* ignore */ }
    setPrompt(null);
  };

  const dismiss = () => {
    setVisible(false);
    setIosVisible(false);
    try { localStorage.setItem(DISMISSED_KEY, '1'); } catch { /* ignore */ }
  };

  if (!visible && !iosVisible) return null;

  return (
    <div
      className="fixed left-4 right-4 md:left-auto md:right-4 md:max-w-sm bottom-20 md:bottom-6 z-40 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg shadow-xl p-4"
      style={{ fontFamily: 'system-ui, sans-serif' }}
    >
      <button
        onClick={dismiss}
        aria-label="Закрити"
        className="absolute top-2 right-2 w-9 h-9 flex items-center justify-center text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-500/15 flex items-center justify-center flex-shrink-0">
          <Download className="w-5 h-5 text-rose-500" />
        </div>
        <div className="flex-1 min-w-0 pr-6">
          <div className="text-sm text-stone-800 dark:text-stone-100 font-medium mb-1">
            Встановити Flolux як додаток?
          </div>
          {iosVisible ? (
            <div className="text-xs text-stone-600 dark:text-stone-300">
              Натисніть <Share2 className="inline w-3.5 h-3.5 -mt-0.5" /> <b>Поділитися</b> → <b>На головний екран</b>.
            </div>
          ) : (
            <div className="text-xs text-stone-600 dark:text-stone-300">
              Швидкий доступ, без вкладок. Як справжній додаток.
            </div>
          )}
        </div>
      </div>
      {!iosVisible && (
        <div className="mt-3 flex gap-2 justify-end">
          <button
            onClick={dismiss}
            className="px-3 min-h-[40px] rounded-md text-sm text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            Пізніше
          </button>
          <button
            onClick={install}
            className="px-4 min-h-[40px] rounded-md text-sm bg-rose-500 hover:bg-rose-600 text-white flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" /> Встановити
          </button>
        </div>
      )}
    </div>
  );
}
