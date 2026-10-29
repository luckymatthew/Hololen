"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

const scrollLocks = new Set<symbol>();
let unlockedOverflow = '';
function lockPageScroll() {
  const lock = Symbol('dialog');
  if (scrollLocks.size === 0) unlockedOverflow = document.body.style.overflow;
  scrollLocks.add(lock); document.body.style.overflow = 'hidden';
  return () => { if (scrollLocks.delete(lock) && scrollLocks.size === 0) document.body.style.overflow = unlockedOverflow; };
}

/** Native dialog semantics + Transitions.dev modal timing. No delay for reduced motion. */
export function useModalMotion(onClose: () => void, open = true) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const node = dialog.current;
    const previousFocus = document.activeElement;
    const unlockScroll = lockPageScroll();
    if (node) node.inert = false;
    if (node && !node.open) node.showModal();
    const frame = window.requestAnimationFrame(() => node?.classList.add('is-open'));
    return () => {
      window.cancelAnimationFrame(frame);
      clearTimeout(timer.current);
      if (node?.open) node.close();
      unlockScroll();
      const remainingDialog = document.querySelector('dialog[open]');
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected && (!remainingDialog || remainingDialog.contains(previousFocus))) previousFocus.focus({ preventScroll: true });
    };
  }, [open]);
  const requestClose = useCallback(() => {
    const node = dialog.current;
    if (!node || node.classList.contains('is-closing')) return;
    node.inert = true;
    node.classList.remove('is-open');
    node.classList.add('is-closing');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const raw = window.getComputedStyle(document.documentElement).getPropertyValue('--modal-close-dur').trim();
    const milliseconds = raw.endsWith('ms') ? parseFloat(raw) : parseFloat(raw) * 1000;
    timer.current = setTimeout(() => {
      node.classList.remove('is-closing');
      closeRef.current();
    }, reduced ? 0 : Number.isFinite(milliseconds) ? milliseconds : 150);
  }, []);
  return { dialog, requestClose };
}

/** Measures only a small chip group; repositions without tween on first paint/resize. */
export function SlidingTabs({ children, className = '', label, selected }: {
  children: ReactNode; className?: string; label: string; selected: string;
}) {
  const bar = useRef<HTMLDivElement>(null);
  const moveIndicator = useRef<((animate: boolean) => void) | null>(null);
  useEffect(() => {
    const node = bar.current;
    const pill = node?.querySelector<HTMLElement>('.t-tabs-pill');
    if (!node || !pill) return;
    const move = (animate: boolean) => {
      const active = node.querySelector<HTMLElement>('[aria-pressed="true"], [aria-current="page"]');
      if (!active) return;
      const previous = pill.style.transition;
      if (!animate) pill.style.transition = 'none';
      pill.style.transform = `translateX(${active.offsetLeft}px)`;
      pill.style.width = `${active.offsetWidth}px`;
      pill.style.height = `${active.offsetHeight}px`;
      pill.style.top = `${active.offsetTop}px`;
      if (!animate) { void pill.offsetWidth; pill.style.transition = previous; }
    };
    moveIndicator.current = move;
    move(false);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => move(false));
    observer?.observe(node);
    const resize = () => move(false);
    window.addEventListener('resize', resize);
    return () => { moveIndicator.current = null; observer?.disconnect(); window.removeEventListener('resize', resize); };
  }, []);
  useEffect(() => { moveIndicator.current?.(true); }, [selected]);
  return <div className={`t-tabs ${className}`} ref={bar} role="group" aria-label={label}><span className="t-tabs-pill" aria-hidden="true" />{children}</div>;
}

export function StatusToast({ message }: { message: string }) {
  const [visibleMessage, setVisibleMessage] = useState(message);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const frame = window.requestAnimationFrame(() => {
      if (message) { setVisibleMessage(message); setShown(true); }
      else {
        setShown(false);
        const raw = window.getComputedStyle(document.documentElement).getPropertyValue('--toast-close').trim();
        const ms = raw.endsWith('ms') ? parseFloat(raw) : parseFloat(raw) * 1000;
        timer = setTimeout(() => setVisibleMessage(''), window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : Number.isFinite(ms) ? ms : 250);
      }
    });
    return () => { window.cancelAnimationFrame(frame); clearTimeout(timer); };
  }, [message]);
  return visibleMessage ? <div className={`toast t-toast${shown ? ' is-open' : ''}`} role="status">{visibleMessage}</div> : null;
}
