"use client";
// beui.dev/components/motion/bottom-sheet

import {
  AnimatePresence,
  animate,
  motion,
  type PanInfo,
  useDragControls,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EASE_DRAWER } from "@/lib/ease";
import { useFocusTrap } from "@/lib/hooks/use-focus-trap";
import { useMessages } from "@/lib/i18n";
import { PresenceGate } from "@/lib/presence-gate";
import { TOUCH_GESTURE_CONTENT_CLASS } from "@/lib/touch";
import { cn } from "@/lib/utils";

// Vaul-style glide: a long, fully-damped tween reads smoother than a spring on
// open — no settle/overshoot, just one clean decel. Same curve drives the
// backdrop fade so the surface and scrim move as one.
const DRAWER = { duration: 0.5, ease: EASE_DRAWER } as const;

/** English defaults. Override per instance with `labels`, or app-wide with `LocaleProvider`. */
export const bottomSheetMessages = {
  label: "Bottom sheet",
  close: "Close bottom sheet",
};

export type BottomSheetMessages = typeof bottomSheetMessages;

export interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Heights (0-1 = fraction of viewport, or "auto"). First entry is default. */
  snapPoints?: (number | "auto")[];
  defaultSnap?: number;
  title?: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  /** Min drag distance (px) past current snap to dismiss. */
  dismissThreshold?: number;
  /** Override any built-in string. */
  labels?: Partial<BottomSheetMessages>;
}

export function BottomSheet({
  open,
  onOpenChange,
  snapPoints = [0.5, 0.92],
  defaultSnap = 0,
  title,
  description,
  children,
  className,
  dismissThreshold = 120,
  labels,
}: BottomSheetProps) {
  const t = useMessages("bottomSheet", bottomSheetMessages, labels);
  const [snap, setSnap] = useState(defaultSnap);
  const [mounted, setMounted] = useState(false);
  const dragControls = useDragControls();
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // Shared by Motion's drag (header) and the manual pull on the content.
  const y = useMotionValue(0);
  const reduce = useReducedMotion();
  const uid = useId();
  const titleId = `${uid}-title`;
  const descriptionId = `${uid}-description`;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) setSnap(defaultSnap);
  }, [open, defaultSnap]);

  // Focus moves into the sheet on open, Tab stays inside it, and focus returns
  // to the opener on close. `mounted` gates it because the sheet only exists
  // once the portal can render.
  useFocusTrap(open && mounted, sheetRef, {
    onEscape: () => onOpenChange(false),
  });

  // Lock background scroll while open. overflow:hidden alone is ignored by
  // iOS Safari — boundary scrolls inside the sheet chain to the page, which
  // scrolls underneath and ends up somewhere else on close. position:fixed
  // is the lock that actually holds; restore the scroll position after.
  useEffect(() => {
    if (!open) return;
    const body = document.body;
    const scrollY = window.scrollY;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      overflow: body.style.overflow,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.overflow = "hidden";

    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  /** Decides where a downward/upward drag lands. Returns true when it closed. */
  const settle = (offset: number, velocity: number) => {
    // Strong downward fling or large drag → dismiss.
    if (velocity > 600 || offset > dismissThreshold) {
      const smaller = snapPoints.map((_, i) => i).filter((i) => i < snap);
      if (smaller.length && velocity < 800 && offset < dismissThreshold * 1.6) {
        setSnap(smaller[smaller.length - 1]);
        return false;
      }
      onOpenChange(false);
      return true;
    }
    return false;
  };

  const settleRef = useRef(settle);
  settleRef.current = settle;

  // Pull-to-dismiss from the content: when the content is scrolled to the top
  // and the finger moves down, the sheet follows the finger instead of the
  // scroll. Touch events (not pointer events) because the browser cancels the
  // pointer stream as soon as it starts its own pan; a non-passive touchmove
  // can still claim the gesture with preventDefault.
  useEffect(() => {
    const el = contentRef.current;
    if (!open || !mounted || !el) return;

    let mode: "idle" | "pending" | "drag" | "scroll" = "idle";
    let startX = 0;
    let startY = 0;
    let lastY = 0;
    let lastT = 0;
    let velocity = 0;

    const onStart = (e: TouchEvent) => {
      const target = e.target as Element | null;
      if (
        e.touches.length !== 1 ||
        target?.closest(".touch-none, [data-sheet-no-drag], textarea")
      ) {
        mode = "scroll";
        return;
      }
      const t = e.touches[0];
      startX = t.clientX;
      startY = lastY = t.clientY;
      lastT = e.timeStamp;
      velocity = 0;
      mode = "pending";
    };

    const onMove = (e: TouchEvent) => {
      if (mode === "idle" || mode === "scroll") return;
      const t = e.touches[0];
      const dy = t.clientY - startY;
      if (mode === "pending") {
        const dx = t.clientX - startX;
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        if (dy > 0 && Math.abs(dy) > Math.abs(dx) && el.scrollTop <= 0) {
          mode = "drag";
          startY = t.clientY;
        } else {
          mode = "scroll";
          return;
        }
      }
      e.preventDefault();
      const dt = e.timeStamp - lastT;
      if (dt > 0) velocity = ((t.clientY - lastY) / dt) * 1000;
      lastY = t.clientY;
      lastT = e.timeStamp;
      y.set(Math.max(0, t.clientY - startY));
    };

    const onEnd = () => {
      const wasDrag = mode === "drag";
      mode = "idle";
      if (!wasDrag) return;
      if (!settleRef.current(y.get(), velocity)) {
        animate(y, 0, { type: "spring", stiffness: 400, damping: 40 });
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [open, mounted, y]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const velocity = info.velocity.y;
    const offset = info.offset.y;

    if (velocity > 600 || offset > dismissThreshold) {
      settle(offset, velocity);
      return;
    }

    // Strong upward fling → next snap.
    if (velocity < -500) {
      setSnap((current) => Math.min(snapPoints.length - 1, current + 1));
      return;
    }

    // Otherwise snap to nearest by current offset.
    setSnap((current) => {
      if (offset > 80 && current > 0) return current - 1;
      if (offset < -80 && current < snapPoints.length - 1) return current + 1;
      return current;
    });
  };

  const snapValue = snapPoints[snap];
  const heightStyle =
    snapValue === "auto"
      ? { maxHeight: "92vh" }
      : { height: `${snapValue * 100}vh` };

  // Portal to <body>: an ancestor with backdrop-filter or transform becomes
  // the containing block for fixed descendants, which would position the
  // sheet against that ancestor instead of the viewport.
  if (!mounted) return null;

  // Two fixed siblings, no wrapper: the scrim spans the viewport edges but
  // carries a colour, and the sheet is pinned to the bottom, stops short of the
  // top edge at every snap point the component ships, and paints an opaque
  // surface either way. Both hang off `PresenceGate`, so interaction releases in
  // the same commit that starts the exit rather than when it ends.
  return createPortal(
    <AnimatePresence>
      {open ? (
        <PresenceGate key="backdrop">
          {({ gate }) => (
            <motion.button
              type="button"
              aria-label={t("close")}
              // Outside the sheet, so the focus trap never lands on it; it is
              // a pointer target, and Escape closes from the keyboard.
              tabIndex={-1}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={DRAWER}
              {...gate}
              onClick={() => onOpenChange(false)}
              // A dim scrim with a light blur. backdrop-blur is GPU-expensive and
              // re-rasterizes every frame the sheet drags over it; a small radius
              // plus more opacity keeps the glass look without the jank.
              className="pointer-events-auto fixed inset-0 z-50 bg-background/40 backdrop-blur-sm"
            />
          )}
        </PresenceGate>
      ) : null}
      {open ? (
        <PresenceGate key="sheet">
          {({ gate }) => (
            <motion.div
              ref={sheetRef}
              drag="y"
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.02, bottom: 0.4 }}
              dragMomentum={false}
              onDragEnd={onDragEnd}
              initial={reduce ? { y: 0, opacity: 0 } : { y: "100%" }}
              animate={reduce ? { y: 0, opacity: 1 } : { y: 0 }}
              exit={reduce ? { y: 0, opacity: 0 } : { y: "100%" }}
              transition={reduce ? { duration: 0.18, ease: EASE_DRAWER } : DRAWER}
              {...gate}
              style={{ ...heightStyle, ...gate.style, y }}
              className={cn(
                "pointer-events-auto fixed bottom-0 left-0 right-0 z-50 mx-auto flex max-w-2xl flex-col overflow-hidden rounded-t-3xl outline-none will-change-transform",
                "border border-border bg-background shadow-xl",
                className,
              )}
              role="dialog"
              aria-modal="true"
              tabIndex={-1}
              aria-labelledby={title ? titleId : undefined}
              aria-describedby={description ? descriptionId : undefined}
              aria-label={title ? undefined : t("label")}
            >
              {/* The whole header is a drag handle — the pill alone is too small a target on a phone. */}
              <div
                onPointerDown={(event) => dragControls.start(event)}
                // A slow pull must not hand the gesture to iOS's callout,
                // which would leave the sheet frozen mid-drag.
                className={cn(
                  "flex cursor-grab touch-none flex-col items-center px-4 pb-2 pt-3 active:cursor-grabbing",
                  TOUCH_GESTURE_CONTENT_CLASS,
                )}
              >
                <div className="flex items-center justify-center py-1">
                  <div className="h-1.5 w-10 rounded-full bg-muted-foreground/40" />
                </div>
                {title || description ? (
                  <div className="mt-2 w-full">
                    {title ? (
                      <h2
                        id={titleId}
                        className="text-base font-semibold text-foreground"
                      >
                        {title}
                      </h2>
                    ) : null}
                    {description ? (
                      <p
                        id={descriptionId}
                        className="mt-0.5 text-sm text-muted-foreground"
                      >
                        {description}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {/* overscroll-contain stops boundary scrolls from chaining to the page. */}
              <div
                ref={contentRef}
                className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 pb-6"
              >
                {children}
              </div>
            </motion.div>
          )}
        </PresenceGate>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
