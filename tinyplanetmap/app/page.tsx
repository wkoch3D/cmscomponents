"use client"

import { useState } from "react";
import MapWrapper from "./MapWrapper";
import TinyPlanet from "./TinyPlanet";
import CustomMap from "./CustomMap";

export default function Home() {
  const [visible, setVisible] = useState(true)
  
  return (
    <TinyPlanet>

      <MapWrapper visible={visible}>

        <CustomMap onClose={() => setVisible(false)} />

      </MapWrapper>

      {/* Floating toggle button (always present) */}
      {(
        <button
          onClick={() => setVisible(v => !v)}
          style={{
            position: "absolute", bottom: 20, right: 20,
            padding: "10px 14px", fontSize: 16, fontWeight: 600,
            backgroundColor: "#ec6608", color: "white", border: "none",
            borderRadius: "50%", width: 44, height: 44, cursor: "pointer",
            zIndex: 10002
          }}
          aria-label={visible ? "Hide Map" : "Show Map"}
          title={visible ? "Hide Map" : "Show Map"}
        >{visible ? "×" : "📍"}</button>
      )}

    </TinyPlanet>
  )
}
