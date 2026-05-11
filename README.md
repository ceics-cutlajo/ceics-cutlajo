# CEICS CUTLAJO — App Next.js

Plataforma del **Comité de Ética en Investigación en Ciencias de la Salud (CEICS)** · División Salud · CUTlajomulco · UDG.

---

## Stack

- **Next.js 15** (App Router, Server Components, Server Actions)
- **TypeScript** estricto
- **Tailwind CSS** con tokens CUTLAJO
- **Supabase** (PostgreSQL + Auth + Storage + RLS)
- **Resend** (correos transaccionales)
- **Vercel** (hosting)

---

## Requisitos

- **Node.js** 20+
- **pnpm** (recomendado) o npm
- **Supabase CLI** — `brew install supabase/tap/supabase` (en macOS)

---

## Instalación rápida

```bash
cd "CEIC CUTLAJO/app"

# 1. Instalar dependencias
pnpm install

# 2. Copiar variables de entorno
cp .env.example .env.local
# editar .env.local con tus credenciales reales

# 3. (Opcional) Levantar Supabase local para pruebas
supabase start
supabase db reset    # aplica migraciones + seeds

# 4. Generar tipos TypeScript de la DB
pnpm db:types

# 5. Correr la app en desarrollo
pnpm dev
# → http://localhost:3000
```

---

## Estructura

```
src/
├── app/
│   ├── (auth)/             ← login, signup, verifica-correo, crear-contraseña
│   ├── (app)/              ← rutas protegidas con sidebar
│   │   ├── dashboard/      ← investigador
│   │   ├── protocolo/      ← sometimiento
│   │   ├── comite/         ← bandeja de votación
│   │   ├── presidencia/    ← tablero
│   │   └── normatividad/   ← lectura pública
│   ├── api/auth/callback/  ← intercambio de magic-link
│   ├── layout.tsx
│   └── globals.css
│
├── components/
│   └── layout/             ← Sidebar, Logo
│
├── lib/
│   ├── supabase/           ← clients (browser, server, admin, middleware)
│   └── auth/               ← validación dominio UDG, schemas, server actions
│
├── types/                  ← database.types.ts (generado), domain.ts (custom)
└── middleware.ts           ← refresh sesión + protección rutas

supabase/
├── config.toml             ← config CLI local
└── migrations/             ← 12 archivos SQL (001..012)
```

---

## Variables de entorno requeridas

Ver `.env.example`. Lo crítico:

| Variable | De dónde sale |
|----------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | idem (anon public) |
| `SUPABASE_SERVICE_ROLE_KEY` | idem (service_role · ⚠️ secreta) |
| `RESEND_API_KEY` | Resend Dashboard → API Keys |
| `EMAIL_FROM` | Email remitente verificado en Resend |

---

## Despliegue a Vercel

1. Sube el repo a GitHub.
2. En Vercel: **Add New → Project → Import**.
3. **Root Directory** = `CEIC CUTLAJO/app` (importante).
4. **Framework**: Next.js (auto-detectado).
5. Configura las mismas variables de entorno en Vercel Dashboard.
6. Click **Deploy**.

Cada `git push` redespliega automáticamente.

### Configurar Auth post-deploy

En Supabase Dashboard → Authentication → URL Configuration:
- **Site URL** = `https://tu-dominio-vercel.app`
- **Redirect URLs** = `https://tu-dominio-vercel.app/api/auth/callback`

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

- **investigador** — somete protocolos
- **comite_vocal** / **comite_secretario** — votan
- **presidente** — emite acta final
- **admin_sistema** — operación

Asignación de roles vía tabla `usuario_roles`. Los 7 miembros oficiales del CEICS se siembran en migración `012_seed_comite.sql`.

---

## Estado de implementación (sesión 3 · 11 may 2026)

- ✅ Scaffold completo Next.js 15 + TypeScript + Tailwind
- ✅ 12 migraciones SQL listas para `supabase db push`
- ✅ Validación de dominio UDG (`@academicos.udg.mx`, `@cutlajomulco.udg.mx`, `@alumnos.udg.mx`)
- ✅ Magic-link signup + crear contraseña
- ✅ Layout autenticado con sidebar por rol (investigador / comité / presidencia)
- ✅ 5 dashboards placeholder (dashboard, protocolo/nuevo, comite/bandeja, presidencia, normatividad)
- ⏳ Formulario de sometimiento de protocolo → sesión 4
- ⏳ Carga de archivos a Supabase Storage → sesión 4
- ⏳ Scheduled task IA + pre-informe → sesión 5
- ⏳ Votación del comité → sesión 6
- ⏳ Generación de actas DOCX → sesión 7

---

## Reportar problemas

- Documentación maestra: `/Users/jaibri/Documents/CEIC CUTLAJO/`
  - `CONTEXTO.md` — onboarding rápido
  - `PROGRESS.md` — bitácora de sesiones
  - `docs/04_ARQUITECTURA.md` — referencia técnica
- Owner: Dr. Jaime Briseño Ramírez (Presidente CEICS)
