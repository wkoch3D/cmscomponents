"use client";
import React, { useRef, useState } from "react";

export type BeforeAfterSliderProps = {
  /** Path or URL to the BEFORE image, e.g. "/images/before.jpg" or "https://..." */
  beforeImage: string;
  /** Path or URL to the AFTER image, e.g. "/images/after.jpg" or "https://..." */
  afterImage: string;
  /** Optional labels shown under the slider */
  beforeLabel?: string;
  afterLabel?: string;
  /** Initial position (0–100). Defaults to 50. */
  initialPercent?: number;
  /** Optional style on the outer wrapper */
  style?: React.CSSProperties;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const BeforeAfterSlider: React.FC<BeforeAfterSliderProps> = ({
  beforeImage,
  afterImage,
  beforeLabel,
  afterLabel,
  initialPercent = 50,
  style,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [percent, setPercent] = useState<number>(clamp(initialPercent, 0, 100));
  const [dragging, setDragging] = useState<boolean>(false);

  const updateFromClientX = (clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    setPercent(clamp((x / rect.width) * 100, 0, 100));
  };

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    updateFromClientX(e.clientX);
  };
  const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!dragging) return;
    updateFromClientX(e.clientX);
  };
  const onPointerUp: React.PointerEventHandler<HTMLDivElement> = (e) => {
    setDragging(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const onHandleKeyDown: React.KeyboardEventHandler<HTMLButtonElement> = (e) => {
    const step = e.shiftKey ? 10 : 2;
    if (e.key === "ArrowLeft") setPercent((p) => clamp(p - step, 0, 100));
    if (e.key === "ArrowRight") setPercent((p) => clamp(p + step, 0, 100));
    if (e.key === "Home") setPercent(0);
    if (e.key === "End") setPercent(100);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", ...style }}>
      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        role="group"
        aria-label="Before and after image comparison slider"
        style={{
          position: "relative",
          width: "100%",
          height: "420px", // change height as you like
          overflow: "hidden",
          borderRadius: 8,
          touchAction: "none",
          userSelect: "none",
          cursor: dragging ? "grabbing" : "grab",
          background: "#eee",
        }}
      >
        {/* AFTER (background) */}
        <img
          src={afterImage}
          alt={afterLabel ?? "After image"}
          draggable={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />

        {/* BEFORE (clipped by width) */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: `${percent}%`,
            height: "100%",
            overflow: "hidden",
          }}
        >
          <img
            src={beforeImage}
            alt={beforeLabel ?? "Before image"}
            draggable={false}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        </div>

        {/* Divider + Handle */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: `${percent}%`,
            height: "100%",
            transform: "translateX(-2px)",
            zIndex: 10,
          }}
        >
          {/* Divider line */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 2,
              width: 4,
              height: "100%",
              backgroundColor: "#ec6608",
            }}
          />
          {/* Knob (focusable button) */}
          <button
            type="button"
            onKeyDown={onHandleKeyDown}
            aria-label="Move comparison slider"
            style={{ 
              position: "absolute",
              top: "50%",
              left: 0,
              transform: "translate(-50%, -50%)",
              width: 30,
              height: 30,
              borderRadius: "50%",
              border: "3px solid white",
              backgroundColor: "#ec6608",
              color: "white",
              fontWeight: 700,
              fontSize: 12,
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              cursor: "ew-resize",
              outline: "none",
            }}
          >
            ⟷
          </button>
        </div>
      </div>

      {(beforeLabel || afterLabel) && (
        <p
          style={{
            textAlign: "center",
            marginTop: 10,
            fontStyle: "italic",
            color: "#333",
          }}
        >
          {beforeLabel ? `Left: ${beforeLabel}` : ""}
          {beforeLabel && afterLabel ? " · " : ""}
          {afterLabel ? `Right: ${afterLabel}` : ""}
        </p>
      )}
    </div>
  );
};

export default BeforeAfterSlider;
