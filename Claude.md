# Los Bambinos · Sistema de Gestión

Aplicación web de gestión de stock y pedidos para una heladería 
artesanal con fábrica central y sucursales. La fábrica produce y 
despacha. Las sucursales emiten pedidos y reciben mercadería.

## Estado actual del proyecto

Fase de wireframes piloto en HTML/CSS/JS puro dentro de la carpeta 
`/wireframes`. No usar frameworks (React, Vue, etc.) en esta etapa.
El backend lo construye otro desarrollador en paralelo.

## Contexto humano · CRÍTICO

Los usuarios son operarios de heladería acostumbrados a trabajar con 
papel y lápiz. No son nativos digitales. Esta app reemplaza un cuaderno 
de stock y pedidos por WhatsApp. Cada decisión de diseño debe respetar 
estos cuatro instintos del cuaderno:

1. Ver todo lo de hoy sin tener que filtrar
2. Corregir errores de forma visible (deshacer accesible, no destructivo)
3. Cero estados invisibles (si se guardó, se muestra)
4. Cero jerga técnica

## Stack de wireframes

- HTML5 semántico
- CSS3 con variables (sin Sass, sin PostCSS, sin build step)
- JavaScript vanilla ES6+
- Íconos: Tabler Icons vía CDN
- Tipografía: Inter desde Google Fonts (weights 400 y 500 solamente)

## Sistema de diseño

### Filosofía visual

Tema CLARO en esta primera versión. El theme oscuro queda planificado 
para v1.1. La identidad visual de la app es sobria, industrial y 
legible. NO refleja el estilo punk del logo de marca, que aparece 
solamente en la pantalla de login y como detalle pequeño en el header.

### Tokens de color (en css/tokens.css)

Fondos:
- --bg-canvas: #FFFFFF
- --bg-surface: #F7F6F2
- --bg-elevated: #FDFDFB

Bordes:
- --border-subtle: #E5E3DC
- --border-strong: #D0CFC8

Texto:
- --text-primary: #1A1A1A
- --text-secondary: #6B6B66
- --text-tertiary: #A0A09A
- --text-disabled: #C8C7C2

Marca (rojo del logo, uso restringido):
- --brand: #ED1C24
- --brand-hover: #B5151B
- --brand-soft-bg: #FCEBEB
- --brand-soft-text: #791F1F

Acción positiva:
- --success: #27500A
- --success-hover: #1F3F08
- --success-soft-bg: #EAF3DE
- --success-soft-text: #27500A

### Reglas de uso del color

- El rojo de marca puro solo en tres lugares: logo, pill "Sin stock", 
  botón "Rechazar".
- Para alertas suaves usar --brand-soft-bg con --brand-soft-text.
- El verde es para acciones POSITIVAS (confirmar despacho).
- Nunca mezclar la semántica: confirmar nunca es rojo, rechazar nunca 
  es verde.
- Estados de stock: Disponible (≥5 latas), Limitado (1-4), Sin stock (0).

### Tipografía

- Familia: Inter
- Pesos permitidos: 400 (regular) y 500 (medium). NO usar 600/700.
- Tamaño base: 14px. NUNCA bajar de 12px.
- Números usan font-variant-numeric: tabular-nums.
- Sentence case siempre. Nunca Title Case ni ALL CAPS.

### Layout

- Grid de 12 columnas, gutter 24px, margen externo 64px.
- Sidebar: 220px fijo izquierda.
- Topbar: 56px fijo arriba.
- Radius: 8px default, 12px para cards grandes.
- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64px.

### Accesibilidad y ergonomía

- Contraste mínimo WCAG AAA (7:1).
- Targets táctiles mínimo 44px de alto. Botones primarios 48px.
- Foco visible con outline 2px en color marca.
- Todo icono va acompañado de texto. Nunca icon-only.

## Filosofía de interacción · papel y lápiz a digital

### Lenguaje

- Usar tono conversacional rioplatense pero neutro. Tutear, no usar voseo 
  agresivo.
- Cero jerga técnica. Lista de traducciones obligatorias:
  - "Crear orden" → "Pedido nuevo"
  - "Confirmar transferencia" → "Despachar"
  - "Out of stock" → "Sin stock"
  - "Error 422" → mensaje específico en lenguaje humano
  - "Submit" → verbo concreto ("Pesar", "Despachar", "Guardar")
  - "Loading..." → "Buscando..." / "Guardando..."

### Feedback

- Toda acción de guardar muestra un toast verde durante 3 segundos: 
  "Listo. Lata pesada y guardada."
- Toda acción reversible incluye link "Deshacer" en el toast durante 
  10 segundos.
- Errores nunca como código. Siempre como frase + acción concreta:
  "Esta lata ya fue pesada hoy. ¿Querés pesarla de nuevo?"

### Estados

- Estados invisibles prohibidos. Si algo se está procesando, mostrar 
  spinner inline.
- Estados vacíos siempre con texto + ilustración + CTA: 
  "Todavía no pesaste ninguna lata hoy. Empezá con la primera →"

### Confirmaciones destructivas

- Acciones que rompen datos requieren confirmación con texto explícito 
  de lo que va a pasar:
  "Vas a rechazar el pedido PED-0142 de Suc. Caballito. No se puede 
  deshacer. ¿Confirmás?"

## Roles del sistema

- Fábrica: confirma pedidos, gestiona stock, pesa latas, despacha.
- Sucursal: emite pedidos, recibe mercadería, gestiona su inventario.

El rol viene del backend según el usuario que inicia sesión. NO se 
elige en pantalla.

## User Journey Map · investigación UX (Documento 03)

Fuente: `los_bambinos_user_journey_map.pdf`. El producto NO es un 
sistema de inventario: es una conversación estructurada entre la 
Fábrica y sus Sucursales. La fricción no vive en cada rol por 
separado, vive en los HANDOFFS. Cada pantalla tiene que reducir esa 
fricción.

### El flujo completo · 6 fases · 2 actores · 2 handoffs críticos

1. **Detección** (Sucursal) · "¿Qué me está faltando?" · revisa su 
   inventario o detecta faltante al atender. Pain: lo manejan de 
   memoria o en planilla, piden cuando ya no hay stock.
2. **Pedido** (Sucursal) · "¿La fábrica tiene lo que necesito?" · abre 
   catálogo, ve disponibilidad real, arma carrito y envía. Pain: lista 
   por WhatsApp, piden cosas que no existen. → **HANDOFF 1**
3. **Revisión** (Fábrica) · "¿Puedo cumplir este pedido?" · ve pedido 
   nuevo en bandeja y abre detalle. Pain: pedidos dispersos en chats.
4. **Confirmación** (Fábrica) · "¿Qué latas envío y con qué peso?" · 
   confirma y asigna latas específicas por ID. Pain: sin trazabilidad 
   ni peso exacto.
5. **Despacho** (Fábrica) · "¿Quedó bien registrado lo que sale?" · 
   genera comprobante con peso real y marca en tránsito. Pain: remito 
   a ojo, diferencias comerciales a fin de mes. → **HANDOFF 2**
6. **Recepción** (Sucursal) · "¿Llegó todo lo que esperaba?" · recibe 
   mercadería, idealmente repesa una muestra y confirma. Pain: a veces 
   llega menos o con otro peso, no se reclama por falta de registro.

### Handoffs críticos

- **Handoff 1 · Pedido a Fábrica**: el momento más frágil. Si el 
  pedido se pierde acá, todo el sistema se cae. La notificación tiene 
  que ser imposible de ignorar.
- **Handoff 2 · Despacho a Sucursal**: hueco del MVP, sin tracking en 
  tránsito. La recepción con reporte de diferencias cierra el loop.

### Estados de stock (3 niveles, semáforo claro)

- Disponible (≥5 latas) · Limitado (1-4) · Sin stock (0).

### Conceptos clave de dominio

- Trazabilidad por lata: cada lata tiene ID único + peso neto pesado 
  en fábrica. Habilita liquidación precisa por peso real (no estimado).
- Inventario propio de la Sucursal con alertas por umbral configurable.
- Recepción con reporte opcional de diferencias y audit trail.

## Pantallas en esta fase (carpeta Wireframes/)

### Vista Fábrica

1. 00-login.html · Pantalla de acceso
2. 01-dashboard.html · Dashboard vista Fábrica
3. 02-inventario.html · Inventario vista Fábrica
4. 03-pedidos.html · Pedidos vista Fábrica

### Vista Sucursal

5. 04-suc-dashboard.html · Dashboard Sucursal (consumo, alertas, 
   pedidos en camino)
6. 05-suc-inventario.html · Mi inventario (stock propio de la sucursal)
7. 06-suc-catalogo.html · Catálogo Fábrica + carrito + emitir pedido 
   (Fase 02 · Handoff 1)
8. 07-suc-pedidos.html · Mis pedidos + confirmar recepción con reporte 
   de diferencias (Fase 06 · Handoff 2)

### Nota de roles en los wireframes

Ambas vistas comparten el mismo design system (tokens.css, base.css, 
components.css). Cambian el `topbar-scope` (Fábrica Central vs nombre 
de sucursal) y los ítems del sidebar. El sidebar de Sucursal NO incluye 
"pesar latas" ni "confirmar/despachar pedidos" (acciones de Fábrica).

## Convenciones de código

- Clases CSS en kebab-case: `.pedido-card`, `.btn-confirmar`.
- IDs solo cuando JavaScript los necesita.
- HTML semántico: header, nav, main, section, article.
- Atributos ARIA en todo elemento interactivo no nativo.
- Comentarios solo en encabezados de archivo y secciones grandes.
- JavaScript modular: una función, una responsabilidad.
- No usar `!important`. Si hace falta, repensar la cascada.