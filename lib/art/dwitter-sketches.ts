export type DwitterSketch = {
  id: string;
  title: string;
  draw: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, t: number) => void;
};

const S = Math.sin;
const C = Math.cos;
const T = Math.tan;

function rgb(r: number, g: number, b: number): string {
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
  return `rgb(${clamp(r)}, ${clamp(g)}, ${clamp(b)})`;
}

function rgba(r: number, g: number, b: number, a: number): string {
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
  const alpha = Math.max(0, Math.min(1, a));
  return `rgba(${clamp(r)}, ${clamp(g)}, ${clamp(b)}, ${alpha})`;
}

function withReferenceScale(
  canvas: HTMLCanvasElement,
  refWidth: number,
  refHeight: number
): {
  x: (value: number) => number;
  y: (value: number) => number;
  w: (value: number) => number;
  h: (value: number) => number;
  s: number;
} {
  const sx = canvas.width / refWidth;
  const sy = canvas.height / refHeight;
  return {
    x: (value: number) => value * sx,
    y: (value: number) => value * sy,
    w: (value: number) => Math.max(0.5, value * sx),
    h: (value: number) => Math.max(0.5, value * sy),
    s: (sx + sy) * 0.5
  };
}

const sketch1: DwitterSketch = {
  id: "1",
  title: "Feb 7 2026",
  draw(ctx, canvas, t) {
    const p = withReferenceScale(canvas, 1920, 1080);
    const safeT = t + 0.001;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const invertLevel = 0.38 + 0.22 * S(t * 0.45);
    canvas.style.filter = `invert(${invertLevel.toFixed(2)})`;
    ctx.fillStyle = "#fff";
    for (let i = 2e4; i--;) {
      const F = i % (2 + 15 / safeT);
      const k = i % 7 ? i * safeT : ~((i / safeT) % 44);
      const tanValue = Math.max(-6, Math.min(6, T(k)));
      const X = 4 * F * tanValue;
      const Y = (F * C(k)) / 2 - 1 / (F || 1);
      ctx.fillRect(p.x(940 + X * 15), p.y(480 - Y * 62), t < 2 ? p.w(1) : p.w(0.1), p.h(0.1));
    }
  }
};

const sketch2: DwitterSketch = {
  id: "2",
  title: "Feb 21 2017",
  draw(ctx, canvas, t) {
    const p = withReferenceScale(canvas, 1920, 1080);
    ctx.fillStyle = "#1e1e1e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const F = (Z: number) => {
      const W = (1 / Z) * 4e3;
      ctx.fillStyle = rgb(W, W / 2, W / 4);
      for (let i = Z * Z * 2; i--;) {
        const n = i % Z;
        const m = (i / Z) | 0;
        if ((n % 2) ^ (m % 2)) {
          ctx.fillRect(p.x((n - (t % 2) - 1) * W), p.y((S(t) + m - 1) * W), p.w(W), p.h(W));
        }
      }
      if (Z) {
        F(Z - 6);
      }
    };

    F(36);
  }
};

const sketch3: DwitterSketch = {
  id: "3",
  title: "Feb 27 2017",
  draw(ctx, canvas, t) {
    const p = withReferenceScale(canvas, 1920, 1080);
    const l = 1920;
    const h = 400;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    for (let i = 1; i < 200; i += 1) {
      const a = (t + C(i)) % 2;
      for (let j = a; j < 50; j += 1) {
        const w = a * h - h;
        const px = l * C(i * i) + Math.trunc(a) * w * C(j);
        const py = (Math.trunc(a) ? h : a * h) * (C(i) * C(i) + 2) + (w * S(j)) / 4;
        ctx.fillRect(p.x(px), p.y(py), p.w(3), p.h(3));
      }
    }
  }
};

const sketch4: DwitterSketch = {
  id: "4",
  title: "Feb 22 2017",
  draw(ctx, canvas, t) {
    const p = withReferenceScale(canvas, 1920, 1080);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    for (let i = 0; i < 300; i += 1) {
      for (let j = 0; j < 6; j += 1) {
        const px = 960 + 200 * C(i) * S(T(t / 1.1) + j / Math.max(i, 1));
        const py = 540 + 200 * S(i);
        ctx.fillRect(p.x(px), p.y(py), p.w(10), p.h(10));
      }
    }
  }
};

const sketch5: DwitterSketch = {
  id: "5",
  title: "Mar 3 2017",
  draw(ctx, canvas, t) {
    const p = withReferenceScale(canvas, 1920, 1080);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = Math.max(1, p.s * 1.2);
    ctx.beginPath();
    for (let i = 16; i--;) {
      ctx.ellipse(
        p.x(1e3 + 300 * S(t + i * 0.1)),
        p.y(500 + 50 * C(t + i * 0.1)),
        p.w(160 * S(-i * 0.5) + 160),
        p.h(50 * S(i * 0.1) + 5),
        1.6 + 0.5 * S(t * 0.5),
        9.5,
        0,
        6.3
      );
    }
    ctx.stroke();
  }
};

const sketch6: DwitterSketch = {
  id: "6",
  title: "Dec 28 2017",
  draw(ctx, canvas, t) {
    const p = withReferenceScale(canvas, 1920, 1080);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let w = 3e3;
    let a = 333 * T((t % 9) / 7);
    let b = a;
    const g = a;
    let prevS = 0;
    for (let i = 3e3; i--;) {
      const j = (i ^ (a * a)) % 4;
      const s = w * 9;
      ctx.fillStyle = rgba(s * 0.55, w * 0.55, prevS * 0.55, 0.13);
      a += g + C(j * 5 + t) * g - a / 2 - w + g;
      b += g + S(j * 9 + t) * g - b / 2 - w;
      ctx.fillRect(p.x(a), p.y(b), p.w(s), p.h(s));
      prevS = s;
      w = 2;
    }
  }
};

const sketch7: DwitterSketch = {
  id: "7",
  title: "Feb 24 2017",
  draw(ctx, canvas, t) {
    const p = withReferenceScale(canvas, 1920, 1080);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#fff";
    for (let i = 9; i < 2e3; i += 2) {
      const s = 3 / (9.1 - ((t + i / 99) % 9));
      const j = i * 7 + S(i * 4 + t + S(t));
      ctx.beginPath();
      ctx.lineWidth = Math.max(0.3, s * s * p.s);
      ctx.arc(p.x(960), p.y(540), p.w(s * 49), j, j + 0.6);
      ctx.stroke();
    }
  }
};

const sketch8: DwitterSketch = {
  id: "8",
  title: "Dec 28 2017 Tree",
  draw(ctx, canvas, t) {
    const p = withReferenceScale(canvas, 500, 500);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";

    const v = (a: number, b: number, g: number, r: number) => {
      if (r > 1) {
        const nextA = a + r * S(g);
        const nextB = b - r * C(g);
        ctx.fillRect(p.x(nextA), p.y(nextB), p.w(2), p.h(2));
        v(nextA, nextB, g - 1 + C(t), r * 0.7);
        v(nextA, nextB, g + 0.5 + S(t), r * 0.7);
      }
    };

    v(250, 270, 0, 80);
  }
};

const sketch9: DwitterSketch = {
  id: "9",
  title: "Oct 17 2018",
  draw(ctx, canvas, t) {
    const p = withReferenceScale(canvas, 2000, 2000);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    t += 160;
    for (let i = 2e3; i--;) {
      const parity = i & 1;
      const m = t / C(t / Math.max(i, 1)) + parity * (t / 2 + (i % t));
      const n = t / 9 + i * i;
      const s = 3 - C(n) * 3;
      ctx.clearRect(
        p.x(960 + m * S(n) * C((parity ? 0 : 1) * i / t)),
        p.y(540 + m * C(n + parity * 2)),
        p.w(s),
        p.h(s)
      );
    }
  }
};

export const DITTER_SKETCHES: DwitterSketch[] = [sketch1, sketch2, sketch3, sketch4, sketch5, sketch6, sketch7, sketch8, sketch9];

export const DITTER_SKETCH_IDS = DITTER_SKETCHES.map((sketch) => sketch.id);

export function getDwitterSketchById(id: string): DwitterSketch | null {
  return DITTER_SKETCHES.find((sketch) => sketch.id === id) ?? null;
}

export function getRandomDwitterSketchId(): string {
  return DITTER_SKETCH_IDS[Math.floor(Math.random() * DITTER_SKETCH_IDS.length)] ?? "1";
}
