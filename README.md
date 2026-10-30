# Farbblitz ⚡

Ein schnelles Reaktionsspiel fürs iPhone: Finde blitzschnell das eine leere Feld, das eine Dreierreihe macht – solo oder mit bis zu 4 Spielern reihum.

## Aufs iPhone holen
1. Die Spiel-URL (z. B. über GitHub Pages) in **Safari** öffnen.
2. Teilen-Symbol → **„Zum Home-Bildschirm“**.
3. Farbblitz startet jetzt im Vollbild wie eine App und funktioniert auch offline.

## Grundregel
- Auf dem Spielfeld ploppen alle Farben **gleichzeitig** auf und **bleiben stehen**; einige Felder bleiben leer.
- Genau **ein leeres Feld** ergibt eine Dreierreihe (waagrecht, senkrecht, diagonal) – und das nur mit **einer** Farbe. Tippe es an!
- Falsches Feld oder Zeit abgelaufen = Fehler. Ist die Zeit um, wird das richtige Feld gezeigt.
- Zwei Spielfelder: **Gitter** mit 13 Rauten im Muster 3-2-3-2-3 oder klassisch **3×3**.

## Modi
- **Klassik:** 9 Level à 10 Züge, 3 s pro Zug (Schwer: 2 s), 3 Fehler = raus. Solo oder bis zu 4 Spieler reihum – wer ein Level am schnellsten schafft, bekommt den Punkt.
- **Chaos:** Wie Klassik, plus Sonderzüge:
  - 🌈 **Joker** (ab Level 2): Ein Regenbogenfeld zählt als jede Farbe.
  - ✌️ **Doppelzug** (ab Level 3): Zwei Lücken – beide finden.
  - 🌀 **Dreher** (ab Level 4): Das Feld dreht sich.
  - 🌑 **Blackout** (ab Level 5): Die Farben verschwinden nach 1 s.
  - Ab Level 4 **Täuschungen** (zwei gleiche Farben, deren drittes Feld schon belegt ist).
  - Level 3 und 6 sind **Bonus-Level**: 20 Züge ohne Zeitlimit, Fehler kosten +2 s statt eines Lebens.
- **Endlos:** Start mit **4 s** pro Zug, jeder Treffer macht es schneller (bis 1,2 s). Punkte für Tempo, **Combo-Multiplikator** bis ×5, **Blitz-Treffer** unter 1 s zählen doppelt. 3 Leben, Highscore wird gespeichert.
- **Zeitjagd:** 30 s auf der Uhr. Treffer **+1,5 s**, Fehler **−2 s**. Punkte wie bei Endlos.
- **Duell:** Zwei Spieler gleichzeitig, iPhone flach zwischen euch (die obere Hälfte ist gedreht). Wer zuerst richtig tippt, punktet; wer falsch tippt, ist für den Zug gesperrt. Ein **Blitz-Treffer sabotiert** den Gegner – sein Feld bleibt im nächsten Zug 1 s verdeckt. Wer zuerst 7 Punkte hat, gewinnt.

## Technik
Reines HTML/CSS/JavaScript ohne Abhängigkeiten, als Progressive Web App (Manifest + Service Worker).
Lokal starten:

```bash
python3 -m http.server 8000
```
