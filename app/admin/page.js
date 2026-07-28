"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import Toast from "../components/Toast";

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

const draftSlotId = "draft-slot";
const emptyUserForm = { id: "", name: "", mobile: "", address: "", active: true };
const emptyLocationForm = { id: "", name: "", parkingName: "", city: "" };

export default function AdminPage() {
  const [authorized, setAuthorized] = useState(false);
  const [adminTab, setAdminTab] = useState("maps");
  const [locations, setLocations] = useState([]);
  const [users, setUsers] = useState([]);
  const [locationId, setLocationId] = useState("");
  const [mapId, setMapId] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [form, setForm] = useState(emptySlot);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [locationForm, setLocationForm] = useState(emptyLocationForm);
  const [mapTitle, setMapTitle] = useState("");
  const [mapName, setMapName] = useState("");
  const [mapLevels, setMapLevels] = useState([1]);
  const [mapFile, setMapFile] = useState(null);
  const [message, setMessage] = useState("Manage maps and slot overlays.");
  const [pendingAction, setPendingAction] = useState("");
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    const auth = JSON.parse(localStorage.getItem("parking-auth") || "{}");
    if (auth.role !== "admin") {
      window.location.href = "/admin/login";
      return;
    }
    setAuthorized(true);
    loadLocations();
    loadUsers();
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

  async function loadLocations(preferredLocationId = locationId, preferredMapId = mapId, preferredSlotId = selectedSlotId, options = {}) {
    try {
      const response = await fetch("/api/locations", { cache: "no-store" });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(data.detail || data.error || "Could not load locations.");
      }
      const nextLocations = data.locations || [];
      const nextLocation = nextLocations.find((item) => item.id === preferredLocationId) || nextLocations[0];
      const nextMap = nextLocation?.maps.find((item) => item.id === preferredMapId) || nextLocation?.maps[0];
      const nextSlot = nextMap?.slots.find((item) => item.id === preferredSlotId);

      setLocations(nextLocations);
      setLocationId(nextLocation?.id || "");
      setMapId(nextMap?.id || "");
      setLocationForm({
        id: nextLocation?.id || "",
        name: nextLocation?.name || "",
        parkingName: nextLocation?.parkingName || "",
        city: nextLocation?.city || ""
      });
      setMapTitle(nextMap?.name || "");
      if (nextSlot) {
        setSelectedSlotId(nextSlot.id);
        setForm(slotToForm(nextSlot));
      }
    } catch (error) {
      if (!options.silent) {
        setMessage(`Could not load data: ${error.message}`);
        showToast("error", `Could not load data: ${error.message}`);
      }
    }
  }

  async function loadUsers() {
    try {
      const response = await fetch("/api/users", { cache: "no-store" });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(data.error || "Could not load users.");
      }
      setUsers(data.users || []);
    } catch (error) {
      setMessage(`Could not load users: ${error.message}`);
      showToast("error", `Could not load users: ${error.message}`);
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
  const selectedSlotHasBookings = Boolean(selectedSlot?.bookings?.length);
  const isDraftSlot = selectedSlotId === draftSlotId && !form.id && Boolean(form.slotNo);
  const canEditPosition = Boolean(form.id || isDraftSlot);

  useEffect(() => {
    function handleKeyDown(event) {
      if (!canEditPosition || isTypingTarget(event.target)) return;

      const movement = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0]
      }[event.key];

      if (!movement) return;
      event.preventDefault();
      const step = event.shiftKey ? 5 : 1;
      nudge(movement[0] * step, movement[1] * step);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canEditPosition]);

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
    setMapTitle(nextLocation?.maps[0]?.name || "");
    setLocationForm({
      id: nextLocation?.id || "",
      name: nextLocation?.name || "",
      parkingName: nextLocation?.parkingName || "",
      city: nextLocation?.city || ""
    });
    setSelectedSlotId("");
    setForm(emptySlot);
  }

  function selectMap(nextMapId) {
    const nextMap = activeLocation?.maps.find((map) => map.id === nextMapId);
    setMapId(nextMapId);
    setMapTitle(nextMap?.name || "");
    setSelectedSlotId("");
    setForm(emptySlot);
  }

  function selectSlot(slot) {
    setSelectedSlotId(slot.id);
    setForm(slotToForm(slot));
    setMessage(`${slot.slotNo} selected for editing.`);
  }

  function addNewSlot() {
    if (!activeMap) {
      setMessage("Select a map first.");
      showToast("error", "Select a map first.");
      return;
    }

    const nextSlot = {
      ...emptySlot,
      slotNo: getNextSlotNumber(activeMap),
      zone: `Level ${activeMap.parkingLevel || 1}`,
      x: 12,
      y: 12
    };

    setSelectedSlotId(draftSlotId);
    setForm(nextSlot);
    setMessage(`${nextSlot.slotNo} draft added. Move it on the map, then save.`);
    showToast("success", `${nextSlot.slotNo} draft added.`);
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function editUser(user) {
    setUserForm({
      id: user.id,
      name: user.name || "",
      mobile: user.mobile || "",
      address: user.address || "",
      active: user.active !== false
    });
  }

  function resetUserForm() {
    setUserForm(emptyUserForm);
  }

  function newLocation() {
    setLocationForm(emptyLocationForm);
    setMapTitle("");
    setMessage("Enter location details, then save.");
  }

  async function saveUser(event) {
    event.preventDefault();
    if (!userForm.name.trim() || userForm.mobile.length !== 10) {
      setMessage("User name and 10 digit mobile are required.");
      showToast("error", "User name and 10 digit mobile are required.");
      return;
    }

    setPendingAction("saveUser");
    try {
      const response = await fetch(userForm.id ? `/api/users/${userForm.id}` : "/api/users", {
        method: userForm.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userForm)
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(data.error || "Could not save user.");
      }
      setMessage(`${data.user.name} saved in user master.`);
      showToast("success", `${data.user.name} saved.`);
      resetUserForm();
      await loadUsers();
    } catch (error) {
      setMessage(`Could not save user: ${error.message}`);
      showToast("error", `Could not save user: ${error.message}`);
    } finally {
      setPendingAction("");
    }
  }

  async function deleteUser(userId) {
    setPendingAction(`deleteUser-${userId}`);
    try {
      const response = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(data.error || "Could not delete user.");
      }
      setMessage(`${data.user.name} deleted from user master.`);
      showToast("success", `${data.user.name} deleted.`);
      if (userForm.id === userId) resetUserForm();
      await loadUsers();
    } catch (error) {
      setMessage(`Could not delete user: ${error.message}`);
      showToast("error", `Could not delete user: ${error.message}`);
    } finally {
      setPendingAction("");
    }
  }

  async function saveLocationMaster(event) {
    event.preventDefault();
    if (!locationForm.name.trim()) {
      setMessage("Location name is required.");
      showToast("error", "Location name is required.");
      return;
    }

    setPendingAction("saveLocation");
    try {
      const response = await fetch(locationForm.id ? `/api/locations/${locationForm.id}` : "/api/locations", {
        method: locationForm.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(locationForm)
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(data.error || "Could not save location.");
      }
      setLocationForm({
        id: data.location.id,
        name: data.location.name || "",
        parkingName: data.location.parkingName || "",
        city: data.location.city || ""
      });
      setMessage(`${data.location.name} location saved.`);
      showToast("success", locationForm.id ? "Location master saved." : "New location created.");
      await loadLocations(data.location.id, mapId, selectedSlotId);
    } catch (error) {
      setMessage(`Could not save location: ${error.message}`);
      showToast("error", `Could not save location: ${error.message}`);
    } finally {
      setPendingAction("");
    }
  }

  async function saveMapTitle(event) {
    event.preventDefault();
    if (!activeMap) return;

    setPendingAction("saveMapTitle");
    try {
      const response = await fetch(`/api/maps/${activeMap.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: mapTitle })
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(data.error || "Could not save parking name.");
      }
      setMessage(`${data.map.name} parking map saved.`);
      showToast("success", "Parking name saved.");
      await loadLocations(locationId, data.map.id, selectedSlotId);
    } catch (error) {
      setMessage(`Could not save parking name: ${error.message}`);
      showToast("error", `Could not save parking name: ${error.message}`);
    } finally {
      setPendingAction("");
    }
  }

  function toggleMapLevel(level) {
    setMapLevels((current) => {
      if (current.includes(level)) {
        const next = current.filter((item) => item !== level);
        return next.length ? next : current;
      }
      return [...current, level].sort((a, b) => a - b);
    });
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
      showToast("error", "Slot number is required.");
      return;
    }

    setPendingAction("saveSlot");
    try {
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
        const error = data.error || "Could not save slot.";
        setMessage(error);
        showToast("error", error);
        return;
      }

      const saved = data.slot;
      setSelectedSlotId(saved.id);
      setMessage(`${saved.slotNo} saved.`);
      showToast("success", `${saved.slotNo} saved.`);
      await loadLocations(locationId, mapId, saved.id);
    } catch (error) {
      setMessage(`Could not save slot: ${error.message}`);
      showToast("error", `Could not save slot: ${error.message}`);
    } finally {
      setPendingAction("");
    }
  }

  async function deleteSlot() {
    if (!selectedSlot) {
      if (isDraftSlot) {
        setSelectedSlotId("");
        setForm(emptySlot);
        setMessage("Draft slot removed.");
        showToast("success", "Draft slot removed.");
        return;
      }
      setMessage("Select a slot first.");
      showToast("error", "Select a slot first.");
      return;
    }

    setPendingAction("deleteSlot");
    try {
      const response = await fetch(`/api/slots/${selectedSlot.id}`, { method: "DELETE" });
      if (!response.ok) {
        setMessage("Could not delete slot.");
        showToast("error", "Could not delete slot.");
        return;
      }
      setSelectedSlotId("");
      setForm(emptySlot);
      setMessage("Slot deleted.");
      showToast("success", "Slot deleted.");
      await loadLocations(locationId, mapId, "");
    } catch (error) {
      setMessage(`Could not delete slot: ${error.message}`);
      showToast("error", `Could not delete slot: ${error.message}`);
    } finally {
      setPendingAction("");
    }
  }

  async function releaseBooking(level) {
    if (!selectedSlot) {
      setMessage("Select a booked slot first.");
      showToast("error", "Select a booked slot first.");
      return;
    }

    setPendingAction(`release-${level}`);
    try {
      const response = await fetch(`/api/slots/${selectedSlot.id}/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level, admin: true })
      });
      const data = await response.json();
      if (!response.ok) {
        const error = data.error || "Could not release booking.";
        setMessage(error);
        showToast("error", error);
        return;
      }

      const releasedSlotNo = getTierSlotNo(selectedSlot, level);
      setMessage(`${releasedSlotNo} released.`);
      showToast("success", `${releasedSlotNo} released.`);
      await loadLocations(locationId, mapId, selectedSlot.id);
    } catch (error) {
      setMessage(`Could not release booking: ${error.message}`);
      showToast("error", `Could not release booking: ${error.message}`);
    } finally {
      setPendingAction("");
    }
  }

  async function deleteMap() {
    if (!activeMap) {
      setMessage("Select a map first.");
      showToast("error", "Select a map first.");
      return;
    }

    const confirmed = window.confirm(`Delete ${activeMap.name}? Slots on this imported map will also be removed.`);
    if (!confirmed) {
      return;
    }

    setPendingAction("deleteMap");
    try {
      const response = await fetch(`/api/maps/${activeMap.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) {
        const error = result.error || "Could not delete map.";
        setMessage(error);
        showToast("error", error);
        return;
      }

      setSelectedSlotId("");
      setForm(emptySlot);
      setMessage(`${result.map.name} deleted.`);
      showToast("success", `${result.map.name} deleted.`);
      await loadLocations(locationId, "", "");
    } catch (error) {
      setMessage(`Could not delete map: ${error.message}`);
      showToast("error", `Could not delete map: ${error.message}`);
    } finally {
      setPendingAction("");
    }
  }

  async function importMap(event) {
    event.preventDefault();
    if (!locationId || !mapFile) {
      setMessage("Choose a location and map file.");
      showToast("error", "Choose a location and map file.");
      return;
    }

    setPendingAction("importMap");
    try {
      const data = new FormData();
      data.append("locationId", locationId);
      data.append("name", mapName || mapFile.name);
      mapLevels.forEach((level) => data.append("parkingLevels", String(level)));
      data.append("file", mapFile);

      const response = await fetch("/api/maps", { method: "POST", body: data });
      const result = await response.json();
      if (!response.ok) {
        const error = result.error || "Map import failed.";
        setMessage(error);
        showToast("error", error);
        return;
      }

      setMapName("");
      setMapLevels([1]);
      setMapFile(null);
      const importedCount = result.maps?.length || 1;
      setMessage(`${importedCount} level map${importedCount > 1 ? "s" : ""} imported. Add slots from the editor.`);
      showToast("success", `${importedCount} level map${importedCount > 1 ? "s" : ""} imported.`);
      await loadLocations(locationId, result.map?.id || result.maps?.[0]?.id || "", "");
    } catch (error) {
      setMessage(`Map import failed: ${error.message}`);
      showToast("error", `Map import failed: ${error.message}`);
    } finally {
      setPendingAction("");
    }
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
          <a href="/admin/login">Admin Login</a>
        </nav>
        <div className="stats">
          <span><strong>{stats.total}</strong> Slots</span>
          <span><strong>{stats.available}</strong> Available</span>
          <span><strong>{stats.booked}</strong> Booked</span>
        </div>
      </header>

      <nav className="admin-tabs" aria-label="Admin sections">
        <button className={adminTab === "maps" ? "active" : ""} type="button" onClick={() => setAdminTab("maps")}>Map Manager</button>
        <button className={adminTab === "users" ? "active" : ""} type="button" onClick={() => setAdminTab("users")}>User Master</button>
        <button className={adminTab === "locations" ? "active" : ""} type="button" onClick={() => setAdminTab("locations")}>Location Master</button>
      </nav>

      {adminTab === "maps" && (
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
                  <span>Level {map.parkingLevel || 1}</span>
                  <em>{map.name}</em>
                  <small>{displayMapSource(map.file)}</small>
                </button>
              ))}
            </div>
          </section>

          <form className="import-box" onSubmit={importMap}>
            <p className="section-label">Import Map</p>
            <input value={mapName} onChange={(event) => setMapName(event.target.value)} placeholder="Map name" />
            <div className="level-checkboxes" role="group" aria-label="Parking levels for this map">
              {[1, 2, 3, 4, 5].map((level) => (
                <label key={level} className="level-check">
                  <input type="checkbox" checked={mapLevels.includes(level)} onChange={() => toggleMapLevel(level)} />
                  <span>L{level}</span>
                </label>
              ))}
            </div>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,.svg" onChange={(event) => setMapFile(event.target.files?.[0] || null)} />
            <button className="secondary" disabled={Boolean(pendingAction)}>
              {pendingAction === "importMap" ? "Importing..." : "Import Map"}
            </button>
          </form>

          <section>
            <p className="section-label">Selected Map</p>
            <button className="ghost danger-text" onClick={deleteMap} disabled={!activeMap || Boolean(pendingAction)} type="button">
              {pendingAction === "deleteMap" ? "Deleting..." : "Delete Imported Map"}
            </button>
          </section>
        </aside>

        <section className="map-card">
          <div className="map-toolbar">
            <div>
              <p className="eyebrow">{activeLocation?.name || "Location"}</p>
              <h2>{activeMap ? `Level ${activeMap.parkingLevel || 1} - ${activeMap.name}` : "No map selected"}</h2>
            </div>
            <p className="message compact">Select a slot, edit coordinates, then save. Coordinates are percentages over the map.</p>
          </div>
          {activeMap ? (
            <>
              <div className="map-stage">
                <div className="floating-position">
                  <div>
                    <p className="section-label">Position</p>
                    <strong>{form.id || isDraftSlot ? form.slotNo || "Selected Slot" : "Select a slot"}</strong>
                    <small>Arrow keys move. Shift + arrow moves faster.</small>
                  </div>
                  <div className="floating-position-grid">
                    <label>X<input type="number" value={form.x} disabled={!canEditPosition} onChange={(event) => updateForm("x", event.target.value)} /></label>
                    <label>Y<input type="number" value={form.y} disabled={!canEditPosition} onChange={(event) => updateForm("y", event.target.value)} /></label>
                    <label>W<input type="number" value={form.w} disabled={!canEditPosition} onChange={(event) => updateForm("w", event.target.value)} /></label>
                    <label>H<input type="number" value={form.h} disabled={!canEditPosition} onChange={(event) => updateForm("h", event.target.value)} /></label>
                  </div>
                </div>
                <div className="map-frame" onClick={clearSelection}>
                  {isPdfMap(activeMap.file) ? (
                    <iframe title={activeMap.name} src={`${activeMap.file}#toolbar=0&navpanes=0&view=FitH`} />
                  ) : (
                    <img className="map-image" src={activeMap.file} alt={activeMap.name} />
                  )}
                  <div className="slot-layer">
                    {activeMap.slots.map((slot) => {
                      const display = slot.id === selectedSlotId ? form : slotToForm(slot);
                      return (
                        <SlotMarker
                          key={slot.id}
                          display={display}
                          occupancyStatus={slot.id === selectedSlotId ? display.status : slot.occupancyStatus || display.status}
                          selected={slot.id === selectedSlotId}
                          style={{ left: `${display.x}%`, top: `${display.y}%`, width: `${display.w}%`, height: `${display.h}%` }}
                          onClick={(event) => {
                            event.stopPropagation();
                            selectSlot(slot);
                          }}
                          slot={slot}
                        />
                      );
                    })}
                    {isDraftSlot && (
                      <button
                        className="slot available is-selected is-draft"
                        style={{ left: `${form.x}%`, top: `${form.y}%`, width: `${form.w}%`, height: `${form.h}%` }}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedSlotId(draftSlotId);
                        }}
                        type="button"
                      >
                        {form.slotNo}
                      </button>
                    )}
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
          <h2>{form.id ? `Editing ${form.slotNo}` : isDraftSlot ? `New ${form.slotNo}` : "New Slot"}</h2>

          <label>Slot Number<input value={form.slotNo} onChange={(event) => updateForm("slotNo", event.target.value)} placeholder="A-101" /></label>
          <label>Zone<input value={form.zone} onChange={(event) => updateForm("zone", event.target.value)} placeholder="Wing A" /></label>
          <label>
            Type
            <select value={form.type} disabled={selectedSlotHasBookings} onChange={(event) => updateForm("type", event.target.value)}>
              <option>Regular</option>
              <option>Stack 2-tier</option>
              <option>Stack 3-tier</option>
            </select>
            {selectedSlotHasBookings && <small className="field-note">Release active bookings before changing tier.</small>}
          </label>
          <label>Status<select value={form.status} onChange={(event) => updateForm("status", event.target.value)}>
            <option value="available">Available</option>
            <option value="reserved">Reserved</option>
            <option value="maintenance">Maintenance</option>
          </select></label>

          {selectedSlot && (
            <section className="level-bookings">
              <p className="section-label">Booking Levels</p>
              {(selectedSlot.levels || ["Single"]).map((level) => {
                const booking = getBookingForLevel(selectedSlot, level);
                return (
                  <div className="level-booking" key={level}>
                    <strong>{getTierSlotNo(selectedSlot, level)}</strong>
                    <span>{booking ? booking.allottee || "Booked" : "Empty"}</span>
                    <small>{booking ? `${booking.mobile || ""}${booking.createdAt ? ` - ${formatDateTime(booking.createdAt)}` : ""}` : ""}</small>
                    {booking && (
                      <button className="ghost compact-action danger-text" type="button" disabled={Boolean(pendingAction)} onClick={() => releaseBooking(level)}>
                        {pendingAction === `release-${level}` ? "Releasing..." : "Release"}
                      </button>
                    )}
                  </div>
                );
              })}
            </section>
          )}

          <button className="primary" onClick={saveSlot} disabled={Boolean(pendingAction)}>
            {pendingAction === "saveSlot" ? "Saving..." : "Save Slot"}
          </button>
          <button className="secondary" onClick={addNewSlot} disabled={!activeMap || Boolean(pendingAction)}>Add New Slot</button>
          <button className="ghost danger-text" onClick={deleteSlot} disabled={Boolean(pendingAction)}>
            {pendingAction === "deleteSlot" ? "Deleting..." : "Delete Selected Slot"}
          </button>
          <p className="message">{message}</p>
        </aside>
      </section>
      )}

      {adminTab === "users" && (
        <section className="master-panel">
          <div className="master-card">
            <div className="master-card-head">
              <div>
                <p className="section-label">User Master</p>
                <h2>{userForm.id ? "Edit User" : "Add User"}</h2>
              </div>
              <button className="ghost inline-action" disabled={Boolean(pendingAction)} type="button" onClick={resetUserForm}>New User</button>
            </div>
            <form className="master-box master-form-grid" onSubmit={saveUser}>
              <input value={userForm.name} onChange={(event) => setUserForm((current) => ({ ...current, name: event.target.value }))} placeholder="User name" />
              <input value={userForm.mobile} onChange={(event) => setUserForm((current) => ({ ...current, mobile: event.target.value.replace(/\D/g, "").slice(0, 10) }))} placeholder="Mobile number" />
              <input value={userForm.address} onChange={(event) => setUserForm((current) => ({ ...current, address: event.target.value }))} placeholder="Flat / address" />
              <label className="inline-check">
                <input type="checkbox" checked={userForm.active} onChange={(event) => setUserForm((current) => ({ ...current, active: event.target.checked }))} />
                <span>Active login access</span>
              </label>
              <div className="split-actions">
                <button className="secondary" disabled={Boolean(pendingAction)} type="submit">
                  {pendingAction === "saveUser" ? "Saving..." : userForm.id ? "Update User" : "Add User"}
                </button>
                <button className="ghost" disabled={Boolean(pendingAction)} type="button" onClick={resetUserForm}>Clear</button>
              </div>
            </form>
          </div>

          <div className="master-card">
            <p className="section-label">Registered Users</p>
            <div className="user-master-table">
              {users.map((user) => (
                <article className={`user-master-row ${user.active ? "" : "inactive"}`} key={user.id}>
                  <div>
                    <strong>{user.name}</strong>
                    <span>{user.mobile}</span>
                    <small>{user.address || "No address"}{user.active ? "" : " - inactive"}</small>
                  </div>
                  <button className="secondary compact-action" type="button" onClick={() => editUser(user)}>Edit</button>
                  <button className="ghost danger-text compact-action" disabled={Boolean(pendingAction)} type="button" onClick={() => deleteUser(user.id)}>
                    {pendingAction === `deleteUser-${user.id}` ? "Deleting..." : "Delete"}
                  </button>
                </article>
              ))}
              {!users.length && <p className="empty">No users added yet.</p>}
            </div>
          </div>
        </section>
      )}

      {adminTab === "locations" && (
        <section className="master-panel">
          <div className="master-card">
            <div className="master-card-head">
              <div>
                <p className="section-label">Location Master</p>
                <h2>{locationForm.id ? "Edit Location" : "New Location"}</h2>
              </div>
              <div className="master-actions">
                <select className="compact-select" value={locationId} onChange={(event) => selectLocation(event.target.value)}>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>{location.name}</option>
                  ))}
                </select>
                <button className="ghost inline-action" disabled={Boolean(pendingAction)} type="button" onClick={newLocation}>New Location</button>
              </div>
            </div>
            <form className="master-box master-form-grid" onSubmit={saveLocationMaster}>
              <input value={locationForm.name} onChange={(event) => setLocationForm((current) => ({ ...current, name: event.target.value }))} placeholder="Location name" />
              <input value={locationForm.parkingName} onChange={(event) => setLocationForm((current) => ({ ...current, parkingName: event.target.value }))} placeholder="Default parking name" />
              <input value={locationForm.city} onChange={(event) => setLocationForm((current) => ({ ...current, city: event.target.value }))} placeholder="City / area" />
              <button className="secondary" disabled={Boolean(pendingAction)} type="submit">
                {pendingAction === "saveLocation" ? "Saving..." : locationForm.id ? "Save Location" : "Create Location"}
              </button>
            </form>
          </div>

          <div className="master-card">
            <div className="master-card-head">
              <div>
                <p className="section-label">Parking Names</p>
                <h2>Location Wise Parking</h2>
              </div>
              <select className="compact-select" value={mapId} onChange={(event) => selectMap(event.target.value)}>
                {activeLocation?.maps.map((map) => (
                  <option key={map.id} value={map.id}>Level {map.parkingLevel || 1} - {map.name}</option>
                ))}
              </select>
            </div>
            <form className="master-box master-form-grid" onSubmit={saveMapTitle}>
              <input value={mapTitle} onChange={(event) => setMapTitle(event.target.value)} placeholder="Parking / map name" />
              <button className="secondary" disabled={!activeMap || Boolean(pendingAction)} type="submit">
                {pendingAction === "saveMapTitle" ? "Saving..." : "Save Parking Name"}
              </button>
            </form>
            <div className="parking-name-list">
              {activeLocation?.maps.map((map) => (
                <button className={`map-item ${map.id === activeMap?.id ? "active" : ""}`} key={map.id} type="button" onClick={() => selectMap(map.id)}>
                  <span>Level {map.parkingLevel || 1}</span>
                  <em>{map.name}</em>
                  <small>{displayMapSource(map.file)}</small>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />
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

function SlotMarker({ display, occupancyStatus, onClick, selected, slot, style }) {
  const previewSlot = {
    ...slot,
    slotNo: display.slotNo,
    type: display.type,
    levels: getSlotLevelNames(display.type)
  };
  const displayNumbers = getSlotDisplayNumbers(previewSlot);
  const isStack = displayNumbers.length > 1;

  return (
    <button
      className={`slot ${occupancyStatus} ${selected ? "is-selected" : ""} ${isStack ? "is-stack" : ""}`}
      style={style}
      onClick={onClick}
      type="button"
    >
      {isStack ? (
        <span className="stack-flags">
          {displayNumbers.map((item) => (
            <span className={`stack-flag ${item.booked ? "booked" : "available"}`} key={item.level}>
              {item.slotNo}
            </span>
          ))}
        </span>
      ) : (
        <span className="slot-number">{display.slotNo}</span>
      )}
    </button>
  );
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

function isTypingTarget(target) {
  const tagName = target?.tagName?.toLowerCase();
  return tagName === "input" || tagName === "select" || tagName === "textarea" || target?.isContentEditable;
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: text.slice(0, 180) };
  }
}

function isPdfMap(file) {
  return String(file || "").toLowerCase().endsWith(".pdf");
}

function displayMapSource(file) {
  const value = String(file || "");
  return value.startsWith("data:") || value.includes("/api/maps/") ? "Uploaded image" : value;
}

function getNextSlotNumber(map) {
  const parkingLevel = map?.parkingLevel || 1;
  const prefix = `L${parkingLevel}P`;
  const highestNumber = (map?.slots || []).reduce((highest, slot) => {
    const parsed = parseSlotNumber(slot.slotNo);
    if (!parsed) return highest;
    return Math.max(highest, parsed.number + getSlotCapacity(slot) - 1);
  }, 0);
  let next = highestNumber + 1;
  let candidate = `${prefix}${String(next).padStart(3, "0")}`;
  const existing = new Set((map?.slots || []).map((slot) => slot.slotNo));

  while (existing.has(candidate)) {
    next += 1;
    candidate = `${prefix}${String(next).padStart(3, "0")}`;
  }

  return candidate;
}

function getSlotDisplayNumbers(slot) {
  const levels = slot?.levels?.length ? slot.levels : getSlotLevelNames(slot?.type);
  const base = parseSlotNumber(slot?.slotNo);

  return levels.map((level, index) => ({
    level,
    slotNo: base ? `${base.prefix}${String(base.number + index).padStart(base.width, "0")}` : slot?.slotNo || "",
    booked: slot?.bookedLevels?.includes(level)
  }));
}

function getTierSlotNo(slot, level) {
  const item = getSlotDisplayNumbers(slot).find((entry) => entry.level === level);
  return item?.slotNo || slot?.slotNo || "";
}

function getSlotCapacity(slot) {
  return getSlotLevelNames(slot?.type).length;
}

function getSlotLevelNames(type = "") {
  if (String(type).includes("3")) return ["Top", "Middle", "Bottom"];
  if (String(type).includes("2")) return ["Top", "Bottom"];
  return ["Single"];
}

function parseSlotNumber(slotNo) {
  const match = String(slotNo || "").match(/^(.*?)(\d+)$/);
  if (!match) return null;
  return {
    prefix: match[1],
    number: Number(match[2]),
    width: match[2].length
  };
}

function getBookingForLevel(slot, level) {
  const normalizedLevel = (slot.levels?.length || 0) > 1 ? level : "Single";
  return slot.bookings?.find((booking) => (booking.level || "Single") === normalizedLevel);
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
