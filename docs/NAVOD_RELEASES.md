# Jak vydat plnou instalaci (Releases)

Rozdílové balíčky v `Update/` slouží k aktualizaci **existující** instalace.
Pro nové PC, reinstalaci nebo Linux je potřeba celá aplikace — a ta do
repozitáře nepatří.

Stav k 11. 8. 2026.

---

> ## ⛔ NEŽ ZAČNEŠ
>
> **Do repozitáře celou aplikaci nedávej.** GitHub blokuje soubory nad 100 MB
> a přes prohlížeč je strop dokonce 25 MB. Aplikace má ~200 MB.
> Patří do **Releases**, kde je limit 2 GB na soubor.

```diff
- ! ČÍSLO VERZE V package.json MUSÍ SEDĚT S OZNAČENÍM RELEASE.
-   Když se rozejdou, updater bude nabízet aktualizaci donekonečna.
-
- ! PŘED ZABALENÍM VYHOĎ backup/, paint_temp/, logy a zkontroluj config.json.
-   Jinak rozešleš vlastní přihlašovací údaje a cesty.
-
- ! LINUX A WINDOWS SESTAV ZE STEJNÉ VERZE.
-   Verze se bere z package.json, který je pro obě platformy společný.
```

---

## 1. Příprava

```bash
cd C:\Users\opapez\Desktop\PhotoBridgeE\resources\app
npm install
```

Zkontroluj číslo verze:

```bash
node -e "console.log(require('./package.json').version)"
```

---

## 2. Sestavení

```bash
npm run build:win      → dist/PhotoBridge-Setup-<verze>.exe
npm run build:linux    → dist/PhotoBridge-Linux-<verze>.AppImage
```

Linuxovou verzi lze sestavit i na Windows přes WSL. Windowsovou na Linuxu ne
(potřebuje Wine a výsledek bývá nespolehlivý).

Cíle jsou v `package.json` v sekci `build` oddělené — `win` a `linux` na sebe
nesahají.

---

## 3. Kontrola před nahráním

- [ ] verze v názvu souboru odpovídá `package.json`
- [ ] v balíčku není `backup/`, `paint_temp/`, `logs/`
- [ ] `config.json` neobsahuje tvoje údaje ani cesty (`M:\`, `I:\…`)
- [ ] `state.json` neobsahuje přihlašovací token
- [ ] aplikace ze sestavené složky se spustí a přihlásí

---

## 4. Vydání

Repozitář `loydtest01/PhotoBridge` → **Releases** → **Draft a new release**

1. **Choose a tag** → `v3.2.3` → *Create new tag on publish*
2. **Release title** → `PhotoBridge 3.2.3`
3. Do popisu vlož nejnovější záznam z `CHANGELOG.txt`
4. Dole přetáhni **oba** soubory:
   - `PhotoBridge-Setup-3.2.3.exe`
   - `PhotoBridge-Linux-3.2.3.AppImage`
5. **Publish release**

Trvalý odkaz pro techniky:

```
https://github.com/loydtest01/PhotoBridge/releases/latest
```

---

## 5. Co po instalaci

Nová instalace potřebuje nastavit:

- **cílovou složku** (na dílenských PC `M:\UploadScan`)
- **přihlášení** — e-mailem a heslem, nebo tlačítkem BRITEX

Zbytek se načte centrálně ze Supabase: `client_id`, `client_secret`, model pro
AI i seznam správců. Technik nic dalšího nevyplňuje.

**Na Linuxu navíc:**

```bash
sudo apt install unzip zip libfuse2
chmod +x PhotoBridge-Linux-3.2.3.AppImage
```

---

## 6. Jak často vydávat

Rozdílové balíčky stačí na běžné změny — technikům se nainstalují samy.
Plnou instalaci vydávej, když:

- přibude nový soubor mimo `src/` (rozdílový balíček ho doručí, ale nová
  instalace by ho neměla)
- změní se závislosti v `package.json`
- uplyne delší doba a řetěz aktualizací by byl zbytečně dlouhý

Orientačně jednou za měsíc nebo po větší změně.

---

## 7. Když je repozitář soukromý

Technici by museli být přihlášení na GitHubu, aby stáhli. Pro dílnu je to
překážka. Buď repozitář zveřejni — ale **jen když jsi si jistý, že v kódu
nikde nejsou klíče** — nebo soubory nasdílej na firemní disk.

Anon klíč Supabase je v pořádku, je veřejný ze své podstaty. `service_role`
klíč ani `client_secret` v kódu být nesmí (a nejsou — čtou se za běhu).
