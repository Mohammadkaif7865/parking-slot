"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import Toast from "./components/Toast";

export default function Home() {
  const [locations, setLocations] = useState([]);
  const [locationId, setLocationId] = useState("");
  const [mapId, setMapId] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [allottee, setAllottee] = useState("");
  const [mobile, setMobile] = useState("");
  const [stackLevel, setStackLevel] = useState("Top");
  const [message, setMessage] = useState("Loading maps from PostgreSQL...");
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState("");
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    const socket = io({ transports: ["websocket"] });
    const refresh = (event) => {
      console.log("[socket] user received update", event);
      loadLocations(locationId, mapId, selectedSlotId, { silent: true });
    };
    socket.on("connect", () => console.log("[socket] user connected", socket.id));
    socket.on("slot:changed", refresh);
    socket.on("slot:booked", refresh);
    socket.on("slot:released", refresh);
    socket.on("map:changed", refresh);
    return () => socket.disconnect();
  }, [locationId, mapId, selectedSlotId]);

  async function loadLocations(preferredLocationId = locationId, preferredMapId = mapId, preferredSlotId = selectedSlotId, options = {}) {
    if (!options.silent) {
      setLoading(true);
    }
    try {
      const response = await fetch("/api/locations", { cache: "no-store" });
      const data = await response.json();
      const nextLocations = data.locations || [];
      const nextLocation = nextLocations.find((item) => item.id === preferredLocationId) || nextLocations[0];
      const nextMap = nextLocation?.maps.find((item) => item.id === preferredMapId) || nextLocation?.maps[0];

      setLocations(nextLocations);
      setLocationId(nextLocation?.id || "");
      setMapId(nextMap?.id || "");
      setSelectedSlotId(preferredSlotId || "");
      if (!options.silent) {
        setMessage(nextLocations.length ? "Select a map and click a parking slot to book." : "No maps found in database.");
      }
    } catch (error) {
      if (!options.silent) {
        setMessage(`Could not load database data: ${error.message}`);
        showToast("error", `Could not load data: ${error.message}`);
      }
    } finally {
      if (!options.silent) {
        setLoading(false);
      }
    }
  }

  function showToast(type, message) {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    setToast({ type, message });
    toastTimerRef.current = setTimeout(() => setToast(null), 3200);
  }

  const activeLocation = locations.find((location) => location.id === locationId);
  const activeMap = activeLocation?.maps.find((map) => map.id === mapId) || activeLocation?.maps[0];
  const selectedSlot = activeMap?.slots.find((slot) => slot.id === selectedSlotId);
  const isStackSlot = (selectedSlot?.levels?.length || 0) > 1;
  const selectedLevelBooked = isStackSlot && selectedSlot?.bookedLevels?.includes(stackLevel);
  const canBookSelectedSlot = selectedSlot && !pendingAction && (isStackSlot ? !selectedLevelBooked : selectedSlot.occupancyStatus !== "booked");
  const canReleaseSelectedSlot = selectedSlot && !pendingAction && (isStackSlot ? selectedLevelBooked : selectedSlot.occupancyStatus === "booked");
  const selectedLevelBooking = selectedSlot ? getBookingForLevel(selectedSlot, stackLevel) : null;

  useEffect(() => {
    if (!selectedSlot) {
      setAllottee("");
      setMobile("");
      setStackLevel("Top");
      return;
    }

    const fallbackLevel = selectedSlot.availableLevels?.[0] || selectedSlot.bookedLevels?.[0] || selectedSlot.levels?.[0] || "Top";
    setStackLevel(fallbackLevel);
  }, [selectedSlot]);

  useEffect(() => {
    if (!selectedSlot) {
      return;
    }

    const booking = getBookingForLevel(selectedSlot, stackLevel);
    setAllottee(booking?.allottee || "");
    setMobile(booking?.mobile || "");
  }, [selectedSlot, stackLevel]);

  const stats = useMemo(() => {
    const slots = locations.flatMap((location) => location.maps.flatMap((map) => map.slots));
    return {
      maps: activeLocation?.maps.length || 0,
      available: slots.filter((slot) => slot.status === "available").length,
      booked: slots.filter((slot) => slot.status === "booked").length,
      reserved: slots.filter((slot) => slot.status === "reserved").length
    };
  }, [activeLocation, locations]);

  function selectLocation(nextLocationId) {
    const nextLocation = locations.find((location) => location.id === nextLocationId);
    setLocationId(nextLocationId);
    setMapId(nextLocation?.maps[0]?.id || "");
    setSelectedSlotId("");
  }

  function selectMap(nextMapId) {
    setMapId(nextMapId);
    setSelectedSlotId("");
    setMessage("Map changed. Click any overlay slot to book a demo parking.");
  }

  function selectSlot(slot) {
    setSelectedSlotId(slot.id);
    setMessage(`${slot.slotNo} selected on ${activeMap.name}.`);
  }

  function clearSelection() {
    setSelectedSlotId("");
    setMessage("Selection cleared.");
  }

  async function bookSlot() {
    if (!selectedSlot) {
      setMessage("Select a parking slot first.");
      showToast("error", "Select a parking slot first.");
      return;
    }
    const displayStatus = selectedSlot.occupancyStatus || selectedSlot.status;
    if (displayStatus === "reserved" || displayStatus === "maintenance") {
      setMessage(`${selectedSlot.slotNo} is ${displayStatus} and cannot be booked.`);
      showToast("error", `${selectedSlot.slotNo} is ${displayStatus}.`);
      return;
    }
    if (!selectedSlot.availableLevels?.length) {
      setMessage(`${selectedSlot.slotNo} is fully booked.`);
      showToast("error", `${selectedSlot.slotNo} is fully booked.`);
      return;
    }
    if (isStackSlot && selectedLevelBooked) {
      setMessage(`${selectedSlot.slotNo} ${stackLevel} level is already booked.`);
      showToast("error", `${selectedSlot.slotNo} ${stackLevel} is already booked.`);
      return;
    }
    if (mobile && !/^[0-9]{10}$/.test(mobile)) {
      setMessage("Mobile number should be 10 digits.");
      showToast("error", "Mobile number should be 10 digits.");
      return;
    }

    setPendingAction("book");
    try {
      const response = await fetch(`/api/slots/${selectedSlot.id}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allottee: allottee || "Demo User",
          mobile,
          level: selectedSlot.levels?.length > 1 ? stackLevel : "Single"
        })
      });

      const data = await response.json();
      if (!response.ok) {
        const error = data.error || "Booking failed.";
        setMessage(error);
        showToast("error", error);
        return;
      }

      const success = selectedSlot.levels?.length > 1 ? `${selectedSlot.slotNo} ${stackLevel} booked.` : `${selectedSlot.slotNo} booked.`;
      setMessage(`${selectedSlot.slotNo} booked in PostgreSQL.`);
      showToast("success", success);
      await loadLocations(locationId, mapId, selectedSlot.id);
    } catch (error) {
      setMessage(`Booking failed: ${error.message}`);
      showToast("error", `Booking failed: ${error.message}`);
    } finally {
      setPendingAction("");
    }
  }

  async function releaseSlot() {
    if (!selectedSlot) {
      setMessage("Select a parking slot first.");
      showToast("error", "Select a parking slot first.");
      return;
    }
    if (isStackSlot && !selectedLevelBooked) {
      setMessage(`${selectedSlot.slotNo} ${stackLevel} level is not booked.`);
      showToast("error", `${selectedSlot.slotNo} ${stackLevel} is not booked.`);
      return;
    }

    setPendingAction("release");
    try {
      const response = await fetch(`/api/slots/${selectedSlot.id}/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: selectedSlot.levels?.length > 1 ? stackLevel : "Single" })
      });
      const data = await response.json();
      if (!response.ok) {
        const error = data.error || "Release failed.";
        setMessage(error);
        showToast("error", error);
        return;
      }

      setMessage(`${selectedSlot.slotNo} released in PostgreSQL.`);
      showToast("success", selectedSlot.levels?.length > 1 ? `${selectedSlot.slotNo} ${stackLevel} released.` : `${selectedSlot.slotNo} released.`);
      await loadLocations(locationId, mapId, selectedSlot.id);
    } catch (error) {
      setMessage(`Release failed: ${error.message}`);
      showToast("error", `Release failed: ${error.message}`);
    } finally {
      setPendingAction("");
    }
  }

  async function updateStatus(status) {
    if (!selectedSlot) {
      setMessage("Select a parking slot first.");
      showToast("error", "Select a parking slot first.");
      return;
    }

    setPendingAction(`status:${status}`);
    try {
      const response = await fetch(`/api/slots/${selectedSlot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const data = await response.json();
      if (!response.ok) {
        const error = data.error || "Status update failed.";
        setMessage(error);
        showToast("error", error);
        return;
      }

      setMessage(`${selectedSlot.slotNo} marked ${status}.`);
      showToast("success", `${selectedSlot.slotNo} marked ${status}.`);
      await loadLocations(locationId, mapId, selectedSlot.id);
    } catch (error) {
      setMessage(`Status update failed: ${error.message}`);
      showToast("error", `Status update failed: ${error.message}`);
    } finally {
      setPendingAction("");
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">PostgreSQL connected demo</p>
          <h1>Parking Booking on Exported AutoCAD Maps</h1>
        </div>
        <nav className="top-actions">
          <a href="/login">Login</a>
          <a href="/admin">Admin</a>
        </nav>
        <div className="stats">
          <span><strong>{stats.maps}</strong> Maps</span>
          <span><strong>{stats.available}</strong> Available</span>
          <span><strong>{stats.booked}</strong> Booked</span>
          <span><strong>{stats.reserved}</strong> Reserved</span>
        </div>
      </header>

      <section className="layout">
        <aside className="sidebar">
          <section>
            <p className="section-label">Location</p>
            <select value={locationId} onChange={(event) => selectLocation(event.target.value)} disabled={loading}>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </section>

          <section>
            <p className="section-label">Maps</p>
            <div className="map-list">
              {!activeLocation?.maps.length ? (
                <p className="empty">No exported maps added yet.</p>
              ) : (
                activeLocation.maps.map((map) => (
                  <button
                    className={`map-item ${map.id === activeMap?.id ? "active" : ""}`}
                    key={map.id}
                    onClick={() => selectMap(map.id)}
                  >
                    <span>{map.name}</span>
                    <small>{displayMapSource(map.file)}</small>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="note">
            <strong>Database mode</strong>
            <p>Locations, maps, slots, and bookings are now loaded from Supabase PostgreSQL through Next.js API routes.</p>
          </section>
        </aside>

        <section className="map-card">
          <div className="map-toolbar">
            <div>
              <p className="eyebrow">{activeLocation?.name || "No location"}</p>
              <h2>{activeMap?.name || "No map selected"}</h2>
            </div>
            <div className="legend">
              <span><i className="available"></i>Available</span>
              <span><i className="booked"></i>Booked</span>
              <span><i className="reserved"></i>Reserved</span>
              <span><i className="selected"></i>Selected</span>
            </div>
          </div>

          {activeMap ? (
            <div className="map-stage">
              <div className="map-frame">
                {isPdfMap(activeMap.file) ? (
                  <iframe title={activeMap.name} src={`${activeMap.file}#toolbar=0&navpanes=0&view=FitH`} />
                ) : (
                  <img className="map-image" src={activeMap.file} alt={activeMap.name} />
                )}
                <div className="slot-layer" aria-label="Clickable parking demo slots" onClick={clearSelection}>
                  {activeMap.slots.map((slot) => (
                    <button
                      key={slot.id}
                    className={`slot ${slot.occupancyStatus || slot.status} ${selectedSlotId === slot.id ? "is-selected" : ""}`}
                      style={{ left: `${slot.x}%`, top: `${slot.y}%`, width: `${slot.w}%`, height: `${slot.h}%` }}
                      onClick={(event) => {
                        event.stopPropagation();
                        selectSlot(slot);
                      }}
                      title={`${slot.slotNo} ${slot.status}`}
                    >
                      {slot.slotNo}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-map">Select a location with exported maps.</div>
          )}
        </section>

        <aside className="booking-panel">
          <p className="section-label">Selected Slot</p>
          <h2>{selectedSlot ? selectedSlot.slotNo : "Click a slot"}</h2>
          <dl className="details">
            <div><dt>Location</dt><dd>{activeLocation?.name || "-"}</dd></div>
            <div><dt>Map</dt><dd>{activeMap?.name || "-"}</dd></div>
            <div><dt>Zone</dt><dd>{selectedSlot?.zone || "-"}</dd></div>
            <div><dt>Type</dt><dd>{selectedSlot?.type || "-"}</dd></div>
            <div><dt>Status</dt><dd>{selectedSlot?.occupancyStatus || selectedSlot?.status || "-"}</dd></div>
            <div><dt>Levels</dt><dd>{selectedSlot?.bookedLevels?.length ? `${selectedSlot.bookedLevels.join(", ")} booked` : "-"}</dd></div>
            {isStackSlot && <div><dt>Selected Level</dt><dd>{selectedLevelBooking ? selectedLevelBooking.allottee || "Booked" : "Empty"}</dd></div>}
          </dl>

          {selectedSlot?.levels?.length > 1 && (
            <label>
              Stack Level
              <select value={stackLevel} onChange={(event) => setStackLevel(event.target.value)}>
                {selectedSlot.levels.map((level) => (
                  <option key={level} value={level}>
                    {level}{selectedSlot.bookedLevels?.includes(level) ? " (booked)" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label>
            Allottee Name
            <input value={allottee} onChange={(event) => setAllottee(event.target.value)} placeholder="Demo user" />
          </label>
          <label>
            Mobile Number
            <input value={mobile} onChange={(event) => setMobile(event.target.value)} placeholder="9876543210" maxLength={10} />
          </label>

          <button className="primary" onClick={bookSlot} disabled={!canBookSelectedSlot}>
            {pendingAction === "book" ? "Booking..." : "Book Demo Parking"}
          </button>
          <button className="secondary" onClick={releaseSlot} disabled={!canReleaseSelectedSlot}>
            {pendingAction === "release" ? "Releasing..." : "Release Slot"}
          </button>
          <button className="ghost" onClick={() => updateStatus("reserved")} disabled={Boolean(pendingAction)}>
            {pendingAction === "status:reserved" ? "Updating..." : "Mark Reserved"}
          </button>
          <button className="ghost" onClick={() => updateStatus("maintenance")} disabled={Boolean(pendingAction)}>
            {pendingAction === "status:maintenance" ? "Updating..." : "Mark Maintenance"}
          </button>
          <button className="ghost" onClick={() => updateStatus("available")} disabled={Boolean(pendingAction)}>
            {pendingAction === "status:available" ? "Updating..." : "Mark Available"}
          </button>
          <p className="message">{message}</p>
        </aside>
      </section>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </main>
  );
}

function isPdfMap(file) {
  return String(file || "").toLowerCase().endsWith(".pdf");
}

function displayMapSource(file) {
  return String(file || "").startsWith("data:") ? "Uploaded image" : file;
}

function getBookingForLevel(slot, level) {
  const normalizedLevel = slot.levels?.length > 1 ? level : "Single";
  return slot.bookings?.find((booking) => (booking.level || "Single") === normalizedLevel);
}
