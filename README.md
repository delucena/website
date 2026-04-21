# Lucena Soluções - Website Institucional

Landing page institucional da Lucena Soluções, construída com foco em:

- alta performance (alvo Lighthouse 100)
- acessibilidade e SEO técnico
- arquitetura simples e escalável
- deploy no Cloudflare Pages (site + função de contato)

## Stack

- Vite (site estático)
- HTML sem hidratação JS
- CSS puro com design tokens
- Cloudflare Pages Functions (`/api/contact`)

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

Variáveis de ambiente/secrets no Cloudflare Pages (Production e Preview):

- `RESEND_API_KEY`: chave da API da Resend.
- `CONTACT_TO_EMAIL`: e-mail de destino (ex.: `josepaulo@delucena.dev`).
- `CONTACT_FROM_EMAIL`: remetente validado na Resend (ex.: `contato@lucenasolucoes.com`).
- `CONTACT_SUBJECT_PREFIX` (opcional): prefixo do assunto (ex.: `[Site Lucena]`).

## Estrutura

```text
src/
  styles/        # Estilos globais e tokens
  scripts/       # Scripts de analytics e formulario
public/
  assets/images/ # Assets otimizados
functions/
  api/           # Endpoints Cloudflare Pages Functions
```

## Analytics (GA4)

O site possui instrumentacao GA4 via `src/scripts/analytics.js`.

### Configuracao

1. Crie um arquivo `.env` na raiz (ou copie de `.env.example`).
2. Defina seu Measurement ID:

```bash
VITE_GA4_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_CONTACT_ENDPOINT=/api/contact
```

3. Rode `npm run build` e publique.

Sem `VITE_GA4_MEASUREMENT_ID`, o script nao envia eventos.

### Eventos enviados

- `entry_origin_detected`: classifica origem de entrada (`paraiba_pet`, `google`, `direct`, `referral`) e envia UTM/referrer.
- `cta_click`: clique em links (internos, externos e `tel`).
- `contact_click`: clique em contato telefônico (`tel`).
- `modal_open` e `modal_close`: interacao com modais da pagina do Paraiba Pet.
- `contact_form_submit_attempt`, `contact_form_submit_success`, `contact_form_error`: ciclo de envio do formulário.

## Formulário de contato

- O formulário envia para `POST /api/contact` via `src/scripts/contact-form.js`.
- O endpoint fica em `functions/api/contact.js` e dispara e-mail via API da Resend.
- Sem configuração de `RESEND_API_KEY`, o endpoint retorna indisponível (503).

### Padrao de UTM recomendado

Use sempre:

- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_id` (recomendado para governanca)

Exemplo:

```text
https://lucenasolucoes.com/?utm_source=paraiba_pet&utm_medium=referral&utm_campaign=institucional_2026q2&utm_id=pp_case_site
```

## Indexacao (SEO)

O site foi ajustado com base de indexacao para Google:

- titulos e descricoes com foco em causa animal, sistema de gerenciamento e denuncias/maus-tratos;
- `meta robots` para index/follow;
- dados estruturados (`Organization`, `WebSite`, `SoftwareApplication`, `WebPage`, `Service`);
- `sitemap.xml` com `lastmod`.

### Checklist operacional

1. Publicar o deploy em producao.
2. Enviar `https://lucenasolucoes.com/sitemap.xml` no Google Search Console.
3. Solicitar indexacao das URLs principais:
   - `https://lucenasolucoes.com/`
   - `https://lucenasolucoes.com/paraiba-pet.html`
4. Monitorar cobertura e consultas no Search Console (Performance > Consultas).
