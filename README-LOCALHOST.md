# kkpramod.com.np — run on localhost

## What is new in this pack
- **Classroom slides** editable from Admin → Classroom (data/classroom-slides.json + API)
- **Perspective grid** under the main slideshow on `/classroom`
- **Quantum Shell NEPSE bar** under the ask box on the homepage
- Shell commands: `nepse` · `gainers` · `losers` · `active` · any symbol (e.g. `NABIL`)

## Requirements
- Node.js 18+ (20+ recommended)
- Internet (for NEPSE live feed / news)

## Setup (Windows / Mac / Linux)

```bash
cd deliver
# or rename folder to whatever you like

npm install
node server.js
```

Open:
- Home + Quantum Shell: http://localhost:3002/
- NEPSE screener:        http://localhost:3002/nepse
- Classroom:             http://localhost:3002/classroom
- Admin:                 http://localhost:3002/admin

PIN is in `.env` → `SITE_PIN` (default from your file).

## Replace into your existing local folder

If you already have the full site:

| Copy this file | Overwrite |
|----------------|-----------|
| `server.js` | yes |
| `public/index.html` | yes |
| `public/classroom.html` | yes |
| `public/admin.html` | yes |
| `public/assets/admin.js` | yes |
| `data/classroom-slides.json` | yes (new) |

Keep your existing:
- `data/knowledge.json`
- `public/assets/classroom/*.jpg` (images)
- `.env` (your PIN / payment keys)

Then:

```bash
npm install
node server.js
```

## Notes
- Port: **3002** (change in `.env` → `PORT=`)
- NEPSE bar needs the live proxy in `server.js` (already included)
- Classroom images live in `public/assets/classroom/`
- Do not commit `.env` if it has live payment secrets
