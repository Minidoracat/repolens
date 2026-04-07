"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";

interface MermaidPanelProps {
  mermaidCode: string | null;
}

const MIN_SCALE = 0.15;
const MAX_SCALE = 6;

export function MermaidPanel({ mermaidCode }: MermaidPanelProps) {
  const t = useTranslations("workspace");
  const [svgHtml, setSvgHtml] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [displayScale, setDisplayScale] = useState(100);

  // Pan = viewport pixels, scale = CSS zoom on inner layer
  const panRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const panLayerRef = useRef<HTMLDivElement>(null);  // translate layer
  const zoomLayerRef = useRef<HTMLDivElement>(null);  // zoom layer
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const fitToViewRef = useRef<(() => void) | null>(null);

  const applyView = useCallback(() => {
    if (panLayerRef.current) {
      panLayerRef.current.style.transform = `translate(${panRef.current.x}px, ${panRef.current.y}px)`;
    }
    if (zoomLayerRef.current) {
      zoomLayerRef.current.style.zoom = String(scaleRef.current);
    }
    setDisplayScale(Math.round(scaleRef.current * 100));
  }, []);

  // Render mermaid
  useEffect(() => {
    if (!mermaidCode) { setSvgHtml(""); return; }
    const render = async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          securityLevel: "strict",
          themeVariables: {
            fontFamily: "var(--font-geist-sans, ui-sans-serif, system-ui, sans-serif)",
          },
        });
        const { svg } = await mermaid.render(`mermaid-${Date.now()}`, mermaidCode);
        // Fix: Mermaid outputs width="100%" which breaks CSS zoom.
        // Use regex to replace width/height with fixed pixel values from viewBox.
        // Do NOT use DOMParser/XMLSerializer — they destroy foreignObject content.
        let fixedSvg = svg;
        const vbMatch = svg.match(/viewBox="[\d.]+ [\d.]+ ([\d.]+) ([\d.]+)"/);
        if (vbMatch) {
          const vbW = Math.ceil(parseFloat(vbMatch[1]!));
          const vbH = Math.ceil(parseFloat(vbMatch[2]!));
          // Replace width="..." (could be 100% or a number)
          fixedSvg = fixedSvg.replace(/(<svg[^>]*)\bwidth="[^"]*"/, `$1width="${vbW}"`);
          // Add height if missing, or replace
          if (/(<svg[^>]*)\bheight="[^"]*"/.test(fixedSvg)) {
            fixedSvg = fixedSvg.replace(/(<svg[^>]*)\bheight="[^"]*"/, `$1height="${vbH}"`);
          } else {
            fixedSvg = fixedSvg.replace(/<svg /, `<svg height="${vbH}" `);
          }
          // Remove max-width inline style that Mermaid adds
          fixedSvg = fixedSvg.replace(/style="[^"]*max-width:[^"]*"/, "");
        }
        setSvgHtml(fixedSvg);
        setError(null);
        panRef.current = { x: 0, y: 0 };
        scaleRef.current = 1;
        applyView();
        // Auto fit after DOM updates
        requestAnimationFrame(() => requestAnimationFrame(() => fitToViewRef.current?.()));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Render failed");
        setSvgHtml("");
      }
    };
    render();
  }, [mermaidCode, applyView]);

  // Escape fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setIsFullscreen(false); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [isFullscreen]);

  // Wheel zoom — zoom toward cursor
  const wheelRef = useRef<((e: WheelEvent) => void) | null>(null);
  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    const prev = containerRef.current;
    if (prev && wheelRef.current) prev.removeEventListener("wheel", wheelRef.current);
    containerRef.current = node;
    if (!node) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = node.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      const oldScale = scaleRef.current;
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, oldScale * factor));

      // SVG point under cursor: (cx - panX) / oldScale
      const svgX = (cx - panRef.current.x) / oldScale;
      const svgY = (cy - panRef.current.y) / oldScale;

      // New pan so same SVG point stays under cursor
      panRef.current.x = cx - svgX * newScale;
      panRef.current.y = cy - svgY * newScale;
      scaleRef.current = newScale;
      applyView();
    };

    wheelRef.current = onWheel;
    node.addEventListener("wheel", onWheel, { passive: false });
  }, [applyView]);

  // Pointer pan — only starts after a small drag threshold to avoid click-to-drag
  const DRAG_THRESHOLD = 3;
  const startPointer = useRef({ x: 0, y: 0 });
  const dragStarted = useRef(false);
  const activePointerId = useRef<number | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    activePointerId.current = e.pointerId;
    isDragging.current = true;
    dragStarted.current = false;
    startPointer.current = { x: e.clientX, y: e.clientY };
    lastPointer.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current || e.pointerId !== activePointerId.current) return;

    if (!dragStarted.current) {
      const dist = Math.abs(e.clientX - startPointer.current.x) + Math.abs(e.clientY - startPointer.current.y);
      if (dist < DRAG_THRESHOLD) return;
      dragStarted.current = true;
      (e.currentTarget as HTMLElement).style.cursor = "grabbing";
    }

    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    panRef.current.x += dx;
    panRef.current.y += dy;
    applyView();
  }, [applyView]);

  const stopDrag = useCallback((e: React.PointerEvent) => {
    if (e.pointerId !== activePointerId.current) return;
    isDragging.current = false;
    dragStarted.current = false;
    activePointerId.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ok */ }
    (e.currentTarget as HTMLElement).style.cursor = "grab";
  }, []);

  // Toolbar actions
  const zoomIn = () => { scaleRef.current = Math.min(MAX_SCALE, scaleRef.current * 1.3); applyView(); };
  const zoomOut = () => { scaleRef.current = Math.max(MIN_SCALE, scaleRef.current / 1.3); applyView(); };
  const resetView = () => { panRef.current = { x: 0, y: 0 }; scaleRef.current = 1; applyView(); };
  // Keep ref updated for auto-fit on render
  const fitToView = () => {
    const container = containerRef.current;
    const zoomLayer = zoomLayerRef.current;
    if (!container || !zoomLayer) return;
    // Temporarily reset to measure natural SVG size
    scaleRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    applyView();
    requestAnimationFrame(() => {
      const svg = zoomLayer.querySelector("svg");
      if (!svg) return;
      const sw = svg.getBoundingClientRect().width;
      const sh = svg.getBoundingClientRect().height;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      if (!sw || !sh) return;
      const pad = 32;
      const fitScale = Math.min((cw - pad * 2) / sw, (ch - pad * 2) / sh, 2);
      scaleRef.current = fitScale;
      panRef.current = { x: (cw - sw * fitScale) / 2, y: (ch - sh * fitScale) / 2 };
      applyView();
    });
  };
  fitToViewRef.current = fitToView;
  const handleCopy = () => { if (mermaidCode) void navigator.clipboard.writeText(mermaidCode); };
  const handleDownloadPng = () => {
    const svg = zoomLayerRef.current?.querySelector("svg");
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    // Reset any zoom for export
    const svgData = new XMLSerializer().serializeToString(clone);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = "diagram.png";
      a.click();
    };
    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`;
  };

  if (!mermaidCode) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-500">
        <p className="text-sm">{t("waitingDiagram")}</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-red-400">
        <p className="text-sm">{t("mermaidError")}</p>
        <p className="max-w-md text-center text-xs">{error}</p>
      </div>
    );
  }

  const toolbar = (
    <div className="flex items-center gap-1 border-b border-zinc-800 px-3 py-1.5">
      <span className="text-sm text-zinc-400">{t("architecture")}</span>
      <span className="ml-2 rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-zinc-500">{displayScale}%</span>
      <div className="ml-auto flex items-center gap-0.5">
        <button onClick={zoomOut} className="rounded p-1.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200" title="Zoom out">−</button>
        <button onClick={zoomIn} className="rounded p-1.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200" title="Zoom in">+</button>
        <button onClick={fitToView} className="rounded p-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200" title="Fit">⊞</button>
        <button onClick={resetView} className="rounded p-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200" title="1:1">1:1</button>
        <div className="mx-1 h-4 w-px bg-zinc-800" />
        <button onClick={handleCopy} className="rounded p-1.5 text-xs text-orange-500 hover:bg-zinc-800" title="Copy">{t("copyMermaid")}</button>
        <button onClick={handleDownloadPng} className="rounded p-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200" title="PNG">PNG</button>
        <div className="mx-1 h-4 w-px bg-zinc-800" />
        <button onClick={() => setIsFullscreen(v => !v)} className="rounded p-1.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200" title={isFullscreen ? "Exit (Esc)" : "Fullscreen"}>
          {isFullscreen ? "✕" : "⛶"}
        </button>
      </div>
    </div>
  );

  const canvas = (
    <div
      ref={setContainerRef}
      className="relative flex-1 overflow-hidden bg-zinc-950"
      style={{ cursor: "grab", touchAction: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      onPointerLeave={stopDrag}
    >
      {/* Dot grid */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
      {/* Pan layer — translate only, no scale */}
      <div ref={panLayerRef} className="pointer-events-none absolute left-0 top-0" style={{ willChange: "transform" }}>
        {/* Zoom layer — CSS zoom only, no translate */}
        <div ref={zoomLayerRef} className="pointer-events-none [&_svg]:max-w-none [&_svg]:pointer-events-none [&_svg_*]:pointer-events-none" style={{ transformOrigin: "0 0" }}
          /* eslint-disable-next-line react/no-danger */
          dangerouslySetInnerHTML={{ __html: svgHtml }}
        />
      </div>
    </div>
  );

  if (isFullscreen) {
    return (<div className="fixed inset-0 z-50 flex flex-col bg-zinc-950">{toolbar}{canvas}</div>);
  }
  return (<div className="flex h-full flex-col">{toolbar}{canvas}</div>);
}
