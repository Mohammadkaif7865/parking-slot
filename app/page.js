"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import Toast from "./components/Toast";

export default function Home() {
  const [auth, setAuth] = useState(null);
  const [locations, setLocations] = useState([]);
  const [locationId, setLocationId] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [mapId, setMapId] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [allottee, setAllottee] = useState("");
  const [stackLevel, setStackLevel] = useState("Top");
  const [message, setMessage] = useState("Loading maps from PostgreSQL...");
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState("");
  const [toast, setToast] = useState(null);
  const [bookingConfirmation, setBookingConfirmation] = useState(null);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    const session = getUserSession();
    if (!session) {
      window.location.href = "/login";
      return;
    }
    localStorage.setItem("parking-auth", JSON.stringify(session));
    setAuth(session);
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
    if (!options.silent) setLoading(true);
    try {
      const response = await fetch("/api/locations", { cache: "no-store" });
      const data = await response.json();
      const nextLocations = data.locations || [];
      const nextLocation = nextLocations.find((item) => item.id === preferredLocationId) || nextLocations[0];
      const maps = nextLocation?.maps || [];
      const nextMap = maps.find((item) => item.id === preferredMapId) || maps.find((item) => item.parkingLevel === Number(selectedLevel)) || maps[0];

      setLocations(nextLocations);
      setLocationId(nextLocation?.id || "");
      if (nextMap && !selectedLevel) {
        setSelectedLevel("");
      }
      setMapId(nextMap?.id || "");
      setSelectedSlotId(preferredSlotId || "");
      if (!options.silent) {
        setMessage(nextLocations.length ? "Select a parking level to continue." : "No maps found in database.");
      }
    } catch (error) {
      if (!options.silent) {
        setMessage(`Could not load database data: ${error.message}`);
        showToast("error", `Could not load data: ${error.message}`);
      }
    } finally {
      if (!options.silent) setLoading(false);
    }
  }

  function showToast(type, message) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, message });
    toastTimerRef.current = setTimeout(() => setToast(null), 3200);
  }

  const activeLocation = locations.find((location) => location.id === locationId);
  const levelMaps = useMemo(() => activeLocation?.maps.filter((map) => map.parkingLevel === Number(selectedLevel)) || [], [activeLocation, selectedLevel]);
  const activeMap = levelMaps.find((map) => map.id === mapId) || levelMaps[0];
  const selectedSlot = activeMap?.slots.find((slot) => slot.id === selectedSlotId);
  const isStackSlot = (selectedSlot?.levels?.length || 0) > 1;
  const selectedLevelBooked = isStackSlot && selectedSlot?.bookedLevels?.includes(stackLevel);
  const selectedLevelBooking = selectedSlot ? getBookingForLevel(selectedSlot, stackLevel) : null;
  const sessionMobile = auth?.mobile || "";
  const userActiveBooking = useMemo(() => {
    return locations
      .flatMap((location) => location.maps)
      .flatMap((map) => map.slots.map((slot) => ({ map, slot })))
      .flatMap(({ map, slot }) => (slot.bookings || []).map((booking) => ({ map, slot, booking })))
      .find((item) => item.booking.mobile === sessionMobile);
  }, [locations, sessionMobile]);

  const canBookSelectedSlot = selectedSlot && !pendingAction && !userActiveBooking && (isStackSlot ? !selectedLevelBooked : selectedSlot.occupancyStatus !== "booked");
  const canReleaseSelectedSlot = selectedSlot && !pendingAction && Boolean(selectedLevelBooking?.mobile === sessionMobile);

  useEffect(() => {
    if (!selectedSlot) {
      setAllottee("");
      setStackLevel("Top");
      return;
    }
    const fallbackLevel = selectedSlot.availableLevels?.[0] || selectedSlot.bookedLevels?.[0] || selectedSlot.levels?.[0] || "Top";
    setStackLevel(fallbackLevel);
  }, [selectedSlot]);

  useEffect(() => {
    if (!selectedSlot) return;
    const booking = getBookingForLevel(selectedSlot, stackLevel);
    setAllottee(booking?.mobile === sessionMobile ? booking?.allottee || "" : "");
  }, [selectedSlot, stackLevel, sessionMobile]);

  const levelOptions = useMemo(() => {
    const levels = new Set((activeLocation?.maps || []).map((map) => map.parkingLevel || 1));
    return Array.from(levels).sort((a, b) => a - b);
  }, [activeLocation]);

  const levelStats = useMemo(() => {
    const stats = {};
    (activeLocation?.maps || []).forEach((map) => {
      const level = map.parkingLevel || 1;
      const current = stats[level] || {
        maps: 0,
        physicalSlots: 0,
        totalCapacity: 0,
        availableCapacity: 0,
        bookedCapacity: 0,
        partialSlots: 0,
        unavailable: 0
      };

      current.maps += 1;
      (map.slots || []).forEach((slot) => {
        const status = slot.occupancyStatus || slot.status || "available";
        const capacity = Math.max(1, slot.levels?.length || 1);
        const booked = Math.min(capacity, slot.bookedLevels?.length || 0);
        current.physicalSlots += 1;
        current.totalCapacity += capacity;
        current.bookedCapacity += booked;

        if (status === "reserved" || status === "maintenance") {
          current.unavailable += capacity;
        } else {
          current.availableCapacity += Math.max(0, capacity - booked);
        }

        if (status === "partial") current.partialSlots += 1;
      });
      stats[level] = current;
    });
    return stats;
  }, [activeLocation]);

  function selectLocation(nextLocationId) {
    const nextLocation = locations.find((location) => location.id === nextLocationId);
    setLocationId(nextLocationId);
    setSelectedLevel("");
    setMapId(nextLocation?.maps[0]?.id || "");
    setSelectedSlotId("");
  }

  function selectLevel(level) {
    const nextMap = activeLocation?.maps.find((map) => map.parkingLevel === level);
    setSelectedLevel(String(level));
    setMapId(nextMap?.id || "");
    setSelectedSlotId("");
    setMessage(`Level ${level} selected. Click a parking slot to book.`);
  }

  function selectMap(nextMapId) {
    setMapId(nextMapId);
    setSelectedSlotId("");
  }

  function selectSlot(slot) {
    setSelectedSlotId(slot.id);
    setMessage(`${slot.slotNo} selected.`);
  }

  function clearSelection() {
    setSelectedSlotId("");
    setMessage("Selection cleared.");
  }

  async function bookSlot() {
    if (!selectedSlot) {
      showToast("error", "Select a parking slot first.");
      return;
    }
    if (!allottee.trim()) {
      showToast("error", "Enter your name.");
      setMessage("Name is required.");
      return;
    }
    if (userActiveBooking) {
      showToast("error", `You already booked ${userActiveBooking.slot.slotNo}.`);
      setMessage("One user can book only one active slot for now.");
      return;
    }
    const displayStatus = selectedSlot.occupancyStatus || selectedSlot.status;
    if (displayStatus === "reserved" || displayStatus === "maintenance") {
      showToast("error", `${selectedSlot.slotNo} is ${displayStatus}.`);
      return;
    }

    const bookingLevel = selectedSlot.levels?.length > 1 ? stackLevel : "Single";
    setBookingConfirmation({
      slotId: selectedSlot.id,
      slotNo: selectedSlot.slotNo,
      bookingLevel,
      allottee: allottee.trim(),
      mobile: sessionMobile,
      location: activeLocation?.name || "",
      map: activeMap?.name || "",
      parkingLevel: selectedLevel
    });
  }

  async function confirmBooking() {
    if (!bookingConfirmation) return;
    setPendingAction("book");
    try {
      const response = await fetch(`/api/slots/${bookingConfirmation.slotId}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allottee: bookingConfirmation.allottee,
          mobile: bookingConfirmation.mobile,
          level: bookingConfirmation.bookingLevel
        })
      });
      const data = await response.json();
      if (!response.ok) {
        const error = data.error || "Booking failed.";
        setMessage(error);
        showToast("error", error);
        return;
      }
      const success = bookingConfirmation.bookingLevel !== "Single"
        ? `${bookingConfirmation.slotNo} ${bookingConfirmation.bookingLevel} booked.`
        : `${bookingConfirmation.slotNo} booked.`;
      setMessage(success);
      showToast("success", success);
      downloadBookingReceipt({
        bookingId: data.booking?.id,
        name: bookingConfirmation.allottee,
        mobile: bookingConfirmation.mobile,
        location: bookingConfirmation.location,
        map: bookingConfirmation.map,
        parkingLevel: bookingConfirmation.parkingLevel,
        slotNo: bookingConfirmation.slotNo,
        stackLevel: bookingConfirmation.bookingLevel,
        bookedAt: data.booking?.createdAt || new Date().toISOString()
      });
      setBookingConfirmation(null);
      await loadLocations(locationId, mapId, bookingConfirmation.slotId);
    } catch (error) {
      setMessage(`Booking failed: ${error.message}`);
      showToast("error", `Booking failed: ${error.message}`);
    } finally {
      setPendingAction("");
    }
  }

  async function releaseSlot() {
    if (!selectedSlot || !canReleaseSelectedSlot) {
      showToast("error", "You can release only your active booking.");
      return;
    }
    setPendingAction("release");
    try {
      const response = await fetch(`/api/slots/${selectedSlot.id}/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: selectedSlot.levels?.length > 1 ? stackLevel : "Single", mobile: sessionMobile })
      });
      const data = await response.json();
      if (!response.ok) {
        const error = data.error || "Release failed.";
        setMessage(error);
        showToast("error", error);
        return;
      }
      setMessage(`${selectedSlot.slotNo} released.`);
      showToast("success", `${selectedSlot.slotNo} released.`);
      await loadLocations(locationId, mapId, selectedSlot.id);
    } catch (error) {
      setMessage(`Release failed: ${error.message}`);
      showToast("error", `Release failed: ${error.message}`);
    } finally {
      setPendingAction("");
    }
  }

  function logout() {
    localStorage.removeItem("parking-auth");
    window.location.href = "/login";
  }

  if (!auth) {
    return <main className="auth-page"><p>Redirecting...</p></main>;
  }

  if (!selectedLevel) {
    return (
      <main className="app-shell level-shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">Level Selection</p>
            <h1>Select Parking Level</h1>
          </div>
          <nav className="top-actions">
            <button className="ghost inline-action" onClick={logout}>Logout</button>
            <a href="/admin/login">Admin</a>
          </nav>
        </header>
        <section className="level-selector">
          <div className="level-card">
            <label>
              Location
              <select value={locationId} onChange={(event) => selectLocation(event.target.value)} disabled={loading}>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>{location.name}</option>
                ))}
              </select>
            </label>
            <div className="level-grid">
              {levelOptions.length ? levelOptions.map((level) => (
                <button className="level-button" key={level} onClick={() => selectLevel(level)}>
                  <span>Level {level}</span>
                  <small>{levelStats[level]?.maps || 0} map - {levelStats[level]?.physicalSlots || 0} slots</small>
                  <dl className="level-stats">
                    <div><dt>Capacity</dt><dd>{levelStats[level]?.totalCapacity || 0}</dd></div>
                    <div><dt>Empty</dt><dd>{levelStats[level]?.availableCapacity || 0}</dd></div>
                    <div><dt>Booked</dt><dd>{levelStats[level]?.bookedCapacity || 0}</dd></div>
                    <div><dt>Partial</dt><dd>{levelStats[level]?.partialSlots || 0}</dd></div>
                  </dl>
                </button>
              )) : <p className="empty">No level maps uploaded yet.</p>}
            </div>
            {userActiveBooking && (
              <p className="message">Active booking: {userActiveBooking.slot.slotNo} on Level {userActiveBooking.map.parkingLevel}.</p>
            )}
            <p className="message">{message}</p>
          </div>
        </section>
        <Toast toast={toast} onClose={() => setToast(null)} />
      </main>
    );
  }

  return (
    <main className="user-map-shell">
      <header className="map-topbar">
        <div>
          <p className="eyebrow">{activeLocation?.name || "Location"}</p>
          <h1>Level {selectedLevel} Parking</h1>
        </div>
        <nav className="top-actions">
          <button className="ghost inline-action" onClick={() => { setSelectedLevel(""); setSelectedSlotId(""); }}>Levels</button>
          <button className="ghost inline-action" onClick={logout}>Logout</button>
        </nav>
      </header>

      <section className="user-map-view">
        <div className="floating-levels">
          {levelOptions.map((level) => (
            <button key={level} className={String(level) === selectedLevel ? "active" : ""} onClick={() => selectLevel(level)}>
              L{level}
            </button>
          ))}
        </div>

        {levelMaps.length > 1 && (
          <div className="floating-maps">
            {levelMaps.map((map) => (
              <button key={map.id} className={map.id === activeMap?.id ? "active" : ""} onClick={() => selectMap(map.id)}>
                {map.name}
              </button>
            ))}
          </div>
        )}

        <aside className="booking-panel top-booking">
          <div className="selected-summary">
            <p className="section-label">Selected Slot</p>
            <h2>{selectedSlot ? selectedSlot.slotNo : "Click a slot"}</h2>
          </div>
          <dl className="details">
            <div><dt>Phone</dt><dd>{sessionMobile}</dd></div>
            <div><dt>Level</dt><dd>{selectedLevel}</dd></div>
            <div><dt>Map</dt><dd>{activeMap?.name || "-"}</dd></div>
            <div><dt>Status</dt><dd>{selectedSlot?.occupancyStatus || selectedSlot?.status || "-"}</dd></div>
            {selectedLevelBooking && <div><dt>Booked By</dt><dd>{selectedLevelBooking.allottee}</dd></div>}
            {selectedLevelBooking?.createdAt && <div><dt>Booked At</dt><dd>{formatDateTime(selectedLevelBooking.createdAt)}</dd></div>}
          </dl>

          {selectedSlot?.levels?.length > 1 && (
            <label>
              Stack Position
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
            Name
            <input value={allottee} onChange={(event) => setAllottee(event.target.value)} placeholder="Your name" />
          </label>
          <button className="primary" onClick={bookSlot} disabled={!canBookSelectedSlot}>
            {pendingAction === "book" ? "Booking..." : "Book Parking"}
          </button>
          <button className="secondary" onClick={releaseSlot} disabled={!canReleaseSelectedSlot}>
            {pendingAction === "release" ? "Releasing..." : "Release My Slot"}
          </button>
          <p className="message">{userActiveBooking ? `Active booking ${userActiveBooking.slot.slotNo}.` : message}</p>
        </aside>

        {activeMap ? (
          <div className="map-stage user-stage">
            <div className="map-frame" onClick={clearSelection}>
              {isPdfMap(activeMap.file) ? (
                <iframe title={activeMap.name} src={`${activeMap.file}#toolbar=0&navpanes=0&view=FitH`} />
              ) : (
                <img className="map-image" src={activeMap.file} alt={activeMap.name} />
              )}
              <div className="slot-layer" aria-label="Clickable parking slots">
                {activeMap.slots.map((slot) => (
                  <button
                    key={slot.id}
                    className={`slot ${slot.occupancyStatus || slot.status} ${selectedSlotId === slot.id ? "is-selected" : ""}`}
                    style={{ left: `${slot.x}%`, top: `${slot.y}%`, width: `${slot.w}%`, height: `${slot.h}%` }}
                    onClick={(event) => {
                      event.stopPropagation();
                      selectSlot(slot);
                    }}
                    title={`${slot.slotNo} ${slot.occupancyStatus || slot.status}`}
                  >
                    {slot.slotNo}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-map">No map uploaded for this level.</div>
        )}
      </section>
      <Toast toast={toast} onClose={() => setToast(null)} />
      {bookingConfirmation && (
        <BookingConfirmModal
          booking={bookingConfirmation}
          pending={pendingAction === "book"}
          onCancel={() => setBookingConfirmation(null)}
          onConfirm={confirmBooking}
        />
      )}
    </main>
  );
}

function BookingConfirmModal({ booking, pending, onCancel, onConfirm }) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={pending ? undefined : onCancel}>
      <section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="booking-confirm-title" onClick={(event) => event.stopPropagation()}>
        <p className="section-label">Confirm Booking</p>
        <h2 id="booking-confirm-title">{booking.slotNo}</h2>
        <dl className="confirm-details">
          <div><dt>Name</dt><dd>{booking.allottee}</dd></div>
          <div><dt>Phone</dt><dd>{booking.mobile}</dd></div>
          <div><dt>Level</dt><dd>{booking.parkingLevel}</dd></div>
          <div><dt>Map</dt><dd>{booking.map || "-"}</dd></div>
          <div><dt>Stack Position</dt><dd>{booking.bookingLevel}</dd></div>
        </dl>
        <p className="message">Please confirm before we reserve this parking slot.</p>
        <div className="modal-actions">
          <button className="ghost" type="button" onClick={onCancel} disabled={pending}>Cancel</button>
          <button className="primary" type="button" onClick={onConfirm} disabled={pending}>
            {pending ? "Booking..." : "Confirm Booking"}
          </button>
        </div>
      </section>
    </div>
  );
}

function isPdfMap(file) {
  return String(file || "").toLowerCase().endsWith(".pdf");
}

function getUserSession() {
  try {
    const session = JSON.parse(localStorage.getItem("parking-auth") || "{}");
    const mobile = String(session.mobile || session.phone || session.name || "").replace(/\D/g, "");
    if (session.role === "user" && /^[0-9]{10}$/.test(mobile)) {
      return { role: "user", mobile };
    }
  } catch {
    return null;
  }
  return null;
}

function getBookingForLevel(slot, level) {
  const normalizedLevel = slot.levels?.length > 1 ? level : "Single";
  return slot.bookings?.find((booking) => (booking.level || "Single") === normalizedLevel);
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function downloadBookingReceipt(receipt) {
  const lines = [
    "Parking Booking Receipt",
    "",
    `Receipt No: ${receipt.bookingId || "PENDING"}`,
    `Name: ${receipt.name}`,
    `Phone: ${receipt.mobile}`,
    `Location: ${receipt.location}`,
    `Map: ${receipt.map}`,
    `Parking Level: ${receipt.parkingLevel}`,
    `Slot: ${receipt.slotNo}`,
    `Stack Position: ${receipt.stackLevel}`,
    `Booked At: ${formatDateTime(receipt.bookedAt)}`
  ];
  const content = lines.map((line, index) => `BT /F1 ${index === 0 ? 18 : 12} Tf 72 ${760 - index * 26} Td (${escapePdfText(line)}) Tj ET`).join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `parking-receipt-${receipt.slotNo}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapePdfText(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
