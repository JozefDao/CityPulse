import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

type TooltipProps = {
  content: string;
  children: ReactNode;
};

type TooltipPosition = {
  left: number;
  top: number;
};

export function Tooltip({ content, children }: TooltipProps) {
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const tooltipRef = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition>({ left: 0, top: 0 });

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    setPosition({
      left: rect.left + rect.width / 2,
      top: rect.bottom + 8,
    });
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    updatePosition();

    const onViewportChange = () => updatePosition();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && triggerRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('scroll', onViewportChange, true);
    window.addEventListener('resize', onViewportChange);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onEscape);

    return () => {
      window.removeEventListener('scroll', onViewportChange, true);
      window.removeEventListener('resize', onViewportChange);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open, updatePosition]);

  useLayoutEffect(() => {
    if (!open || !tooltipRef.current) {
      return;
    }

    const margin = 8;
    const rect = tooltipRef.current.getBoundingClientRect();

    let nextLeft = position.left;
    if (rect.left < margin) {
      nextLeft += margin - rect.left;
    }
    if (rect.right > window.innerWidth - margin) {
      nextLeft -= rect.right - (window.innerWidth - margin);
    }

    if (Math.abs(nextLeft - position.left) > 0.5) {
      setPosition((prev) => ({ ...prev, left: nextLeft }));
    }
  }, [open, position.left]);

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget as Node | null;
        if (nextTarget && triggerRef.current?.contains(nextTarget)) {
          return;
        }

        setOpen(false);
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setOpen((current) => !current);
      }}
    >
      {children}
      {open
        ? createPortal(
            <span
              ref={tooltipRef}
              role="tooltip"
              className="pointer-events-none fixed z-[9999] max-w-[280px] -translate-x-1/2 rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
              style={{ left: `${position.left}px`, top: `${position.top}px` }}
            >
              {content}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
