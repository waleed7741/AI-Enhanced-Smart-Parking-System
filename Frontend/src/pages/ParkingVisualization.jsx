// src/pages/ParkingVisualization.jsx
import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";

export default function ParkingVisualization() {
  const floors = 3;
  const slotsPerFloor = 12;

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>3D Parking Visualization</h1>

      <Canvas camera={{ position: [10, 15, 25], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />

        <Suspense fallback={<Html><p>Loading 3D…</p></Html>}>

          {/* Render Floors */}
          {[...Array(floors)].map((_, floorIndex) => (
            <Floor
              key={floorIndex}
              floor={floorIndex + 1}
              slots={slotsPerFloor}
              y={floorIndex * 4}
            />
          ))}

          <OrbitControls />
        </Suspense>
      </Canvas>
    </div>
  );
}

function Floor({ floor, slots, y }) {
  const rows = 4;
  const columns = slots / rows;

  return (
    <group position={[0, y, 0]}>
      {/* Floor Base */}
      <mesh position={[0, -0.1, 0]} receiveShadow>
        <boxGeometry args={[20, 0.2, 20]} />
        <meshStandardMaterial color={"#1e1e1e"} />
      </mesh>

      {/* Floor Label */}
      <Html position={[0, 1.5, 0]}>
        <div style={styles.floorLabel}>Floor {floor}</div>
      </Html>

      {/* Parking Slots */}
      {[...Array(rows)].map((_, row) =>
        [...Array(columns)].map((_, col) => (
          <Slot
            key={`${row}-${col}`}
            x={col * 3 - 6}
            z={row * 4 - 6}
            slotNumber={row * columns + col + 1}
          />
        ))
      )}
    </group>
  );
}

function Slot({ x, z, slotNumber }) {
  return (
    <group position={[x, 0, z]}>
      <mesh castShadow>
        <boxGeometry args={[2, 0.1, 3]} />
        <meshStandardMaterial color={"#3a3a3a"} />
      </mesh>

      {/* Slot Number */}
      <Html position={[0, 0.2, 0]}>
        <div style={styles.slotNumber}>{slotNumber}</div>
      </Html>

      {/* Outline */}
      <mesh>
        <boxGeometry args={[2.1, 0.05, 3.1]} />
        <meshStandardMaterial color="#ffffff" wireframe />
      </mesh>
    </group>
  );
}

const styles = {
  container: {
    height: "100vh",
    width: "100%",
    background: "#121212",
    overflow: "hidden",
  },
  title: {
    position: "absolute",
    top: 10,
    left: 20,
    zIndex: 10,
    color: "white",
    fontSize: "24px",
    fontWeight: "bold",
  },
  floorLabel: {
    background: "rgba(0,0,0,0.5)",
    padding: "4px 10px",
    borderRadius: "6px",
    color: "#fff",
    fontSize: "14px",
    fontWeight: "600",
  },
  slotNumber: {
    background: "rgba(255,255,255,0.8)",
    padding: "2px 6px",
    borderRadius: "4px",
    fontSize: "12px",
    fontWeight: "bold",
  },
};
