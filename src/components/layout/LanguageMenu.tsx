import { useCallback, useRef, useState } from 'react';
import clsx from 'clsx';
import { Check, Globe } from 'lucide-react';
import { LANGUAGES, useLang, useT } from '../../i18n';
import { useOnClickOutside } from '../../lib/hooks';

/** Globe button that switches the interface language. `light` is for dark backgrounds. */
export function LanguageMenu({ compact, light, className }: { compact?: boolean; light?: boolean; className?: string }) {
  const t = useT();
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useOnClickOutside(ref, close, open);
  const currentName = LANGUAGES.find((l) => l.code === lang)!.name;
  return (
    <div className={clsx('relative', className)} ref={ref}>
      <button
        type="button"
        className={clsx(
          compact ? 'icon-btn' : 'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition',
          !compact && (light ? 'text-white/80 hover:bg-white/10 hover:text-white' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'),
        )}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('Language: {name}', { name: currentName })}
        title={t('Language')}
      >
        <Globe className={compact ? 'h-[18px] w-[18px]' : 'h-4 w-4'} />
        {!compact && <span>{currentName}</span>}
      </button>
      {open && (
        <div role="menu" className="absolute end-0 top-11 z-50 w-52 animate-pop-in overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 text-gray-900 shadow-pop dark:border-white/10 dark:bg-ink-850 dark:text-gray-100">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              role="menuitemradio"
              aria-checked={l.code === lang}
              lang={l.code}
              onClick={() => {
                setLang(l.code);
                setOpen(false);
              }}
              className={clsx('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-start text-sm transition hover:bg-gray-50 dark:hover:bg-white/5', l.code === lang && 'bg-gray-50 font-medium dark:bg-white/5')}
            >
              <span className="flex-1">{l.name}</span>
              {l.code !== 'en' && <span className="text-xs text-gray-400">{l.english}</span>}
              {l.code === lang && <Check className="h-4 w-4 text-brand-600 dark:text-brand-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
