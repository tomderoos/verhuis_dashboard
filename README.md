# 🏠 Huis Dashboard

Een persoonlijk huishoudens-dashboard om inkomsten en uitgaven bij te houden, per **week / maand / jaar** te begroten en rapportages te bekijken. Alles draait lokaal in je browser — data wordt opgeslagen in `localStorage` en gaat niet naar een server.

## ✨ Wat kun je ermee

- **Dashboard** — overzicht per periode: totale inkomsten, uitgaven, saldo, % budget gebruikt, uitgaven per categorie, trend over tijd, recente transacties.
- **Transacties** — handmatig toevoegen, bewerken, verwijderen. Filters op periode, categorie, type en zoekterm. Bulk-verwijderen mogelijk.
- **Begroting** — per categorie een bedrag per week/maand/jaar instellen. De app rekent automatisch om tussen periodes en toont voortgangsbalken.
- **Rapportages** — trends over 3–24 maanden, saldo-verloop, top categorieën per maand (stacked bar), verdeling per persoon.
- **CSV-import** — bankafschriften importeren. Formaten van **ING**, **Rabobank** en **ABN AMRO** worden automatisch herkend, andere banken via handmatige kolom-mapping. Categorie-suggesties op basis van de omschrijving (Albert Heijn → Boodschappen, enzovoort).
- **Twee gebruikers** — categoriseer wie welke transactie heeft gedaan.
- **Backup** — exporteer/importeer al je data als JSON-bestand.
- **Licht/donker thema** — automatisch of handmatig.

## 🚀 Lokaal draaien

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## 📦 Production build (lokaal testen)

```bash
npm run build
npm run preview
```

## 🌐 Hosten op GitHub Pages

Er zijn twee manieren, kies er één.

### Optie A — GitHub Actions (aanbevolen)

De workflow `.github/workflows/deploy.yml` bouwt en deployt automatisch bij elke push naar `main`.

1. Maak een repo op GitHub en push deze code:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<jouw-user>/<repo-naam>.git
   git push -u origin main
   ```
2. Ga in GitHub naar **Settings → Pages** en zet **Source** op **GitHub Actions**.
3. De workflow draait automatisch en publiceert op `https://<jouw-user>.github.io/<repo-naam>/`.

De workflow zet `REPO_NAME` automatisch, dus je hoeft niets aan te passen als je repo bijvoorbeeld `huishouden` heet.

### Optie B — handmatig met `gh-pages`

```bash
# Repo eerst gekoppeld hebben aan github (git remote add origin ...).
REPO_NAME=jouw-repo-naam npm run build
npx gh-pages -d dist
```

Ga daarna in **Settings → Pages** naar **Source** en kies branch `gh-pages` / root.

## 🔐 Waar staat mijn data?

In je browser (`localStorage`, key `huis-dashboard.v1`). Als je in dezelfde browser blijft werken, blijft alles staan. Maak regelmatig een JSON-backup via **Instellingen → Backup** — vooral als je met meerdere apparaten werkt.

> Wil je later multi-device sync met echte database? Dan is een backend nodig. Deze versie is bewust static/lokaal om zonder server op GitHub Pages te draaien.

## 🗂️ Projectstructuur

```
src/
  main.jsx              Entry point
  App.jsx               Navigatie + layout
  store.jsx             LocalStorage store + Context
  styles.css            Alle CSS (light/dark theme via CSS variables)
  utils/
    format.js           Bedrag/datum-formatting (nl-NL)
    period.js           Week/maand/jaar-berekeningen
    csv.js              Bank-CSV parsers + categorie-suggesties
    uid.js              ID-generator
  components/
    PeriodNav.jsx       Week/maand/jaar tabs + navigatie
    UserFilter.jsx      Gebruikers-selectie
    Modal.jsx           Herbruikbare modal
    TransactionForm.jsx Add/edit transactie
  pages/
    Dashboard.jsx
    Transacties.jsx
    Begroting.jsx
    Rapportages.jsx
    CsvImport.jsx       Multi-step CSV-import
    Instellingen.jsx    Gebruikers, categorieën, backup, theme
```

## 🧪 CSV-formaten

De volgende bank-exports worden automatisch herkend:

| Bank | Export |
|------|--------|
| ING | `Mijn ING → Downloaden` → CSV |
| Rabobank | `Rabo Internetbankieren → Exporteren → CSV` |
| ABN AMRO | `Internetbankieren → Transacties → Downloaden CSV` |

Andere banken: upload gewoon je CSV, de app laat je zelf kolommen kiezen.

## ⚙️ Tech

- Vite + React 18 (JavaScript, geen TypeScript — bewust simpel)
- Recharts voor grafieken
- date-fns voor datum-berekeningen
- PapaParse voor CSV
- Plain CSS met CSS custom properties (geen Tailwind)
