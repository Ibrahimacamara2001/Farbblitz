# Farbblitz ⚡

Ein schnelles Reaktionsspiel fürs iPhone: Schnapp dir die Zielfarbe auf dem 3×3-Feld und verbinde drei in einer Reihe – solo oder mit bis zu 4 Spielern reihum.

## Aufs iPhone holen
1. Die Spiel-URL (z. B. über GitHub Pages) in **Safari** öffnen.
2. Teilen-Symbol → **„Zum Home-Bildschirm“**.
3. Farbblitz startet jetzt im Vollbild wie eine App und funktioniert auch offline.

## Regeln
- Oben steht die **Zielfarbe**. Auf dem 3×3-Feld blitzen Felder in zufälligen Farben auf.
- Tippe ein Feld, **während** es in der Zielfarbe leuchtet – es gehört dann dir.
- Drei eigene Felder in einer Reihe (waagrecht, senkrecht, diagonal) = Level geschafft.
- Falscher Tipp = Fehler. **3 Fehler** und du bist raus.
- **9 Level** in **3 Schwierigkeitsstufen** (Leicht, Mittel, Schwer): Jedes Level ist schneller und hat mehr Farben.
  - Mittel/Schwer ab Level 4: Die Zielfarbe wechselt nach jedem Treffer.
  - Schwer ab Level 7: Eigene Felder erlöschen nach 4 Sekunden wieder.
- **Solo:** Schaffe alle 9 Level in möglichst kurzer Gesamtzeit. Der Rekord wird gespeichert.
- **Mehrspieler (2–4):** Das iPhone wird reihum weitergegeben. Wer ein Level am schnellsten schafft, bekommt einen Punkt. Wer 3 Fehler hat, scheidet aus.

## Technik
Reines HTML/CSS/JavaScript ohne Abhängigkeiten, als Progressive Web App (Manifest + Service Worker).
Lokal starten:

```bash
python3 -m http.server 8000
```
