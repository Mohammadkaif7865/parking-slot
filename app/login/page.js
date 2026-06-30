"use client";

import { useState } from "react";

export default function LoginPage() {
  const [role, setRole] = useState("user");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("Demo admin password is admin123.");

  function login(event) {
    event.preventDefault();

    if (role === "admin" && password !== "admin123") {
      setMessage("Invalid demo admin password.");
      return;
    }

    localStorage.setItem("parking-auth", JSON.stringify({ role, name: name || role }));
    window.location.href = role === "admin" ? "/admin" : "/";
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={login}>
        <p className="eyebrow">Demo Login</p>
        <h1>Smart Parking Portal</h1>
        <label>
          Role
          <select value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <label>
          Name / Mobile
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Demo User" />
        </label>
        {role === "admin" && (
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="admin123" />
          </label>
        )}
        <button className="primary">Continue</button>
        <p className="message">{message}</p>
      </form>
    </main>
  );
}
