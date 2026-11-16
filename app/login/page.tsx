"use client";
import { useState } from "react";

export default function Login() {
  const [pw, setPw] = useState("");
  const [fehler, setFehler] = useState("");
  const [laeuft, setLaeuft] = useState(false);

  async function anmelden(e: React.FormEvent) {
    e.preventDefault();
    setLaeuft(true);
    setFehler("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    setLaeuft(false);
    if (res.ok) window.location.href = "/";
    else setFehler((await res.json()).fehler ?? "Anmeldung fehlgeschlagen.");
  }

  return (
    <main>
      <h1>Fragebögen auswerten</h1>
      <p className="untertitel">Bitte mit dem Passwort anmelden.</p>
      <form className="karte" onSubmit={anmelden}>
        <label htmlFor="pw">Passwort</label>
        <input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        <div className="reihe" style={{ marginTop: 16 }}>
          <button className="haupt" disabled={!pw || laeuft}>Anmelden</button>
          {fehler && <span className="fehler">{fehler}</span>}
        </div>
      </form>
    </main>
  );
}
