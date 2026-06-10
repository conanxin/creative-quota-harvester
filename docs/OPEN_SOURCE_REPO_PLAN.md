# Open Source Repository Plan

**Purpose:** Define the steps to publish `creative-quota-harvester` and `creative-quota-assets` as open source on GitHub.

---

## Repository Architecture

| Repo | Purpose | License | Contents |
|------|---------|---------|----------|
| `creative-quota-harvester` | Main program | MIT | TypeScript source, adapters, pipeline, scripts |
| `creative-quota-assets` | Open asset library | MIT + CC-BY + CC-BY-NC | Content packs, prompts, gallery, metadata |

---

## What to Publish Now (Ready)

### creative-quota-harvester
- ✅ All source adapters (except GitHub Radar which is configured to exclude conanxin/*)
- ✅ `src/pipeline/` — signal collection, brief generation, content pack export
- ✅ `src/types/` — data structures
- ✅ `src/storage/` — SQLite storage layer
- ✅ `src/utils/` — fetch-with-retry, utilities
- ✅ Scripts: `collect.ts`, `diagnose-sources.ts`, `generate-briefs.ts`, `validate-assets.ts`
- ✅ `docs/` — ARCHITECTURE.md, SOURCE_ADAPTERS.md, PHASE_0A_REPORT.md, PHASE_1_*.md, PHASE_2A_*.md
- ✅ `README.md`, `ROADMAP.md`, `DEVELOPMENT_HANDOFF.md`
- ✅ `package.json`, `tsconfig.json`, `.env.example`

**Requires before publish:**
- Add `.gitignore` (exclude `node_modules/`, `data/`, `.env`)
- Remove any hardcoded paths to `/home/ubuntu/` in comments
- Add GitHub Actions CI for `npm run type-check && npm run diagnose:sources`

### creative-quota-assets
- ✅ `content-packs/` — creative briefs + prompts (all real, no conanxin/* contamination)
- ✅ `gallery/` — static HTML gallery + assets.json
- ✅ `metadata/` — asset indices
- ✅ `README.md` — project description + structure
- ✅ `LICENSE` (MIT) + `LICENSE-ASSETS` (CC-BY / CC-BY-NC)

**Requires before publish:**
- Add `.gitignore` (exclude generated media: `images/`, `videos/`, `music/` — keep directory markers)
- Ensure `gallery/index.html` has inline asset data for offline use

---

## What to Keep Private (Not Ready)

| Item | Reason | When to publish |
|------|--------|----------------|
| `.env` files | Contains API keys | Never in public repo |
| `data/signals.db` | Contains signal data | Review before publishing |
| `reports/` | May contain internal analysis | Publish after review |
| Personal notes in `memory/` | User private data | Never |
| OpenClaw workspace configs | System configuration | Never |

---

## License Strategy

### creative-quota-harvester
- **License:** MIT
- All code is original work
- No dependencies with conflicting licenses

### creative-quota-assets

| Content | License | Rationale |
|---------|---------|-----------|
| Source code / metadata JSON | MIT | Reusable by anyone |
| Prompts + briefs (text) | CC-BY 4.0 | Attribution required, commercial OK |
| Generated media (future) | CC-BY-NC 4.0 | Non-commercial only, protects the project |
| Asset metadata | CC01.0 | Public domain dedication for data |

**Why CC-BY-NC for media?** This project monetizes via the generation pipeline (MiniMax quota). Allowing free commercial use of generated media would undercut the business model. CC-BY 4.0 is used for text prompts to maximize reuse.

---

## GitHub Pages Setup

### creative-quota-assets
```
Repository: github.com/conanxin/creative-quota-assets
Branch: gh-pages (or main)
Source: /gallery/
URL: https://conanxin.github.io/creative-quota-assets/
```

The gallery is a **pure static HTML page** — no Jekyll, no build step. GitHub Pages serves it directly.

### creative-quota-harvester
No GitHub Pages needed. The repo is a program, not a website.

---

## Publishing Steps (Manual — Do Not Auto-Execute)

**Step 1: Create repos (manual confirmation required)**
```bash
gh repo create creative-quota-harvester --public --MIT
gh repo create creative-quota-assets --public --MIT
```

**Step 2: Prepare harvester**
```bash
cd ~/.openclaw/workspace/projects/creative-quota-harvester
# Add .gitignore
echo "node_modules/" > .gitignore
echo "data/" >> .gitignore
echo ".env" >> .gitignore
git init && git add -A && git commit -m "Initial commit"
```

**Step 3: Prepare assets**
```bash
cd ~/.openclaw/workspace/projects/creative-quota-assets
# Add .gitignore (keep dir structure, ignore media files)
echo "images/*.jpg" > .gitignore
echo "images/*.png" >> .gitignore
echo "videos/*" >> .gitignore
echo "music/*" >> .gitignore
git init && git add -A && git commit -m "Initial commit"
```

**Step 4: Push (manual confirmation required)**
```bash
gh repo sync --force
```

---

## Important Notes

1. **GitHub Radar hardcoded exclusion is preserved** — `NOT user:conanxin` is enforced client-side in `github-open-source-radar.ts`. This means even if someone forks the repo and removes the code, the behavior is preserved for our deployment. External users will still get GitHub data — just not conanxin/* repos.

2. **No automated `gh repo create`** — This plan does NOT execute `gh repo create` automatically. It writes the plan only. User must confirm before execution.

3. **No API keys in code** — MiniMax API key is read from `.env`. The `.env.example` template contains placeholder only. This is already correct.

4. **conanxin/* contamination check** — Before any public release, run `npm run validate:assets` and confirm0 conanxin/* results.

---

## Status

- [x] Plan written (Phase 2B)
- [ ] `.gitignore` added to both repos
- [ ] `data/` signals reviewed before publishing
- [ ] `reports/` reviewed before publishing
- [ ] GitHub repos created manually
- [ ] GitHub Pages configured for assets gallery
- [ ] Initial commits pushed