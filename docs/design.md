> **Copia de referencia.** El documento canónico vive en la carpeta madre del proyecto local (`design.md`, fuera de este repo). Sincronizar al actualizar.

# Sistema de Diseño — UDG / CUTLAJO Salud

**Versión 1.0 · Junio 2026**
Documento reutilizable para proyectos digitales de la división de salud Universidad de Guadalajara / CUTLAJO. Estilo: minimalismo institucional plano, inspirado en el portal de Transparencia UDG (transparencia.udg.mx). Pensado para que un desarrollador o una IA lo aplique a un proyecto nuevo sin contexto adicional.

---

## 1. Filosofía del sistema

**"Gobierno universitario bien diseñado":** sobrio, plano, legible, con jerarquía clara. El color comunica estructura e identidad, nunca decora.

**Sí:**
- Blanco dominante con espacio en blanco generoso. El aire ES el diseño.
- Bloques de color sólido con texto blanco para titular secciones (firma visual UDG).
- Reglas finas de 1px como divisores; bordes de 1px en lugar de sombras.
- Radios de borde pequeños (4–8px máximo). Esquinas casi rectas.
- Jerarquía por tamaño, peso y espacio — no por color ni ornamento.
- Transiciones discretas (150–200ms, opacidad/color). La interfaz responde, no actúa.

**No:**
- Gradientes (animados o estáticos) como decoración.
- Sombras pesadas, glassmorphism, neumorphism, profundidad simulada.
- Decoración que no informa: iconos ornamentales, ilustraciones genéricas, emojis en UI.
- Color saturado en grandes superficies fuera de los bloques de título y el sidebar.

---

## 2. Paleta

### 2.1 Rojos UDG (identidad)

Extraídos del sitio real de Transparencia UDG (portada y subpáginas: protección de datos, datos abiertos).

| Token | Hex | Nombre | Rol |
|---|---|---|---|
| `rojo-700` | `#701d14` | Rojo ladrillo profundo | **Dominante.** Botón primario, bloques de identidad |
| `rojo-600` | `#90303a` | Rojo vino | Barras de título de sección (texto blanco encima), links de énfasis |
| `rojo-500` | `#9a2c1c` | Rojo ladrillo claro | Hover de primario, acentos, barra activa del sidebar |
| `rojo-650` | `#86212b` | Rojo carmesí | Estado active/pressed de primario |
| `rojo-900` | `#4a2f32` | Granate oscurísimo | Casi neutro; texto sobre tintes rojos, footers de identidad |
| `rojo-800` | `#602321` | Caoba (subpáginas UDG) | Tono extendido: fondos oscuros de identidad, hover de rojo-700 |
| `rojo-950` | `#3d1212` | Sangre de toro (subpáginas UDG) | Tono extendido: el más profundo; solo fondos |

### 2.2 Azules (estructura)

| Token | Hex | Nombre | Rol |
|---|---|---|---|
| `azul-900` | `#27334F` | Azul marino profundo | Sidebar, headers de tabla oscuros, texto principal alternativo |
| `azul-800` | `#36476E` | Azul marino | Hover de secundario, ítem activo del sidebar |
| `azul-700` | `#455A8C` | Azul acero | Focus ring, links estructurales, info |
| `azul-600` | `#546EAB` | Azul medio | Acentos secundarios, iconografía funcional |
| `azul-500` | `#7388BA` | Azul claro | Solo decorativo o texto grande sobre blanco; eyebrows sobre navy |
| `azul-400` | `#92A2C9` | Azul niebla | Fondos suaves con texto navy, texto secundario sobre navy |
| `azul-300` | `#B0BCD8` | Azul hielo | Fondos suaves, bordes sobre navy, texto sobre navy |

### 2.3 Grises fríos (superficies y texto)

| Token | Hex | Rol |
|---|---|---|
| `blanco` | `#ffffff` | Fondo base de la aplicación |
| `gris-50` | `#f7f8fa` | Fondo de página alternativo, hover de filas |
| `gris-100` | `#eef0f4` | Fondos de paneles secundarios |
| `gris-200` | `#dde1e8` | **Bordes y divisores estándar (1px)** |
| `gris-300` | `#c3c9d4` | Bordes de inputs, divisores marcados |
| `gris-400` | `#9aa3b2` | Solo decorativo: iconos inactivos, placeholders. ⚠️ No usar como texto (2.5:1) |
| `gris-500` | `#6b7585` | Texto secundario mínimo permitido (4.66:1 AA) |
| `gris-600` | `#4b5462` | Texto secundario cómodo |
| `gris-700` | `#333a47` | Texto de cuerpo alternativo |
| `gris-800` | `#21262f` | Fondos oscuros neutros |
| `gris-900` | `#14181f` | **Texto principal** (casi-negro azulado) |

### 2.4 Proporción y reglas de uso

**Proporción aproximada por vista: 70 / 20 / 10.**
- **~70% blanco y grises:** todas las superficies, tarjetas, fondos.
- **~20% azules:** sidebar, navegación, headers de tabla, focus, info. El azul es **estructura**.
- **~10% rojos:** barras de título, botón primario, acentos. El rojo es **identidad y acción** — escaso para que pese.

**Cuándo rojo:** la acción principal de la vista (un solo botón primario), barras de título de sección, acento del ítem activo del sidebar, links de énfasis institucional.
**Cuándo azul:** todo lo estructural y de navegación; estados informativos; focus.
**Nunca:** rojo sobre azul ni azul sobre rojo. Conviven solo separados por blanco (excepción única: barra de acento `rojo-500` de 3px sobre el sidebar navy).

**Texto blanco va sobre:** los rojos, `azul-900/800/700/600`, `gris-600` y más oscuros, y los semánticos base.
**Texto oscuro (`gris-900` o `azul-900`) va sobre:** blanco, `gris-50/100/200`, `azul-300`, `azul-400`, y todos los tintes semánticos.

---

## 3. Accesibilidad — pares de contraste aprobados

Ratios WCAG 2.1 calculados. AA texto normal ≥ 4.5:1 · AAA ≥ 7:1 · AA texto grande ≥ 3:1.

| Primer plano | Fondo | Ratio | Nivel | Uso |
|---|---|---|---|---|
| `#ffffff` | `#701d14` rojo-700 | 11.20:1 | AAA | Botón primario |
| `#ffffff` | `#90303a` rojo-600 | 7.87:1 | AAA | **Barra de título de sección** |
| `#ffffff` | `#9a2c1c` rojo-500 | 7.63:1 | AAA | Hover primario |
| `#ffffff` | `#86212b` rojo-650 | 9.27:1 | AAA | Active primario |
| `#ffffff` | `#4a2f32` rojo-900 | 12.04:1 | AAA | Footer identidad |
| `#ffffff` | `#27334F` azul-900 | 12.55:1 | AAA | **Sidebar, header de tabla** |
| `#ffffff` | `#36476E` azul-800 | 9.20:1 | AAA | Hover secundario |
| `#ffffff` | `#455A8C` azul-700 | 6.79:1 | AA | Badges info, focus visible |
| `#ffffff` | `#546EAB` azul-600 | 5.01:1 | AA | Acentos con texto |
| `#ffffff` | `#7388BA` azul-500 | 3.52:1 | Solo AA grande | ⚠️ Únicamente texto grande/decorativo |
| `#27334F` | `#ffffff` | 12.55:1 | AAA | Titulares alternativos |
| `#14181f` | `#ffffff` | 17.79:1 | AAA | **Texto principal** |
| `#6b7585` | `#ffffff` | 4.66:1 | AA | Texto secundario (mínimo) |
| `#90303a` | `#ffffff` | 7.87:1 | AAA | Links de énfasis |
| `#27334F` | `#B0BCD8` | 6.59:1 | AA | Texto sobre fondo hielo |
| `#27334F` | `#92A2C9` | 4.92:1 | AA | Texto sobre fondo niebla |

**Reglas duras:** nunca texto en `gris-400` o más claro sobre blanco; `azul-500 #7388BA` jamás como texto de cuerpo; focus ring (`azul-700`, 2px, offset 2px) obligatorio en todo elemento interactivo; el color nunca es el único portador de significado.

---

## 4. Tipografía

**Barlow** (Google Fonts) para todo el sistema. **JetBrains Mono** para folios, códigos y datos técnicos.
*Justificación: Camber, la fuente del portal UDG, es de licencia privada; Barlow es la alternativa libre más cercana en proporciones y carácter.*

Cargar: Barlow 400, 500, 600, 700, 800 · JetBrains Mono 400, 500.

| Estilo | Tamaño | Peso | Tracking | Interlínea | Uso |
|---|---|---|---|---|---|
| `display` | 3rem | 800 | -0.02em | 1.1 | Portadas, héroe de módulo |
| `h1` | 2.25rem | 800 | -0.015em | 1.15 | Título de página |
| `h2` | 1.75rem | 700 | -0.01em | 1.2 | Título de sección |
| `h3` | 1.375rem | 700 | -0.005em | 1.3 | Subsección, título de tarjeta |
| `h4` | 1.125rem | 600 | 0 | 1.4 | Encabezado menor |
| `body-lg` | 1.125rem | 400 | 0 | 1.65 | Párrafos introductorios |
| `body` | 1rem | 400 | 0 | 1.6 | Texto base |
| `body-sm` | 0.875rem | 400–500 | 0 | 1.5 | UI densa, tablas |
| `caption` | 0.75rem | 500 | 0.01em | 1.4 | Notas, metadatos |
| `eyebrow` | 0.75rem | 600 | **0.10em, MAYÚSCULAS** | 1.4 | Etiquetas sobre títulos, headers de tabla |
| `mono` | 0.875rem | 500 | 0 | 1.5 | Folios, códigos, IDs (JetBrains Mono) |

Reglas: énfasis con peso (500→600), no con cursivas largas ni mayúsculas en cuerpo. Máximo ~65–75 caracteres por línea en prosa. Números tabulares (`font-variant-numeric: tabular-nums`) en tablas.

---

## 5. Componentes canónicos

### 5.1 Barra de título de sección (firma UDG)
Bloque sólido con texto blanco. El elemento más reconocible del sistema.
- Fondo `rojo-600 #90303a`, texto blanco 700, 1rem–1.125rem, MAYÚSCULAS opcionales con tracking 0.05em.
- Padding 12px 16px. Radio 0 o 4px. Sin sombra. Ancho completo del contenedor.
- Variante secundaria: fondo `azul-900 #27334F` (secciones estructurales).
- Variante ligera: eyebrow + título `gris-900` + regla inferior de 1px `gris-200` (o 2px `rojo-600` para acentuar).

### 5.2 Tarjeta plana
- Fondo blanco, **borde 1px `gris-200`**, radio 6px, padding 24px. **Sin sombra** por defecto.
- Hover (si clickeable): borde `gris-300` o sombra mínima `0 1px 2px rgba(20,24,31,.06)`.
- Variante con cabecera: barra de título (5.1) integrada arriba, radio solo abajo.

### 5.3 Botones
Altura 40px (compacto 32px), radio 4px, peso 600, 0.9375rem, padding horizontal 16–20px.
- **Primario:** fondo `rojo-700 #701d14`, texto blanco. Hover `rojo-500 #9a2c1c`. Active `rojo-650 #86212b`. **Uno por vista.**
- **Secundario:** fondo `azul-900 #27334F`, texto blanco. Hover `azul-800 #36476E`.
- **Ghost:** transparente, borde 1px `gris-300`, texto `azul-900`. Hover fondo `gris-50`.
- **Destructivo:** fondo `#a61e12` (rojo de error, no de marca).
- Deshabilitado: fondo `gris-100`, texto `gris-400`. Focus: anillo 2px `azul-700` offset 2px.

### 5.4 Inputs
- Altura 40px, fondo blanco, borde 1px `gris-300`, radio 4px, texto `gris-900`, placeholder `gris-500`.
- Focus: borde `azul-700` + anillo 2px del mismo tono al 25%.
- Error: borde `#a61e12` + mensaje 0.75rem en `#8a1c12`.
- Label arriba: 0.875rem, 500, `gris-700`. Ayuda: 0.75rem `gris-500`.

### 5.5 Badges de estado semántico
- Tinte de fondo + texto oscuro del mismo matiz + borde 1px. Radio 4px (no píldoras). 0.75rem, 600.
- Ver §7. Ejemplo: aprobado = fondo `#e7f2ec`, texto `#176442`, borde `#b9dcc9`.

### 5.6 Tablas
- Header: fondo `gris-50` con eyebrow `gris-600`; variante institucional: fondo `azul-900` texto blanco 600.
- Filas: solo borde inferior 1px `gris-200`. **Sin bordes verticales, sin cebra.** Hover `gris-50`.
- Celdas: padding 12px 16px, 0.875rem. Números a la derecha con tabular-nums. Folios en mono.

### 5.7 Sidebar navy
- Fondo `azul-900 #27334F`, ancho 256–280px.
- Ítems: texto `azul-300 #B0BCD8`, 0.9375rem, 500, radio 4px, hover fondo `azul-800` texto blanco.
- **Activo:** fondo `azul-800`, texto blanco 600, barra izquierda 3px `rojo-500 #9a2c1c` (único punto donde rojo toca azul).
- Títulos de grupo: eyebrow en `azul-500`. Divisores: `rgba(255,255,255,0.08)`.

---

## 6. Espaciado y retícula

- **Escala (base 4px):** 4, 8, 12, 16, 24, 32, 48, 64, 96. Padding interno: 12–24px. Entre secciones: 48–64px.
- **Max-width:** 72rem (1152px) en aplicación; 65ch para prosa larga.
- **Retícula:** 12 columnas, gutter 24px. Sidebar fija 256–280px + contenido fluido.
- **Radios:** 4px (botones, inputs, badges), 6px (tarjetas), 8px máximo (modales). Barras de título: 0–4px.
- **Sombras:** ninguna por defecto. Solo flotantes (dropdown, modal): `0 4px 16px rgba(20,24,31,0.10)`.
- **Divisores:** 1px `gris-200`. La regla fina bajo títulos es recurso heredado del portal UDG: úsala.

---

## 7. Semántica de estado

Tonos armonizados con la paleta (verdes y ámbares apagados, fríos). El rojo de error es **distinto** de los rojos de marca: más vivo y saturado, para que la marca nunca parezca alarma.

| Estado | Base (texto blanco) | Ratio | Tinte fondo | Texto sobre tinte | Ratio | Borde |
|---|---|---|---|---|---|---|
| **Éxito** | `#1a6b42` | 6.51:1 AA | `#e7f2ec` | `#176442` | 6.23:1 AA | `#b9dcc9` |
| **Advertencia** | `#8a5c0a` | 5.81:1 AA | `#fbf3dd` | `#7a4e06` | 6.50:1 AA | `#ecd9a8` |
| **Error** | `#a61e12` | 7.46:1 AAA | `#fbeae8` | `#8a1c12` | 8.00:1 AAA | `#f0c4bf` |
| **Info** | `#455A8C` | 6.79:1 AA | `#edf1f8` | `#27334F` | 11.08:1 AAA | `#c8d2e6` |

### Semáforo de plazos
Distinguibles entre sí; acompañar siempre con etiqueta o icono (no solo color).

| Plazo | Como TEXTO sobre blanco | Como PUNTO/dot |
|---|---|---|
| 🟢 En tiempo | `#1a6b42` (6.51:1 AA) | `#1a6b42` |
| 🟡 Próximo a vencer | `#8a5c0a` (5.81:1 AA) | `#D9A514` (oro — solo punto, nunca texto) |
| 🔴 Vencido | `#a61e12` (7.46:1 AAA) | `#a61e12` |

---

## 8. Qué NO hacer (antipatrones)

1. **No gradientes** — ni animados ni estáticos. El color es siempre sólido.
2. **No sombras pesadas** ni glassmorphism/neumorphism. Profundidad = bordes 1px.
3. **No radios grandes** (>8px) ni botones píldora.
4. **No rojo como fondo de página** ni en grandes áreas fuera de barras de título.
5. **No mezclar rojo y azul en el mismo componente** (excepción: acento activo del sidebar).
6. **No rojos de marca para errores** — el error es `#a61e12`; la marca es `#701d14/#90303a`.
7. **No más de un botón primario por vista.**
8. **No texto sobre color sin par aprobado** (§3).
9. **No texto en `gris-400` o más claro**, ni `azul-500` como texto normal.
10. **No mayúsculas en texto corrido** — solo eyebrows y barras de título.
11. **No cebra de colores en tablas** ni bordes verticales.
12. **No iconografía decorativa, emojis en UI ni ilustraciones genéricas.**
13. **No animaciones llamativas** — solo transiciones 150–200ms de color/opacidad.
14. **No bordes >1px**, salvo barras de acento (2–3px) y la regla bajo títulos.

---

## 9. Tokens listos para copiar

### 9.1 CSS Custom Properties

```css
:root {
  /* Rojos UDG */
  --rojo-500: #9a2c1c;  --rojo-600: #90303a;  --rojo-650: #86212b;
  --rojo-700: #701d14;  --rojo-800: #602321;  --rojo-900: #4a2f32;
  --rojo-950: #3d1212;
  /* Azules */
  --azul-300: #B0BCD8;  --azul-400: #92A2C9;  --azul-500: #7388BA;
  --azul-600: #546EAB;  --azul-700: #455A8C;  --azul-800: #36476E;
  --azul-900: #27334F;
  /* Grises fríos */
  --gris-50: #f7f8fa;   --gris-100: #eef0f4;  --gris-200: #dde1e8;
  --gris-300: #c3c9d4;  --gris-400: #9aa3b2;  --gris-500: #6b7585;
  --gris-600: #4b5462;  --gris-700: #333a47;  --gris-800: #21262f;
  --gris-900: #14181f;
  /* Semánticos */
  --ok: #1a6b42;    --ok-soft: #e7f2ec;    --ok-text: #176442;    --ok-border: #b9dcc9;
  --warn: #8a5c0a;  --warn-soft: #fbf3dd;  --warn-text: #7a4e06;  --warn-border: #ecd9a8;
  --bad: #a61e12;   --bad-soft: #fbeae8;   --bad-text: #8a1c12;   --bad-border: #f0c4bf;
  --info: #455A8C;  --info-soft: #edf1f8;  --info-text: #27334F;  --info-border: #c8d2e6;
  /* Semáforo de plazos (texto; como dot el amarillo es #D9A514) */
  --semaforo-verde: #1a6b42;  --semaforo-amarillo: #8a5c0a;  --semaforo-rojo: #a61e12;
  /* Estructura */
  --radius-sm: 4px;  --radius-md: 6px;  --radius-lg: 8px;
  --shadow-sm: 0 1px 2px rgba(20,24,31,0.06);
  --shadow-float: 0 4px 16px rgba(20,24,31,0.10);
  --max-content: 72rem;
  --font-sans: "Barlow", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}
```

### 9.2 Tailwind (v3, `theme.extend`)

```ts
colors: {
  rojo: { 500: "#9a2c1c", 600: "#90303a", 650: "#86212b", 700: "#701d14",
          800: "#602321", 900: "#4a2f32", 950: "#3d1212" },
  azul: { 300: "#B0BCD8", 400: "#92A2C9", 500: "#7388BA", 600: "#546EAB",
          700: "#455A8C", 800: "#36476E", 900: "#27334F" },
  gris: { 50: "#f7f8fa", 100: "#eef0f4", 200: "#dde1e8", 300: "#c3c9d4", 400: "#9aa3b2",
          500: "#6b7585", 600: "#4b5462", 700: "#333a47", 800: "#21262f", 900: "#14181f" },
  ok:   { DEFAULT: "#1a6b42", soft: "#e7f2ec", text: "#176442", border: "#b9dcc9" },
  warn: { DEFAULT: "#8a5c0a", soft: "#fbf3dd", text: "#7a4e06", border: "#ecd9a8" },
  bad:  { DEFAULT: "#a61e12", soft: "#fbeae8", text: "#8a1c12", border: "#f0c4bf" },
  info: { DEFAULT: "#455A8C", soft: "#edf1f8", text: "#27334F", border: "#c8d2e6" },
  semaforo: { verde: "#1a6b42", amarillo: "#D9A514", rojo: "#a61e12" },
  side: { bg: "#27334F", fg: "#B0BCD8", muted: "#7388BA", hover: "#36476E",
          active: "#36476E", accent: "#9a2c1c" },
},
fontFamily: {
  sans: ["var(--font-barlow)", "Barlow", "system-ui", "sans-serif"],
  mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
},
borderRadius: { sm: "4px", md: "6px", lg: "8px" },
boxShadow: { sm: "0 1px 2px rgba(20,24,31,0.06)", float: "0 4px 16px rgba(20,24,31,0.10)" },
```

> **Nota de mapeo (app CEICS):** la plataforma CEICS implementa esta paleta con su naming
> de tokens preexistente: `gris-*`→`ink-*`, `azul-*`→`navy-*` (invertido: azul-900=navy-700),
> `rojo-*`→`brand.{red,wine,brick,crimson,maroon}`. Mismos hex, distinto nombre.

---

*Verificación de contraste: WCAG 2.1, fórmula de luminancia relativa. Recalcular si se modifica cualquier hex.*
