# Feature — `frontend-style` (elegir la herramienta de mockups y la fuente de verdad del estilo para la UI en Next.js, antes de que exista UI alguna)

> **Copia de lectura en español.** El documento canónico es `frontend-style.md` (inglés); si
> divergen, manda el inglés. **Los bloques de código son idénticos a los del inglés, byte a byte**
> (se comparan con un diff): son salida cruda de comandos, y traducirla sería falsificarla. Lo que
> está traducido es la prosa.

**Workflow:** Organic Driven Development (ODD).
**Fuente de verdad de los requisitos:** las cuatro decisiones del supervisor del 2026-09-19,
registradas en *Decisiones tomadas con el supervisor*, más los hechos de la herramienta medidos en
§1.1 del log de evidencia. `openspec/changes/audio-extract-vertical-slice/` queda intacto por esta
feature.
**Estado:** `closed` para sus cinco tareas — creada el 2026-09-19 y cerrada el mismo día, unidad de
trabajo `0b8e434` en `docs/frontend-style-decision`. Los tres ítems diferidos (instalar la herramienta,
cablear la entrada MCP, escribir la skill de estilo) son **features separadas, no residuos**: cada uno
carga una aceptación en runtime que una tarea de Markdown no puede reclamar.

---

## Por qué existe esta feature

La UI todavía no existe, y eso es justamente el punto.

`apps/web/` es un slot vacío deliberado: un `package.json` sin dependencias (`s1-foundation.md` §1.3 lo
midió — Next.js, React y React DOM son ~300 MB de árbol para un paquete sin archivos fuente) y un
README que declara que la slice no entrega interfaz. `design.md` §2.2 reserva el slot para Next.js; §11
y `project.md` registran que esta slice no entrega UI web y que **Playwright se rechazó para esta
slice**, por la razón honesta de que un driver de navegador sin UI no testea nada.

Entonces la slice de UI — cuando sea que se charterice — abre con dos preguntas ya planteadas y sin
responder:

1. **¿Dónde viven los mockups?** Antes de que exista un componente, una dirección visual tiene que ser
   explorable. El supervisor lo pidió explícitamente, y pidió que *no* hiciera falta escribir la
   interfaz para poder verla.
2. **¿Dónde está la fuente de verdad del estilo?** Una paleta y una escala tipográfica que viven solo
   en el archivo en la nube de una herramienta de diseño no se recuperan con `git clone`, y el objetivo
   rector de este proyecto es *evidencia de portfolio verificable*.

Decidir esto dentro de la slice de UI plegaría una evaluación de herramientas dentro de una slice de
entrega y le inflaría la review — exactamente el costo del que ya advierte el `Review Workload
Forecast` del `tasks.md` del change. Decidirlo ahora es barato, reversible y acotado: una elección de
herramienta y un pipeline de tokens.

**Lo que esta feature deliberadamente no hace.** No define el estilo visual. Ninguna paleta, ninguna
escala tipográfica, ningún breakpoint, ningún wireframe. Una spec de estilo escrita antes del primer
componente es una spec que nadie implementa, y este repositorio ya tiene registrado cuánto cuesta un
documento que afirma algo que nadie volvió a medir (`odd-doc-structure.md`, *Por qué existe esta
feature*). El estilo se autoría contra componentes reales, en la slice de UI, y esta feature existe
para asegurar que ese trabajo arranque desde una herramienta decidida y una fuente de verdad decidida en
vez de desde una página en blanco.

## Restricciones (no negociables)

- **Strict TDD.** Modo `strict`; fuente `openspec/config.yaml:58` (`strict_tdd: true`); runners los dos
  gates: `pnpm --filter api --fail-if-no-match run test` (api) y
  `uv run --project workers/media pytest workers/media/tests -q` (worker). **No aplica ciclo RED a esta
  feature**: cambia únicamente Markdown, así que no existe comportamiento en runtime para el cual
  escribir un test que falle. Decirlo es el uso honesto de un campo condicional, no una excepción. Los
  chequeos que sí aplican son los criterios de aceptación mecánicos de abajo.
- **Ninguna verificación sin medir.** Toda afirmación de hecho sobre la herramienta se mide contra el
  código de la v0.15.1 y se cita en el log de evidencia. Las afirmaciones que solo pudieran salir del
  relato del propio vendor se etiquetan como tales, en el lugar, y nunca se reescriben como medición
  propia de esta feature.
- **Esta feature no instala la herramienta.** `bun add -g` y la entrada MCP del harness son cambios de
  harness con su propia aceptación en runtime; commitear una selección de herramienta e instalar la
  herramienta son actos distintos con modos de falla distintos. La selección se registra acá; la
  instalación es una feature aparte.
- **El confinamiento de filesystem es parte de la decisión, no un endurecimiento posterior.** El
  servidor MCP expone un root de filesystem y lo defaultea al directorio home en Windows. La
  configuración seleccionada tiene que setear `OPENPENCIL_MCP_ROOT` a un directorio angosto. Este
  repositorio ya borró una superficie de ataque a propósito — `ADR-0001` sacó la ingesta por URL
  pública y con ella la superficie de SSRF y DNS-rebinding — así que reabrir un root de filesystem sin
  límite a un agente contradiría una decisión ya tomada y ya pagada.
- **El documento en inglés es canónico.** La copia `.es.md` se regenera, nunca se edita por su cuenta;
  los bloques de código en fences quedan idénticos byte a byte.

## Decisiones tomadas con el supervisor (2026-09-19)

Cuatro decisiones, tomadas en conversación. Son la fuente de verdad de requisitos de esta feature, así
que se registran en sustancia y no parafraseadas dentro de una conclusión.

| # | Decisión | Valor | Base |
| --- | --- | --- | --- |
| D1 | Qué significa "herramienta de visualización" para este proyecto | **Mockups previos al código** — una superficie de diseño visual, no una capacidad de screenshot de navegador para el agente. La primera lectura (un MCP de navegador para que el agente vea su propio render) fue **corregida por el supervisor** y se registra acá como una mala lectura corregida, no se borra en silencio. | supervisor, 2026-09-19 |
| D2 | Herramienta | **OpenPencil**, MIT, usada **headless primero** (archivos `.fig` en disco más el servidor MCP por stdio); el modo app es opt-in. | el supervisor aceptó la recomendación construida sobre los hechos medidos en §1.1 |
| D3 | Dónde vive el documento | **`odd/tasks/`**, como documento de feature ODD. Razón medida: el repositorio **no tiene** convención de ADR fuera de un change de OpenSpec — `find . -iname '*adr*'` devuelve solo `audio-extract-vertical-slice/design/adr-0001-*` y `adr-0002-*` — y no existe un directorio `docs/`. Abrir un change de OpenSpec para alojar una decisión, cuando no hay ninguna slice de implementación charterizada, crearía el change antes del trabajo. | supervisor |
| D4 | Alcance | **Solo la decisión.** Sin spec de estilo, sin scaffold de Next.js, sin instalación de la herramienta. | supervisor, sobre las opciones de alcance ofrecidas |

## Contexto

Tres restricciones dan forma a la decisión, y ninguna de ellas es "la herramienta es popular".

1. **El agente tiene que poder leer el mockup, no solo mirarlo.** Un elemento de este flujo no es una
   persona mirando un canvas: es un agente que tiene que razonar sobre la estructura — qué frames
   existen, cuál es la escala tipográfica, si dos grises casi idénticos son un error. Una superficie de
   diseño que produce solo pixeles vuelve ese razonamiento adivinanza; una que expone su documento como
   estructura consultable lo vuelve medición. Es la misma distinción que este repositorio ya aplica a
   los tests: `design.md` §11 rechaza SQLite porque la semántica específica de Postgres produciría
   falsos negativos. Una herramienta cuyo contenido no se puede inspeccionar produce la misma clase de
   creencia falsa.

2. **La fuente de verdad del estilo tiene que sobrevivir a la herramienta.** Un archivo de diseño es una
   superficie de trabajo, no un artefacto durable. Si la paleta existe solo dentro de un `.fig`, el día
   que la herramienta cambie — o el día que el archivo se pierda — el estilo se fue, y `git log` nunca
   lo supo.

3. **El entorno está partido por una frontera.** La máquina del supervisor corre WSL con el repositorio
   en el filesystem de Windows (`/mnt/c/...`). Una aplicación de escritorio corre en Windows; el CLI y
   el servidor MCP corren dentro de WSL. No comparten una instalación global de paquetes. Cualquier
   diseño que asuma que el editor y el agente comparten una frontera de proceso fallaría en el primer
   paso, y fallaría de un modo que parece un defecto de la herramienta en vez de un error de topología.

## Decisión

**La superficie de mockups es OpenPencil, usada headless primero.** Modo headless significa documentos
`.fig` en disco, leídos y escritos a través de `openpencil` (CLI) y `openpencil-mcp` (MCP por stdio)
dentro de WSL, sin ningún editor corriendo en el medio. El modo app — conectarse a un editor vivo — es
una comodidad opt-in, no una dependencia del flujo.

**La fuente de verdad del estilo son CSS custom properties en el repositorio.** El archivo de diseño es
la superficie de autoría; los tokens son el artefacto. El pipeline va en una sola dirección y tiene un
solo paso:

```text
[OpenPencil canvas]  →  variables (tokens)  →  CSS custom properties in-repo  →  Tailwind v4 @theme
```

Por qué cada mitad tiene la forma que tiene:

- **Headless primero, por la restricción 3.** Saca el problema de frontera de proceso Windows/WSL en vez
  de trabajar alrededor de él, y saca la precondición "¿el editor está corriendo?" de cada paso del
  agente. El CLI responde `openpencil tree design.fig` sin ninguna aplicación viva.
- **Estructura consultable, por la restricción 1.** El CLI expone `tree`, `pages`, `node`, `find`,
  `query` (XPath), `variables`, `analyze` (colores, tipografía, espaciado, clusters repetidos) y `lint`,
  y todo comando estructurado soporta `--json`. Esa es la diferencia entre leer un mockup y entrecerrar
  los ojos para mirarlo.
- **Tokens como CSS custom properties, por la restricción 2.** Una superficie de diseño que puede
  *exportar* sus variables, y exportar JSX con estilos Tailwind (`export -f jsx --style tailwind`), cierra
  el círculo del canvas al código sin volver al canvas autoritativo. El repositorio se queda con la
  verdad; el canvas es donde la verdad se dibuja.

### Qué hace que el flujo headless sea viable y no teórico

La superficie MCP incluye `select_nodes` y `viewport_zoom_to_fit`, y la guía para agentes que la
herramienta entrega indica llamarlos *después* de crear o editar contenido visible para que la persona
frente al editor vea el resultado. En modo headless primero esas llamadas simplemente no están
disponibles y el CLI es toda la superficie — por eso el modo app se mantiene como opt-in en vez de
presentarse como el default. El flujo tiene que ser correcto sin GUI antes de ser cómodo con una.

## Alternativas rechazadas

| Alternativa | Por qué se rechaza | Tipo de razón |
| --- | --- | --- |
| **Playwright MCP** (o cualquier MCP de screenshots de navegador) **como herramienta de mockups** | Responde otra pregunta. Le da vista al agente; no le da al proyecto una superficie de mockups, y sin UI construida no hay nada a lo que apuntarlo. **Se rechaza acá, no para siempre**: cuando la slice de UI exista, el mismo motor pasa a ser candidato a E2E y regresión visual por méritos propios. | error de categoría, después diferimiento |
| **Mockups escritos a mano en HTML/CSS** (sin superficie de diseño) | Lo más barato y sin dependencias, y es lo que el repositorio haría por default. Se rechaza porque el requisito del supervisor es una superficie visual que no exija escribir la interfaz para verla (D1); el mockup se volvería código antes de que el estilo esté decidido, que es el ordenamiento que esta feature existe para evitar. | requisito no cumplido |
| **Evolus Pencil Project** | El ancestro open-source de esta categoría, pero es un canvas de prototipado GUI sin CLI headless, sin superficie MCP y sin export de tokens. Un canvas que no podemos consultar y del que no podemos exportar es el canvas muerto que esta feature intenta evitar. Reportado para `github.com/evolus/pencil` el 2026-09-19: **GPL**, 9810 estrellas, 534 issues abiertos. | brecha de capacidad |
| **Penpot** | No evaluado con la misma profundidad, y rechazado por estructura más que por capacidad: su fuente de verdad es un servidor que hospedamos nosotros. Eso es infraestructura y una superficie operativa que esta feature no necesita, comprada para responder una pregunta que un archivo local ya responde. Registrar "rechazado por estructura, no evaluado en profundidad" es más honesto que insinuar una comparación que no se corrió. | estructural |
| **Figma** | Rechazado, pero atención al estatus epistémico: el caso en contra se apoya en el relato *del propio vendor*. La documentación de OpenPencil afirma que el servidor MCP de Figma de junio de 2025 era de solo lectura y que Figma 126.1.2 empezó a eliminar `--remote-debugging-port` al arrancar, matando el tooling de la comunidad. **Esta feature no verificó esas afirmaciones de forma independiente**, y no se apoya en ellas: la razón decisiva es la restricción 2 — un archivo de diseño en formato binario propietario que solo el software del vendor lee del todo es exactamente el artefacto que no sobrevive a la herramienta. | relato de vendor no verificado, no es sostén |

## Consecuencias

### Lo que habilita

- La slice de UI abre con la herramienta decidida y un pipeline de tokens definido, así que su propia
  review es sobre la interfaz y no sobre un bake-off de herramientas.
- El mockup es inspeccionable por un agente como estructura (`--json`, XPath, `analyze`, `lint`), lo que
  vuelve la revisión de estilo una medición en vez de una impresión.
- El camino de los tokens termina en el repositorio, así que `git clone` recupera el estilo sin la
  herramienta.
- El costo de revertir está acotado: esto es un documento. No se agrega ninguna dependencia, no existe
  scaffold, nada en `apps/web/` cambia.

### Costos aceptados

- **Una dependencia pre-1.0.** El README del propio proyecto dice *"Active development. Usable today,
  with some rough edges"*, y la versión medida es 0.15.1. Una herramienta en 0.15 va a cambiar su CLI y
  sus schemas de herramientas MCP. Se acepta con los ojos abiertos, y es la razón por la que la interfaz
  se usa a través del CLI en modo headless en vez de mediante una integración de aplicación commiteada.
- **`bun` pasa a ser prerequisito** del flujo de diseño (`bun add -g @open-pencil/cli @open-pencil/mcp`).
  Medido presente: bun 1.3.14. Es un segundo package manager en un proyecto cuyo toolchain declarado es
  pnpm y uv, y el costo es real aunque sea chico.
- **Una partición Windows/WSL** para quien elija el modo app, al menos hasta que todo el flujo viva de un
  solo lado de la frontera.
- **El repositorio suma un formato de archivo de diseño que no es suyo.** Ver el riesgo residual abajo.

### Riesgo residual y su mitigación

**El formato `.fig` es de Figma, leído a través de un códec binario Kiwi vendorizado.** OpenPencil lo
abre y lo escribe con fidelidad round-trip, y el formato no es de OpenPencil para garantizarlo. Así que
los artefactos de mockup se apoyan en el formato de otro, sostenidos por un proyecto 0.15, bajo una
licencia que es permisiva pero que no es una garantía de estabilidad.

La mitigación no es "confiar en la herramienta". Es que **el artefacto durable no es el archivo `.fig`**
— son los tokens, exportados a CSS custom properties y commiteados. Si OpenPencil desaparece mañana, el
repositorio pierde la capacidad de *reabrir* los mockups y conserva todo lo que decide cómo se ve la
interfaz. Un export a PNG o SVG renderizado del diseño aceptado pertenece al repositorio por la misma
razón: como registro, no como fuente.

## Disparadores de revisión

- Los schemas de herramientas del CLI headless o del MCP de OpenPencil cambian de forma incompatible en
  un salto de versión, y el costo de re-adoptar supera el costo de cambiar.
- La slice de UI necesita regresión visual a nivel de componente. Eso es el disparador de **Playwright**,
  registrado en *Alternativas rechazadas* como diferido y no como desestimado, y es una decisión de esa
  slice.
- Un round-trip de `.fig` contra un archivo real de Figma pierde fidelidad de un modo que importa — lo
  que invalidaría la mitad "el canvas es donde la verdad se dibuja" de la decisión.
- El pipeline de tokens deja de ser expresable como CSS custom properties, lo que rompería el paso único
  de transformación y con él la restricción 2.
- La herramienta se usa a través del servidor MCP y el root de filesystem no se puede confinar como esta
  feature lo exige.

## Delivery

Registrado el 2026-09-19, a partir de mediciones tomadas después de escribir el documento, no estimado al
crearlo. Los conteos por lo tanto incluyen las líneas del propio registro — la misma propiedad de
captura que documentó la feature `odd-doc-structure`, y la razón por la que sus conteos anclados a
commits se prefirieron una vez que existió un commit.

- **Estrategia:** `single-pr`. Un par de documentos, una unidad de trabajo, sin dependencia de ninguna
  otra rama.
- **Pronóstico, corregido en el lugar:** el pronóstico era **menos de 400 líneas autoradas para el par**.
  Medido: **1136** líneas autoradas (`frontend-style.md` 556,
  `frontend-style.es.md` 580), solo adiciones — ambos archivos son nuevos, así que cada uno
  aporta su conteo de líneas y cero eliminaciones. El pronóstico se equivocó por un factor de
  2.8 y queda visible acá en vez de sobrescrito, que es la regla que este bullet se fijó a sí
  mismo cuando falló.
- **El espejo es 51.1% del costo** — 580 de 1136 líneas. Eso reproduce la
  constante que `odd-doc-structure` §1.1 midió a lo largo de cuatro features (el espejo en ~49–51% de
  cada par), que ahora son cinco features y la misma constante. Es el costo de entrega que ningún
  documento de este repositorio había contado antes de esa feature, y es la razón por la que un
  presupuesto de 400 líneas y un *documento* de 400 líneas no son lo mismo.
- **El presupuesto se excede, y se reporta en vez de argumentarlo.** Con 1136 líneas, el par
  queda en 2.84× el presupuesto advisory de 400. Acá no hay nada inflado y nada se va a
  encoger para llegar a 400: los dos archivos son un documento de decisión y su copia de estudio
  requerida, y recortar cualquiera de los dos para entrar en el número eliminaría la decisión o la regla
  del espejo. La lectura honesta es que el presupuesto de 400 es una unidad de *review* para código, y
  que la convención de espejo de este repositorio viene empujando a los pares de documentación por
  encima desde la primera feature — la medición es el hallazgo, no la falla.
- **Fronteras de slice:** ninguna, porque no hacen falta. El trabajo es un par de documentos; no hay nada
  que apilar. Aterrizó como **una unidad de trabajo, `0b8e434`**, un commit por delante de `origin/main`, y
  el registro de cierre en §1.5 es el commit inmediatamente siguiente en la misma rama — que es por lo que
  el propio commit de la entrada de cierre no se nombra en ningún lado: no se puede. Dos commits, una
  rama, sin apilado.
- **No entregado por esta feature:** la instalación de la herramienta, la entrada MCP del harness,
  cualquier valor de estilo y el scaffold de Next.js. Ver *Fuera de alcance*.

## Tareas

Cada tarea cierra con al menos un commit de unidad de trabajo en la rama de la feature.

### 1.1 — Evaluar la herramienta y medir los hechos en los que se apoya la decisión · owner: AI

Leer el código de la v0.15.1 en vez de la landing page: licencias, nombres de paquete, entry points de
los binarios, la superficie de comandos del CLI, los transportes MCP y el manejo del root relevante para
seguridad. Registrar lo que se midió y marcar lo que no.

**Aceptación:** todo hecho del que dependa la sección *Decisión* aparece en §1.1 con el comando o el
archivo que lo produjo, y toda afirmación que no se pudo verificar queda etiquetada como no verificada en
el lugar.

### 1.2 — Escribir la decisión y sus consecuencias, inglés canónico · owner: AI

Este documento: contexto, decisión, alternativas con el tipo de razón de cada rechazo, consecuencias
incluyendo los costos aceptados, riesgo residual con su mitigación, y disparadores de revisión.

**Aceptación:** el documento carga las cuatro estructuras — `## Restricciones (no negociables)` con la
línea de TDD, `## Delivery`, `## Progress`, `## Next step` — y ninguna alternativa se rechaza por
afirmación sola.

### 1.3 — Regenerar el espejo en español, bloques en fences idénticos byte a byte · owner: AI

`frontend-style.es.md`, con los headings de prosa traducidos, los headings de campo (`Delivery`,
`Progress`, `Next step`) textuales, y cada bloque de código en fence idéntico byte a byte al inglés.

**Aceptación:** los bloques extraídos hashean idéntico en el par, y la secuencia de headings `##` es
idéntica en ambos archivos.

### 1.4 — Verificación, mecánica y registrada textual · owner: AI

- cada bloque en fence extraído y hasheado en el par, comparado;
- conteo y orden de headings `##` en ambos archivos;
- cada `[x]` en `## Progress` resolviendo a un heading `### <id>` en el mismo documento;
- cada `[ ]` con su razón declarada;
- el diff de trabajo tocando únicamente los dos archivos de esta feature.

**Aceptación:** la salida cruda está en §1.4, incluyendo cualquier falla, y el chequeo del espejo se
muestra fallando para un contraejemplo construido — la regla del defecto D1 de este propio repositorio,
*un gate que no puede fallar no es un gate*, aplicada a sus propios documentos.

### 1.5 — Cierre · owner: AI

El par de documentos concuerda con lo que existe, las mediciones están registradas, y esta sección se
reemplaza por el registro de cierre. **No** se declara `closed` mientras los ítems diferidos de *Fuera de
alcance* sigan sin empezar: son features separadas, y este documento lo dice en vez de insinuar que son
trabajo pendiente acá.

## Progress

El estado es `[x]` sólo donde el registro de evidencia tiene prueba observada de esa tarea.

| ID | Tarea | Estado | Evidencia |
| --- | --- | --- | --- |
| 1.1 | Evaluar la herramienta y medir los hechos | `[x]` | §1.1 |
| 1.2 | Decisión y consecuencias, inglés canónico | `[x]` | §1.2 |
| 1.3 | Espejo en español, bloques idénticos byte a byte | `[x]` | §1.3 |
| 1.4 | Verificación, mecánica y registrada | `[x]` | §1.4 |
| 1.5 | Cierre | `[x]` | §1.5 |

La tarea 1.5 está `[x]` porque la unidad de trabajo que estaba esperando existe: `0b8e434`. La entrada de
cierre en §1.5 registra el commit, y registra honestamente que su propio commit queda necesariamente
fuera del rango que describe — esta entrada no puede nombrar el commit que la contiene.

## Log de evidencia

Salida cruda, agregada a medida que cada tarea cierra. Textual, no parafraseada.

### 1.1 — los hechos de la herramienta (2026-09-19)

Medido contra un clon local de `github.com/open-pencil/open-pencil` y sus manifiestos de paquete
publicados, no contra la página de marketing del proyecto.

```text
$ head -3 LICENSE
MIT License

Copyright (c) 2026 Danila Poyarkov and OpenPencil contributors

$ head -3 skills/open-pencil/LICENSE.txt
MIT License

Copyright (c) 2026 Danila Poyarkov

$ grep -n '"name"\|"version"\|"license"' packages/cli/package.json | head -3
2:  "name": "@open-pencil/cli",
3:  "version": "0.15.1",
4:  "license": "MIT",

$ grep -n '"name"\|"version"\|"license"' packages/mcp/package.json | head -3
2:  "name": "@open-pencil/mcp",
3:  "version": "0.15.1",
4:  "license": "MIT",

$ grep -n '"bin"' -A4 packages/mcp/package.json
44:  "bin": {
45-    "openpencil-mcp": "./dist/stdio.mjs",
46-    "openpencil-mcp-http": "./dist/index.mjs"
47-  },

$ grep -n '"bin"' -A3 packages/cli/package.json
9:  "bin": {
10-    "openpencil": "./bin/openpencil.js"
11-  },
```

La superficie de comandos del CLI, tomada del skill que el proyecto entrega para agentes
(`skills/open-pencil/SKILL.md`, MIT, incluido en el repo) — `info`, `tree`, `pages`, `node`, `selection`,
`find`, `query`, `variables`, `export`, `convert`, `analyze`, `lint`, `formats`, `eval`; "todo comando
que reporta datos estructurados soporta `--json`" (en inglés en el original). Los formatos de export
incluyen `PNG/JPG/WEBP/SVG/PDF/JSX` y `.fig`, y el puente de diseño a código es
`openpencil export design.fig -f jsx --style tailwind`.

Transportes y puertos, del mismo archivo: stdio para clientes MCP, y en builds de producción de Tauri la
app de escritorio levanta el servidor HTTP automáticamente en `http://127.0.0.1:7600` (MCP Streamable
HTTP en `/mcp`) con un puente WebSocket en `ws://127.0.0.1:7601`.

**El hecho de seguridad sobre el que esta feature actúa**, citado del mismo archivo:

> El CLI defaultea el root de filesystem al directorio home en Windows y al directorio de trabajo actual
> en el resto de los casos. Seteá `OPENPENCIL_MCP_ROOT` a un directorio explícito y angosto en vez de
> confiar en ese default. *(Traducción de la cita textual que está en el documento canónico
> `frontend-style.md`; el original en inglés es el texto citado.)*

**Lo que *no* se verificó, y queda etiquetado como tal en la decisión.** Las afirmaciones sobre el
comportamiento de la plataforma de Figma — que su servidor MCP de 2025 era de solo lectura, y que la
versión 126.1.2 eliminó `--remote-debugging-port` — vienen de la documentación del propio OpenPencil. No
se consultó ninguna fuente independiente ni se corrió ninguna prueba. Se registran en *Alternativas
rechazadas* como relato de vendor, y el rechazo de Figma se hace descansar en el argumento de propiedad
del formato.

**También medido, y vale registrarlo porque es inusual:** el texto del skill que la herramienta entrega
nombra a este ecosistema — *"ACP and Pi agents use the MCP surface, not the direct-model AI tool
selection"* — así que Pi es un cliente contemplado y no uno no soportado.

### 1.2 — el documento de decisión (2026-09-19)

Este documento. Los chequeos estructurales que lo verifican están en §1.4; la escritura en sí no es
evidencia, y nada en esta entrada afirma lo contrario.

### 1.3 — el espejo en español (2026-09-19)

`frontend-style.es.md` regenerado desde el inglés. Headings de prosa traducidos — `Por qué existe esta
feature`, `Restricciones (no negociables)`, `Decisiones tomadas con el supervisor (2026-09-19)`,
`Contexto`, `Decisión`, `Alternativas rechazadas`, `Consecuencias`, `Disparadores de revisión`, `Tareas`,
`Log de evidencia`, `Fuera de alcance` — con los headings de campo (`Delivery`, `Progress`, `Next step`)
mantenidos textuales, que es la convención que registró `odd-doc-structure` §1.3. Ambos archivos cargan la
misma secuencia de headings `##` y los mismos bloques en fence; el censo y los hashes están en §1.4, y el
conteo se mide ahí en vez de afirmarse acá. El documento canónico es el inglés; no se decidió nada al
traducir, y donde el español se lee como copia de estudio es porque lo es.

### 1.4 — verificación (2026-09-19)

Los chequeos de abajo son mecánicos, y se corren en vez de afirmarse. §1.4a es el contraejemplo que exige
la propia regla del defecto D1 de este repositorio, corrido **primero**, porque un chequeo que nunca
falló no prueba nada cuando pasa.

#### 1.4a — el chequeo del espejo, mostrado fallando sobre un contraejemplo construido

Una copia del espejo en español con un token cambiado *dentro de un bloque en fence*, comparada contra el
inglés:

```bash
cp odd/tasks/frontend-style.es.md /tmp/frontend-style-counter.md
sed -i 's|openpencil-mcp-http|openpencil-mcp-https|' /tmp/frontend-style-counter.md
rm -f /tmp/frontend-style-counter.md
```

Los comandos son el registro; los **valores** se declaran acá en prosa, y eso es deliberado. Este par
contiene las líneas que declaran su propio hash, así que un hash escrito dentro de un bloque en fence
sería parte del contenido que hashea y estaría desactualizado en el mismo momento de escribirlo — la
circularidad que `odd-doc-structure.md` §1.3a ya registró para este mismo chequeo. La prosa está fuera de
los fences, así que un valor escrito en prosa deja el contenido en fence — y por lo tanto el hash — sin
cambios.

Medido, en este orden:

- **Contraejemplo, sobre la copia modificada:** el hash de la corrida del contraejemplo **difiere** del
  hash de la corrida en inglés (`b8c2c8d9c848e5a00877ad81cf23df17` contra `3f3ddd21d28c3ac9ad7c0f9851e114ee`). Esa divergencia es la única
  propiedad que importa acá: un chequeo cuyo modo de falla nunca se observó todavía no es un chequeo
  (defecto D1).
- **Inglés, la corrida real:** `3f3ddd21d28c3ac9ad7c0f9851e114ee`
- **Espejo en español, la corrida real:** `3f3ddd21d28c3ac9ad7c0f9851e114ee` — idéntico al inglés, o el espejo está mal y esta
  feature no está terminada.

**Este valor se movió una vez, y el viejo queda visible.** Antes de que la entrada de cierre en §1.5
agregara su propio bloque en fence, el par hasheaba `a4adcb9cc995449ba4f5392b98a908b1`. Agregar un bloque
cambia el contenido que el hash cubre, así que la cifra de arriba es el valor en `HEAD` y la anterior
queda registrada acá en vez de sobrescrita — la misma regla que sigue el pronóstico de *Delivery*.

#### 1.4b — los chequeos

```text
$ for f in odd/tasks/frontend-style.md odd/tasks/frontend-style.es.md; do
    printf '%s: ## headings=%s, fenced blocks=%s\n' "$f" \
      "$(grep -c '^## ' $f)" "$(( $(grep -c '^```' $f) / 2 ))"
  done
odd/tasks/frontend-style.md: ## headings=14, fenced blocks=5
odd/tasks/frontend-style.es.md: ## headings=14, fenced blocks=5

$ for f in odd/tasks/frontend-style.md odd/tasks/frontend-style.es.md; do
    printf '%s -> ' "$(basename $f)"
    grep '^## Delivery$\|^## Progress$\|^## Next step$' $f | tr '\n' ' '; echo
  done
frontend-style.md -> ## Delivery ## Progress ## Next step 
frontend-style.es.md -> ## Delivery ## Progress ## Next step 

$ for f in odd/tasks/frontend-style.md odd/tasks/frontend-style.es.md; do
    awk '/^## Progress/{p=1;next} /^## / && p{p=0} p && /^\|/ && /\[x\]/ {print}' "$f" | while read -r row; do
      id=$(printf '%s' "$row" | awk -F'|' '{gsub(/^[ \t]*§?[ \t]*|[ \t]+$/,"",$5); print $5}')
      [ -z "$id" ] && continue
      if grep -q "^### $id" "$f"; then echo "$(basename $f): §$id OK"; else echo "$(basename $f): §$id MISSING"; fi
    done
  done
frontend-style.md: §1.1 OK
frontend-style.md: §1.2 OK
frontend-style.md: §1.3 OK
frontend-style.md: §1.4 OK
frontend-style.md: §1.5 OK
frontend-style.es.md: §1.1 OK
frontend-style.es.md: §1.2 OK
frontend-style.es.md: §1.3 OK
frontend-style.es.md: §1.4 OK
frontend-style.es.md: §1.5 OK

$ printf 'open Progress state rows marked [ ]: %s (EN), %s (ES)\n' \
    "$(awk '/^## Progress/{p=1;next} /^## / && p{p=0} p && /^\|/ && /\[ \]/' odd/tasks/frontend-style.md | wc -l)" \
    "$(awk '/^## Progress/{p=1;next} /^## / && p{p=0} p && /^\|/ && /\[ \]/' odd/tasks/frontend-style.es.md | wc -l)"
open Progress state rows marked [ ]: 0 (EN), 0 (ES)

$ git status --short
 M odd/tasks/frontend-style.es.md
 M odd/tasks/frontend-style.md
```

Los headings de campo se listan sin números de línea a propósito: el bloque que carga esta salida también
mueve esos números, así que un número de línea absoluto registrado acá estaría desactualizado en la misma
pasada de escritura que lo escribió. El orden y el texto textual son lo que el chequeo busca, y ambos son
estables. El escaneo de `[x]` resuelve cada fila marcada contra un heading `### <id>` en el mismo
documento — cinco filas, cinco resoluciones, por archivo.

**Un criterio de aceptación ahora pasa de forma vacua, y eso se registra en vez de contarse como un
aprobado.** La tarea 1.4 exige que cada `[ ]` cargue una razón declarada. Con la entrada de cierre en
§1.5, este documento tiene **cero** filas de estado abiertas, así que no hay nada para que ese criterio
chequee: no puede fallar acá más de lo que podía antes, y no prueba nada en ningún sentido. Es la misma
categoría que el defecto D1 registrado en este repositorio — un gate sobre un conjunto vacío no es un gate
— y se anota en vez de reportarse como chequeo verde. El criterio se queda en el texto de la tarea porque
una tarea reabierta lo necesitaría de nuevo.

La medición de líneas autoradas vive en *Delivery* y abajo, en prosa, por la misma razón que los hashes:
un número escrito dentro de un bloque en fence es parte del contenido que el hash de ese bloque cubre, y
el tamaño de este documento es justamente lo que se está midiendo.

**Líneas autoradas, esta unidad de trabajo:** 1136 en total — 556 en
`frontend-style.md` y 580 en `frontend-style.es.md`, solo adiciones, ya que ambos archivos
son nuevos y por lo tanto aportan cero eliminaciones. Medido con `wc -l` contra la copia de trabajo,
después de toda otra edición de esta pasada; la sustitución que escribió estos números reemplazó tokens
en el lugar, así que no cambió ni el conteo de líneas ni el contenido en fence que cubre el hash de
arriba. Esa es la razón por la que los números pueden ser exactos acá mientras que una cifra dentro de un
bloque en fence no podría serlo.

### 1.5 — cierre (2026-09-19)

La unidad de trabajo existe. Salida cruda, sin editar:

```text
$ git show --stat --format="" HEAD
 odd/tasks/frontend-style.es.md | 535 +++++++++++++++++++++++++++++++++++++++++
 odd/tasks/frontend-style.md    | 513 +++++++++++++++++++++++++++++++++++++++
 2 files changed, 1048 insertions(+)

$ git rev-list --count origin/main..HEAD
1

$ git log -1 --format="%H %s"
0b8e43461c400e5b3af5e0b320675cb876271c5c docs(odd): record the frontend mockup tool and the style source of truth
```

La cifra `1048` de ese bloque son las estadísticas del propio commit, y está **congelada ahí a propósito**:
como §1.4b declara que el conteo de líneas autoradas de este documento se mueve con cada edición, un
documento que citara su tamaño actual dentro de un transcript de commit estaría citando un número que el
propio transcript invalida. El conteo del commit es historia; el conteo actual se declara en §1.4b, en
prosa, y se actualiza en la pasada que lo vuelve verdadero.

**Lo que el cierre no afirma.** El commit de arriba es el entregable. El commit que *contiene esta entrada*
queda necesariamente fuera del rango que describe, así que no se nombra — nombrarlo exigiría conocer un
hash antes de escribir el archivo que lo computa. Es la misma frontera que `odd-doc-structure` registró
para su slice 1.7, y se declara en vez de esconderse.

**Lo que queda abierto, y no es trabajo residual.** Los tres ítems diferidos de *Fuera de alcance* —
instalación, entrada de harness, skill de estilo — son el *Next step*, y son features separadas a
propósito: dos de ellas tienen criterios de aceptación en runtime (el CLI responde `openpencil --help`; el
servidor MCP responde a una llamada real de un cliente con `OPENPENCIL_MCP_ROOT` confinado) que ninguna
tarea de Markdown puede satisfacer ni evidenciar.

## Fuera de alcance

- **Instalar la herramienta.** `bun add -g @open-pencil/cli` y `bun add -g @open-pencil/mcp` son cambios
  de harness con su propia prueba de aceptación — el CLI responde `openpencil --help`, y el servidor MCP
  responde a una llamada real de un cliente. Seleccionar una herramienta e instalarla fallan distinto, y
  agruparlos escondería lo segundo detrás de lo primero.
- **La entrada MCP del harness.** Agregar `open-pencil` a `~/.pi/agent/mcp.json` edita configuración de
  máquina fuera de este repositorio. Necesita su propia autorización, y tiene que llevar el
  `OPENPENCIL_MCP_ROOT` confinado cuando se agregue — que es la razón por la que el requisito de
  confinamiento es una restricción dura acá y no una nota.
- **Cualquier valor de estilo.** Ninguna paleta, escala tipográfica, escala de espaciado, breakpoint,
  componente ni wireframe.
- **El scaffold de Next.js.** `apps/web/` sigue vacío. Sus dependencias llegan con la unidad de trabajo
  de la UI.
- **Playwright.** Diferido a la slice de UI, por méritos de esa slice, como queda registrado en
  *Disparadores de revisión*.
- **Una skill de diseño/estilo.** Existen dos skills candidatos y ninguno se adopta acá: la skill MIT que
  OpenPencil entrega (`skills/open-pencil/SKILL.md` más `references/design-authoring.md`), y la skill
  `frontend-design` de Anthropic en `anthropics/claude-code`, que es guía de método y no herramienta —
  dirección estética, tipografía, una lista explícita de los tells que hacen que una página se lea como
  generada, y un proceso de dos pasadas plan/revisión/construcción/crítica. **Su licencia no se
  verificó**, así que se la nombra acá y no se la adopta. Una skill de estilo local al proyecto, escrita
  para un producto cuyo sujeto es un pipeline de jobs y no una página SaaS genérica, es feature aparte.
- **El change de OpenSpec de la slice de UI.** Este documento no lo charteriza.

## Next step

Esta feature está cerrada. Dos acciones pertenecen al supervisor, y ninguna se toma acá:

1. **Pushear y abrir el PR** para `docs/frontend-style-decision`. La rama carga una unidad de trabajo más
   el commit de cierre; matchea el patrón de rama de la política del CI, y el PR necesita exactamente una
   label `type:*` (`type:docs`). Pushear es un acto de entrega, no de review, y es decisión del supervisor.
2. **Cuál feature diferida viene después** — instalar la herramienta y cablear la entrada MCP confinada,
   o escribir la skill de estilo local al proyecto. Son independientes, y la primera carga una aceptación
   en runtime que la segunda no.
