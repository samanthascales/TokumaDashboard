import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { Info } from 'lucide-react';
import { useLang, useT } from '../../i18n';

const W = 288;
const GAP = 8;
const EDGE = 12;

/**
 * A small "i" button that explains a number or word in plain language.
 * Opens on hover, on keyboard focus, and on tap (so it works on phones);
 * closes on Escape, on a second tap, or when you tap elsewhere.
 */
export function Explain({ children, label, className }: { children: ReactNode; label: string; className?: string }) {
  const t = useT();
  const { dir } = useLang();
  const id = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false);
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number; above: boolean } | null>(null);
  const open = pinned || hover;

  const place = useCallback(() => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const h = box.current?.offsetHeight ?? 120;
    const width = Math.min(W, window.innerWidth - EDGE * 2);
    const x = Math.min(Math.max(r.left + r.width / 2 - width / 2, EDGE), window.innerWidth - width - EDGE);
    const above = r.bottom + GAP + h > window.innerHeight && r.top - GAP - h > 0;
    setPos({ x, y: above ? r.top - GAP - h : r.bottom + GAP, above });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPinned(false);
        setHover(false);
      }
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (btn.current?.contains(target) || box.current?.contains(target)) return;
      setPinned(false);
      setHover(false);
    };
    const onMove = () => place();
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open, place]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={clsx(
          'no-print inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full align-middle text-gray-400 transition hover:text-brand-700 focus-visible:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:text-gray-500 dark:hover:text-brand-300',
          open && 'text-brand-700 dark:text-brand-300',
          className,
        )}
        aria-label={t('What does “{name}” mean?', { name: label })}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          // Clicking keeps it open; a second click or tap closes it, even though the button still has focus.
          if (pinned) {
            setPinned(false);
            setHover(false);
          } else setPinned(true);
        }}
        onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(true)}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(false)}
        // Keyboard focus opens it; focus from a tap or click is handled by onClick.
        onFocus={(e) => e.currentTarget.matches(':focus-visible') && setHover(true)}
        onBlur={() => !pinned && setHover(false)}
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open &&
        createPortal(
          <div
            ref={box}
            id={id}
            role="tooltip"
            dir={dir}
            onPointerEnter={() => setHover(true)}
            onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(false)}
            className="fixed z-[70] animate-fade-in rounded-xl bg-gray-900 px-3.5 py-3 text-start text-[13px] font-normal normal-case leading-relaxed tracking-normal text-gray-100 shadow-xl dark:bg-ink-700"
            style={{ left: pos?.x ?? -9999, top: pos?.y ?? -9999, width: Math.min(W, window.innerWidth - EDGE * 2) }}
          >
            <p className="mb-1 font-semibold text-white">{label}</p>
            <div className="space-y-1.5">{children}</div>
          </div>,
          document.body,
        )}
    </>
  );
}

/** A label followed by its explanation button, e.g. table headers and card titles. */
export function Term({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1', className)}>
      {label}
      <Explain label={label}>{children}</Explain>
    </span>
  );
}
