# Firemní přihlášení BRITEX – jak to funguje

Dokumentace k přihlašování do PhotoBridge firemním účtem RTS.
Stav k 10. 8. 2026, PhotoBridge v3.1.77, mobilní stránka v1.3.0.

> Linuxová verze má vlastní návod: **NAVOD_LINUX.md**. Sem se nemíchá,
> protože se týká jen sestavení a provozu na Linuxu, ne přihlašování.


> ## ⛔ NEŽ NĚCO ZMĚNÍŠ — PŘEČTI SI TOHLE
>
> **Platí pro člověka i pro AI. Není to doporučení, je to podmínka.**
> Každý bod níž stál někoho několik hodin. Neobcházej je.

```diff
- ! NIKDY nepoužívej Supabase Custom Auth Providers. Nefungují (bug #2519).
-   Přihlášení jde přes Edge Funkci rts-sso. Kapitola 3.
-
- ! NIKDY netestuj přihlášení jen po přihlašovací stránku RTS.
-   Chyba padá AŽ v callbacku. Projdi vždy celou cestu. Kapitola 3.
-
- ! VŽDY po Deploy Edge Funkce zkontroluj „Verify JWT with legacy secret".
-   Sám se zapíná. Když je zapnutý, funkce vrací 401 a v logu NENÍ NIC.
-
- ! VŽDY pojmenuj balíček s TEČKAMI ve verzi:
-       photobridge_update_v3.1.80_2026-08-10.zip
-   S podtržítky ho updater NEVIDÍ a nikdy se nenainstaluje. Kapitola 12.
-
- ! NIKDY nedávej client_secret ani service_role klíč do aplikace
-   ani do mobilní stránky. Patří na server. Kapitola 6.
-
- ! Mobilní stránka je na DVOU místech a obě musí být stejné:
-       index.html v kořeni repozitáře   → GitHub Pages
-       templates/index.html v aplikaci  → telefony na dílenské síti
-   Kapitola 9.2.
```

> **Nemazat pole z Nastavení.** Ukládací kód je čte přes `getElementById`.
> Když pole odstraníš, uložení nastavení spadne. Schovej je pod „Pokročilé“.

---


## Obsah

| | Kapitola | Kdy se hodí |
|---|---|---|
| 1 | K čemu to je | úvod |
| 2 | Jak to funguje | schéma toku |
| 3 | Proč to nejde přes Supabase providery | než to někdo zkusí znovu |
| 4 | Proč mobil nemůže výměnu kódu udělat sám | CORS a client_secret |
| 5 | Součásti řešení | kde co leží |
| 6 | Bezpečnost | co chrání přihlášení |
| 7 | Na co si dát pozor | **přečíst před zásahem** |
| 8 | Co zkontrolovat, když to nefunguje | **při potížích** |
| 9 | Nasazení krok za krokem | **postup** |
| 10 | Když se něco mění | adresa, projekt, secret, lidé |
| 11 | Historie a rozhodnutí | proč to vypadá takhle |
| 12 | Jak balíčkovat aktualizace | pojmenování ZIPů |
| 13 | Smazání účtu | druhá Edge Funkce |

---

## 1. K čemu to je

Technik měl dvě samostatná přihlášení: účet v PhotoBridge (e-mail + heslo)
a zvlášť přihlášení do RTS (kvůli ukládání fotek přímo do zakázky).

Nově stačí jedno kliknutí na **BRITEX – OAuth2**. Technik se přihlásí do RTS
svými firemními údaji a tím zároveň získá účet v PhotoBridge.

Přihlášení e-mailem a heslem zůstává funkční jako záložní cesta.

---

## 2. Jak to funguje

```
   ┌──────────────┐                      ┌──────────────┐
   │  PhotoBridge │  1. přihlášení       │     RTS      │
   │  (PC/mobil)  │ ───────────────────► │ rts.britex.cz│
   │              │ ◄─────────────────── │              │
   │              │     token / kód      └──────────────┘
   │              │                              ▲
   │              │  2. token nebo kód           │ 3. kdo to je?
   │              │      ┌────────────────┐      │    /api/v4/User
   │              │ ────►│  Edge Funkce   │──────┘
   │              │      │    rts-sso     │
   │              │ ◄────│                │──────┐ 4. najdi/založ účet
   │              │   token_hash          │      ▼
   └──────┬───────┘      └────────────────┘   ┌──────────────┐
          │  5. token_hash → session          │   Supabase   │
          └──────────────────────────────────►│   auth.users │
                                              └──────────────┘
```

**Krok 1** – technik se přihlásí do RTS. Na PC to dělá aplikace sama
(`rts-auth.js`, PKCE). Na mobilu stránka odejde na `rts.britex.cz/oauth/Authorize`
a vrátí se s autorizačním kódem.

**Krok 2** – PC posílá hotový token, mobil posílá kód. Mobil nemůže token
získat sám, viz kapitola 4.

**Krok 3** – Edge Funkce se tím tokenem zeptá RTS na `/api/v4/User`. Tím je
totožnost prokázaná: token nikdo nevyrobí, vydá ho jen RTS po přihlášení.

**Krok 4** – podle e-mailu se najde nebo založí účet v `auth.users`.

**Krok 5** – funkce vrátí jednorázový `token_hash`, ten se přes
`/auth/v1/verify` vymění za běžnou session.

---

## 3. Proč to NEJDE přes Supabase Custom Auth Providers

Původní záměr byl použít vlastního poskytovatele v Supabase. **Nefunguje to.**

Poskytovatel je správně nastavený a `/auth/v1/authorize` vrací 302 na RTS.
RTS uživatele přihlásí a vrátí kód. Pak ale selže callback v Supabase:

```
?error=server_error&error_description=error+missing+provider+id
```

Co bylo vyzkoušeno (vše bez efektu):

| Zkoušeno | Výsledek |
|---|---|
| Ověření, že poskytovatel existuje a je zapnutý | `enabled: true`, v pořádku |
| Ověření správného projektu | `vfxurqshbibaibqssjyz`, sedí |
| Nekódovaná dvojtečka v `provider` | bez efektu |
| `pkce_enabled: false` | bez efektu |
| Scopes `openid, email, profile` místo `user` | bez efektu |
| Vymazání `jwks_uri` | server hodnotu neuloží (ignoruje `""` i `null`) |
| Druhý poskytovatel založený přes admin API, bez `issuer` a `jwks_uri` | stejná chyba |

Je to chyba na straně Supabase, sledovaná jako **supabase/auth#2519**.
Oprava (PR #2528) nebyla v době psaní sloučená.

**Kdyby to Supabase někdy opravil**, dá se na poskytovatele vrátit – ale není
proč, Edge Funkce funguje a nemá na Supabase v tomhle ohledu závislost.

### Pozor na past při testování

Otevřít `/auth/v1/authorize?...` v prohlížeči a vidět přihlašovací stránku RTS
**neznamená, že to funguje.** Chyba padá až v callbacku, tedy po dokončení
přihlášení. Test je platný jen tehdy, když projdeš celou cestu až na návratovou
adresu. Tahle past nás stála několik hodin.

---

## 4. Proč mobil nemůže výměnu kódu udělat sám

Dva důvody:

1. **CORS** – prohlížeč nepustí volání na `rts.britex.cz/oauth/Token` z jiné
   domény, dokud to RTS výslovně nepovolí.
2. **client_secret** – RTS u výměny kódu vyžaduje `client_secret`, samotné PKCE
   mu nestačí. Ověřeno chybou:
   ```json
   {"message":"Invalid authorization - client secret","statusCode":400}
   ```
   Secret v prohlížeči být nesmí, jinak si ho přečte kdokoli ze zdroje stránky.

Edge Funkce běží na serveru, takže obojí odpadá.

---

## 5. Součásti řešení

| Kde | Co |
|---|---|
| Supabase → Edge Functions | funkce `rts-sso`, `delete-account` |
| Supabase → `pb_settings` | `rts_client_id`, `rts_client_secret`, `rts_sso_enabled` |
| Supabase → Policies | `pb_settings_read_groq` (přihlášení), `pb_settings_read_anon` (nepřihlášení) |
| PC aplikace | `src/main/britex-sso.js`, IPC `supabase:login-britex` v `supabase.js` |
| PC aplikace | `src/main/rts-auth.js` (přihlášení do RTS), `rts-api.js` (výměna, userinfo) |
| Mobilní stránka | funkce `rtsLogin()`, `rtsHandleRedirect()` v `index.html` |
| RTS (spravuje Luboš) | `client_id`, `client_secret`, povolené `redirect_uri` |

---

## 6. Bezpečnost

**Co chrání přihlášení:** token do RTS ani autorizační kód nelze vyrobit.
Vydá je jen RTS po úspěšném přihlášení. Kdo je má, ten se přihlásil.

**Klíč `service_role`** je jen v Edge Funkci (proměnná prostředí Supabase).
Do aplikace ani do prohlížeče se nikdy nedostane.

**`client_secret`** je v `pb_settings` a čte ho:
- Edge Funkce klíčem `service_role`
- PC aplikace **přihlašovacím tokenem technika** (ne anonymním klíčem)

Nepřihlášený ho nepřečte. Do 9. 8. 2026 to tak nebylo – secret si mohl přečíst
kdokoli, kdo otevřel zdroj mobilní stránky. Opraveno.

**E-mail se převádí na malá písmena.** RTS vrací `OPapez@britex.cz`, v Supabase
je účet `opapez@britex.cz`. Bez převodu by vznikl druhý účet pro téhož člověka.

---

## 7. Na co si dát pozor

### Verify JWT with legacy secret

Přepínač u Edge Funkce (Edge Functions → `rts-sso` → Details) **musí být
vypnutý**. Volající ještě žádnou Supabase session nemá.

> **Sám se zapíná zpátky po každé aktualizaci funkce.** Je to známá chyba
> Supabase. Po každém Deploy zkontrolovat.

Poznávací znamení: funkce vrací **401** a v jejím logu **není vidět nic** –
brána ji odmítne dřív, než se spustí.

### redirect_uri u RTS

Adresa, ze které se přihlašuje, musí být u RTS povolená pro naše `client_id`.
Aktuálně povolené:

- `https://vfxurqshbibaibqssjyz.supabase.co/auth/v1/callback` (PC aplikace)
- `https://loydtest01.github.io/PhotoBridge/` (mobilní stránka)

Při změně adresy stránky nebo projektu Supabase je nutné požádat správce RTS
o doplnění. Projeví se to chybou při odchodu na RTS nebo `redirect_uri_mismatch`.

### Vypínač pro mobil

```sql
-- zapnout
update public.pb_settings set value='on'  where key='rts_sso_enabled';
-- vypnout (tlačítko se technikům přestane zobrazovat)
update public.pb_settings set value='off' where key='rts_sso_enabled';
```

Na PC se tlačítko zobrazuje vždy, na tenhle přepínač nečeká.

### RTS nevydává refresh_token

Přihlášení platí ~23 hodin a **automaticky se neobnoví**. Po vypršení je nutné
se přihlásit znovu. Bezpečnostní politika RTS, netýká se jen nás.

Vyskakovací upozornění na vypršení je od v3.1.68 vypnuté přepínačem
`PROMPT_ENABLED` v `rts-auth.js` (bylo otravné, dokud SSO nefungovalo).
**Až se firemní přihlášení zaběhne, zvážit zapnutí zpět.**

### Externí účty

Účty na `seznam.cz` a `gmail.com` se přes RTS nepřihlásí nikdy – RTS zná jen
firemní adresy. Zůstávají na hesle. Je jich k 10. 8. 2026 celkem 4.

---

## 8. Co zkontrolovat, když to nefunguje

Postupuj odshora, každý krok vylučuje jednu vrstvu.

**1. Log aplikace** – hledej `BRITEX_SSO`:

```
BRITEX_SSO  Otevírám přihlášení do RTS
BRITEX_SSO  RTS přihlášen – OPapez@britex.cz
BRITEX_SSO  Ověřuji totožnost přes Edge Funkci
BRITEX_SSO  Nalezen účet: opapez@britex.cz
BRITEX_SSO  Přihlášeno jako opapez@britex.cz
```

Kde se to zastaví, tam je problém.

**2. Přihlášení do RTS samotné** – Nastavení → Přihlásit se do RTS.
Hledej v logu:

```
RTS_CFG    client_id=OK, secret=OK, čteno jako přihlášený technik
RTS token  Získán token, platnost 23 h
RTS_USER   E-mail nalezen v poli "email": …
```

- `secret=CHYBÍ` → policy v `pb_settings` nepovoluje čtení, viz kapitola 5
- `Invalid authorization - client secret` → secret chybí nebo je špatný

**3. Edge Funkce** – Supabase → Edge Functions → `rts-sso` → Logs.

- V logu **nic** a odpověď 401 → zapnutý Verify JWT
- `V pb_settings chybí rts_client_secret` → secret v tabulce není
- `RTS odmítl výměnu kódu` → špatný secret nebo nepovolená `redirect_uri`
- `Token do RTS neplatí` → token vypršel, přihlásit se znovu

**4. Stav účtů** – po přihlášení zkontroluj, že nevznikl duplikát:

```sql
select u.email, count(i.id) as pocet_identit
from auth.users u
left join auth.identities i on i.user_id = u.id
group by u.id, u.email
order by u.email;
```

Počet řádků se **nesmí zvýšit** u člověka, který už účet měl. Kdyby se objevil
druhý řádek se stejným e-mailem lišící se jen velikostí písmen, selhal převod
na malá písmena v Edge Funkci.

`pocet_identit = 1` je správně. Přihlašujeme přes jednorázový odkaz, ne přes
OAuth identitu, takže žádná nová identita nevzniká.

---

## 9. Nasazení krok za krokem

Pořadí je závazné. Kroky 1 a 2 na sobě nezávisí, zbytek ano.

### 9.1 První nasazení

**1. Povolit adresu u RTS** *(zařizuje správce RTS – Luboš)*

Pro `client_id 5755a537-102f-44c4-be5c-4e1be7f39158` musí být povolené
`redirect_uri`:

```
https://vfxurqshbibaibqssjyz.supabase.co/auth/v1/callback   ← PC aplikace
https://loydtest01.github.io/PhotoBridge/                   ← mobilní stránka
```

Bez druhé adresy skončí mobil chybou hned při odchodu na RTS.

**2. Zkontrolovat pb_settings**

```sql
select key, length(value) as delka from public.pb_settings where key like 'rts_%';
```

Musí existovat `rts_client_id` a `rts_client_secret`. Když secret chybí,
doplnit hodnotou od správce RTS.

**3. Nastavit oprávnění ke čtení**

Secret smí číst jen přihlášený, nepřihlášený ne:

```sql
drop policy if exists pb_settings_read_groq on public.pb_settings;
drop policy if exists pb_settings_read_anon on public.pb_settings;

create policy pb_settings_read_groq
  on public.pb_settings for select to authenticated
  using (key in ('groq_api_key','groq_vision_model',
                 'rts_client_id','rts_client_secret','rts_url','rts_sso_enabled'));

create policy pb_settings_read_anon
  on public.pb_settings for select to anon
  using (key in ('groq_api_key','groq_vision_model',
                 'rts_client_id','rts_url','rts_sso_enabled'));
```

Ověření zvenčí anonymním klíčem, nejlépe v anonymním okně prohlížeče
(v SQL editoru běžíš jako správce, tam uvidíš vždy všechno a výsledek by lhal):

```
…/rest/v1/pb_settings?key=eq.rts_client_secret&select=key,value&apikey=<ANON>
```
Musí vrátit prázdné pole `[]`. Když vrátí secret, policy se neuložila.

```
…/rest/v1/pb_settings?key=eq.rts_client_id&select=key,value&apikey=<ANON>
```
Naopak **musí** vrátit hodnotu. Tím se ověří, že se nezalomilo i to, co
fungovat má.

**4. Nasadit Edge Funkci**

Supabase → Edge Functions → Deploy a new function → Via Editor

- jméno: `rts-sso`
- vložit obsah `rts-sso-index.ts`
- Deploy

**5. Vypnout Verify JWT**

Edge Functions → `rts-sso` → Details → **Verify JWT with legacy secret** → vypnout.

Bez tohohle vrací funkce 401 a v jejím logu není vidět nic.

**6. Nasadit aplikaci**

Rozdílový ZIP do `Update/` na větev `main`, pak v aplikaci
Nastavení → Zkontrolovat aktualizace.

**7. Nasadit mobilní stránku**

`index.html` do kořene repozitáře `loydtest01/PhotoBridge`.
GitHub Pages překlopí do minuty či dvou.

**8. Vyzkoušet na PC**

Nastavení → BRITEX – OAuth2. V logu hledej `BRITEX_SSO`, viz kapitola 8.

**9. Teprve pak zapnout mobil**

```sql
update public.pb_settings set value='on' where key='rts_sso_enabled';
```

Tlačítko se technikům objeví až po tomhle. Do té doby se dá vše testovat
na PC, aniž by to kohokoli v dílně ovlivnilo.

**10. Vyzkoušet na telefonu a zkontrolovat účty**

```sql
select u.email, count(i.id) as pocet_identit
from auth.users u
left join auth.identities i on i.user_id = u.id
group by u.id, u.email
order by u.email;
```

Počet řádků se nesmí zvýšit u člověka, který už účet měl.

### 9.2 Běžná aktualizace aplikace

1. ZIP do `Update/` (pojmenování viz kapitola 12)
2. Nastavení → Zkontrolovat aktualizace
3. Když se měnila i mobilní stránka, nahrát `index.html` do kořene repozitáře

Mobilní stránka je na dvou místech a **obě musí být stejné**:

- `index.html` v kořeni repozitáře → GitHub Pages, vzdálený přístup
- `templates/index.html` uvnitř aplikace → lokální server pro telefony v dílně

Když se aktualizuje jen jedno, technici na dílenské síti jedou na staré verzi.

### 9.3 Aktualizace Edge Funkce

1. Edge Functions → `rts-sso` → upravit kód → Deploy
2. **Znovu vypnout Verify JWT** – po každém Deploy se sám zapne

---

## 10. Když se něco mění

### Mění se adresa mobilní stránky

Například jiný repozitář nebo vlastní doména.

1. Požádat správce RTS o povolení nové `redirect_uri`
2. Nahrát stránku na novou adresu
3. Ověřit přihlášení na mobilu

`redirect_uri` se odvozuje automaticky z adresy stránky
(`location.origin + location.pathname`), v kódu se nic neupravuje.

### Mění se projekt Supabase

1. Nasadit Edge Funkci v novém projektu
2. Přenést `pb_settings` včetně secretu
3. Nastavit policies podle kapitoly 9.1
4. Požádat správce RTS o povolení nové adresy callbacku
5. Změnit `SB_URL` a `SB_ANON` v aplikaci i v mobilní stránce

Tohle už jednou způsobilo potíže – část oprav se dělala v nesprávném projektu.
Produkční projekt je **`vfxurqshbibaibqssjyz`**, účet `photobridge`.

### Otáčí se client_secret

1. Novou hodnotu do `pb_settings`:
   ```sql
   update public.pb_settings set value='<nová hodnota>' where key='rts_client_secret';
   ```
2. Nic víc. Edge Funkce i aplikace ho čtou odtud, na žádném PC se nevyplňuje.

Pole „OAuth2 client_secret“ v Nastavení → Pokročilé má zůstat **prázdné**.
Má přednost před centrální hodnotou, takže vyplněné by tu novou přebilo.

### Přibývá nový technik

Nic dělat nemusíš. Při prvním přihlášení přes BRITEX se účet založí sám
podle e-mailu z RTS, s typem účtu `business`.

### Odchází technik

Zrušit mu účet v RTS. Do PhotoBridge se pak nepřihlásí, i když jeho účet
v `auth.users` zůstane. Pokud si dřív nastavil heslo, to funguje dál – v tom
případě smazat i účet v Supabase → Authentication → Users.

### Supabase opraví issue #2519

Nic dělat nemusíš. Edge Funkce je na poskytovatelích nezávislá a funguje
spolehlivě. Přecházet zpět nemá důvod.

---

## 11. Historie a rozhodnutí

| Verze | Co se stalo |
|---|---|
| 3.1.63 | Tlačítko BRITEX v PC aplikaci, `sbAdoptSession()`, přes Supabase providery |
| 3.1.64 | Úklid přihlašovací obrazovky, odstraněno vypsané výchozí heslo |
| 3.1.65 | Pokus: ERR_ABORTED při přesměrování – nebyla to příčina |
| 3.1.66 | Diagnostika: projekt, celá adresa, test bez okna, průchod okna |
| 3.1.67 | Pokus: nekódovaná dvojtečka v `provider` – nebyla to příčina |
| 3.1.68 | Vypnuto vyskakovací okno o vypršení RTS |
| 3.1.69 | Diagnostika odpovědi `/api/v4/User` – zjištěno pole `email` |
| 3.1.70 | Doplněno logování chyb výměny kódu (dosud se ztrácely) |
| 3.1.71 | `client_secret` se čte přihlašovacím tokenem, ne anonymním klíčem |
| 3.1.73 | Edge Funkce `rts-sso` v PC aplikaci – **funguje** |
| 3.1.74 | Edge Funkce i pro mobilní stránku, výměna kódu na serveru |

**Proč tolik verzí:** chyba byla na straně Supabase a projevovala se hláškou,
která popisovala něco jiného, než se dělo. Většina verzí byla diagnostika,
ne opravy.

**Poučení pro příště:** když chyba padá až po návratu z cizí služby, testuj
vždy celou cestu. Zastavit se na přihlašovací stránce a prohlásit to za úspěch
je past.

---

## 12. Jak balíčkovat aktualizace

Zkopírováno sem, protože s tím souvisí a nemá to jinde místo.

Rozdílový ZIP musí mít název ve tvaru, který updater rozpozná:

```
photobridge_update_v3.1.74_2026-08-10.zip
```

Regulární výraz v `updater.js`:

```
^photobridge_update_(?:v([\d.]+)_)?(\d{4}-\d{2}-\d{2})(?:_(\d+))?\.zip$
```

**Ve verzi musí být TEČKY, ne podtržítka.** Skupina je `[\d.]+`, takže název
`photobridge_update_v3_1_74_2026-08-10.zip` **updater vůbec nevidí** a takový
balíček se nikdy nenainstaluje. Ve složce `Update/` na GitHubu takové soubory
byly – nepočítají se.

Další pravidla:

- balíček obsahuje **jen změněné soubory**, ne celou aplikaci
- struktura odpovídá složce `resources/app` (tedy `main.js` v kořeni,
  `src/main/…`, `templates/…`)
- prefix `photobridge_` malými písmeny
- do `Update/` na větvi `main` repozitáře `loydtest01/PhotoBridge`
- updater umí řetězit: když technik přeskočil verze, nainstaluje je popořadě

Celou aplikaci pro nové instalace **do repozitáře nedávej** – GitHub blokuje
soubory nad 100 MB. Použij **Releases** (limit 2 GB na soubor).

---

## 13. Smazání účtu

Nastavení → Smazání účtu (PC) i Nastavení → Smazat účet (mobil).
Každý smí smazat **jen svůj** účet, ověřuje se heslem.

Běží ve druhé Edge Funkci **`delete-account`** – smazat uživatele z
`auth.users` umí jen klíč `service_role` a ten do aplikace nepatří.
Platí pro ni to samé jako pro `rts-sso`: **vypnout Verify JWT** a po každém
Deploy zkontrolovat.

### Proč je to dvoukrokové

**1. Zkontrolovat** – ověří heslo a vrátí přehled toho, co uživateli zůstalo
ve frontě `pb_queue` nenahraného: počet, rozsah dat, kterých zakázek se to týká.
**Nic nemaže.**

**2. Smazat účet** – teprve tohle maže, s dalším potvrzením.

Bez toho mezikroku by technik přišel o fotky, o kterých neví. Uživatel se pak
rozhodne sám: nechat je ve frontě (dojedou do zakázek, smaže se jen účet),
nebo zaškrtnout, že se mají smazat spolu s účtem.

Přehled se nevrací bez ověření hesla – jinak by kdokoli zjistil, kolik má kdo
rozdělané práce, pouhým zadáním cizí adresy.

### Na co si dát pozor

**Účet přes BRITEX se založí znovu.** Kdo se hlásí firemně, tomu se účet při
dalším přihlášení vytvoří podle e-mailu nanovo. Je to vyčištění, ne odchod.

**Účty bez hesla.** Kdo se od začátku hlásí jen přes BRITEX, žádné heslo nemá
a takhle účet nesmaže. Funkce umí ověřit i tokenem do RTS (`{ rts_token }`),
ale rozhraní to zatím nepoužívá. Kdyby to bylo potřeba, stačí doplnit volání.

**Co zůstane.** Maže se řádek v `auth.users` a volitelně fronta. Soubory v R2
a případné další záznamy zůstávají – při dalším přihlášení stejného člověka
se ale k jeho novému účtu už nepřipojí.
