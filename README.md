# Farbblitz ⚡

Ein schnelles Reaktionsspiel fürs iPhone: Finde blitzschnell das eine leere Feld, das eine Dreierreihe macht.

## Aufs iPhone holen
1. Die Spiel-URL (z. B. über GitHub Pages) in **Safari** öffnen.
2. Teilen-Symbol → **„Zum Home-Bildschirm“**.
3. Farbblitz startet jetzt im Vollbild wie eine App und funktioniert auch offline.

## Grundregel
- Auf dem Spielfeld ploppen alle Farben **gleichzeitig** auf und **bleiben stehen**; einige Felder bleiben leer.
- Genau **ein leeres Feld** ergibt eine Dreierreihe (waagrecht, senkrecht, diagonal) – und das nur mit **einer** Farbe. Tippe es an!
- Falsches Feld oder Zeit abgelaufen = Fehler. Ist die Zeit um, wird das richtige Feld gezeigt.
- Spielfeld: 13 Rauten im Muster 3-2-3-2-3.

## Modi
- **Klassik:** 9 Level à 10 Züge, 3 s pro Zug (Schwer: 2 s), 3 Fehler = raus.
- **Chaos:** Endlos – Start mit **4 s** pro Zug, jeder Treffer macht es schneller (bis 1,2 s). Punkte für Tempo, **Combo-Multiplikator** bis ×5, **Blitz-Treffer** unter 1 s zählen doppelt. 3 Leben, Highscore wird gespeichert. Alle 6 Treffer steigt die Stufe: mehr Farben, mehr Lücken, ab Stufe 4 **Täuschungen** und nach und nach **Sonderzüge**:
  - 🌈 **Joker** (ab Stufe 2): Ein Regenbogenfeld zählt als jede Farbe.
  - ✌️ **Doppelzug** (ab Stufe 3): Zwei Lücken – beide finden.
  - 🌀 **Dreher** (ab Stufe 4): Das Feld dreht sich.
  - 🌑 **Blackout** (ab Stufe 5): Die Farben verschwinden nach 1 s.
- **Zeitjagd:** 30 s auf der Uhr. Treffer **+1,5 s**, Fehler **−2 s**. Punkte wie bei Chaos.
- **Duell:** Zwei Spieler gleichzeitig, iPhone flach zwischen euch (die obere Hälfte ist gedreht). Wer zuerst richtig tippt, punktet; wer falsch tippt, ist für den Zug gesperrt. Ein **Blitz-Treffer sabotiert** den Gegner – sein Feld bleibt im nächsten Zug 1 s verdeckt. Wer zuerst 7 Punkte hat, gewinnt.

## Technik
Reines HTML/CSS/JavaScript ohne Abhängigkeiten, als Progressive Web App (Manifest + Service Worker).
Lokal starten:

```bash
python3 -m http.server 8000
```
