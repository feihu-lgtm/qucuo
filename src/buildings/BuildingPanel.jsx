import React from "react";
import { getBuildingsForLocation, BUILDING_TYPE_LABEL } from "./qucuoBuildings.js";

export default function BuildingPanel({ locationName, zoneTheme, onEnter }) {
  const buildings = getBuildingsForLocation(locationName);
  if (buildings.length === 0) return null;

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ color: zoneTheme.accentDim, fontSize: "11px", marginBottom: 3 }}>此地建筑</div>
      {buildings.map(b => (
        <div
          key={b.id}
          onClick={() => onEnter(b)}
          style={{ cursor: "pointer", color: "#8ac8b8", marginBottom: 2 }}
        >
          {b.name}
          <span style={{ color: "#5a5a4a", fontSize: "11px", marginLeft: 6 }}>
            {BUILDING_TYPE_LABEL[b.type] || b.type}
          </span>
        </div>
      ))}
    </div>
  );
}
