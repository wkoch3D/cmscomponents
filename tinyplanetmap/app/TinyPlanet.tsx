"use client"

import { useEffect, useRef } from "react";
import { useAppState } from "./store";

export type TinyPlanetProps = {
    children?: React.ReactNode
}

export default function TinyPlanet(props: TinyPlanetProps) {
    const ensureViewer = useAppState(s => s.ensureViewer);

    const refCb = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        if (!refCb.current) return;
        ensureViewer<HTMLDivElement>({ container: refCb.current });
    }, []);

    return(
        <div
            ref={refCb}
            style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}
        >
            {props.children}
        </div>
    )
}