# Jak vydávat aktualizace PhotoBridge

Návod pro člověka i pro AI. Stav k 10. 8. 2026, PhotoBridge v3.1.82.

---

> ## ⛔ NEŽ VYROBÍŠ BALÍČEK — PŘEČTI SI TOHLE
>
> **Není to doporučení, je to podmínka.** Každý bod stál někoho hodiny.

```diff
- ! VERZE V NÁZVU MUSÍ MÍT TEČKY, NE PODTRŽÍTKA.
-       photobridge_update_v3.1.82_2026-08-10.zip     ✓ updater ho vidí
-       photobridge_update_v3_1_82_2026-08-10.zip     ✗ NEVIDÍ HO NIKDY
-
- ! ČÍSLO V package.json SE MUSÍ SHODOVAT S NÁZVEM ZIPU.
-   Když se rozejdou, updater instaluje donekonečna dokola.
-
- ! MOBILNÍ STRÁNKA JE NA DVOU MÍSTECH. Aktualizuj OBĚ:
-       index.html v kořeni repozitáře   → GitHub Pages (vzdálený přístup)
-       templates/index.html v balíčku   → telefony na dílenské síti
-
- ! PŘI ZMĚNĚ index.html VŽDY ZVEDNI CACHE_VERSION V sw.js.
-   Bez toho si telefon nechá starou verzi z mezipaměti a změna se NEPROJEVÍ.
-   Přesně tohle skrylo chybu „cannot access sentByMobile" na několik dní.
-
- ! NEPŘEPISUJ index.html SVOJI VĚTVÍ, KDYŽ MEZITÍM VZNIKLA OPRAVA JINDE.
-   Vezmi opravený soubor jako ZÁKLAD a nanes na něj své změny, ne naopak.
-
- ! BALÍČEK OBSAHUJE JEN ZMĚNĚNÉ SOUBORY, ne celou aplikaci.
```

---

## Obsah

| | Kapitola |
|---|---|
| 1 | Postup krok za krokem |
| 2 | Struktura balíčku |
| 3 | Pojmenování |
| 4 | Běžná vs. urgentní aktualizace |
| 5 | Řetězení verzí |
| 6 | Plná instalace (Releases) |
| 7 | Kontrolní seznam před nahráním |
| 8 | Když se něco pokazí |

---

## 1. Postup krok za krokem

**1. Uprav zdrojové soubory** ve své pracovní kopii.

**2. Zvedni verzi v `package.json`:**

```json
{ "version": "3.1.82" }
```

**3. Doplň `changelog` v `package.json`** — pole polí, zobrazuje se uživateli
v okně aktualizace:

```json
"changelog": [
  "Krátká věta, co se změnilo a proč je to pro technika dobré.",
  "Druhá změna."
]
```

**4. Doplň `CHANGELOG.txt`** — podrobný záznam **nahoru**, ne dolů.
Sem patří příčina, oprava a na co si dát pozor. Čte to člověk, který přijde
za půl roku hledat, proč něco vypadá, jak vypadá.

**5. Zabal jen změněné soubory** (viz kapitola 2).

**6. Pojmenuj podle vzoru** (kapitola 3).

**7. Nahraj do `Update/`** na větev `main` repozitáře `loydtest01/PhotoBridge`.

**8. Když se měnila mobilní stránka**, nahraj `index.html` i do kořene
repozitáře a **zvedni `CACHE_VERSION` v `sw.js`**.

**9. Když je aktualizace urgentní**, dopiš verzi do `Update/urgent.json`
(kapitola 4).

**10. Otestuj na svém PC** dřív, než to pustíš na dílnu.

---

## 2. Struktura balíčku

ZIP obsahuje **jen změněné soubory**, ve struktuře odpovídající složce
`resources/app`:

```
photobridge_update_v3.1.82_2026-08-10.zip
├── package.json          ← VŽDY (nese číslo verze)
├── CHANGELOG.txt         ← VŽDY
├── main.js               ← jen když se měnil
├── src/
│   ├── main/…            ← jen změněné
│   └── renderer/…        ← jen změněné
└── templates/
    └── index.html        ← jen když se měnila mobilní stránka
```

`package.json` a `CHANGELOG.txt` patří do balíčku **vždycky**, i když se
v nich měnilo jen číslo verze. Bez `package.json` updater neví, co nainstaloval.

**Co do balíčku nepatří:** `node_modules`, `backup/`, `paint_temp/`, logy,
`config.json`, `state.json`. Ty poslední dva by přepsaly nastavení technikům.

---

## 3. Pojmenování

```
photobridge_update_v<VERZE>_<RRRR-MM-DD>.zip
```

Updater to porovnává tímhle výrazem:

```
^photobridge_update_(?:v([\d.]+)_)?(\d{4}-\d{2}-\d{2})(?:_(\d+))?\.zip$
```

Skupina pro verzi je `[\d.]+` — **jen číslice a tečky.** Podtržítka neprojdou
a balíček je pro updater neviditelný. Ve složce `Update/` takové soubory byly
a nikdy se nenainstalovaly.

Když v jeden den vydáváš víc balíčků, přidej pořadí:

```
photobridge_update_v3.1.82_2026-08-10_2.zip
```

---

## 4. Běžná vs. urgentní aktualizace

### Běžná

Chová se jako dosud:

- při ručním „Zkontrolovat aktualizace" se aplikace zeptá
- o půlnoci se nainstaluje sama, bez ptaní

Nedělá se nic navíc.

### Urgentní

Nainstaluje se **hned a bez ptaní**, jakmile na ni aplikace narazí. Používej
jen na vážné chyby: fotky neodcházejí, aplikace padá, hrozí ztráta dat.

Zapiš verzi do `Update/urgent.json`:

```json
{
  "urgent": ["3.1.81"]
}
```

Soubor je jednoduchý naschvál — kdo ho neumí přečíst (starší instalace),
chová se jako dosud.

**Proč to není v názvu ZIPu:** název hlídá ten přísný výraz výše. Přidat do
něj příznak by znamenalo, že starší instalace nové balíčky přestanou vidět.

**Když už je urgentní verze rozšířená**, můžeš ji ze seznamu vyndat, ať se
soubor nenafukuje. Nic se tím nerozbije.

---

## 5. Řetězení verzí

Když technik přeskočil verze, updater je nainstaluje **popořadě** — stáhne
všechny mezilehlé ZIPy a rozbalí je za sebou. Nemusíš dělat kumulativní balíčky.

**Urgentní aktualizace řetěz respektuje.** Stačí, aby urgentní byla kterákoli
verze v řetězu, a nainstalují se s ní i všechny běžné před ní. Bez toho by se
přeskočily a aplikace by se rozbila — třeba když v běžné verzi přibyl soubor,
na který urgentní spoléhá.

Příklad: technik má 3.1.79, vydáš běžné 3.1.80 a 3.1.81 a urgentní 3.1.82.
Nainstaluje se **všech pět souborů najednou**, bez ptaní, protože poslední
v řetězu je urgentní.

---

## 6. Plná instalace (Releases)

Rozdílové balíčky slouží k aktualizaci **existující** instalace. Pro nové PC
nebo reinstalaci je potřeba celá aplikace.

Do repozitáře ji nedávej — GitHub blokuje soubory nad 100 MB. Použij
**Releases**, kde je limit 2 GB na soubor.

```bash
npm run build:win      → dist/PhotoBridge-Setup-<verze>.exe
npm run build:linux    → dist/PhotoBridge-Linux-<verze>.AppImage
```

Repozitář → Releases → Draft a new release → tag `v3.1.82` → přetáhnout oba
soubory → Publish.

Trvalý odkaz pro techniky:

```
https://github.com/loydtest01/PhotoBridge/releases/latest
```

Před zabalením vyhoď `backup/`, `paint_temp/`, logy a zkontroluj, že v
`config.json` nezůstaly tvoje přihlašovací údaje ani cesty.

---

## 7. Kontrolní seznam před nahráním

- [ ] verze v `package.json` zvednutá
- [ ] `changelog` v `package.json` doplněný
- [ ] `CHANGELOG.txt` doplněný **nahoře**
- [ ] název ZIPu má **tečky** ve verzi
- [ ] číslo v názvu **se shoduje** s `package.json`
- [ ] v ZIPu je `package.json` i `CHANGELOG.txt`
- [ ] v ZIPu **nejsou** `node_modules`, `config.json`, `state.json`
- [ ] měnila se mobilní stránka? → `templates/index.html` v ZIPu **i**
      `index.html` v kořeni repozitáře **i** zvednutý `CACHE_VERSION` v `sw.js`
- [ ] urgentní? → verze dopsaná do `Update/urgent.json`
- [ ] otestováno na vlastním PC

---

## 8. Když se něco pokazí

### Aplikace aktualizaci nevidí

Nejčastěji špatný název. Ověř si ho:

```
^photobridge_update_(?:v([\d.]+)_)?(\d{4}-\d{2}-\d{2})(?:_(\d+))?\.zip$
```

Zkontroluj i log — má tam být `GitHub – nalezeno N update ZIPů` a pak
`scanForUpdates: nalezeno X novějších`.

### Aktualizace se instaluje pořád dokola

Číslo v `package.json` se neshoduje s názvem ZIPu. Aplikace se po instalaci
hlásí jinou verzí, než jakou updater čekal, takže balíček pořád vidí jako nový.

### Změna v mobilní stránce se neprojevila

Service Worker drží starou verzi. **Zvedni `CACHE_VERSION` v `sw.js`** a nahraj
ho také. Bez toho telefon nový soubor vůbec nestáhne.

Kontrola: v aplikaci na telefonu se dole ukazuje verze. Když se nezměnila,
běží stará.

### Aktualizace se stáhne, ale nenainstaluje

Na Linuxu nejspíš chybí `unzip` (`apt install unzip`). Na Windows zkontroluj
`%TEMP%\photobridge_update.log`.

### Rozbil jsem updater a nejde poslat opravu

Aktualizací už opravu nedoručíš. Zbývá:

1. na postiženém PC otevřít `resources\app` a soubory nakopírovat ručně
2. nebo použít zálohu — před každou instalací se dělá do `backup/` vedle `.exe`

**Proto se do updateru sahá opatrně a testuje se nejdřív na jednom PC.**
