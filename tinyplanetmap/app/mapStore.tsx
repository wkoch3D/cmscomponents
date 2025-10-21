"use client"

import { create } from "zustand";

export type GridPoint = { x: number; y: number };
export type PathState = {
    points: GridPoint[];
    activePoint: number;
    cone: { yaw: number; pitch: number; radius?: number };
};

type InternalState = {
    pathToState: Record<string, any>; // keep 'any' to allow legacy shape to coexist until accessed
    getStateForPath: (path: string) => PathState;
    setPointsForPath: (path: string, points: GridPoint[]) => void;
    setPointAtIndexForPath: (path: string, index: number, p: GridPoint) => void;
    setActivePointForPath: (path: string, index: number) => void;
    setConeForPath: (path: string, cone: { yaw: number; pitch: number; radius?: number }) => void;
};

export const defaultPathState: PathState = {
    points: [],
    activePoint: 0,
    cone: { yaw: 0, pitch: Math.PI / 3 },
};

export const useMapStore = create<InternalState>((set, get) => ({
    pathToState: {},
    getStateForPath: (path) => {
        const raw = get().pathToState[path];
        if (!raw) {
            set(s => ({ pathToState: { ...s.pathToState, [path]: { ...defaultPathState } } }));
            return { ...defaultPathState };
        }
        // Legacy migration fallback: if legacy 'point' exists and no points[], synthesize
        if (!Array.isArray(raw.points) && raw.point) {
            const legacy = raw.point as { xPercent: number; yPercent: number };
            const state: PathState = {
                points: [], // component will synthesize using provided base dimensions
                activePoint: 0,
                cone: raw.cone ?? { ...defaultPathState.cone },
            };
            return state;
        }
        // Already in new format
        return {
            points: Array.isArray(raw.points) ? raw.points : [],
            activePoint: Number.isInteger(raw.activePoint) ? raw.activePoint : 0,
            cone: raw.cone ?? { ...defaultPathState.cone },
        } as PathState;
    },
    setPointsForPath: (path, points) => set(s => ({
        pathToState: { ...s.pathToState, [path]: { ...(s.pathToState[path] ?? defaultPathState), points } }
    })),
    setPointAtIndexForPath: (path, index, p) => set(s => {
        const prev = (s.pathToState[path] ?? defaultPathState);
        const pts: GridPoint[] = Array.isArray(prev.points) ? [...prev.points] : [];
        while (pts.length <= index) pts.push({ x: 0, y: 0 });
        pts[index] = p;
        return { pathToState: { ...s.pathToState, [path]: { ...prev, points: pts } } };
    }),
    setActivePointForPath: (path, index) => set(s => ({
        pathToState: { ...s.pathToState, [path]: { ...(s.pathToState[path] ?? defaultPathState), activePoint: index } }
    })),
    setConeForPath: (path, cone) => set(s => ({
        pathToState: { ...s.pathToState, [path]: { ...(s.pathToState[path] ?? defaultPathState), cone } }
    })),
}));