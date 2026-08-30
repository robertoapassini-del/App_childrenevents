"use client";

import { useCallback, useRef, useState } from "react";

/**
 * A two-position bottom sheet.
 *
 * The map screen previously drew a grab handle on a fixed-height panel — an
 * affordance promising a gesture that did not exist. Being able to shove the
 * list down to see the map, and haul it back up to read, is the main gesture on
 * that screen, so it should actually work.
 *
 * Heights are viewport fractions rather than pixels so the sheet behaves the
 * same on a small phone and a tablet.
 */

export type SheetPosition = "peek" | "expanded";

export const SHEET_HEIGHTS: Record<SheetPosition, number> = {
  peek: 0.42,
  expanded: 0.86,
};

/** Past this fraction of the travel, the drag commits to the other position. */
const COMMIT_FRACTION = 0.25;

/** A fast flick commits regardless of distance, in viewport fractions per second. */
const FLICK_VELOCITY = 0.6;

export function useSheet(initial: SheetPosition = "peek") {
  const [position, setPosition] = useState<SheetPosition>(initial);
  /** Live fraction while a finger is down; null when settled. */
  const [dragFraction, setDragFraction] = useState<number | null>(null);

  const start = useRef<{ y: number; at: number; from: number } | null>(null);

  const height = dragFraction ?? SHEET_HEIGHTS[position];

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      // Ignore secondary buttons; a right-click is not a drag.
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      start.current = {
        y: event.clientY,
        at: performance.now(),
        from: SHEET_HEIGHTS[position],
      };
    },
    [position],
  );

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    if (!start.current) return;
    // Dragging up grows the sheet, so the sign flips.
    const delta = (start.current.y - event.clientY) / window.innerHeight;
    const next = start.current.from + delta;
    setDragFraction(
      Math.min(SHEET_HEIGHTS.expanded, Math.max(SHEET_HEIGHTS.peek, next)),
    );
  }, []);

  const onPointerUp = useCallback(
    (event: React.PointerEvent) => {
      const began = start.current;
      start.current = null;
      if (!began) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      const travelled = (began.y - event.clientY) / window.innerHeight;
      const elapsed = Math.max(1, performance.now() - began.at) / 1000;
      const velocity = travelled / elapsed;
      const span = SHEET_HEIGHTS.expanded - SHEET_HEIGHTS.peek;

      let next: SheetPosition;
      if (Math.abs(velocity) >= FLICK_VELOCITY) {
        next = velocity > 0 ? "expanded" : "peek";
      } else if (Math.abs(travelled) >= span * COMMIT_FRACTION) {
        next = travelled > 0 ? "expanded" : "peek";
      } else {
        // Not enough intent either way — go back where it came from.
        next = position;
      }

      setPosition(next);
      setDragFraction(null);
    },
    [position],
  );

  const toggle = useCallback(() => {
    setPosition((current) => (current === "peek" ? "expanded" : "peek"));
    setDragFraction(null);
  }, []);

  const expand = useCallback(() => {
    setPosition("expanded");
    setDragFraction(null);
  }, []);

  return {
    position,
    /** Viewport fraction, 0–1. */
    height,
    isDragging: dragFraction !== null,
    toggle,
    expand,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}
