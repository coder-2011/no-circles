"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getDwitterSketchById, getRandomDwitterSketchId } from "@/lib/art/dwitter-sketches";

type DwitterCanvasProps = {
  sketchId: string;
  className?: string;
};

export function DwitterCanvas({ sketchId, className }: DwitterCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [resolvedSketchId, setResolvedSketchId] = useState(sketchId === "random" ? "" : sketchId);

  useEffect(() => {
    if (sketchId !== "random") {
      setResolvedSketchId(sketchId);
      return;
    }

    setResolvedSketchId(getRandomDwitterSketchId());
  }, [sketchId]);

  const sketch = useMemo(() => {
    if (!resolvedSketchId) {
      return null;
    }

    return getDwitterSketchById(resolvedSketchId);
  }, [resolvedSketchId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sketch) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    let animationFrame = 0;
    const resize = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    };

    resize();
    window.addEventListener("resize", resize);

    const draw = (milliseconds: number) => {
      sketch.draw(context, canvas, milliseconds / 1000);
      animationFrame = window.requestAnimationFrame(draw);
    };

    animationFrame = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
    };
  }, [sketch]);

  return (
    <div>
      <canvas className={className} ref={canvasRef} />
    </div>
  );
}
