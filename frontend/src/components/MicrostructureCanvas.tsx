import { useEffect, useRef } from "react";

interface MicrostructureCanvasProps {
  composition: Record<string, number>;
  width?: number;
  height?: number;
}

// Seeded PRNG (mulberry32)
function createRng(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashComposition(comp: Record<string, number>): number {
  let h = 0;
  for (const key of Object.keys(comp).sort()) {
    const v = comp[key] || 0;
    h = ((h << 5) - h + Math.round(v * 100)) | 0;
  }
  return Math.abs(h) || 42;
}

interface Particle {
  x: number;
  y: number;
  r: number;
}

function overlaps(p: Particle, placed: Particle[], margin: number): boolean {
  for (const q of placed) {
    const dx = p.x - q.x;
    const dy = p.y - q.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < p.r + q.r + margin) return true;
  }
  return false;
}

function drawIrregularAggregate(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  rng: () => number,
  color: string,
  itzColor: string,
  itzWidth: number
) {
  const vertices = 6 + Math.floor(rng() * 4);
  const points: [number, number][] = [];
  for (let i = 0; i < vertices; i++) {
    const angle = (i / vertices) * Math.PI * 2 + rng() * 0.3;
    const r = radius * (0.7 + rng() * 0.3);
    points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }

  // ITZ (Interfacial Transition Zone) - lighter ring
  if (itzWidth > 0) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
    ctx.lineWidth = itzWidth;
    ctx.strokeStyle = itzColor;
    ctx.stroke();
  }

  // Aggregate body
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();

  // Subtle edge
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = "rgba(0,0,0,0.2)";
  ctx.stroke();
}

export default function MicrostructureCanvas({
  composition,
  width = 550,
  height = 550,
}: MicrostructureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rng = createRng(hashComposition(composition));

    const cement = composition.cement || 0;
    const flyAsh = composition.fly_ash || 0;
    const water = composition.water || 0;
    const superplasticizer = composition.superplasticizer || 0;
    const coarseAgg = composition.coarse_aggregate || 0;
    const fineAgg = composition.fine_aggregate || 0;
    const age = composition.age || 28;

    // Derived parameters
    const binderTotal = cement + flyAsh + 0.001;
    const wcRatio = water / binderTotal;
    const ageFactor = Math.min(Math.log(age + 1) / Math.log(366), 1);
    const spEffect = Math.min(superplasticizer / 15, 1); // 0-1 dispersion quality

    // --- 1. Cement paste background ---
    // Young/low cement = lighter, old/high cement = darker
    const pasteBase = 195 - cement * 0.08 - ageFactor * 30;
    const pasteG = pasteBase - 5;
    const pasteB = pasteBase - 15;
    ctx.fillStyle = `rgb(${Math.round(pasteBase)}, ${Math.round(pasteG)}, ${Math.round(pasteB)})`;
    ctx.fillRect(0, 0, width, height);

    // Add subtle texture to paste
    for (let i = 0; i < 3000; i++) {
      const tx = rng() * width;
      const ty = rng() * height;
      const brightness = (rng() - 0.5) * 15;
      ctx.fillStyle = `rgba(${brightness > 0 ? 255 : 0}, ${brightness > 0 ? 255 : 0}, ${brightness > 0 ? 255 : 0}, ${Math.abs(brightness) / 100})`;
      ctx.fillRect(tx, ty, 1 + rng() * 2, 1 + rng() * 2);
    }

    const placed: Particle[] = [];

    // --- 2. Coarse aggregates ---
    const coarseCount = Math.round((coarseAgg / 1200) * 35);
    const coarseColors = [
      "rgb(160, 155, 145)",
      "rgb(145, 140, 130)",
      "rgb(170, 165, 155)",
      "rgb(155, 148, 138)",
      "rgb(135, 130, 122)",
      "rgb(175, 168, 158)",
    ];
    const itzColor = `rgba(200, 195, 185, 0.6)`;

    for (let i = 0; i < coarseCount; i++) {
      const r = 18 + rng() * 25;
      let attempts = 0;
      let x: number, y: number;
      do {
        x = r + rng() * (width - 2 * r);
        y = r + rng() * (height - 2 * r);
        attempts++;
      } while (overlaps({ x, y, r }, placed, 3) && attempts < 80);
      if (attempts >= 80) continue;

      placed.push({ x, y, r });
      const color = coarseColors[Math.floor(rng() * coarseColors.length)];
      drawIrregularAggregate(ctx, x, y, r, rng, color, itzColor, 3);
    }

    // --- 3. Fine aggregates (sand) ---
    const fineCount = Math.round((fineAgg / 900) * 120);
    const sandColors = [
      "rgb(195, 180, 155)",
      "rgb(185, 172, 148)",
      "rgb(200, 188, 165)",
      "rgb(178, 165, 140)",
    ];

    for (let i = 0; i < fineCount; i++) {
      const r = 2 + rng() * 5;
      let attempts = 0;
      let x: number, y: number;
      do {
        x = r + rng() * (width - 2 * r);
        y = r + rng() * (height - 2 * r);
        attempts++;
      } while (overlaps({ x, y, r }, placed, 1) && attempts < 30);
      if (attempts >= 30) continue;

      placed.push({ x, y, r });
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = sandColors[Math.floor(rng() * sandColors.length)];
      ctx.fill();
    }

    // --- 4. Fly ash spheres (perfect circles - characteristic shape) ---
    const faCount = Math.round((flyAsh / 200) * 50);
    for (let i = 0; i < faCount; i++) {
      const r = 2 + rng() * 6;
      let attempts = 0;
      let x: number, y: number;
      do {
        x = r + rng() * (width - 2 * r);
        y = r + rng() * (height - 2 * r);
        attempts++;
      } while (overlaps({ x, y, r }, placed, 1) && attempts < 30);
      if (attempts >= 30) continue;

      placed.push({ x, y, r });

      // Fly ash is characteristically dark and perfectly spherical
      const shade = 60 + rng() * 30;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${Math.round(shade)}, ${Math.round(shade)}, ${Math.round(shade + 5)})`;
      ctx.fill();

      // Glassy highlight (fly ash is vitreous)
      ctx.beginPath();
      ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      ctx.fill();
    }

    // --- 5. Pores / voids ---
    // More water = higher w/c = more porosity
    // Superplasticizer reduces entrapped air
    const porosityFactor = Math.max(0, wcRatio - 0.25) * 3;
    const poreReduction = spEffect * 0.4;
    const poreCount = Math.round(
      Math.max(0, (porosityFactor - poreReduction) * 60 * (1 - ageFactor * 0.3))
    );

    for (let i = 0; i < poreCount; i++) {
      const r = 1.5 + rng() * (5 + porosityFactor * 6);
      let x = r + rng() * (width - 2 * r);
      let y = r + rng() * (height - 2 * r);

      // Check if pore falls inside an aggregate (skip if so)
      let inAggregate = false;
      for (const p of placed) {
        if (p.r > 10) {
          const dx = x - p.x;
          const dy = y - p.y;
          if (Math.sqrt(dx * dx + dy * dy) < p.r - 2) {
            inAggregate = true;
            break;
          }
        }
      }
      if (inAggregate) continue;

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(40, 35, 30, ${0.5 + rng() * 0.3})`;
      ctx.fill();
    }

    // --- 6. Unhydrated cement grains (visible in young concrete) ---
    if (ageFactor < 0.6) {
      const grainCount = Math.round((1 - ageFactor) * 25 * (cement / 400));
      for (let i = 0; i < grainCount; i++) {
        const r = 1 + rng() * 3;
        const x = r + rng() * (width - 2 * r);
        const y = r + rng() * (height - 2 * r);

        // Check not inside aggregate
        let inside = false;
        for (const p of placed) {
          if (p.r > 10) {
            const dx = x - p.x;
            const dy = y - p.y;
            if (Math.sqrt(dx * dx + dy * dy) < p.r) { inside = true; break; }
          }
        }
        if (inside) continue;

        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(210, 205, 195, ${0.6 + rng() * 0.3})`;
        ctx.fill();
      }
    }

    // --- 7. Scale bar ---
    const barY = height - 25;
    const barX = width - 130;
    const barLen = 100;
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(barX - 5, barY - 18, barLen + 10, 30);
    ctx.fillStyle = "#fff";
    ctx.fillRect(barX, barY, barLen, 3);
    ctx.fillRect(barX, barY - 3, 2, 9);
    ctx.fillRect(barX + barLen - 2, barY - 3, 2, 9);
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText("~ 5 mm", barX + barLen / 2, barY - 5);

    // --- 8. Legend ---
    const legendX = 10;
    let legendY = 14;
    const legendH = 16;
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(5, 5, 175, 118);

    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "#fff";
    ctx.fillText("Microestructura 2D", legendX, legendY);
    legendY += legendH + 2;

    const legendItems: [string, string][] = [
      ["rgb(155, 148, 138)", "Agregado grueso"],
      ["rgb(195, 180, 155)", "Agregado fino (arena)"],
      ["rgb(70, 70, 75)", "Ceniza volante"],
      [`rgb(${Math.round(pasteBase)}, ${Math.round(pasteG)}, ${Math.round(pasteB)})`, "Pasta de cemento"],
      ["rgb(40, 35, 30)", "Poros / vacíos"],
    ];

    ctx.font = "10px sans-serif";
    for (const [color, label] of legendItems) {
      ctx.fillStyle = color;
      ctx.fillRect(legendX, legendY - 8, 12, 12);
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(legendX, legendY - 8, 12, 12);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, legendX + 17, legendY + 2);
      legendY += legendH;
    }

  }, [composition, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        border: "1px solid #ccc",
        borderRadius: 4,
        display: "block",
      }}
    />
  );
}
