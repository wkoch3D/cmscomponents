"use client"

import { Viewer } from "@photo-sphere-viewer/core";
import { create } from "zustand";

type AppState = {
    viewer: Viewer | null;
    viewerContainer: HTMLElement | null;
    ensureViewer: <T extends HTMLElement>(props: { container: T }) => Promise<void>;
    // current orientation snapshot
    yaw?: number;
    pitch?: number;
    // set viewer orientation (best-effort across API variants)
    setYawPitch: (p: { yaw?: number; pitch?: number; animate?: boolean }) => void;
    // subscribe to viewer position updates
    subscribePosition: (cb: (p: { yaw: number; pitch: number }) => void) => () => void;
}

export const useAppState = create<AppState>((set, get) => ({
    viewer: null,
    viewerContainer: null,
    yaw: 0,
    pitch: 0,

    ensureViewer: async (props) => {
        const { viewer, viewerContainer } = get();

        const containerChanged = !!viewer && viewerContainer && viewerContainer !== props.container;
        const containerDetached = !!viewer && viewerContainer && !viewerContainer.isConnected;

        if (containerChanged || containerDetached) {
            try { viewer?.destroy(); } catch {}
            set({ viewer: null, viewerContainer: null });
        }
        if (get().viewer) return;

        const v = new Viewer({
            container: props.container,
            panorama: 'https://photo-sphere-viewer-data.netlify.app/assets/sphere.jpg',
            navbar: undefined,
            plugins: [

            ],

            defaultPitch:   0,
            defaultYaw:     0,
            defaultZoomLvl: 50,
            maxFov:         90,
            fisheye:        0,

            mousemove:  true,
            mousewheel: true,
            keyboard:   true,

            moveInertia: 0.95,
            moveSpeed: 2,
        });
        // wire position updates
        try {
            // most builds expose 'on' with event name 'position-updated'
            // @ts-ignore
            const emit = (yaw: number, pitch: number) => {
                set({ yaw, pitch });
                (positionSubscribers as Set<(p:{yaw:number; pitch:number}) => void>).forEach(fn => fn({ yaw, pitch }));
            };
            v.on?.('position-updated', (_e: unknown, data: { yaw: number; pitch: number }) => {
                const yaw = (data?.yaw ?? 0);
                const pitch = (data?.pitch ?? 0);
                emit(yaw, pitch);
            });
            // also listen to zoom changes and treat them as movement for settling
            v.on?.('zoom-updated', (_e: unknown) => {
                const yaw = get().yaw ?? 0;
                const pitch = get().pitch ?? 0;
                emit(yaw, pitch);
            });

            // Fallback polling if events are not emitted in this build/env
            let rafId: number | null = null;
            let lastYaw = Number.NaN;
            let lastPitch = Number.NaN;
            const poll = () => {
                try {
                    const pos = (v as any).getPosition?.();
                    if (pos && (pos.yaw !== lastYaw || pos.pitch !== lastPitch)) {
                        lastYaw = pos.yaw; lastPitch = pos.pitch;
                        emit(pos.yaw, pos.pitch);
                    }
                } catch {}
                rafId = requestAnimationFrame(poll);
            };
            rafId = requestAnimationFrame(poll);
            // store cleanup on viewer destroy
            // @ts-ignore
            v.on?.('destroy', () => { if (rafId) cancelAnimationFrame(rafId); });
        } catch {}
        set({ viewer: v, viewerContainer: props.container });
    },
    setYawPitch: ({ yaw, pitch, animate = true }) => {
        const v = get().viewer;
        if (!v) return;
        try {
            if (animate && (v as any).animate) {
                (v as any).animate({ yaw: yaw ?? get().yaw ?? 0, pitch: pitch ?? get().pitch ?? 0 });
            } else if ((v as any).rotate) {
                (v as any).rotate({ yaw: yaw ?? get().yaw ?? 0, pitch: pitch ?? get().pitch ?? 0 });
            }
        } catch {}
        if (yaw !== undefined || pitch !== undefined) set({ yaw: yaw ?? get().yaw, pitch: pitch ?? get().pitch });
    },
    subscribePosition: (cb) => {
        positionSubscribers.add(cb);
        return () => positionSubscribers.delete(cb);
    }
}))

// Module-scoped subscribers set
const positionSubscribers = new Set<(p: { yaw: number; pitch: number }) => void>();