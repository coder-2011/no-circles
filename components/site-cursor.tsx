"use client";

import { useEffect, useRef, useState } from "react";

const MOUSE_TAIL_COUNT = 8;
const INTERACTIVE_SELECTOR = "a, button, input, textarea, select, label, summary, [role='button']";

export function SiteCursor() {
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const tailDotRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const [pointerEffectsEnabled, setPointerEffectsEnabled] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const pointerMediaQuery = window.matchMedia("(pointer: fine) and (hover: hover)");
    const motionMediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const update = () => {
      setPointerEffectsEnabled(pointerMediaQuery.matches);
      setPrefersReducedMotion(motionMediaQuery.matches);
    };

    update();
    pointerMediaQuery.addEventListener("change", update);
    motionMediaQuery.addEventListener("change", update);

    return () => {
      pointerMediaQuery.removeEventListener("change", update);
      motionMediaQuery.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("site-cursor-active", pointerEffectsEnabled);

    return () => {
      document.body.classList.remove("site-cursor-active");
    };
  }, [pointerEffectsEnabled]);

  useEffect(() => {
    if (!pointerEffectsEnabled) {
      return;
    }

    const cursor = cursorRef.current;
    const tailDots = tailDotRefs.current.filter((dot): dot is HTMLSpanElement => dot !== null);
    if (!cursor) {
      return;
    }

    const trail = tailDots.map(() => ({ x: -999, y: -999 }));
    let visible = false;
    let cursorX = -999;
    let cursorY = -999;
    let targetX = -999;
    let targetY = -999;
    let frameId = 0;

    const updatePointerState = (target: EventTarget | null) => {
      const isPointer = target instanceof Element && target.closest(INTERACTIVE_SELECTOR);
      cursor.classList.toggle("site-cursor--pointer", Boolean(isPointer));
    };

    const handleMouseMove = (event: MouseEvent) => {
      targetX = event.clientX;
      targetY = event.clientY;
      visible = true;
      updatePointerState(event.target);
    };

    const handleMouseLeave = () => {
      visible = false;
      cursor.classList.remove("site-cursor--pointer");
    };

    const render = () => {
      cursorX += (targetX - cursorX) * 0.28;
      cursorY += (targetY - cursorY) * 0.28;
      cursor.style.opacity = visible ? "1" : "0";
      cursor.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0) translate(-50%, -50%)`;

      if (!prefersReducedMotion) {
        for (let index = 0; index < trail.length; index += 1) {
          const point = trail[index];
          const leader = index === 0 ? { x: targetX, y: targetY } : trail[index - 1];
          const easing = index === 0 ? 0.3 : 0.23;

          point.x += (leader.x - point.x) * easing;
          point.y += (leader.y - point.y) * easing;

          const dot = tailDots[index];
          const opacity = visible ? Math.max(0, 0.66 - index * 0.065) : 0;
          const scale = 1 - index * 0.08;
          const rotation = 45 + index * 7;

          dot.style.opacity = String(opacity);
          dot.style.transform = `translate3d(${point.x - 7}px, ${point.y - 7}px, 0) rotate(${rotation}deg) scale(${scale})`;
        }
      }

      frameId = window.requestAnimationFrame(render);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mouseleave", handleMouseLeave, { passive: true });
    frameId = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [pointerEffectsEnabled, prefersReducedMotion]);

  if (!pointerEffectsEnabled) {
    return null;
  }

  return (
    <>
      {!prefersReducedMotion ? (
        <div className="site-cursor__tail-layer" aria-hidden="true">
          {Array.from({ length: MOUSE_TAIL_COUNT }).map((_, index) => (
            <span
              className="site-cursor__tail-dot"
              key={index}
              ref={(element) => {
                tailDotRefs.current[index] = element;
              }}
            />
          ))}
        </div>
      ) : null}
      <div aria-hidden="true" className="site-cursor" ref={cursorRef} />
    </>
  );
}
