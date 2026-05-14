# Dashboard Arduino (Electron + React + Vite)

Dashboard industrial em tempo real para leitura via Serial (USB/COM) e visualização com UI em React.

## Requisitos

- Windows
- Node.js (recomendado Node 20 LTS)

## Rodar em desenvolvimento (PowerShell)

Se o PowerShell bloquear `npm.ps1`, use `npm.cmd`.

```powershell
cd D:\PAT
npm.cmd install --include=dev --no-audit --no-fund
npm.cmd run dev
```

## Build Windows (local)

```powershell
cd D:\PAT
npm.cmd install --include=dev --no-audit --no-fund
npm.cmd run build:renderer
npx electron-builder --win --x64 --publish never
```

Os artefatos são gerados em `release/`.

## CI (GitHub Actions)

O workflow `build-windows` gera um artifact em `.zip`. Após baixar e extrair, os executáveis ficam em `release/` (portable + NSIS).

## Ícone do app

O ícone do app é lido de `build/icon.png` (configurado no `package.json`).
