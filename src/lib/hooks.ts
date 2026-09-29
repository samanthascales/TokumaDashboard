import { useEffect, useRef, useState, type RefObject } from 'react';

/** Tweens a number toward its target so value changes count rather than snap. */
export function useCountUp(target: number, duration = 700, startFrom?: number) {
  const [value, setValue] = useState(startFrom ?? 0);
  const fromRef = useRef(startFrom ?? 0);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setValue(target);
      return;
    }
    fromRef.current = valueRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(fromRef.current + (target - fromRef.current) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

const loaded = new Set<string>();

/** Simulates an async fetch the first time a section mounts in a session, so skeletons show. */
export function useSimulatedLoad(key: string, ms = 650) {
  const [ready, setReady] = useState(loaded.has(key));
  useEffect(() => {
    if (ready) return;
    const t = setTimeout(() => {
      loaded.add(key);
      setReady(true);
    }, ms);
    return () => clearTimeout(t);
  }, [key, ms, ready]);
  return ready;
}

export function useOnClickOutside(ref: RefObject<HTMLElement | null>, fn: () => void, active = true) {
  useEffect(() => {
    if (!active) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) fn();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, fn, active]);
}

export function useChartColors(theme: 'light' | 'dark') {
  return theme === 'dark'
    ? { primary: '#2FB488', secondary: '#9FE1CB', neutral: '#6B7280', grid: 'rgba(255,255,255,0.06)', axis: '#8B948F', surface: '#141917', tertiary: '#4B5563' }
    : { primary: '#0F6E56', secondary: '#5DCAA5', neutral: '#9CA3AF', grid: '#EEF0EF', axis: '#8A918D', surface: '#FFFFFF', tertiary: '#D1D5DB' };
}
