"use client";

import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";

const emptySlot = {
  id: "",
  slotNo: "",
  zone: "",
  type: "Regular",
  status: "available",
  x: 10,
  y: 10,
  w: 8,
  h: 6
};

export default function AdminPage() {
  const [authorized, setAuthorized] = useState(false);
  const [locations, setLocations] = useState([]);
  const [locationId, setLocationId] = useState("");
  const [mapId, setMapId] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [form, setForm] = useState(emptySlot);
  const [mapName, setMapName] = useState("");
  const [mapFile, setMapFile] = useState(null);
  const [message, setMessage] = useState("Manage maps and slot overlays.");

  useEffect(() => {
    const auth = JSON.parse(localStorage.getItem("parking-auth") || "{}");
    if (auth.role !== "admin") {
      window.location.href = "/login";
      return;
    }
    setAuthorized(true);
    loadLocations();
  }, []);

  useEffect(() => {
    const socket = io({ transports: ["websocket"] });
    const refresh = (event) => {
      console.log("[socket] admin received update", event);
      loadLocations(locationId, mapId, selectedSlotId);
    };
    socket.on("connect", () => console.log("[socket] admin connected", socket.id));
    socket.on("slot:changed", refresh);
    socket.on("slot:booked", refresh);
    socket.on("slot:released", refresh);
    socket.on("map:changed", refresh);
    return () => socket.disconnect();
  }, [locationId, mapId, selectedSlotId]);

  async function loadLocations(preferredLocationId = locationId, preferredMapId = mapId, preferredSlotId = selectedSlotId) {
    const response = await fetch("/api/locations", { cache: "no-store" });
    const data = await response.json();
    const nextLocations = data.locations || [];
    const nextLocation = nextLocations.find((item) => item.id === preferredLocationId) || nextLocations[0];
    const nextMap = nextLocation?.maps.find((item) => item.id === preferredMapId) || nextLocation?.maps[0];
    const nextSlot = nextMap?.slots.find((item) => item.id === preferredSlotId);

    setLocations(nextLocations);
    setLocationId(nextLocation?.id || "");
    setMapId(nextMap?.id || "");
    if (nextSlot) {
      setSelectedSlotId(nextSlot.id);
      setForm(slotToForm(nextSlot));
    }
  }

  const activeLocation = locations.find((location) => location.id === locationId);
  const activeMap = activeLocation?.maps.find((map) => map.id === mapId) || activeLocation?.maps[0];
  const selectedSlot = activeMap?.slots.find((slot) => slot.id === selectedSlotId);

  const stats = useMemo(() => {
    const slots = activeMap?.slots || [];
    return {
      total: slots.length,
      available: slots.filter((slot) => slot.status === "available").length,
      booked: slots.filter((slot) => slot.status === "booked").length
    };
  }, [activeMap]);

  function selectLocation(nextLocationId) {
    const nextLocation = locations.find((location) => location.id === nextLocationId);
    setLocationId(nextLocationId);
    setMapId(nextLocation?.maps[0]?.id || "");
    setSelectedSlotId("");
    setForm(emptySlot);
  }

  function selectMap(nextMapId) {
    setMapId(nextMapId);
    setSelectedSlotId("");
    setForm(emptySlot);
  }

  function selectSlot(slot) {
    setSelectedSlotId(slot.id);
    setForm(slotToForm(slot));
    setMessage(`${slot.slotNo} selected for editing.`);
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function clearSelection() {
    setSelectedSlotId("");
    setForm(emptySlot);
    setMessage("Selection cleared.");
  }

  function nudge(dx, dy) {
    setForm((current) => ({
      ...current,
      x: clamp(Number(current.x) + dx),
      y: clamp(Number(current.y) + dy)
    }));
  }

  async function saveSlot() {
    if (!activeMap) return;
    if (!form.slotNo.trim()) {
      setMessage("Slot number is required.");
      return;
    }

    const payload = normalizeForm(form);
    const url = form.id ? `/api/slots/${form.id}` : `/api/maps/${activeMap.id}/slots`;
    const method = form.id ? "PATCH" : "POST";
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error || "Could not save slot.");
      return;
    }

    const saved = data.slot;
    setSelectedSlotId(saved.id);
    setMessage(`${saved.slotNo} saved.`);
    await loadLocations(locationId, mapId, saved.id);
  }

  async function deleteSlot() {
    if (!selectedSlot) {
      setMessage("Select a slot first.");
      return;
    }

    const response = await fetch(`/api/slots/${selectedSlot.id}`, { method: "DELETE" });
    if (!response.ok) {
      setMessage("Could not delete slot.");
      return;
    }
    setSelectedSlotId("");
    setForm(emptySlot);
    setMessage("Slot deleted.");
    await loadLocations(locationId, mapId, "");
  }

  async function importMap(event) {
    event.preventDefault();
    if (!locationId || !mapFile) {
      setMessage("Choose a location and map file.");
      return;
    }

    const data = new FormData();
    data.append("locationId", locationId);
    data.append("name", mapName || mapFile.name);
    data.append("file", mapFile);

    const response = await fetch("/api/maps", { method: "POST", body: data });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error || "Map import failed.");
      return;
    }

    setMapName("");
    setMapFile(null);
    setMessage("Map imported. Add slots from the editor.");
    await loadLocations(locationId, result.map.id, "");
  }

  if (!authorized) {
    return <main className="auth-page"><p>Redirecting...</p></main>;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Admin Panel</p>
          <h1>Map & Slot Overlay Manager</h1>
        </div>
        <nav className="top-actions">
          <a href="/">User View</a>
          <a href="/login">Switch Login</a>
        </nav>
        <div className="stats">
          <span><strong>{stats.total}</strong> Slots</span>
          <span><strong>{stats.available}</strong> Available</span>
          <span><strong>{stats.booked}</strong> Booked</span>
        </div>
      </header>

      <section className="layout admin-layout">
        <aside className="sidebar">
          <section>
            <p className="section-label">Location</p>
            <select value={locationId} onChange={(event) => selectLocation(event.target.value)}>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </select>
          </section>

          <section>
            <p className="section-label">Maps</p>
            <div className="map-list">
              {activeLocation?.maps.map((map) => (
                <button className={`map-item ${map.id === activeMap?.id ? "active" : ""}`} key={map.id} onClick={() => selectMap(map.id)}>
                  <span>{map.name}</span>
                  <small>{map.file}</small>
                </button>
              ))}
            </div>
          </section>

          <form className="import-box" onSubmit={importMap}>
            <p className="section-label">Import Map</p>
            <input value={mapName} onChange={(event) => setMapName(event.target.value)} placeholder="Map name" />
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,.svg" onChange={(event) => setMapFile(event.target.files?.[0] || null)} />
            <button className="secondary">Import Map</button>
          </form>
        </aside>

        <section className="map-card">
          <div className="map-toolbar">
            <div>
              <p className="eyebrow">{activeLocation?.name || "Location"}</p>
              <h2>{activeMap?.name || "No map selected"}</h2>
            </div>
            <p className="message compact">Select a slot, edit coordinates, then save. Coordinates are percentages over the map.</p>
          </div>
          {activeMap ? (
            <>
              <div className="position-panel">
                <div>
                  <p className="section-label">Position</p>
                  <strong>{form.id ? form.slotNo || "Selected Slot" : "Select a slot"}</strong>
                </div>

                <div className="position-grid">
                  <label>X %<input type="number" value={form.x} disabled={!form.id} onChange={(event) => updateForm("x", event.target.value)} /></label>
                  <label>Y %<input type="number" value={form.y} disabled={!form.id} onChange={(event) => updateForm("y", event.target.value)} /></label>
                  <label>W %<input type="number" value={form.w} disabled={!form.id} onChange={(event) => updateForm("w", event.target.value)} /></label>
                  <label>H %<input type="number" value={form.h} disabled={!form.id} onChange={(event) => updateForm("h", event.target.value)} /></label>
                </div>

                <div className="nudge-pad">
                  <button className="ghost" type="button" disabled={!form.id} onClick={() => nudge(0, -1)}>Up</button>
                  <button className="ghost" type="button" disabled={!form.id} onClick={() => nudge(-1, 0)}>Left</button>
                  <button className="ghost" type="button" disabled={!form.id} onClick={() => nudge(1, 0)}>Right</button>
                  <button className="ghost" type="button" disabled={!form.id} onClick={() => nudge(0, 1)}>Down</button>
                </div>
              </div>
              <div className="map-stage">
                <div className="map-frame">
                  {isPdfMap(activeMap.file) ? (
                    <iframe title={activeMap.name} src={`${activeMap.file}#toolbar=0&navpanes=0&view=FitH`} />
                  ) : (
                    <img className="map-image" src={activeMap.file} alt={activeMap.name} />
                  )}
                  <div className="slot-layer" onClick={clearSelection}>
                    {activeMap.slots.map((slot) => {
                      const display = slot.id === selectedSlotId ? form : slotToForm(slot);
                      return (
                        <button
                          key={slot.id}
                          className={`slot ${display.status} ${slot.id === selectedSlotId ? "is-selected" : ""}`}
                          style={{ left: `${display.x}%`, top: `${display.y}%`, width: `${display.w}%`, height: `${display.h}%` }}
                          onClick={(event) => {
                            event.stopPropagation();
                            selectSlot(slot);
                          }}
                          type="button"
                        >
                          {display.slotNo}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-map">Import or select a map.</div>
          )}
        </section>

        <aside className="booking-panel">
          <p className="section-label">Slot Editor</p>
          <h2>{form.id ? `Editing ${form.slotNo}` : "New Slot"}</h2>

          <label>Slot Number<input value={form.slotNo} onChange={(event) => updateForm("slotNo", event.target.value)} placeholder="A-101" /></label>
          <label>Zone<input value={form.zone} onChange={(event) => updateForm("zone", event.target.value)} placeholder="Wing A" /></label>
          <label>Type<select value={form.type} onChange={(event) => updateForm("type", event.target.value)}>
            <option>Regular</option>
            <option>Stack 2-tier</option>
            <option>Stack 3-tier</option>
          </select></label>
          <label>Status<select value={form.status} onChange={(event) => updateForm("status", event.target.value)}>
            <option value="available">Available</option>
            <option value="reserved">Reserved</option>
            <option value="maintenance">Maintenance</option>
          </select></label>

          <button className="primary" onClick={saveSlot}>Save Slot</button>
          <button className="secondary" onClick={() => { setForm(emptySlot); setSelectedSlotId(""); }}>Add New Slot</button>
          <button className="ghost danger-text" onClick={deleteSlot}>Delete Selected Slot</button>
          <p className="message">{message}</p>
        </aside>
      </section>
    </main>
  );
}

function slotToForm(slot) {
  return {
    id: slot.id,
    slotNo: slot.slotNo,
    zone: slot.zone || "",
    type: slot.type || "Regular",
    status: slot.status || "available",
    x: slot.x,
    y: slot.y,
    w: slot.w,
    h: slot.h
  };
}

function normalizeForm(form) {
  return {
    slotNo: form.slotNo,
    zone: form.zone,
    type: form.type,
    status: form.status,
    x: Number(form.x),
    y: Number(form.y),
    width: Number(form.w),
    height: Number(form.h)
  };
}

function clamp(value) {
  return Math.max(0, Math.min(100, Number(value)));
}

function isPdfMap(file) {
  return String(file || "").toLowerCase().endsWith(".pdf");
}
