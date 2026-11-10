# ADR-0002: Deploy Only `app/` Directory to GitHub Pages

- **Status**: Accepted
- **Date**: 2026-11-10

## Context
In v1, GitHub Pages deployed from the root `/` of the `main` branch. Because of this:
1. Copyrighted exam PDFs and textbooks in `raw_materials/` (25 MB), intermediate JSON/text dumps in `data/`, and 120+ Python/Node scripts in `scripts/` were publicly accessible via URL on the live site.
2. Repository root was cluttered with both web assets and offline data-engineering scripts.

## Decision
1. Move all deployable web assets into a dedicated `app/` directory (`app/index.html`, `app/styles/`, `app/js/`, `app/data/questions.json`).
2. Configure `.github/workflows/deploy-pages.yml` using `actions/upload-pages-artifact` with `path: ./app` so **only** the `app/` directory is published to GitHub Pages.
3. Stop tracking `raw_materials/` in Git (`git rm -r --cached raw_materials` + `.gitignore`) and move the ~110 historical one-off extraction scripts to an out-of-repo sibling directory (`../nursing-education-ai-archive/`) documented for future AI reference.

## Consequences
- **Positive**:
  - Only clean, production web files (`index.html`, CSS, JS modules, `questions.json`) are reachable on `benrotlevy.github.io`.
  - Copyrighted raw PDFs and internal scripts are no longer served publicly.
  - Deployment artifact shrinks from ~35 MB to ~4 MB.
- **Negative / Trade-offs**:
  - At v2 release cutover, the repository owner flips *Settings → Pages → Build and deployment → Source* from "Deploy from a branch" to "GitHub Actions".
