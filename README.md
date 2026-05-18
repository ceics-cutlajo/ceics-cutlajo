# CEICS CUTLAJO

**Plataforma digital de gestión de protocolos de investigación**
del Comité de Ética en Investigación en Ciencias de la Salud (CEICS)
de la División de Salud, Centro Universitario de Tlajomulco,
Universidad de Guadalajara.

[![DOI](https://img.shields.io/badge/DOI-10.5281%2Fzenodo.20264976-blue)](https://doi.org/10.5281/zenodo.20264976)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Manual: CC BY-NC-SA 4.0](https://img.shields.io/badge/Manual-CC%20BY--NC--SA%204.0-lightgrey)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![Plataforma](https://img.shields.io/badge/Plataforma-ceics--cutlajo.com-brightgreen)](https://ceics-cutlajo.com)

---

## Cesión institucional

El código fuente de esta plataforma y su documentación de usuario se ceden, **sin fines lucrativos**, a la **División de Salud del Centro Universitario de Tlajomulco — Universidad de Guadalajara**, como herramienta institucional permanente para la operación del Comité de Ética en Investigación en Ciencias de la Salud (CEICS).

La autoría intelectual del diseño y del manual queda atribuida a sus autores conforme a la Cita académica más abajo. El código fuente se publica bajo Licencia **MIT**; el manual de usuario, depositado en Zenodo con DOI persistente, se distribuye bajo **CC BY-NC-SA 4.0**.

Durante la gestión del autor principal como Presidente del CEICS, el repositorio queda bajo su administración. La División, representada institucionalmente por la Secretaría Académica y la Coordinación de Investigación, dispone de permisos administrativos sobre este repositorio para garantizar la continuidad institucional.

---

## ¿Qué hace esta plataforma?

Digitaliza el ciclo completo de evaluación ética de protocolos de investigación:

1. **Sometimiento asistido** del investigador (extracción por IA del protocolo + wizard).
2. **Pre-análisis automatizado** contra el checklist normativo del CEICS (modelo Claude Haiku) con observaciones críticas y sugerencias.
3. **Evaluación deliberativa colegiada** por bloques temáticos, con voto razonado y manejo automático de conflicto de interés.
4. **Emisión del dictamen** por la Presidencia (o por delegación a la Secretaría si la Presidencia tiene COI), con generación instantánea del acta institucional en PDF/DOCX y folio digital de verificación (SHA-256).
5. **Archivo institucional** con semáforo de vigencia, ficha pública de verificación (`/v/[hash]`) y bitácora de auditoría.

Marco normativo aplicado: Ley General de Salud, NOM-012-SSA3-2012, Declaración de Helsinki, pautas CIOMS–OMS, Reporte Belmont, ICH-GCP E6(R3), lineamientos CONBIOÉTICA y Estatuto General UdeG.

---

## Citación académica

> Briseño-Ramírez, J., & De Arcos-Jiménez, J. C. (2026). *Manual de Usuario CEICS CUTLAJO — Plataforma digital de gestión de protocolos de investigación* (Versión 1.2.0) [Manual]. Zenodo. https://doi.org/10.5281/zenodo.20264976

**BibTeX:**

```bibtex
@manual{briseno_ceics_cutlajo_2026,
  author    = {Brise{\~n}o-Ram{\'i}rez, Jaime and
               De Arcos-Jim{\'e}nez, Judith Carolina},
  title     = {Manual de Usuario {CEICS} {CUTLAJO} --- Plataforma
               digital de gesti{\'o}n de protocolos de
               investigaci{\'o}n},
  year      = {2026},
  version   = {1.2.0},
  publisher = {Zenodo},
  doi       = {10.5281/zenodo.20264976},
  url       = {https://doi.org/10.5281/zenodo.20264976}
}
```

DOI persistente concept (apunta siempre a la última versión): [10.5281/zenodo.20264975](https://doi.org/10.5281/zenodo.20264975).

---

## Stack técnico

- **Next.js 15** (App Router, Server Components, Server Actions)
- **TypeScript** estricto
- **Tailwind CSS** con tokens visuales UdeG / CUTLAJO
- **Supabase** (PostgreSQL + Auth + Storage + RLS)
- **Anthropic Claude** (Sonnet 4.6 para extracción de protocolos · Haiku 4.5 para pre-análisis del comité)
- **Resend** (correos transaccionales)
- **Vercel** (hosting con auto-deploy desde `main`)

---

## Requisitos

- **Node.js** 20+
- **pnpm** (recomendado) o npm
- **Supabase CLI** — `brew install supabase/tap/supabase` (en macOS)

## Instalación rápida

```bash
git clone https://github.com/jaimebriseno-boop/ceics-cutlajo.git
cd ceics-cutlajo/app

# 1. Dependencias
pnpm install

# 2. Variables de entorno
cp .env.example .env.local
# Editar .env.local con las credenciales reales (ver tabla abajo)

# 3. (Opcional) Base de datos local para pruebas
supabase start
supabase db reset    # aplica migraciones + seeds

# 4. Generar tipos TypeScript de la DB
pnpm db:types

# 5. Servidor de desarrollo
pnpm dev
# → http://localhost:3000
```

## Variables de entorno

Ver `.env.example`. Variables críticas:

| Variable | De dónde sale |
|----------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | idem (anon public) |
| `SUPABASE_SERVICE_ROLE_KEY` | idem (service_role · ⚠️ secreta) |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `RESEND_API_KEY` | Resend Dashboard → API Keys |
| `EMAIL_FROM` | Email remitente verificado en Resend |
| `NEXT_PUBLIC_APP_URL` | Dominio público (ej. `https://ceics-cutlajo.com`) |

---

## Estructura del repositorio

```
src/
├── app/
│   ├── (auth)/             ← login, signup, magic link
│   ├── (app)/              ← rutas protegidas
│   │   ├── dashboard/      ← investigador
│   │   ├── protocolo/      ← sometimiento + edición + procesando
│   │   ├── comite/         ← bandeja + expediente con voto
│   │   ├── presidencia/    ← tablero + dictamen + actas
│   │   └── normatividad/   ← marco normativo público
│   ├── api/                ← callbacks de auth y endpoints IA
│   └── v/[hash]/           ← ficha pública de verificación de acta
│
├── components/             ← UI compartida (actas, comité, layout, visual)
├── lib/                    ← supabase clients, auth, actas, evaluaciones, IA
├── types/                  ← database.types.ts (generado)
└── middleware.ts           ← refresh de sesión + protección de rutas

supabase/
├── config.toml             ← config CLI local
└── migrations/             ← 20+ archivos SQL (001..020)
```

---

## Despliegue a Vercel

1. Conectar el repo de GitHub a Vercel.
2. **Root Directory** = `app/`.
3. **Framework**: Next.js (auto-detectado).
4. Configurar las variables de entorno listadas arriba.
5. Cada `git push` a `main` redespliega automáticamente.

### Configuración post-despliegue en Supabase

Authentication → URL Configuration:
- **Site URL** = `https://ceics-cutlajo.com`
- **Redirect URLs** = `https://ceics-cutlajo.com/api/auth/callback`

---

## Scripts disponibles

| Comando | Acción |
|---------|--------|
| `pnpm dev` | Servidor desarrollo (http://localhost:3000) |
| `pnpm build` | Build producción |
| `pnpm start` | Sirve build producción local |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Verifica tipos sin compilar |
| `pnpm db:reset` | Reinicia DB local + aplica migraciones + seeds |
| `pnpm db:push` | Aplica migraciones a DB remoto |
| `pnpm db:types` | Genera tipos TypeScript desde DB |
| `pnpm format` | Prettier en todo el código |

---

## Roles del sistema

| Rol | Función |
|-----|---------|
| `investigador` | Somete protocolos, atiende observaciones |
| `comite_vocal` | Evalúa y vota |
| `comite_secretario` | Vota y firma actas por delegación cuando aplica COI presidencial |
| `presidente` | Emite el dictamen final |
| `admin_sistema` | Operación y soporte |

Asignación de roles vía tabla `usuario_roles`. Los 7 miembros oficiales del CEICS se siembran en migración `012_seed_comite.sql`.

---

## Licencias

- **Código fuente** (`/app`): Licencia **MIT** — ver [`LICENSE`](./LICENSE).
- **Manual de Usuario** (depositado en Zenodo): **CC BY-NC-SA 4.0** — Atribución, No Comercial, Compartir Igual.

Las marcas, escudos y logotipos de la Universidad de Guadalajara y del Centro Universitario de Tlajomulco son propiedad de la institución y se utilizan en el contexto institucional autorizado; no se incluyen en la licencia MIT del código.

---

## Autoría

| Autor | Rol | ORCID |
|---|---|---|
| **Dr. Jaime Briseño-Ramírez** | Presidente del CEICS · diseño, desarrollo, autoría intelectual | [0009-0006-1901-392X](https://orcid.org/0009-0006-1901-392X) |
| **Dra. Judith Carolina De Arcos-Jiménez** | Vocal del CEICS · co-autoría del manual | [0000-0003-0251-6425](https://orcid.org/0000-0003-0251-6425) |

## Administración institucional

Por designación de la División de Salud, CUTLAJO — UdeG:

- **Roberto Miguel Damián Negrete** — Coordinación / División de Salud
- **Paloma Gallegos Tejeda** — Secretaría / División de Salud

---

## Recursos

- 🌐 Plataforma en producción: https://ceics-cutlajo.com
- 📘 Manual de Usuario (PDF): https://doi.org/10.5281/zenodo.20264976
- 📦 Código fuente: https://github.com/jaimebriseno-boop/ceics-cutlajo
- 🏛️ Centro Universitario de Tlajomulco: http://www.cutlajomulco.udg.mx
