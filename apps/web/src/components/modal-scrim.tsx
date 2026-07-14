"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/**
 * Full-screen modal backdrop. Only closes when pointer down + click both
 * happen on the scrim itself (not after releasing a native <select>/file
 * picker over the dimmed area — a common "random close" bug).
 */
export function ModalScrim({
  children,
  onClose,
  className,
}: {
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const pointerDownOnScrim = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const onPointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    pointerDownOnScrim.current = e.target === e.currentTarget;
  }, []);

  const onClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (pointerDownOnScrim.current && e.target === e.currentTarget) {
      onCloseRef.current();
    }
    pointerDownOnScrim.current = false;
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className={className ? `vo-scrim ${className}` : "vo-scrim"}
      role="presentation"
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      {children}
    </div>,
    document.body,
  );
}
