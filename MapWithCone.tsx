"use client";
import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { sectorPath, polarToCartesian } from "./geometry/sectorPath";

type Point = { x: number; y: number }; // pixel coordinates

export type Cone = {
  pitch: number; // radians, total aperture (e.g. Math.PI/3)
  yaw: number; // radians, 0 = +x (right), positive clockwise
  radius?: number; // optional, px; default: min(width,height)*0.6
};

export type MapWithConeProps = {
  points: Point[];
  width?: number; // default 525 (matches standard map image)
  height?: number; // default 360 (matches standard map image)
  cone: Cone;
  coneOriginIndex?: number; // which point emits the cone; default 0
  interactive?: boolean; // if true, dragging around origin rotates yaw
  showYawGuide?: boolean; // dashed line from origin in yaw direction
  onConeChange?: (next: Cone) => void; // fired when interactive changes yaw or pitch
  className?: string;
  style?: React.CSSProperties;
  originHandleRadius?: number; // grab distance for interactive
  showMapButton?: boolean; // show button to open map window
  mapButtonLabel?: string; // label for open button (default: "📍")
  onClose?: () => void; // callback when close button is clicked
  onMapOpen?: () => void; // callback when map opens
  // When true, the cone yaw follows screen rotation (orientation change)
  rotateWithScreen?: boolean;
  // Callback fired with the computed yaw (radians) whenever screen-driven rotation occurs
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
  const baseAngleRef = useRef<number>(0); // radians

  // Get origin point
  const origin = points[coneOriginIndex] || { x: width / 2, y: height / 2 };

  // Calculate radius
  const radius = cone.radius ?? Math.min(width, height) * 0.6;

  // Memoize sector path
  const conePath = useMemo(() => {
    return sectorPath(origin.x, origin.y, radius, cone.yaw, cone.pitch);
  }, [origin.x, origin.y, radius, cone.yaw, cone.pitch]);

  // Memoize yaw guide endpoint
  const yawGuideEnd = useMemo(() => {
    return polarToCartesian(origin.x, origin.y, radius, cone.yaw);
  }, [origin.x, origin.y, radius, cone.yaw]);

  // Handle pointer down - start dragging
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!interactive || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Check if click is near origin
      const dx = x - origin.x;
      const dy = y - origin.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= originHandleRadius) {
        setIsDragging(true);
        e.currentTarget.setPointerCapture(e.pointerId);
      }
    },
    [interactive, origin.x, origin.y, originHandleRadius]
  );

  // Handle pointer move - update yaw
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging || !interactive || !containerRef.current || !onConeChange) return;

      // Use requestAnimationFrame to throttle updates
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      animationFrameRef.current = requestAnimationFrame(() => {
        const rect = containerRef.current!.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Calculate new yaw
        const dx = x - origin.x;
        const dy = y - origin.y;
        const newYaw = Math.atan2(dy, dx);

        onConeChange({ ...cone, yaw: newYaw });
      });
    },
    [isDragging, interactive, origin.x, origin.y, cone, onConeChange]
  );

  // Handle pointer up - stop dragging
  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (isDragging) {
        setIsDragging(false);
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    },
    [isDragging]
  );

  // Handle keyboard controls
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

  // Handle map open
  const handleMapOpen = useCallback(() => {
    setIsMapOpen(true);
    onMapOpen?.();
  }, [onMapOpen]);

  // Handle map close
  const handleMapClose = useCallback(() => {
    setIsMapOpen(false);
    onClose?.();
  }, [onClose]);

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Compute current screen orientation angle in radians (0, 90, 180, 270)
  const getScreenAngleRad = useCallback(() => {
    if (typeof window === "undefined") return 0;
    // Prefer ScreenOrientation API
    // Fallback to window.orientation (deprecated but still present on some devices)
    const so = (window.screen as any).orientation;
    const angleDeg = (so && typeof so.angle === "number")
      ? so.angle
      : (typeof (window as any).orientation === "number" ? (window as any).orientation : 0);
    const normalized = ((((angleDeg as number) % 360) + 360) % 360);
    return (normalized * Math.PI) / 180;
  }, []);

  // Establish baseline whenever enabling rotateWithScreen or when cone.yaw changes externally
  useEffect(() => {
    if (!rotateWithScreen) return;
    baseYawRef.current = cone.yaw;
    baseAngleRef.current = getScreenAngleRad();
  }, [rotateWithScreen, cone.yaw, getScreenAngleRad]);

  // When rotateWithScreen is active, update yaw on orientation changes
  useEffect(() => {
    if (!rotateWithScreen || !onConeChange) return;

    const handleOrientation = () => {
      const currentAngle = getScreenAngleRad();
      const delta = currentAngle - baseAngleRef.current;
      const newYaw = baseYawRef.current + delta;
      onConeChange({ ...cone, yaw: newYaw });
      onRotateWithScreen?.(newYaw);
    };

    // Listen to both orientationchange and resize as fallback
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
      {/* Render points */}
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

      {/* SVG overlay for cone */}
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
        {/* Cone sector */}
        <path
          d={conePath}
          fill="rgba(0, 128, 255, 0.18)"
          stroke="#0080ff"
          strokeWidth="2"
        />

        {/* Yaw guide line */}
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

      {/* Interactive hint */}
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
          Drag origin or use arrow keys
        </div>
      )}

      {/* Map Open Button */}
      {showMapButton && !isMapOpen && (
        <button
          onClick={handleMapOpen}
          style={{
            position: "absolute",
            bottom: "8px",
            right: "8px",
            padding: "10px 14px",
            fontSize: "16px",
            fontWeight: 600,
            backgroundColor: "#ec6608",
            color: "white",
            border: "none",
            borderRadius: "50%",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            transition: "all 0.2s",
            zIndex: 20,
            pointerEvents: "auto",
            width: "44px",
            height: "44px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#d45a07";
            e.currentTarget.style.transform = "scale(1.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#ec6608";
            e.currentTarget.style.transform = "scale(1)";
          }}
          aria-label="Open Map"
        >
          {mapButtonLabel}
        </button>
      )}

      {/* Map Window */}
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
          {/* Close Button */}
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

          {/* Map Content - Full view of the map with cone */}
          <div
            style={{
              width: "100%",
              height: "100%",
              position: "relative",
              ...style,
            }}
          >
            {/* Render points */}
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

            {/* SVG overlay for cone */}
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
              {/* Cone sector */}
              <path
                d={conePath}
                fill="rgba(0, 128, 255, 0.18)"
                stroke="#0080ff"
                strokeWidth="2"
              />

              {/* Yaw guide line */}
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
      )}
    </div>
  );
};

export default MapWithCone;

