# Farbblitz ⚡

Ein schnelles Reaktionsspiel fürs iPhone: Finde blitzschnell das eine leere Feld, das eine Dreierreihe macht – solo oder mit bis zu 4 Spielern reihum.

## Aufs iPhone holen
1. Die Spiel-URL (z. B. über GitHub Pages) in **Safari** öffnen.
2. Teilen-Symbol → **„Zum Home-Bildschirm“**.
3. Farbblitz startet jetzt im Vollbild wie eine App und funktioniert auch offline.

## Regeln
- Zwei Spielfelder: **Gitter** mit 13 Rauten im Muster 3-2-3-2-3 oder klassisch **3×3**.
- Auf dem Spielfeld ploppen alle Farben **gleichzeitig** auf und **bleiben stehen**; einige Felder bleiben leer.
- Genau **ein leeres Feld** ergibt eine Dreierreihe (waagrecht, senkrecht, diagonal) – und das nur mit **einer** Farbe. Tippe es an!
- **3 Sekunden** pro Zug, auf **Schwer 2 Sekunden**. Ist die Zeit um, wird das richtige Feld gezeigt.
- Falsches Feld oder Zeit abgelaufen = Fehler. **3 Fehler** und du bist raus.
- **9 Level** mit je 10 Zügen in **3 Schwierigkeitsstufen**: mehr Farben und mehr leere Felder.
- **Solo:** Schaffe alle 9 Level in möglichst kurzer Gesamtzeit. Der Rekord wird gespeichert.
- **Mehrspieler (2–4):** Das iPhone wird reihum weitergegeben. Wer ein Level am schnellsten schafft, bekommt einen Punkt. Wer 3 Fehler hat, scheidet aus.

## Technik
Reines HTML/CSS/JavaScript ohne Abhängigkeiten, als Progressive Web App (Manifest + Service Worker).
Lokal starten:

```bash
python3 -m http.server 8000
```
