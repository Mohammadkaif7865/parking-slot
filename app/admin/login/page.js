"use client";

import { useState } from "react";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("Enter admin password to continue.");

  async function login(event) {
    event.preventDefault();
    setPending(true);
    try {
      const response = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "Invalid admin password.");
        return;
      }
      localStorage.setItem("parking-auth", JSON.stringify(data.admin));
      window.location.href = "/admin";
    } catch (error) {
      setMessage(`Admin login failed: ${error.message}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={login}>
        <p className="eyebrow">Admin Login</p>
        <h1>Map Management</h1>
        <label>
          Password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Admin password" />
        </label>
        <button className="primary" disabled={pending}>{pending ? "Checking..." : "Login"}</button>
        <p className="message">{message}</p>
        <p className="message"><a href="/login">User login</a></p>
      </form>
    </main>
  );
}

