"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import standardCodebuch from "@/data/codebuch.json";
import type { Ergebnis } from "@/lib/claude-typen";
import { excelBauen } from "@/lib/excel";
import { type SeitenQuelle, seitenAuflisten } from "@/lib/seiten";
import { SPALTEN, type Uebersprungen, type Zeile, zeileBauen } from "@/lib/zeilen";
import { type Veranstaltung, veranstaltungText } from "@/lib/zuordnung";
import { direktApi, SCHLUESSEL_SPEICHER, schluessel } from "@/lib/direkt";

/** GitHub-Pages-Version: kein Server, Aufrufe gehen direkt vom Browser an Claude. */
const NUR_BROWSER = process.env.NEXT_PUBLIC_NUR_BROWSER === "1";
const api = (url: string, init?: RequestInit) => (NUR_BROWSER ? direktApi(url, init) : fetch(url, init));

interface Seite {
  key: string;
  datei: string;
  seite: number;
  fileId?: string;
  ergebnis?: Ergebnis;
}

interface Auftrag {
  seiten: Seite[];
  batchId?: string;
  batchSeiten?: number;
  batchStand?: string;
  startId: string;
  festeVer: number | null;
}

const LEER: Auftrag = { seiten: [], startId: "", festeVer: null };
const SPEICHER = "fragebogen-auftrag-v1";
const SPEICHER_CODEBUCH = "fragebogen-codebuch-v1";

function laden<T>(key: string): T | null {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : null;
  } catch {
    return null;
  }
}
function speichern(key: string, wert: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(wert));
    return true;
  } catch {
    return false;
  }
}

async function postJson<T>(url: string, body: unknown): Promise<{ ok: boolean; status: number; daten: T }> {
  const res = await api(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const daten = (await res.json().catch(() => ({ fehler: `Serverfehler (${res.status})` }))) as T;
  return { ok: res.ok, status: res.status, daten };
}

/** Führt Aufgaben mit begrenzter Parallelität aus. */
async function parallel<T>(items: T[], n: number, fn: (x: T) => Promise<void>, stop: () => boolean) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length && !stop()) await fn(items[i++]);
    }),
  );
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

function dollar(cent: number) {
  return (cent / 100).toLocaleString("de-DE", { style: "currency", currency: "USD" });
}

export default function Startseite() {
  const [auftrag, setAuftrag] = useState<Auftrag>(LEER);
  const [geladen, setGeladen] = useState(false);
  const [codebuch, setCodebuch] = useState<Veranstaltung[]>(standardCodebuch as Veranstaltung[]);
  const [eigenesCodebuch, setEigenesCodebuch] = useState(false);
  const quellen = useRef(new Map<string, SeitenQuelle>());
  const [quellenAnzahl, setQuellenAnzahl] = useState(0);
  const [taetigkeit, setTaetigkeit] = useState<string | null>(null);
  const [fortschritt, setFortschritt] = useState<{ fertig: number; gesamt: number } | null>(null);
  const [meldung, setMeldung] = useState<{ text: string; art: "fehler" | "gut" | "leise" } | null>(null);
  const [speicherVoll, setSpeicherVoll] = useState(false);
  const abbrechen = useRef(false);

  // Auftrag aus dem Browser laden (überlebt Neuladen und Schließen des Tabs)
  useEffect(() => {
    const a = laden<Auftrag>(SPEICHER);
    if (a) setAuftrag(a);
    const cb = laden<Veranstaltung[]>(SPEICHER_CODEBUCH);
    if (cb?.length) {
      setCodebuch(cb);
      setEigenesCodebuch(true);
    }
    setGeladen(true);
  }, []);

  useEffect(() => {
    if (!geladen) return;
    const t = setTimeout(() => setSpeicherVoll(!speichern(SPEICHER, auftrag)), 300);
    return () => clearTimeout(t);
  }, [auftrag, geladen]);

  const aendern = useCallback((f: (a: Auftrag) => Auftrag) => setAuftrag((a) => f(a)), []);
  const seiteSetzen = useCallback(
    (key: string, teil: Partial<Seite>) =>
      aendern((a) => ({ ...a, seiten: a.seiten.map((s) => (s.key === key ? { ...s, ...teil } : s)) })),
    [aendern],
  );

  const festeVeranstaltung = useMemo(
    () => (auftrag.festeVer != null ? codebuch.find((v) => v.ver === auftrag.festeVer) ?? null : null),
    [auftrag.festeVer, codebuch],
  );

  // Zahlen für die Anzeige
  const seiten = auftrag.seiten;
  const hochgeladen = seiten.filter((s) => s.fileId).length;
  const fehltQuelle = seiten.filter((s) => !s.fileId && !quellen.current.has(s.key)).length;
  const ausgewertet = seiten.filter((s) => s.ergebnis?.ok).length;
  const fehlgeschlagen = seiten.filter((s) => s.ergebnis && !s.ergebnis.ok).length;
  const offen = seiten.filter((s) => s.fileId && !s.ergebnis?.ok);
  const batchLaeuft = !!auftrag.batchId;

  const { zeilen, uebersprungen } = useMemo(() => {
    const zeilen: Zeile[] = [];
    const uebersprungen: Uebersprungen[] = [];
    for (const s of seiten) {
      if (!s.ergebnis) continue;
      if (!s.ergebnis.ok) {
        uebersprungen.push({ datei: s.datei, seite: s.seite, grund: s.ergebnis.fehler });
      } else if (!s.ergebnis.daten.ist_fragebogen) {
        uebersprungen.push({ datei: s.datei, seite: s.seite, grund: "Kein Fragebogen: " + s.ergebnis.daten.hinweis });
      } else {
        zeilen.push(zeileBauen(s.ergebnis.daten, s, codebuch, festeVeranstaltung));
      }
    }
    return { zeilen, uebersprungen };
  }, [seiten, codebuch, festeVeranstaltung]);
  const zuPruefen = zeilen.filter((z) => z.pruefen.length).length;

  // ---- Schritt 1: Dateien auswählen
  async function dateienGewaehlt(liste: File[]) {
    if (!liste.length) return;
    setMeldung(null);
    setTaetigkeit("Dateien werden gelesen …");
    try {
      const neu = await seitenAuflisten(liste);
      for (const q of neu) quellen.current.set(q.key, q);
      setQuellenAnzahl(quellen.current.size);
      aendern((a) => {
        const da = new Set(a.seiten.map((s) => s.key));
        const dazu = neu.filter((q) => !da.has(q.key)).map((q) => ({ key: q.key, datei: q.datei, seite: q.seite }));
        return { ...a, seiten: [...a.seiten, ...dazu] };
      });
      setMeldung({ text: `${neu.length} Seiten aus ${liste.length} Datei(en) erkannt.`, art: "gut" });
    } catch (e) {
      setMeldung({ text: e instanceof Error ? e.message : String(e), art: "fehler" });
    } finally {
      setTaetigkeit(null);
    }
  }

  // ---- Schritt 2: Hochladen
  async function hochladen() {
    const todo = seiten.filter((s) => !s.fileId && quellen.current.has(s.key));
    if (!todo.length) return;
    abbrechen.current = false;
    setMeldung(null);
    setTaetigkeit("Seiten werden hochgeladen …");
    let fertig = 0;
    let fehler = 0;
    setFortschritt({ fertig, gesamt: todo.length });
    await parallel(
      todo,
      4,
      async (s) => {
        for (let versuch = 0; versuch < 3; versuch++) {
          try {
            const bild = await quellen.current.get(s.key)!.bild();
            const fd = new FormData();
            fd.append("bild", bild, `${s.datei.replace(/\.[^.]+$/, "")}-S${s.seite}.jpg`);
            fd.append("name", `${s.datei}-S${s.seite}.jpg`);
            const res = await api("/api/upload", { method: "POST", body: fd });
            const d = await res.json();
            if (res.ok && d.fileId) {
              seiteSetzen(s.key, { fileId: d.fileId });
              break;
            }
            if (res.status === 401) throw new Error("Abgemeldet. Bitte Seite neu laden und anmelden.");
            if (res.status < 500 && res.status !== 429) throw new Error(d.fehler ?? "Hochladen fehlgeschlagen.");
            await pause(2000 * (versuch + 1));
            if (versuch === 2) throw new Error(d.fehler ?? "Hochladen fehlgeschlagen.");
          } catch (e) {
            if (versuch === 2 || (e instanceof Error && !/fetch|network/i.test(e.message))) {
              fehler++;
              setMeldung({ text: `${s.datei} Seite ${s.seite}: ${e instanceof Error ? e.message : e}`, art: "fehler" });
              break;
            }
            await pause(2000 * (versuch + 1));
          }
        }
        setFortschritt({ fertig: ++fertig, gesamt: todo.length });
      },
      () => abbrechen.current,
    );
    setTaetigkeit(null);
    setFortschritt(null);
    if (!fehler && !abbrechen.current) setMeldung({ text: "Alle Seiten sind hochgeladen.", art: "gut" });
  }

  // ---- Schritt 3a: Sofort auswerten
  async function sofortAuswerten(nurDiese?: Seite[]) {
    const todo = nurDiese ?? offen;
    if (!todo.length) return;
    abbrechen.current = false;
    setMeldung(null);
    setTaetigkeit("Bögen werden gelesen …");
    let fertig = 0;
    setFortschritt({ fertig, gesamt: todo.length });
    await parallel(
      todo,
      3,
      async (s) => {
        let ergebnis: Ergebnis = { ok: false, fehler: "Nicht ausgewertet.", wiederholbar: true };
        for (let versuch = 0; versuch < 3; versuch++) {
          try {
            const { status, daten } = await postJson<Partial<Ergebnis> & { fehler?: string }>("/api/extract", { fileId: s.fileId });
            if (status === 401) {
              ergebnis = { ok: false, fehler: "Abgemeldet.", wiederholbar: true };
              abbrechen.current = true;
              break;
            }
            ergebnis =
              typeof daten.ok === "boolean"
                ? (daten as Ergebnis)
                : { ok: false, fehler: daten.fehler ?? "Fehler", wiederholbar: status >= 500 };
          } catch {
            ergebnis = { ok: false, fehler: "Keine Verbindung.", wiederholbar: true };
          }
          if (ergebnis.ok || !ergebnis.wiederholbar) break;
          await pause(3000 * (versuch + 1));
        }
        seiteSetzen(s.key, { ergebnis });
        setFortschritt({ fertig: ++fertig, gesamt: todo.length });
      },
      () => abbrechen.current,
    );
    setTaetigkeit(null);
    setFortschritt(null);
  }

  // ---- Schritt 3b: Sammelauftrag
  async function sammelauftragStarten() {
    const ids = offen.map((s) => s.fileId!);
    if (!ids.length) return;
    setMeldung(null);
    setTaetigkeit("Sammelauftrag wird angelegt …");
    const { ok, daten } = await postJson<{ batchId?: string; fehler?: string }>("/api/batch", { fileIds: ids });
    setTaetigkeit(null);
    if (!ok || !daten.batchId) {
      setMeldung({ text: daten.fehler ?? "Sammelauftrag konnte nicht angelegt werden.", art: "fehler" });
      return;
    }
    aendern((a) => ({ ...a, batchId: daten.batchId, batchSeiten: ids.length, batchStand: "Gestartet" }));
  }

  const batchPruefen = useCallback(async () => {
    const id = auftrag.batchId;
    if (!id) return;
    const res = await api(`/api/batch/${encodeURIComponent(id)}`);
    const d = await res.json();
    if (!res.ok) {
      aendern((a) => ({ ...a, batchStand: d.fehler ?? "Stand unbekannt" }));
      return;
    }
    const z = d.zaehler;
    const erledigt = z.succeeded + z.errored + z.canceled + z.expired;
    if (d.status !== "ended") {
      aendern((a) => ({ ...a, batchStand: `In Arbeit: ${erledigt} von ${erledigt + z.processing} Seiten fertig` }));
      return;
    }
    aendern((a) => ({ ...a, batchStand: "Fertig, Ergebnisse werden abgeholt …" }));
    const r = await api(`/api/batch/${encodeURIComponent(id)}/results`);
    const e = await r.json();
    if (!r.ok) {
      aendern((a) => ({ ...a, batchStand: e.fehler ?? "Ergebnisse konnten nicht abgeholt werden." }));
      return;
    }
    if (e.mock) {
      aendern((a) => ({ ...a, batchId: undefined, batchStand: undefined }));
      await sofortAuswerten();
      return;
    }
    const ergebnisse = e.ergebnisse as Record<string, Ergebnis>;
    aendern((a) => ({
      ...a,
      batchId: undefined,
      batchStand: undefined,
      seiten: a.seiten.map((s) => (s.fileId && ergebnisse[s.fileId] ? { ...s, ergebnis: ergebnisse[s.fileId] } : s)),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auftrag.batchId, aendern]);

  // Während ein Sammelauftrag läuft, jede Minute nachsehen
  useEffect(() => {
    if (!auftrag.batchId) return;
    batchPruefen();
    const t = setInterval(batchPruefen, 60_000);
    return () => clearInterval(t);
  }, [auftrag.batchId, batchPruefen]);

  // ---- Schritt 4: Excel
  async function excelHerunterladen() {
    setTaetigkeit("Excel-Datei wird erstellt …");
    try {
      const start = auftrag.startId.trim() ? parseInt(auftrag.startId, 10) : null;
      const blob = await excelBauen(zeilen, uebersprungen, Number.isFinite(start) ? start : null);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `fragebogen-auswertung-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    } catch (e) {
      setMeldung({ text: "Excel konnte nicht erstellt werden: " + (e instanceof Error ? e.message : e), art: "fehler" });
    } finally {
      setTaetigkeit(null);
    }
  }

  // ---- Schritt 5: Aufräumen
  async function bilderLoeschen() {
    const ids = seiten.filter((s) => s.fileId).map((s) => s.fileId!);
    if (!ids.length) return;
    if (!window.confirm(`${ids.length} hochgeladene Seitenbilder bei Anthropic löschen? Die Ergebnisse bleiben erhalten.`)) return;
    setTaetigkeit("Bilder werden gelöscht …");
    let fehler = 0;
    for (let i = 0; i < ids.length; i += 200) {
      const { daten } = await postJson<{ fehlgeschlagen?: number }>("/api/cleanup", { fileIds: ids.slice(i, i + 200) });
      fehler += daten.fehlgeschlagen ?? 0;
      setFortschritt({ fertig: Math.min(i + 200, ids.length), gesamt: ids.length });
    }
    aendern((a) => ({ ...a, seiten: a.seiten.map((s) => ({ ...s, fileId: undefined })) }));
    setTaetigkeit(null);
    setFortschritt(null);
    setMeldung(
      fehler
        ? { text: `${fehler} Bilder konnten nicht gelöscht werden; sie verfallen nach 7 Tagen von selbst.`, art: "fehler" }
        : { text: "Alle Bilder sind gelöscht.", art: "gut" },
    );
  }

  function neuerAuftrag() {
    if (!window.confirm("Alles zurücksetzen? Die Ergebnisse dieses Auftrags gehen verloren (Excel vorher herunterladen).")) return;
    quellen.current.clear();
    setQuellenAnzahl(0);
    setAuftrag({ ...LEER, festeVer: null });
    setMeldung(null);
  }

  async function codebuchLaden(f: File | undefined) {
    if (!f) return;
    try {
      const ExcelJS = (await import("exceljs")).default;
      const { parseCodebuchWorkbook } = await import("@/lib/codebuch-parse.mjs");
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await f.arrayBuffer());
      const cb = parseCodebuchWorkbook(wb) as Veranstaltung[];
      if (!cb.length) throw new Error("Keine Veranstaltungen gefunden.");
      setCodebuch(cb);
      setEigenesCodebuch(true);
      speichern(SPEICHER_CODEBUCH, cb);
      setMeldung({ text: `Codebuch mit ${cb.length} Veranstaltungen geladen.`, art: "gut" });
    } catch (e) {
      setMeldung({ text: "Codebuch konnte nicht gelesen werden: " + (e instanceof Error ? e.message : e), art: "fehler" });
    }
  }

  const beschaeftigt = taetigkeit !== null;
  const prozent = fortschritt ? Math.round((100 * fortschritt.fertig) / Math.max(1, fortschritt.gesamt)) : 0;
  const nOffen = offen.length;

  return (
    <main>
      <h1>Fragebögen auswerten</h1>
      <p className="untertitel">
        Eingescannte Fragebögen hochladen, von Claude lesen lassen und als Excel-Tabelle herunterladen. Der Fortschritt
        bleibt in diesem Browser gespeichert.
      </p>

      {NUR_BROWSER && <SchluesselKarte />}

      {(taetigkeit || meldung) && (
        <div className="karte" role="status">
          {taetigkeit && <strong>{taetigkeit}</strong>}
          {fortschritt && (
            <>
              <div className="balken"><div style={{ width: `${prozent}%` }} /></div>
              <div className="reihe leise">
                {fortschritt.fertig} von {fortschritt.gesamt}
                <button onClick={() => (abbrechen.current = true)}>Anhalten</button>
              </div>
            </>
          )}
          {meldung && <div className={meldung.art}>{meldung.text}</div>}
        </div>
      )}
      {speicherVoll && (
        <div className="karte fehler">
          Der Browser-Speicher ist voll; der Fortschritt wird nicht mehr gesichert. Bitte jetzt die Excel-Datei
          herunterladen und danach einen neuen Auftrag beginnen.
        </div>
      )}

      <section className="karte">
        <h2><span className={`schritt ${seiten.length ? "fertig" : ""}`}>1</span> Scans auswählen</h2>
        <p className="leise" style={{ marginTop: 0 }}>
          PDF-Dateien (auch mehrseitig) oder Bilder (JPG, PNG). Eine Seite = ein Fragebogen. Man kann mehrmals Dateien
          hinzufügen.
        </p>
        <input type="file" multiple accept="application/pdf,image/jpeg,image/png" disabled={beschaeftigt || batchLaeuft}
          onChange={(e) => { dateienGewaehlt(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
        {seiten.length > 0 && (
          <p>
            <strong>{seiten.length} Seiten</strong> im Auftrag
            {fehltQuelle > 0 && (
              <span className="fehler"> · {fehltQuelle} noch nicht hochgeladen: bitte dieselben Dateien noch einmal auswählen</span>
            )}
          </p>
        )}
        <label htmlFor="ver">Veranstaltung</label>
        <select id="ver" value={auftrag.festeVer ?? ""} disabled={beschaeftigt}
          onChange={(e) => aendern((a) => ({ ...a, festeVer: e.target.value ? Number(e.target.value) : null }))}>
          <option value="">Automatisch vom Bogen ablesen (empfohlen)</option>
          {codebuch.map((v) => (
            <option key={v.ver} value={v.ver}>{veranstaltungText(v)}</option>
          ))}
        </select>
        <label htmlFor="start">Erste ID (optional)</label>
        <input id="start" type="number" min={1} placeholder="z. B. die nächste freie Nummer in der Eingabetabelle"
          value={auftrag.startId} onChange={(e) => aendern((a) => ({ ...a, startId: e.target.value }))} />
        <details style={{ marginTop: 12 }}>
          <summary>Codebuch ({eigenesCodebuch ? "eigenes" : "2026"}, {codebuch.length} Veranstaltungen)</summary>
          <p className="leise">
            Ver26, ort26, typ, datum und titel werden aus dem Codebuch übernommen. Für ein anderes Jahr hier die neue
            Codebuch-Datei laden (gleiche Spaltennamen wie 2026).
          </p>
          <input type="file" accept=".xlsx" onChange={(e) => { codebuchLaden(e.target.files?.[0]); e.target.value = ""; }} />
          {eigenesCodebuch && (
            <button style={{ marginLeft: 8 }} onClick={() => {
              localStorage.removeItem(SPEICHER_CODEBUCH);
              setCodebuch(standardCodebuch as Veranstaltung[]);
              setEigenesCodebuch(false);
            }}>Codebuch 2026 verwenden</button>
          )}
        </details>
      </section>

      <section className={`karte ${!seiten.length ? "aus" : ""}`}>
        <h2><span className={`schritt ${seiten.length && hochgeladen === seiten.length ? "fertig" : ""}`}>2</span> Hochladen</h2>
        <p className="leise" style={{ marginTop: 0 }}>
          {NUR_BROWSER
            ? "Jede Seite wird verkleinert und für die Auswertung bereitgelegt."
            : "Jede Seite wird verkleinert und zur Auswertung an Claude (Anthropic) übertragen."} Bitte das Fenster offen
          lassen, bis alles hochgeladen ist (etwa 1 Minute pro 100 Seiten).
        </p>
        <div className="reihe">
          <button className="haupt" onClick={hochladen}
            disabled={beschaeftigt || batchLaeuft || seiten.filter((s) => !s.fileId && quellen.current.has(s.key)).length === 0}>
            Seiten hochladen
          </button>
          <span>{hochgeladen} von {seiten.length} hochgeladen</span>
        </div>
        {quellenAnzahl === 0 && seiten.length > hochgeladen && (
          <p className="fehler">Nach dem Neuladen der Seite bitte die Dateien noch einmal auswählen; bereits hochgeladene Seiten werden übersprungen.</p>
        )}
      </section>

      <section className={`karte ${!hochgeladen ? "aus" : ""}`}>
        <h2><span className={`schritt ${hochgeladen && !nOffen ? "fertig" : ""}`}>3</span> Auswerten</h2>
        {batchLaeuft ? (
          <div>
            <p><strong>Sammelauftrag läuft</strong> ({auftrag.batchSeiten} Seiten). {auftrag.batchStand}</p>
            <p className="leise">
              Das dauert meist unter einer Stunde, höchstens 24 Stunden. Das Fenster darf geschlossen werden; beim
              nächsten Öffnen dieser Seite wird automatisch weitergemacht.
            </p>
            <button onClick={batchPruefen} disabled={beschaeftigt}>Jetzt nachsehen</button>
          </div>
        ) : (
          <>
            <p style={{ marginTop: 0 }}>{nOffen} Seiten warten auf die Auswertung.</p>
            <div className="wahl">
              <div>
                <h3>Sofort</h3>
                <p className="leise">Für Tests und kleine Mengen (bis etwa 100 Seiten). Ergebnis nach wenigen Minuten, Fenster offen lassen.</p>
                <p className="leise">Kosten ca. {dollar(nOffen * 3.5)} (Schätzung)</p>
                <button className="haupt" onClick={() => sofortAuswerten()} disabled={beschaeftigt || !nOffen}>Sofort auswerten</button>
              </div>
              {!NUR_BROWSER && <div>
                <h3>Sammelauftrag</h3>
                <p className="leise">Für große Mengen. Halber Preis, dauert meist unter einer Stunde. Fenster darf geschlossen werden.</p>
                <p className="leise">Kosten ca. {dollar(nOffen * 1.75)} (Schätzung)</p>
                <button className="haupt" onClick={sammelauftragStarten} disabled={beschaeftigt || !nOffen}>Sammelauftrag starten</button>
              </div>}
            </div>
          </>
        )}
      </section>

      <section className={`karte ${!ausgewertet && !fehlgeschlagen ? "aus" : ""}`}>
        <h2><span className={`schritt ${ausgewertet ? "fertig" : ""}`}>4</span> Excel herunterladen</h2>
        <p style={{ marginTop: 0 }}>
          <strong>{zeilen.length}</strong> Bögen ausgewertet
          {zuPruefen > 0 && <>, davon <strong>{zuPruefen}</strong> mit gelb markierten Feldern zum Nachprüfen</>}
          {uebersprungen.length > 0 && <>; <span className="fehler">{uebersprungen.length} Seiten ohne Ergebnis</span></>}.
        </p>
        <div className="reihe">
          <button className="haupt" onClick={excelHerunterladen} disabled={beschaeftigt || !zeilen.length}>Excel herunterladen</button>
          {fehlgeschlagen > 0 && !batchLaeuft && (
            <button disabled={beschaeftigt}
              onClick={() => sofortAuswerten(seiten.filter((s) => s.fileId && s.ergebnis && !s.ergebnis.ok))}>
              {fehlgeschlagen} fehlgeschlagene Seiten erneut versuchen
            </button>
          )}
        </div>
        {zeilen.length > 0 && <Vorschau zeilen={zeilen.slice(0, 15)} />}
      </section>

      <section className="karte">
        <h2><span className="schritt">5</span> Aufräumen</h2>
        <p className="leise" style={{ marginTop: 0 }}>
          Die Bilder liegen bei Anthropic und werden nach 7 Tagen automatisch gelöscht. Nach dem Herunterladen kann man
          sie auch sofort löschen.
        </p>
        <div className="reihe">
          <button onClick={bilderLoeschen} disabled={beschaeftigt || batchLaeuft || !hochgeladen}>Bilder jetzt löschen</button>
          <button onClick={neuerAuftrag} disabled={beschaeftigt}>Neuen Auftrag beginnen</button>
        </div>
      </section>
    </main>
  );
}

function SchluesselKarte() {
  const [wert, setWert] = useState("");
  const [gespeichert, setGespeichert] = useState(false);
  useEffect(() => setGespeichert(!!schluessel()), []);
  return (
    <section className="karte">
      <h2>API-Schlüssel</h2>
      {gespeichert ? (
        <div className="reihe">
          <span className="gut">Schlüssel ist in diesem Browser gespeichert.</span>
          <button onClick={() => { try { localStorage.removeItem(SCHLUESSEL_SPEICHER); } catch {} setGespeichert(false); }}>
            Schlüssel entfernen
          </button>
        </div>
      ) : (
        <>
          <p className="leise" style={{ marginTop: 0 }}>
            Testversion ohne Server: Der Schlüssel aus der Anthropic Console wird nur in diesem Browser gespeichert und
            direkt an Anthropic geschickt. Nur auf dem eigenen Rechner verwenden.
          </p>
          <div className="reihe">
            <input type="password" placeholder="sk-ant-…" value={wert} onChange={(e) => setWert(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
            <button className="haupt" disabled={!wert.trim().startsWith("sk-")}
              onClick={() => { try { localStorage.setItem(SCHLUESSEL_SPEICHER, wert.trim()); } catch {} setWert(""); setGespeichert(true); }}>
              Speichern
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function Vorschau({ zeilen }: { zeilen: Zeile[] }) {
  const spalten = SPALTEN.filter((s) => s !== "ID");
  return (
    <div className="tabelle">
      <p className="leise">Vorschau der ersten Zeilen (gelb = bitte prüfen):</p>
      <table>
        <thead>
          <tr>
            <th>Seite</th>
            {spalten.map((s) => <th key={s}>{s}</th>)}
          </tr>
        </thead>
        <tbody>
          {zeilen.map((z) => (
            <tr key={z.datei + z.seite}>
              <td>{z.seite}</td>
              {spalten.map((s) => {
                const w = z.werte[s];
                const text = w instanceof Date ? w.toLocaleDateString("de-DE", { timeZone: "UTC" }) : w ?? "";
                const t = String(text);
                return (
                  <td key={s} className={z.pruefen.includes(s) ? "unsicher" : ""} title={t}>
                    {t.length > 30 ? t.slice(0, 30) + "…" : t}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
