# PhotoBridge na Linuxu

Samostatný návod. Windowsová verze se nemění a nic z toho, co je tady, se jí
netýká — proto je to zvlášť a ne v hlavním manuálu.

Stav k 10. 8. 2026, PhotoBridge v3.1.77.

---

> ## ⛔ NEŽ NĚCO ZMĚNÍŠ — PŘEČTI SI TOHLE
>
> **Platí pro člověka i pro AI. Není to doporučení, je to podmínka.**

```diff
- ! NIKDY neupravuj existující windowsové volání „aby fungovalo všude".
-   VŽDY přidej druhou větev vedle něj:
-
-       if (process.platform !== 'win32') {
-           // nová linuxová cesta
-           return;
-       }
-       // původní windowsový kód, BEZE ZMĚNY
-
-   Když rozbiješ updater na Windows, NEJDE poslat opravu aktualizací.
-   Musela by se kopírovat ručně do resources\app na každém PC.
-
- ! VŽDY testuj obě platformy. Rozdílový balíček je pro obě společný.
-
- ! Verze v package.json je SPOLEČNÁ pro Windows i Linux.
-   Když se čísla rozejdou, jedna platforma bude nabízet aktualizaci donekonečna.
-
- ! Nový spawn() = ověř, že ten program na Linuxu existuje.
-   Seznam míst, kde už větvení je:  grep -rn "process.platform" src/main/
```

---


## Obsah

| | Kapitola |
|---|---|
| 1 | Zásada: Windows se nesmí rozbít |
| 2 | Co se liší proti Windows |
| 3 | Co Linux potřebuje navíc |
| 4 | Sestavení balíčku |
| 5 | Instalace a spuštění |
| 6 | Aktualizace |
| 7 | Kde jsou soubory |
| 8 | Řešení potíží |
| 9 | Na co si dát pozor při dalších úpravách |

---

## 1. Zásada: Windows se nesmí rozbít

Podpora Linusu je udělaná tak, že **windowsová větev zůstala nedotčená**.
Nikde se nepřepisoval původní kód — všude přibyla odbočka vedle něj:

```js
if (process.platform !== 'win32') {
    // nová linuxová cesta
    return;
}
// původní windowsový kód, beze změny
```

Kdyby se v budoucnu na Linuxu něco doplňovalo, **drž se stejného vzoru.**
Nikdy neupravuj existující windowsové volání „aby fungovalo všude“ — přidej
vedle něj druhou větev. Na Windows se pak nemá co pokazit.

---

## 2. Co se liší proti Windows

| Oblast | Windows | Linux |
|---|---|---|
| Restart po aktualizaci | `.bat` + `PhotoBridgeUpdater.exe` | shell skript |
| Rozbalení balíčku | PowerShell `Expand-Archive` | `unzip` |
| Obnova ze zálohy | PowerShell přes UAC | shell, bez povyšování práv |
| Obnova po pádu | `PB_restore.bat` | `PB_restore.sh` |
| Balení diagnostiky | PowerShell | `zip` |
| Editor fotek | Malování nebo vestavěný | **vždy vestavěný** |
| Tisk z editoru | `mspaint /p` – tiskne rovnou | otevře obrázek v systému, tisk ručně |
| Výchozí cíl fotek | `M:\UploadScan` | `~/PhotoBridge/UploadScan` |
| Autostart | registry `HKCU\Run` | přeskakuje se |
| Firewall pravidlo | přidá se automaticky | přeskakuje se |
| Detekce tmavého režimu | z registry | přeskakuje se, použije se světlý |

### Co funguje úplně stejně

Přenos fotek z mobilu, QR kód, lokální server, fronta `pb_queue`, Supabase,
Realtime, ukládání do zakázek v RTS, přihlášení heslem i přes BRITEX,
vestavěný editor (kreslení, ořez, text, redakce), smazání účtu.

### Autostart

Na Linuxu se neřeší automaticky. Když ho chceš, vytvoř si soubor
`~/.config/autostart/photobridge.desktop`:

```ini
[Desktop Entry]
Type=Application
Name=PhotoBridge
Exec=/cesta/k/PhotoBridge-Linux-3.1.77.AppImage
X-GNOME-Autostart-enabled=true
```

---

## 3. Co Linux potřebuje navíc

```bash
sudo apt install unzip zip
```

Na většině distribucí už jsou. Bez `unzip` se nenainstaluje žádná aktualizace,
bez `zip` nepůjde vyexportovat diagnostika.

AppImage navíc potřebuje FUSE. Na novějších Ubuntu:

```bash
sudo apt install libfuse2
```

---

## 4. Sestavení balíčku

Na Linuxu (nebo ve WSL) ve složce se zdrojáky:

```bash
npm install
npm run build:linux
```

Výsledek v `dist/`:

```
PhotoBridge-Linux-3.1.77.AppImage      ← distribuovat tohle
linux-unpacked/                        ← rozbalená podoba, na ladění
```

Windows sestavení zůstává beze změny:

```bash
npm run build:win
```

Cíle jsou v `package.json` v sekci `build` oddělené — `win` a `linux` na sebe
nesahají. Spustitelný soubor na Linuxu se jmenuje **`PhotoBridge-Linux`**
(nastaveno přes `executableName`).

---

## 5. Instalace a spuštění

```bash
chmod +x PhotoBridge-Linux-3.1.77.AppImage
./PhotoBridge-Linux-3.1.77.AppImage
```

Při prvním spuštění nastav v Nastavení cílovou složku. Výchozí je
`~/PhotoBridge/UploadScan`, což pravděpodobně nebude to, co chceš — na Windows
je to síťový disk `M:`, tady si vyber podle toho, kam se má synchronizovat.

---

## 6. Aktualizace

**Rozdílové balíčky jsou společné pro obě platformy.** Obsahují jen soubory
`.js`, `.html` a `package.json`, které jsou přenositelné. Nic se nerozděluje,
`Update/` na GitHubu je jedna složka pro Windows i Linux.

Aktualizace tedy probíhá stejně: Nastavení → Zkontrolovat aktualizace.
Rozdíl je jen uvnitř — místo `.bat` se použije shell skript a místo
PowerShellu `unzip`.

**Plná instalace se ale liší.** Pro nové instalace jsou v Releases dva soubory:

- `PhotoBridge-Setup-<verze>.exe` — Windows
- `PhotoBridge-Linux-<verze>.AppImage` — Linux

Ty se **musí sestavit zvlášť** a nahrát oba. Rozdílový balíček tohle nenahradí.

---

## 7. Kde jsou soubory

| Co | Windows | Linux |
|---|---|---|
| Nastavení, session, logy | `%APPDATA%\PhotoBridge` | `~/.config/PhotoBridge` |
| Zálohy | vedle `.exe` | vedle AppImage |
| Dočasné soubory | `%TEMP%` | `/tmp` |
| Log restartu | `%TEMP%\photobridge_update.log` | `/tmp/photobridge_update.log` |

---

## 8. Řešení potíží

### Aplikace se nespustí

```bash
./PhotoBridge-Linux-3.1.77.AppImage --no-sandbox
```

Když pomůže `--no-sandbox`, chybí ti nastavení jmenných prostorů v jádře.
Trvalé řešení je nainstalovat `libfuse2` a mít AppImage na oddílu, kde se smí
spouštět (ne `noexec`).

### Aktualizace se stáhne, ale nenainstaluje

Nejspíš chybí `unzip`. V logu bude:

```
unzip exit code ... (je unzip nainstalovaný? apt install unzip)
```

### Aplikace se po aktualizaci nerestartuje

Zkontroluj `/tmp/photobridge_update.log`. Má tam být:

```
sh restart start (PID=...)
PID ... skoncil, spoustim aplikaci
HOTOVO
```

Když končí u prvního řádku, proces se neukončil do 60 sekund a skript to vzdal.
Spusť aplikaci ručně — soubory už jsou zkopírované, aktualizace proběhla.

### Fotky se neukládají

Zkontroluj práva k cílové složce:

```bash
ls -ld ~/PhotoBridge/UploadScan
```

Na Windows je cíl síťový disk, tady běžná složka — musí existovat a být
zapisovatelná.

### Tisk z editoru nic neudělá

To je čekané. Obrázek se otevře v systémové prohlížečce a tisk spustíš sám
(Ctrl+P). `mspaint /p`, který na Windows tiskne rovnou, tu neexistuje.

---

## 9. Na co si dát pozor při dalších úpravách

**Nikdy neupravuj windowsové volání „aby fungovalo všude“.** Přidej vedle něj
druhou větev podle vzoru z kapitoly 1. Kdyby se rozbil updater na Windows,
nejde poslat opravu aktualizací — musela by se kopírovat ručně do
`resources\app` na každém PC.

**Testuj obojí.** Změna v `src/main/*.js` se dotýká obou platforem, protože
rozdílový balíček je společný.

**Nové externí nástroje si ověř.** Když někdy přibude volání `spawn()`,
zkontroluj, jestli ten program na Linuxu existuje. Seznam míst, kde už větvení
je, najdeš takhle:

```bash
grep -rn "process.platform" src/main/*.js main.js
```

**Verze v `package.json`.** Sestavení pro Linux i Windows bere verzi odtud.
Když se čísla rozejdou, updater bude na jedné z platforem nabízet aktualizace
donekonečna.

---

## Historie

| Verze | Co se stalo |
|---|---|
| 3.1.77 | První verze s podporou Linuxu. 11 souborů v `src/main` dostalo linuxovou větev, windowsová větev nedotčena. |
