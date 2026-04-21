# Lucena Soluções - Website Institucional

Landing page institucional da Lucena Soluções, construída com foco em:

- alta performance (alvo Lighthouse 100)
- acessibilidade e SEO técnico
- arquitetura simples e escalável
- deploy estático no Cloudflare Pages

## Stack

- Vite (site estático)
- HTML sem hidratação JS
- CSS puro com design tokens

## Rodar localmente

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy no Cloudflare Pages

Configuração recomendada no projeto Pages:

- Build command: `npm run build`
- Build output directory: `dist`
- Node version: `20`

## Estrutura

```text
src/
  styles/        # Estilos globais e tokens
public/
  assets/images/ # Assets otimizados
```
