"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { sectorPath, polarToCartesian } from "./geometry/sectorPath";
import { useMapStore } from "./mapStore";
import { useAppState } from "./store";

type Point = { x: number; y: number };

export type Cone = {
  pitch: number;
  yaw: number;
  radius?: number;
};

export type MapWithConeProps = {
  points: Point[];
  width?: number;
  height?: number;
  cone: Cone;
  coneOriginIndex?: number;
  interactive?: boolean;
  showYawGuide?: boolean;
  onConeChange?: (next: Cone) => void;
  onSelectOrigin?: (index: number) => void;
  className?: string;
  style?: React.CSSProperties;
  originHandleRadius?: number;
  showMapButton?: boolean;
  mapButtonLabel?: string;
  onClose?: () => void;
  onMapOpen?: () => void;
  rotateWithScreen?: boolean;
  onRotateWithScreen?: (newYaw: number) => void;
};

const MapWithCone: React.FC<MapWithConeProps> = ({
  points,
  width = 525,
  height = 360,
  cone,
  coneOriginIndex = 0,
  interactive = false,
  showYawGuide = false,
  onConeChange,
  onSelectOrigin,
  className,
  style,
  originHandleRadius = 24,
  showMapButton = false,
  mapButtonLabel = "📍",
  onClose,
  onMapOpen,
  rotateWithScreen = false,
  onRotateWithScreen,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const animationFrameRef = useRef<number | null>(null);
  const baseYawRef = useRef<number>(cone.yaw);
  const baseAngleRef = useRef<number>(0);
  // Panning state for popup window
  const popupViewportRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const panDragRef = useRef<{ active: boolean; startX: number; startY: number; startPanX: number; startPanY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
  });

  const origin = points[coneOriginIndex] || { x: width / 2, y: height / 2 };
  const radius = cone.radius ?? Math.min(width, height) * 0.6;

  const conePath = useMemo(() => {
    return sectorPath(origin.x, origin.y, radius, cone.yaw, cone.pitch);
  }, [origin.x, origin.y, radius, cone.yaw, cone.pitch]);

  const yawGuideEnd = useMemo(() => {
    return polarToCartesian(origin.x, origin.y, radius, cone.yaw);
  }, [origin.x, origin.y, radius, cone.yaw]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!interactive || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // First: pick nearest point to set origin
      let picked = -1; let best = Infinity;
      for (let i = 0; i < points.length; i++) {
        const dxp = x - points[i].x;
        const dyp = y - points[i].y;
        const dp = Math.hypot(dxp, dyp);
        if (dp < best && dp <= originHandleRadius) { best = dp; picked = i; }
      }
      if (picked !== -1) { onSelectOrigin?.(picked); return; }

      const dx = x - origin.x;
      const dy = y - origin.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= originHandleRadius) {
        setIsDragging(true);
        e.currentTarget.setPointerCapture(e.pointerId);
      }
    },
    [interactive, origin.x, origin.y, originHandleRadius, points, onSelectOrigin]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging || !interactive || !containerRef.current || !onConeChange) return;

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      animationFrameRef.current = requestAnimationFrame(() => {
        const rect = containerRef.current!.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const dx = x - origin.x;
        const dy = y - origin.y;
        const newYaw = Math.atan2(dy, dx);

        onConeChange({ ...cone, yaw: newYaw });
      });
    },
    [isDragging, interactive, origin.x, origin.y, cone, onConeChange]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (isDragging) {
        setIsDragging(false);
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    },
    [isDragging]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!interactive || !onConeChange) return;

      let updated = false;
      let newYaw = cone.yaw;
      let newPitch = cone.pitch;

      switch (e.key) {
        case "ArrowLeft":
          newYaw -= 0.02;
          updated = true;
          break;
        case "ArrowRight":
          newYaw += 0.02;
          updated = true;
          break;
        case "ArrowUp":
          newPitch = Math.min(newPitch + 0.02, Math.PI * 1.8);
          updated = true;
          break;
        case "ArrowDown":
          newPitch = Math.max(newPitch - 0.02, 0);
          updated = true;
          break;
      }

      if (updated) {
        e.preventDefault();
        onConeChange({ ...cone, yaw: newYaw, pitch: newPitch });
      }
    },
    [interactive, cone, onConeChange]
  );

  const handleMapOpen = useCallback(() => {
    setIsMapOpen(true);
    onMapOpen?.();
  }, [onMapOpen]);

  const handleMapClose = useCallback(() => {
    setIsMapOpen(false);
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const getScreenAngleRad = useCallback(() => {
    if (typeof window === "undefined") return 0;
    const so = (window.screen as any).orientation;
    const angleDeg = (so && typeof so.angle === "number")
      ? so.angle
      : (typeof (window as any).orientation === "number" ? (window as any).orientation : 0);
    const normalized = ((((angleDeg as number) % 360) + 360) % 360);
    return (normalized * Math.PI) / 180;
  }, []);

  useEffect(() => {
    if (!rotateWithScreen) return;
    baseYawRef.current = cone.yaw;
    baseAngleRef.current = getScreenAngleRad();
  }, [rotateWithScreen, cone.yaw, getScreenAngleRad]);

  useEffect(() => {
    if (!rotateWithScreen || !onConeChange) return;

    const handleOrientation = () => {
      const currentAngle = getScreenAngleRad();
      const delta = currentAngle - baseAngleRef.current;
      const newYaw = baseYawRef.current + delta;
      onConeChange({ ...cone, yaw: newYaw });
      onRotateWithScreen?.(newYaw);
    };

    window.addEventListener("orientationchange", handleOrientation);
    window.addEventListener("resize", handleOrientation);

    return () => {
      window.removeEventListener("orientationchange", handleOrientation);
      window.removeEventListener("resize", handleOrientation);
    };
  }, [rotateWithScreen, onConeChange, onRotateWithScreen, cone, getScreenAngleRad]);

  return (
    <div
      ref={containerRef}
      className={className}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onKeyDown={handleKeyDown}
      tabIndex={interactive ? 0 : -1}
      style={{
        position: "relative",
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: "#f0f0f0",
        border: "1px solid #ccc",
        cursor: interactive ? "crosshair" : "default",
        outline: "none",
        ...style,
      }}
    >
      {points.map((point, index) => (
        <div
          key={index}
          style={{
            position: "absolute",
            left: `${point.x}px`,
            top: `${point.y}px`,
            width: "10px",
            height: "10px",
            backgroundColor: "red",
            transform: "translate(-50%, -50%)",
            borderRadius: "2px",
            zIndex: 10,
          }}
          title={`Point ${index}: (${point.x}, ${point.y})`}
        />
      ))}

      <svg
        width={width}
        height={height}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          pointerEvents: "none",
        }}
        role="img"
        aria-label={`View cone at yaw ${(cone.yaw * 180 / Math.PI).toFixed(1)}° with ${(cone.pitch * 180 / Math.PI).toFixed(1)}° aperture`}
      >
        <path
          d={conePath}
          fill="rgba(0, 128, 255, 0.18)"
          stroke="#0080ff"
          strokeWidth="2"
        />

        {showYawGuide && (
          <line
            x1={origin.x}
            y1={origin.y}
            x2={yawGuideEnd.x}
            y2={yawGuideEnd.y}
            stroke="#0080ff"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
        )}
      </svg>

      {interactive && !showMapButton && (
        <div
          style={{
            position: "absolute",
            bottom: "4px",
            right: "4px",
            fontSize: "10px",
            color: "#666",
            backgroundColor: "rgba(255,255,255,0.8)",
            padding: "2px 4px",
            borderRadius: "2px",
            pointerEvents: "none",
          }}
        >
          Click a point to set origin. Use arrow keys to adjust yaw/pitch.
        </div>
      )}

      {/* removed internal open button to avoid duplicate controls */}

      {isMapOpen && (
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            width: `${width}px`,
            height: `${height}px`,
            backgroundColor: "white",
            borderRadius: "12px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            zIndex: 10000,
            overflow: "hidden",
          }}
        >
          <button
            onClick={handleMapClose}
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              background: "rgba(0, 0, 0, 0.6)",
              border: "none",
              color: "white",
              fontSize: "24px",
              cursor: "pointer",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              transition: "background 0.2s",
              padding: 0,
              zIndex: 10001,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(236, 102, 8, 0.9)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.6)";
            }}
            aria-label="Close"
          >
            ×
          </button>

          <div
            ref={popupViewportRef}
            onPointerDown={(e) => {
              const el = popupViewportRef.current;
              if (!el) return;
              el.setPointerCapture(e.pointerId);
              panDragRef.current = {
                active: true,
                startX: e.clientX,
                startY: e.clientY,
                startPanX: pan.x,
                startPanY: pan.y,
              };
            }}
            onPointerMove={(e) => {
              if (!panDragRef.current.active || !popupViewportRef.current) return;
              const rect = popupViewportRef.current.getBoundingClientRect();
              const viewportW = rect.width;
              const viewportH = rect.height;
              const contentW = width;
              const contentH = height;
              const maxX = Math.max(0, contentW - viewportW);
              const maxY = Math.max(0, contentH - viewportH);
              const dx = e.clientX - panDragRef.current.startX;
              const dy = e.clientY - panDragRef.current.startY;
              const nextX = Math.min(Math.max(panDragRef.current.startPanX - dx, 0), maxX);
              const nextY = Math.min(Math.max(panDragRef.current.startPanY - dy, 0), maxY);
              setPan({ x: nextX, y: nextY });
            }}
            onPointerUp={(e) => {
              if (!popupViewportRef.current) return;
              popupViewportRef.current.releasePointerCapture(e.pointerId);
              panDragRef.current.active = false;
            }}
            style={{
              width: "100%",
              height: "100%",
              position: "relative",
              overflow: "hidden",
              touchAction: "none",
              ...style,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: `${width}px`,
                height: `${height}px`,
                transform: `translate(${-pan.x}px, ${-pan.y}px)`,
              }}
            >
              <img
                src={"/Luftkarte%201928.jpg"}
                alt="Map background"
                style={{ width: `${width}px`, height: `${height}px`, objectFit: "cover", filter: "grayscale(100%)" }}
                aria-hidden
              />
              {points.map((point, index) => (
                <div
                  key={index}
                  style={{
                    position: "absolute",
                    left: `${point.x}px`,
                    top: `${point.y}px`,
                    width: "10px",
                    height: "10px",
                    backgroundColor: "red",
                    transform: "translate(-50%, -50%)",
                    borderRadius: "2px",
                    zIndex: 10,
                    pointerEvents: "none",
                  }}
                  title={`Point ${index}: (${point.x}, ${point.y})`}
                />
              ))}

              <svg
                width={width}
                height={height}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  pointerEvents: "none",
                }}
              >
                <path
                  d={conePath}
                  fill="rgba(0, 128, 255, 0.18)"
                  stroke="#0080ff"
                  strokeWidth="2"
                />

                {showYawGuide && (
                  <line
                    x1={origin.x}
                    y1={origin.y}
                    x2={yawGuideEnd.x}
                    y2={yawGuideEnd.y}
                    stroke="#0080ff"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                  />
                )}
              </svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function CustomMap(props: { onClose?: () => void; onPositionChange?: (pos: { yaw: number; pitch: number }) => void }) {
  const pathname = usePathname() || "/";
  const getStateForPath = useMapStore(s => s.getStateForPath);
  const setPointsForPath = useMapStore(s => s.setPointsForPath);
  const setActivePointForPath = useMapStore(s => s.setActivePointForPath);
  const setConeForPath = useMapStore(s => s.setConeForPath);

  const state = getStateForPath(pathname);

  // Base dimensions: use image natural size once loaded; fallback to 525x360
  const [imageSize, setImageSize] = useState<{ w: number; h: number }>({ w: 525, h: 360 });
  const baseWidth = imageSize.w;
  const baseHeight = imageSize.h;

  // Measure outer container to scale content to "contain" the whole image
  const outerRef = useRef<HTMLDivElement | null>(null);
  const [outerSize, setOuterSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const cr = entries[0].contentRect;
      setOuterSize({ w: cr.width, h: cr.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = useMemo(() => {
    if (!outerSize.w || !outerSize.h) return 1;
    return Math.min(outerSize.w / baseWidth, outerSize.h / baseHeight);
  }, [outerSize.w, outerSize.h]);
  const scaledW = baseWidth * scale;
  const scaledH = baseHeight * scale;
  const offsetX = (outerSize.w - scaledW) / 2;
  const offsetY = (outerSize.h - scaledH) / 2;

  // Points (grid coords) with legacy fallback
  const pointsGrid: { x: number; y: number }[] = useMemo(() => {
    if (state.points && state.points.length) return state.points;
    const legacy = (state as any).point;
    if (legacy) {
      return [{ x: Math.round(legacy.xPercent * baseWidth), y: Math.round(legacy.yPercent * baseHeight) }];
    }
    return [];
  }, [state.points, (state as any).point, baseWidth, baseHeight]);
  const scaledPoints = useMemo(() => pointsGrid.map(p => ({ x: p.x * scale, y: p.y * scale })), [pointsGrid, scale]);
  const activeIdx = useMemo(() => {
    const idx = Number.isInteger(state.activePoint) ? state.activePoint : 0;
    return Math.min(Math.max(idx, 0), Math.max(0, pointsGrid.length - 1));
  }, [state.activePoint, pointsGrid.length]);

  // Seed a bottom-left origin if none exist; migrate legacy percent if present
  useEffect(() => {
    if (!baseWidth || !baseHeight) return;
    const hasPoints = !!(state.points && state.points.length);
    if (hasPoints) return;
    const legacy = (state as any).point;
    if (legacy) {
      const p = { x: Math.round(legacy.xPercent * baseWidth), y: Math.round(legacy.yPercent * baseHeight) };
      setPointsForPath(pathname, [p]);
      setActivePointForPath(pathname, 0);
      return;
    }
    const bottomLeft = { x: 0, y: baseHeight };
    setPointsForPath(pathname, [bottomLeft]);
    setActivePointForPath(pathname, 0);
  }, [baseWidth, baseHeight, state.points, pathname, setPointsForPath, setActivePointForPath]);

  const [coneLocal, setConeLocal] = useState<Cone>({
    yaw: state.cone.yaw,
    pitch: state.cone.pitch > 0 ? state.cone.pitch : Math.PI / 3,
    radius: state.cone.radius,
  });
  const subscribeViewerPosition = useAppState(s => s.subscribePosition);
  const storeYaw = useAppState(s => s.yaw);
  const storePitch = useAppState(s => s.pitch);
  const onPositionChangeRef = useRef(props.onPositionChange);
  useEffect(() => { onPositionChangeRef.current = props.onPositionChange; }, [props.onPositionChange]);

  useEffect(() => {
    setConeLocal({ yaw: state.cone.yaw, pitch: state.cone.pitch, radius: state.cone.radius });
  }, [state.cone.yaw, state.cone.pitch, state.cone.radius]);

  const handleConeChange = useCallback((next: Cone) => {
    setConeLocal(next);
    setConeForPath(pathname, { yaw: next.yaw, pitch: next.pitch, radius: next.radius });
    props.onPositionChange?.({ yaw: next.yaw, pitch: next.pitch });
  }, [pathname, setConeForPath]);

  // Removed legacy handleMoveOrigin; use setActivePointForPath or setPointsForPath externally if needed

  // when viewer yaw/pitch change externally, update cone
  useEffect(() => {
    const unsubscribe = subscribeViewerPosition(({ yaw }) => {
      // Only update when yaw actually changes to avoid loops
      setConeLocal(prev => {
        if (prev.yaw === yaw) return prev;
        const next = { ...prev, yaw };
        setConeForPath(pathname, { yaw, pitch: prev.pitch, radius: prev.radius });
        return next;
      });
      onPositionChangeRef.current?.({ yaw, pitch: coneLocal.pitch });
    });
    return unsubscribe;
  }, [subscribeViewerPosition, pathname, setConeForPath, coneLocal.pitch]);

  // Extra robust: react to store yaw/pitch changes (from polling/events)
  useEffect(() => {
    if (storeYaw === undefined) return;
    setConeLocal(prev => {
      if (prev.yaw === storeYaw) return prev;
      const next = { ...prev, yaw: storeYaw };
      setConeForPath(pathname, { yaw: storeYaw, pitch: prev.pitch, radius: prev.radius });
      return next;
    });
  }, [storeYaw, pathname, setConeForPath]);

  return (
    <div ref={outerRef} style={{ position: "relative", width: "100%", height: "100%" }}>
      <div style={{ position: "absolute", left: `${offsetX}px`, top: `${offsetY}px`, width: `${scaledW}px`, height: `${scaledH}px` }}>
        <img
          src={"/Luftkarte%201928.jpg"}
          alt="Map background"
          onLoad={(e) => {
            const img = e.currentTarget as HTMLImageElement;
            setImageSize({ w: img.naturalWidth, h: img.naturalHeight });
          }}
          style={{ width: "100%", height: "100%", objectFit: "contain", filter: "grayscale(100%)" }}
          aria-hidden
        />
        <div style={{ position: "absolute", left: 0, top: 0, width: `${scaledW}px`, height: `${scaledH}px` }}>
          {scaledPoints.map((p, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${p.x}px`,
                top: `${p.y}px`,
                width: i === activeIdx ? "12px" : "10px",
                height: i === activeIdx ? "12px" : "10px",
                backgroundColor: "red",
                border: i === activeIdx ? "2px solid #fff" : "none",
                transform: "translate(-50%, -50%)",
                borderRadius: "2px",
                zIndex: 10,
                pointerEvents: "none",
              }}
              title={`Point ${i}: (${Math.round(p.x/scale)}, ${Math.round(p.y/scale)})`}
            />
          ))}
          <MapWithCone
            points={scaledPoints}
            width={scaledW}
            height={scaledH}
            cone={coneLocal}
            coneOriginIndex={activeIdx}
            interactive
            showYawGuide
            showMapButton
            onConeChange={handleConeChange}
            onClose={props.onClose}
            originHandleRadius={24}
            style={{ backgroundColor: "transparent", border: "none" }}
          />
        </div>
      </div>
    </div>
  );
}