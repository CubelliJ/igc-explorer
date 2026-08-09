# IGC Explorer

Simulador interactivo del **Impuesto Global Complementario** (Chile, Art. 52 LIR · AT 2026) y **Migrador 107** (rescate Art. 108 → 107 sin subir de tramo).

En IGC Explorer ajustas sueldo, bono, alza y ganancia de fondos; el impuesto se muestra como el área bajo la escalera de tasas marginales. En Migrador 107 subes el certificado CSV de Fintual y comparas FIFO/LIFO bajo un tope de ganancia.

## Desarrollo local

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## GitHub Pages

El sitio se publica en:

**https://cubellij.github.io/igc-explorer/**

Cada push a `main` dispara el workflow en `.github/workflows/deploy.yml`.

En el repo: **Settings → Pages → Source: GitHub Actions**.

## Nota

Estimación educativa. No reemplaza asesoría tributaria ni la propuesta del SII.
