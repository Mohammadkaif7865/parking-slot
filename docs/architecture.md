# Architecture Notes

## Goal

The application must support many client locations. Each location may provide one or more AutoCAD/DWG files, and each drawing may represent a separate parking map, floor, wing, or stack-parking layout.

## Recommended Production Architecture

```text
Frontend
  - Location selector
  - Map selector
  - Autodesk Viewer panel
  - Slot overlay/selection panel
  - Booking panel

Backend
  - Auth
  - Location/map/slot APIs
  - DWG upload endpoint
  - Autodesk Platform Services token endpoint
  - Model Derivative translation jobs
  - Booking transactions

Database
  - locations
  - maps
  - parking_slots
  - bookings
  - audit_logs
```

## Autodesk Platform Services Flow

1. User uploads DWG for a map.
2. Backend stores file metadata.
3. Backend uploads file to Autodesk Platform Services.
4. Backend starts Model Derivative translation.
5. Backend stores translated model URN.
6. Frontend loads the URN in Autodesk Viewer.
7. Admin links CAD object ids or overlay polygons to parking slot records.
8. User clicks a slot and books it.

## Why Slot Mapping Is Still Needed

DWG files contain CAD geometry, layers, blocks, and text. They do not automatically contain application-level booking rules. We still need a slot registry that says:

- Slot number
- Location
- Map/floor
- Regular or stack parking
- Stack level rules
- Booking status
- Linked CAD object id or overlay coordinates

## Current Prototype

The current app simulates this with local browser data and SVG overlays. It is ready to be replaced piece-by-piece with real APIs and Autodesk Viewer once credentials and backend setup are available.
