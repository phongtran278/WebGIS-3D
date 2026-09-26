# WebGIS 3D — Apartment Management

Interactive Checkpoint 3 prototype for **Hệ thống thông tin địa lý 3 chiều (IE402)**.

## Prototype
- React + Vite frontend
- Three.js procedural 8-floor apartment building
- Floor slicing/filtering
- Thematic room status colors
- Raycasting: click room → room/body metadata → inspector
- Dashboard + apartment/tenant/contract/utility/maintenance/report UI drafts
- PlotFlow-inspired design tokens and interaction language

## Target architecture
React + Three.js → REST API / JSON → Node.js + Express.js → PostgreSQL + PostGIS.

See:
- `docs/ARCHITECTURE.md`
- `docs/UI_SPEC.md`

## Local run
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```

A GitHub Pages workflow is included at `.github/workflows/deploy-pages.yml`.
