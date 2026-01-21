# ClinicFlow Admin (GitHub Pages + Vercel API)

Repo: `stellaxychen-ux/codesearching`
Data path: `data/patient_claims.json`
Admin URL (GitHub Pages): `https://stellaxychen-ux.github.io/codesearching/admin/`

## What you get
- A secure admin page: `admin/index.html`
- A Vercel API that commits to GitHub: `api/add-claim.js`

## Setup steps
1) Copy `admin/` + `api/` + `vercel.json` into your repo root and commit.
2) Ensure `data/patient_claims.json` exists in the repo.
3) Deploy on Vercel (import same repo).
4) In Vercel → Project Settings → Environment Variables:
   - `GITHUB_TOKEN` = fine-grained GitHub token with Contents Read/Write for this repo
5) Deploy. Copy the Vercel URL.
6) Open the admin page and paste the Vercel URL into "API Base", then Save.

## Token permissions (GitHub)
Create a fine-grained PAT with:
- Repository access: only `stellaxychen-ux/codesearching`
- Permissions: **Contents: Read and write**
