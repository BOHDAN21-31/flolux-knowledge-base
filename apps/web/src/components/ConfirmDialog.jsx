import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const ConfirmContext = createContext(null);

// useConfirm() -> async confirm({ title, description, confirmLabel, confirmVariant })
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null); // { opts, resolve }

  const confirm = useCallback((opts = {}) => new Promise((resolve) => {
    setState({ opts, resolve });
  }), []);

  const close = useCallback((result) => {
    setState((s) => {
      if (s) s.resolve(result);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!state) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') close(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, close]);

  const opts = state?.opts || {};
  const variant = opts.confirmVariant || 'danger';
  const confirmCls = variant === 'primary'
    ? 'bg-rose-500 hover:bg-rose-600'
    : 'bg-red-600 hover:bg-red-700';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/50 backdrop-blur-sm" onClick={() => close(false)} />
          <div className="relative bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg shadow-xl w-full max-w-md p-6"
            style={{ fontFamily: 'Georgia, serif' }}>
            <h3 className="text-lg text-stone-800 dark:text-stone-100 mb-2">{opts.title || 'Підтвердіть дію'}</h3>
            {opts.description && (
              <p className="text-sm text-stone-500 dark:text-stone-400 mb-5" style={{ fontFamily: 'system-ui, sans-serif' }}>
                {opts.description}
              </p>
            )}
            <div className="flex gap-2 justify-end" style={{ fontFamily: 'system-ui, sans-serif' }}>
              <button onClick={() => close(false)}
                className="px-4 min-h-[44px] rounded-md text-sm bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700">
                {opts.cancelLabel || 'Скасувати'}
              </button>
              <button onClick={() => close(true)} autoFocus
                className={`px-4 min-h-[44px] rounded-md text-sm text-white ${confirmCls}`}>
                {opts.confirmLabel || 'Видалити'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  // Фолбек на window.confirm, якщо провайдер відсутній
  return ctx || (async (o = {}) => window.confirm(o.description || o.title || 'Підтвердити?'));
}
