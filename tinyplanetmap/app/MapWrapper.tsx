export default function MapWrapper({ children, visible = true }: { children?: React.ReactNode, visible?: boolean }) {
    if (!visible) return null;
    return(
        <div 
            style={{
            width: "20vw",
            height: "50vh",
            backgroundColor: "rgba(255,255,255,0.0)", 
            position: "absolute", 
            bottom: 0, 
            right: 0, 
            zIndex: 10001
            }}
        >

            { children }

        </div>
    )
}