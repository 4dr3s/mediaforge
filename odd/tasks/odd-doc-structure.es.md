# Feature — `odd-doc-structure` (darle a cada documento de feature ODD las cuatro estructuras que le faltan)

> **Copia de lectura en español.** El documento canónico es `odd-doc-structure.md` (inglés); si
> divergen, manda el inglés. **Los bloques de código son idénticos a los del inglés, byte a byte.**
> Lo que está traducido es la prosa.

**Workflow:** Organic Driven Development (ODD).
**Fuente de verdad de los requisitos:** el contrato ODD instalado — `assets/orchestrator-memory.md:7`
(la lista de contenido del documento), `assets/orchestrator-delegation.md:96` (modo, fuente y runner
de TDD) y `:102` (forecast de entrega, estrategia y fronteras de slice) — más los cuatro huecos medidos
abajo.
**Estado:** `in progress` — creado el 2026-09-17.

---

## Por qué existe esta feature

Cuatro features se rastrearon bajo ODD y ninguno de sus documentos lleva las cuatro estructuras que el
contrato pide. Esto se midió, no se supuso:

| Documento | Estado que declara | Estado realmente legible en el documento | ¿Resoluble? |
| --- | --- | --- | --- |
| `s1-foundation.md:5` | `in progress` | su lista de residuos la está cerrando `repo-hygiene`; la feature está terminada | **No** |
| `repo-hygiene.md:9` | `in progress` | slice pusheado; la tarea 1.6 existe y **no tiene sección de evidencia** (1.1–1.5, 1.7 y 1.8 sí). El rastro está en el hallazgo F5, sin nada que lo ligue a 1.6 | **No** |
| `wu2-data-model.md:10` | `closed` | 1.1–1.8 con evidencia completa | Sí |
| `wu3-contract.md:9` | `in progress` | la tarea 1.4 (Cierre) **no tiene sección de evidencia**, y el plan de fixes del propio verificador (F1, F2, F3 — "before this feature closes") está sin aplicar: los cuatro fixtures de calendario que exigía no existen y el validador de Python no tiene chequeo con conocimiento de calendario | **No** |

Tres de cuatro documentos durables no pueden contestar la única pregunta para la que existen: *¿esto
está hecho?* El único confiable es el que declaró `closed`.

Dos defectos distintos, y no son de la misma clase:

- **Estructura faltante es ambigüedad.** Cuesta una re-lectura. No engaña.
- **Una afirmación falsa es desinformación activa.** `s1-foundation.md:5` y `repo-hygiene.md:9`
  afirman estados que la medición contradice. El propio hallazgo F2 de `repo-hygiene` ya lo había
  registrado: *"Third instance in this repo of a document asserting something nobody re-measured."*

Las cuatro estructuras se eligieron del contrato, no se inventaron, y están graduadas — dos son
contenido incondicional y dos son reglas operativas condicionales:

| Estructura | Fuente en el contrato | Clase |
| --- | --- | --- |
| `## Progress` (estado por ID de tarea estable) | `orchestrator-memory.md:7` — *"actionable checklist with stable task IDs … progress"* | Contenido incondicional |
| `## Next step` | `orchestrator-memory.md:7` — *"and next step"* | Contenido incondicional |
| Modo / fuente / runner de TDD, una línea dentro de `## Constraints` | `orchestrator-delegation.md:96` — *"Record resolved mode, source, and runner in the feature document **when present**"* | Condicional |
| `## Delivery` (forecast, estrategia, fronteras de slice) | `orchestrator-delegation.md:102` — *"forecast authored changed lines … record slice boundaries … in the feature document"* | Condicional (se dispara al pasar ~400 líneas autoradas) |

La práctica upstream confirma la graduación y no la lectura plana. Medido sobre los cuatro documentos
de los propios mantenedores en `Gentleman-Programming/gentle-shell@main`, `odd/tasks/`: checkboxes
**4/4**, `## Progress` **4/4**, next step **3/4**, TDD como una línea dentro de `Constraints` **3/4**, y
forecast + fronteras de slice **0/4**. Las dos estructuras incondicionales son práctica; el bloque de
entrega no tiene precedente en ningún lado, upstream incluido.

## Entradas autoritativas

| Entrada | Qué gobierna |
| --- | --- |
| `assets/orchestrator-memory.md:7` | La lista de contenido del documento, la regla del espejo completo, y que el `todo` es una proyección y no una tercera autoridad. |
| `assets/orchestrator-memory.md:9` | *"Check off only observed outcomes with applicable proof"* — la regla de honestidad que obliga a esta feature. |
| `assets/orchestrator-delegation.md:80` | Proporcionalidad: *"Small, understood work creates no durable task artifacts."* La estructura es para trabajo sustancial, no un impuesto sobre todo. |
| `assets/orchestrator-delegation.md:96`, `:102` | Las dos estructuras condicionales, verbatim. |
| `odd/tasks/command-palette.md` (upstream) | La forma de referencia: TDD como una línea dentro de `Constraints`, y `## Next step` como encabezado real. |

## Restricciones (no negociables)

- **Strict TDD.** Modo `strict`; fuente `openspec/config.yaml:58` (`strict_tdd: true`); runner las dos
  gates: `pnpm --filter api --fail-if-no-match run test` (api) y
  `uv run --project workers/media pytest workers/media/tests -q` (worker). **No aplica ningún ciclo
  RED a esta feature**: sólo cambia Markdown, así que no hay comportamiento de runtime para el que
  escribir un test que falle. Decirlo es el uso honesto de un campo condicional, no una excepción —
  los checks que sí aplican son los criterios de aceptación de abajo, y son mecánicos.
- **Sin tilde sin prueba.** Un `[x]` en cualquier tabla `## Progress` exige una sección de evidencia en
  el mismo documento que muestre el resultado observado. Evidencia faltante es `[ ]`, nunca una
  conjetura. Las dos tareas irresueltas que se encontraron acá (1.6 en `repo-hygiene`, 1.4 en
  `wu3-contract`) quedan sin tildar.
- **Sin historia inventada.** Un forecast de una feature ya cerrada se mide de `git log --numstat` y se
  marca retrospectivo. Un número que nadie midió es peor que un campo vacío.
- **El documento en inglés es el canónico.** La copia `.es.md` se regenera, nunca se edita por su
  cuenta; los bloques de código cercados quedan idénticos byte a byte.
- **La prosa existente se preserva.** Esta feature agrega estructura; no reescribe hallazgos,
  evidencias ni decisiones ya aceptadas. Los encabezados de tarea conservan su texto y no ganan nada
  más que una fila de estado.
- **Un estado por tarea, en un solo lugar.** El estado vive sólo en la tabla `## Progress`. Duplicarlo
  en los encabezados de tarea crearía exactamente el drift que esta feature existe para remover.

## Delivery

- **Estrategia:** `ask-on-risk` (la default) — el forecast supera el presupuesto de ~400 líneas
  autoradas, así que la estrategia de cadena se pregunta una vez, antes del primer commit, y se cachea
  acá.
- **Estrategia de cadena:** `feature-branch-chain` — registrada el 2026-09-17 a partir de la respuesta
  del supervisor al prompt de `ask-on-risk`.
- **Forecast:** ~750 líneas autoradas cambiadas (adiciones más deleciones, archivos generados y
  lockfiles excluidos) sobre 8 documentos, 4 en inglés más 4 espejos en español que actúan como una
  unidad cada uno. Base medida: las adiciones por documento son 4 estructuras × ~15–20 líneas,
  duplicadas por el espejo.
- **Conteo corriente:** los slices 1.1, 1.2 y 1.3 juntos miden **1054** líneas autoradas
  cambiadas, adiciones más deleciones — la única fórmula que el supervisor unificó el 2026-09-17 —
  ancladas a los **commits** y medidas con `git diff --numstat 96f03f6..ad8b122`: 515 en los
  documentos en inglés y 539 en sus espejos en español, así que los espejos vuelven a ser ~51%
  del costo. Re-anclado en 1.3a (2026-09-17): el bullet anterior medía el árbol de trabajo
  (`git diff --numstat 96f03f6`) y así incluía sus propias líneas y se movía con cada edición
  posterior; el slice 1.3 ya está commiteado como `ad8b122`, y un conteo anclado a commits no
  puede ser invalidado por el acto de escribirlo. Este work unit (1.3a) agrega sus propias
  líneas autoradas por encima, contadas por separado contra el árbol de trabajo con
  `git diff --numstat ad8b122` — salida y totales crudos en §1.3a; ese conteo incluye las
  líneas del propio registro (el mecanismo de re-medición de §1.1). El forecast de ~750 no se
  sostiene: 1054 ya está medido sobre los primeros tres slices, y todavía faltan los dos pares
  de documentos restantes (1.4, 1.5) y el slice de verificación (1.6). La base sigue siendo la
  lección dura de §1.1, el punto de bifurcación y no el tip de la feature anterior: un rango
  que arranca en `2a62fa7` se tragaría los cuatro commits de `wu3-contract`, ancestros
  de esta branch. El slice 1.4 aterrizó como `64177be`, así que ahora está anclado a commits
  como los slices 1.1–1.3: `git diff --numstat c96dd3d..64177be` reproduce exactamente el total
  registrado del árbol de trabajo del slice, 390 (EN=191, ES=199) — salida cruda y aritmética en
  §1.5. El valor histórico del árbol de trabajo (`git diff --numstat c96dd3d`, registrado en §1.4)
  queda visible y etiquetado: leía los mismos 390, y el rango commiteado lo confirma línea por
  línea. El slice 1.5, el que este bullet está actualizando, no tiene commit todavía, así que nada
  de lo suyo está anclado a uno: sus propias líneas se cuentan contra el árbol de trabajo en
  `64177be` con `git diff --numstat 64177be` — salida cruda y totales en §1.5; ese conteo incluye
  las líneas del propio registro (el mecanismo de re-medición de §1.1). Los slices 1.1–1.3
  mantienen su ancla de commits (`96f03f6..ad8b122` = 1054, arriba) y el work unit propio de 1.3a
  mantiene su conteo registrado contra `ad8b122` (545, en §1.3a).
- **Fronteras de slice:** cinco slices, uno por par de documentos (un documento en inglés más su
  espejo español), apilados sobre `feat/odd-doc-structure` e integrados al final. El slice 1 es el par
  de este mismo documento, del work-unit 1.1 (`92c5fb4`); los slices 2–5 son las tareas 1.2–1.5. El
  rango de commits de cada slice se agrega acá a medida que aterriza, porque un rango sólo se conoce
  después de que su work unit commitea.

## Tareas

Cada tarea cierra con al menos un work-unit commit en la feature branch.

### 1.1 — Definir la forma objetivo uniforme y registrar los hechos medidos · owner: IA

La spec que el próximo agente copia, guardada en este documento para que tenga un único hogar: orden de
secciones y forma exacta de las cuatro estructuras; el texto canónico de la línea de TDD; las columnas
de la tabla `## Progress`; los campos del bloque `## Delivery`; la regla de `## Next step` (una línea,
y un *none* explícito cuando la feature está cerrada).

Los hechos medidos se registran acá, no se re-derivan por documento: los dos runners canónicos; los
conteos de líneas autoradas por feature; la branch y el rango de commits de cada una; y el hallazgo de
que el espejo español es más o menos la mitad de las líneas autoradas de cada feature (s1 +622 de
+1930, `repo-hygiene` +472 de +951, `wu2` +857 de +3224, `wu3` +286 de +1572) — un costo de entrega
duplicado que ningún documento contó nunca.

**Aceptación:** este documento contiene la forma y los hechos, y este documento mismo lleva las cuatro
estructuras.

### 1.2 — `wu3-contract.md` y su espejo español · owner: IA

Agregar las cuatro estructuras. El progreso tiene que registrar la verdad: 1.1–1.3 son `[x]` (su
evidencia existe); **1.4 queda `[ ]`**; y el `## Next step` nombra el plan de fixes sin aplicar del
verificador (F1, F2, F3) como próxima acción, porque eso es lo que el documento hoy no dice.

### 1.3 — `repo-hygiene.md` y su espejo español · owner: IA

Agregar las cuatro estructuras, corregir la línea de `Status` que hoy contradice el slice pusheado, y
dejar **1.6 en `[ ]`** con la razón: no hay sección de evidencia, el rastro está sólo en el hallazgo
F5.

### 1.3a — Corregir la fórmula del forecast a adiciones más deleciones, y registrar la decisión de conformidad con el RDD · owner: IA

Dos decisiones del supervisor, tomadas el 2026-09-17 (el día en que se creó esta feature), aplicadas
acá:

- **Una única fórmula de forecast.** La única fórmula es adiciones más deleciones. Los cuatro
  totales de §1.1 eran *netos* (adiciones menos deleciones) y se corrigen, dejando las cifras
  netas viejas visibles y etiquetadas; `## Delivery` de `wu3-contract.md` lleva la misma
  corrección.
- **Conteo corriente re-anclado.** Los slices 1.1–1.3 se miden desde los commits (`git diff
  --numstat 96f03f6..ad8b122`), porque la medición del árbol de trabajo incluía las líneas del
  propio bullet y se movía con cada edición. Las líneas propias de este work unit se cuentan por
  separado.
- **La decisión de RDD.** El supervisor optó por saltear la revisión nativa para los candidatos de
  esta feature, explícita e informadamente, por la excepción de edición pasiva trivial sólo de
  documentación de la regla de entrada de revisión, con precedente en el repo en `repo-hygiene.md`
  §1.8. El resultado queda registrado en la nueva sección `## Conformidad con el RDD`; la
  verificación mecánica de la tarea 1.6 carga con el check en su lugar.

**Aceptación:** cada número corregido está medido y su salida cruda está en §1.3a; ningún número
corregido reemplaza a uno viejo sin que la cifra vieja siga visible y etiquetada; los espejos
`.es.md` se regeneran en paso; y el registro de RDD nombra el resultado, su alcance y qué lleva la
feature en su lugar.

### 1.4 — `s1-foundation.md` y su espejo español · owner: IA

Agregar las cuatro estructuras y corregir `Status`, que dice `in progress` sobre una feature cuya lista
de residuos ya se está cerrando en otro lado.

### 1.5 — `wu2-data-model.md` y su espejo español · owner: IA

Agregar las cuatro estructuras. Es el único documento cuyo estado ya era veraz, así que su
`## Progress` debería salir completamente en `[x]` y su `## Next step` debería ser un *none* explícito.

### 1.6 — Verificación sobre los 8 documentos · owner: IA

Mecánica, y registrada verbatim:

- cada uno de los 8 documentos contiene las cuatro estructuras (grep por encabezado);
- cada `[x]` tiene un puntero de evidencia que resuelve a una sección real del mismo documento;
- cada `[ ]` tiene una razón declarada;
- los bloques de código cercados del inglés y del español son idénticos byte a byte (1.2–1.5 no deben
  haber roto la regla del espejo), comparados extrayendo y hasheando los bloques;
- la prosa preexistente de los documentos en inglés quedó intacta salvo por las estructuras agregadas y
  las líneas de `Status` corregidas — verificado diffeando la prosa, no confiando en la edición.

**Aceptación:** los checks se corren y su salida cruda está en el registro de evidencia, incluyendo
cualquier falla. Un check que no puede fallar no es un check: la evidencia tiene que mostrarlo fallando
contra un contraejemplo construido.

### 1.7 — Cierre · owner: IA

Los documentos de la feature coinciden con lo que existe, los espejos en español se regeneran y se
verifican, y este documento cierra con sus gates registradas.

## Progress

El estado es `[x]` sólo donde el registro de evidencia tiene prueba observada de esa tarea.

| ID | Tarea | Estado | Evidencia |
| --- | --- | --- | --- |
| 1.1 | La forma uniforme y los hechos medidos | `[x]` | §1.1 |
| 1.2 | `wu3-contract.md` + espejo | `[x]` | §1.2 |
| 1.3 | `repo-hygiene.md` + espejo | `[x]` | §1.3 |
| 1.3a | Corregir la fórmula de §1.1, re-anclar el conteo corriente, registrar la decisión de RDD | `[x]` | §1.3a |
| 1.4 | `s1-foundation.md` + espejo | `[x]` | §1.4 |
| 1.5 | `wu2-data-model.md` + espejo | `[x]` | §1.5 |
| 1.6 | Verificación sobre los 8 documentos | `[ ]` | — |
| 1.7 | Cierre | `[ ]` | — |

## Registro de evidencia

Salida cruda, agregada a medida que cierra cada tarea. Verbatim, sin parafrasear.

### 1.1 — la forma y los hechos medidos (2026-09-17)

Líneas autoradas por feature, medidas con `git log <rango> --numstat`, adiciones más deleciones,
excluyendo `pnpm-lock.yaml`, rutas `generated` y archivos `.lock`:

| Feature | Rango | Total (altas+bajas) | Código/tests | Docs EN | Docs ES | Total anterior (neto) |
| --- | --- | --- | --- | --- | --- | --- |
| `s1-foundation` | `b05afcd..9eb288b` | +1934 | +666 | +644 | +624 | +1930 |
| `repo-hygiene` | `9eb288b..1c73e4c` | +1163 | +20 | +585 | +558 | +951 |
| `wu2-data-model` | `1c73e4c..2a62fa7` | +4478 | +2092 | +1219 | +1167 | +3224 |
| `wu3-contract` | `2a62fa7..96f03f6` | +1598 | +1004 | +308 | +286 | +1572 |

**Corregido en 1.3a, 2026-09-17.** Las cuatro filas de arriba eran originalmente totales
*netos* (adiciones menos deleciones) — +1930 = +666/+642/+622, +951 = +20/+459/+472,
+3224 = +1502/+865/+857, +1572 = +1002/+284/+286 — contradiciendo la oración de fórmula que
las encabeza. El supervisor unificó el 2026-09-17 una sola fórmula, **adiciones más deleciones**,
y las filas se re-midieron desde los commits con `git log <rango> --numstat` (las dos fórmulas,
salida cruda en §1.3a): +1934 = +666/+644/+624, +1163 = +20/+585/+558, +4478 =
+2092/+1219/+1167, +1598 = +1004/+308/+286. Las cifras netas viejas quedan visibles: la
columna `Total anterior (neto)`, y completas en la oración de arriba como medición histórica.
Otros números de esta sección medidos en su momento quedan como evidencia escrita (los
+2106/+450/+454 del párrafo de la trampa y las cifras de participación del texto de la tarea
1.1); la afirmación del espejo se sostiene con las dos fórmulas, ~49% de las líneas de
documentación de cada par.

Cada feature supera el presupuesto advisory de ~400 líneas, por 2,9× a 11,2×. En tres de cuatro, el espejo
español por sí solo está en o por encima del presupuesto entero, y ningún documento registra ese costo.

La ausencia de las cuatro estructuras, medida sobre los 4 documentos en inglés:

| Estructura | `s1-foundation` | `repo-hygiene` | `wu2-data-model` | `wu3-contract` |
| --- | --- | --- | --- | --- |
| `## Progress` | ausente | ausente | ausente | ausente |
| `## Next step` | ausente | ausente | presente (prosa, línea 816) | ausente |
| Modo/fuente/runner de TDD | sólo modo, inline (línea 205) | **ausente** | sólo modo, inline (línea 43) | sólo modo, inline (línea 49) |
| `## Delivery` | ausente | ausente | ausente | ausente |
| Checkboxes en cualquier lado | 0 | 0 | 0 | 0 |

`git log -S'- [ ]' -- odd/tasks/` no devuelve ningún commit que alguna vez haya agregado uno: la
omisión es estable en toda la historia de las features, no una regresión.

**Una trampa de medición encontrada por cometerla.** El primer conteo que se hizo para esta feature fue `git log 2a62fa7..HEAD --numstat` → **+2106**, y está mal: como la historia está apilada linealmente (`feat/wu2-data-model` es ancestro de `feat/wu3-contract`, que es el padre de esta branch), un rango que arranca en el tip de la feature *anterior* se traga silenciosamente los commits de esa feature — los cuatro de `wu3-contract`, +1572 del total. La base correcta es el punto de bifurcación, `git merge-base feat/wu3-contract HEAD` → `96f03f6`, que da **+450**. Re-medido después de esta corrección, el mismo rango lee **+454** (223 inglés, 231 español) — la corrección es parte del mismo work unit, y por eso el conteo se mueve exactamente las cuatro líneas que agregó. Es exactamente la clase de error que el forecast de entrega existe para atrapar, y se atrapó midiendo en vez de leyendo: los dos números difieren por 4,6×.

El plan de fixes sin aplicar de `wu3-contract`, medido contra el árbol de trabajo: los cuatro fixtures
que F2 exige están ausentes de `contracts/fixtures/envelopes/invalid/` (presentes: `date-only`,
`fourth-field`, `missing-job-id`, `missing-occurred-at`, `missing-type`, `naive-occurred-at`,
`non-object`, `numeric-occurred-at`, `numeric-type`, `object-job-id`, `unknown-version`,
`unsupported-version`), y `workers/media/src/mediaforge/contracts.py` no contiene `datetime`, `date(`
ni `fromisoformat` — así que la validación con conocimiento de calendario que F2 pide no está.

### 1.2 — `wu3-contract.md` y su espejo español (2026-09-17)

Las estructuras agregadas, y los checks que efectivamente se corrieron:

```text
$ for f in wu3-contract.md wu3-contract.es.md; do
    echo "$f: $(grep -c '^## Delivery\|^## Progress\|^## Next step' $f) sections, TDD source: $(grep -c 'source `openspec' $f)"; done
wu3-contract.md: 3 sections, TDD source: 1
wu3-contract.es.md: 3 sections, TDD source: 1

$ blocks() { awk '/^```/{f=!f; print; next} f{print}' "$1" | md5sum; }
$ blocks wu3-contract.md && blocks wu3-contract.es.md
5164754a97cd612023d3ffb28522a9c8
5164754a97cd612023d3ffb28522a9c8      # identical
```

**Un check pasó de forma vacua, y se registra en vez de esconderse.** Corrida sobre el par de esta
misma feature, la misma comparación devuelve `d41d8cd98f00b204e9800998ecf8427e` — el MD5 de la cadena
vacía — porque `odd-doc-structure.md` no tiene ningún bloque de código cercado. La regla del espejo se
cumple ahí de forma trivial, así que el check no puede fallar para ese par y no prueba nada sobre él.
Es la misma clase que el defecto D1 ya registrado en este repo (*"una gate que no puede fallar"*): un
check que pasa por una razón ajena a lo que afirma. Por eso la tarea 1.6 tiene que *demostrar* que el
check falla sobre un contraejemplo construido, antes de que cualquier pase suyo valga algo — y tiene
que re-medir este par también, porque esta entrada de evidencia es la que le da al par su primer
bloque cercado.

**Lo que el documento ahora dice y antes no.** La tarea 1.4 (Cierre) está `[ ]`, y `## Next step`
nombra el plan de fixes sin aplicar del verificador — medido, no inferido, como registra el §1.1. El
bloque de Delivery registra la frontera de slice como *"ninguna, porque no se usó ninguna"*:
`feat/wu3-contract` no tiene upstream ni pull request, y está 24 commits por delante de `origin/main`
(un conteo que incluye `wu2-data-model`, porque la historia está apilada).

### 1.3 — `repo-hygiene.md` y su espejo español (2026-09-17)

Las cuatro estructuras agregadas a los dos archivos; la línea de `Status` corregida (complete and
pushed, nueve commits en `origin/main`); y la anulación del supervisor del 2026-09-17 aplicada — la
tarea 1.6 de `repo-hygiene` ahora tiene una sección de evidencia y está `[x]`, con la anulación
registrada en ese documento y no escondida. Los checks de abajo son los que la tarea 1.6 va a
re-correr sobre los ocho documentos, corridos acá sobre este par, crudos:

```text
$ for f in repo-hygiene.md repo-hygiene.es.md; do
    printf '%s: constraints=%s delivery=%s progress=%s next=%s\n' "$f" \
      "$(grep -c '^## Constraints (non-negotiable)\|^## Restricciones (no negociables)' odd/tasks/$f)" \
      "$(grep -c '^## Delivery$' odd/tasks/$f)" "$(grep -c '^## Progress$' odd/tasks/$f)" \
      "$(grep -c '^## Next step$' odd/tasks/$f)"; done
repo-hygiene.md: constraints=1 delivery=1 progress=1 next=1
repo-hygiene.es.md: constraints=1 delivery=1 progress=1 next=1

$ awk '/^## Evidence log|^## Log de evidencia/{ev=1} /^### / && ev{print $2}' odd/tasks/repo-hygiene.md | sort | uniq -c
      1 1.1
      1 1.2
      1 1.3
      1 1.4
      1 1.5
      1 1.6
      1 1.7
      1 1.8
$ awk '/^## Evidence log|^## Log de evidencia/{ev=1} /^### / && ev{print $2}' odd/tasks/repo-hygiene.es.md | sort | uniq -c
      1 1.1
      1 1.2
      1 1.3
      1 1.4
      1 1.5
      1 1.6
      1 1.7
      1 1.8

$ awk '/^```/{f=!f;next} f' odd/tasks/repo-hygiene.md | md5sum
246e1a4a0e106c5ea69b9577af0849d8  -
$ awk '/^```/{f=!f;next} f' odd/tasks/repo-hygiene.es.md | md5sum
246e1a4a0e106c5ea69b9577af0849d8  -      # identical
```

Cada `[x]` de cualquiera de las dos tablas `## Progress` apunta a §1.1..§1.8 y cada una de esas
secciones existe en el mismo documento — el escaneo de punteros de arriba cuenta exactamente un
encabezado de evidencia por id, en los dos idiomas. El orden de encabezados `##` es idéntico en
los dos archivos: 11 secciones cada uno, misma secuencia; la copia en español traduce los
encabezados de prosa (`Restricciones (no negociables)`, `Decisiones …`, `Hallazgos …`, `Tareas`,
`Log de evidencia`, `Fuera de alcance`) y conserva los encabezados de campo (`Delivery`,
`Progress`, `Next step`) verbatim.

**Prueba de prosa.** `git diff --stat` (este work unit, sin commitear) y una lectura del diff:

```text
$ git diff --stat
 odd/tasks/odd-doc-structure.es.md | 122 +++++++++++++++++++++++++++++++++++++-
 odd/tasks/odd-doc-structure.md    | 117 +++++++++++++++++++++++++++++++++++-
 odd/tasks/repo-hygiene.es.md      | 103 +++++++++++++++++++++++++++++++-
 odd/tasks/repo-hygiene.md         |  97 +++++++++++++++++++++++++++++-
 4 files changed, 431 insertions(+), 8 deletions(-)

$ git diff --numstat 96f03f6
382	0	odd/tasks/odd-doc-structure.es.md
370	0	odd/tasks/odd-doc-structure.md
101	2	odd/tasks/repo-hygiene.es.md
96	1	odd/tasks/repo-hygiene.md
49	3	odd/tasks/wu3-contract.es.md
44	2	odd/tasks/wu3-contract.md
```

El diff de trabajo toca sólo los cuatro archivos de documentos, y cada cambio es una de estas
cosas: las cuatro estructuras agregadas, la línea de `Status` corregida, o el bookkeeping de este
documento. Nada más se reescribió.

**Sobre el conteo corriente.** El bullet `**Conteo corriente:**` de `## Delivery` se actualiza
para los slices 1.1, 1.2 y 1.3 juntos: `git diff --numstat 96f03f6` (arriba, medido desde la base
de la feature branch, con las ediciones sin commitear del slice 1.3 incluidas) lee 1054 líneas
autoradas en total — 515 en los documentos en inglés y 539 en sus espejos en español, así que
los espejos vuelven a ser ~51% del costo. Son altas más bajas, que ahora es la única fórmula
vigente en este documento; los cuatro totales de §1.1 son netos, y unificarlos es la tarea 1.3a.
Re-medir después de escribir es el mecanismo de §1.1, así que el total incluye las líneas de
esta misma sección. *(Nota de consistencia, 1.3a, 2026-09-17: 1054 fue la medición del árbol de
trabajo, capturada antes del commit e incluyendo las líneas que lo afirman. El slice 1.3 ya
aterrizó como `ad8b122`, y el rango anclado a commits `git diff --numstat 96f03f6..ad8b122`
reproduce exactamente 1054 — la aritmética está en §1.3a — así que el valor histórico
sobrevive intacto mientras 1.3a re-ancla el bullet a los commits.)*

**Lo que me sorprendió.**

1. **La fila de `repo-hygiene` de §1.1 (+951 = +20/+459/+472) no se reproduce con su fórmula
   declarada.** Sumando adiciones *más* deleciones sobre `git log 9eb288b..1c73e4c --numstat` da
   +1163, no +951. El desglose +951 se reproduce exacto sólo como adiciones *menos* deleciones por
   archivo: 430 + 445 + 23 + 27 + 10 + 3 + 7 + 6 = 951 (repo-hygiene.md, repo-hygiene.es.md,
   s1-foundation.md, s1-foundation.es.md, .gitattributes, package.json, Makefile y el `tasks.md`
   del SDD agrupado en los docs en inglés). La aritmética de §1.1 contradice su propia oración de
   fórmula; el forecast corregido (adiciones más deleciones) está registrado en `## Delivery` de
   `repo-hygiene.md`, y la fila de §1.1 queda intacta como evidencia aceptada. *(Superado en 1.3a,
   2026-09-17: el supervisor unificó la única fórmula como adiciones más deleciones, y las cuatro
   filas de §1.1 se corrigieron con las cifras netas viejas visibles y etiquetadas, en lugar de
   "intacta"; ver §1.1 y §1.3a.)*
2. **El espejo español de este documento ya se había desviado antes de este slice.** La fila 1.2
   de `## Progress` en `odd-doc-structure.es.md` leía `[ ]` mientras la tabla canónica en inglés
   leía `[x]` (la evidencia §1.2 existe en los dos archivos). Detectado al regenerar el espejo acá;
   corregido para que coincida con el canónico.
3. **Un matiz de notación de rango en la línea de status.** `746be7f..1c73e4c`, leído como rango
   de git, excluye a `746be7f` y cuenta 8 commits; el rango de 9 commits es `9eb288b..1c73e4c` (el
   padre de `746be7f` es `9eb288b`). El texto dictado por el supervisor decía "9 commits" junto a un
   rango que contiene ocho: la trampa de notación en miniatura. Corregido el 2026-09-17: la línea de
   status ahora escribe el span como `746be7f`…`1c73e4c` (un span, no un rango de git) y el conteo
   de nueve es el medido desde `9eb288b..1c73e4c`.

**Sobre la anulación.** La tarea 1.3 de este documento originalmente exigía que la tarea 1.6 de
`repo-hygiene` quedara en `[ ]` (*"no hay sección de evidencia, el rastro está sólo en el hallazgo
F5"*). El supervisor anuló eso el 2026-09-17 porque la prueba ya existe en el mismo documento — F4
tiene la salida cruda de pi-lens y la decisión de no accionar, F5 la salida cruda de knip y el
hallazgo diferido de `uv`. El cuerpo de la tarea de arriba conserva su texto original; la anulación
queda registrada acá y, como sección de evidencia, en el propio documento anulado.

### 1.3a — la corrección de la fórmula, el conteo re-anclado y el registro de RDD (2026-09-17)

Todo lo de esta sección sale de un comando, y cada número es un valor medido; donde el original se
conservó deliberadamente como evidencia escrita, se dice y no se esconde. Los totales de altas+bajas
y los desgloses por categoría dictados por el supervisor se reprodujeron exactos — no se le corrigió
nada al padre. La única discrepancia encontrada fue mi propia primera corrida de awk, que imprimía
mal el desglose neto por categoría (los acumuladores netos quedaron fuera de la rama de categoría,
así que cada columna imprimía el total); la corrida corregida de abajo es el registro.

**Check 1 — la re-medición por feature, las dos fórmulas.** Mismos rangos, mismas exclusiones
(`pnpm-lock.yaml`, rutas `generated`, archivos `.lock`; `migration_lock.toml` es un `.toml`, no un
archivo `.lock`, y cuenta como código/tests):

```text
$ for r in "b05afcd..9eb288b" "9eb288b..1c73e4c" "1c73e4c..2a62fa7" "2a62fa7..96f03f6"; do git log "$r" --numstat | grep -v '^$' | grep -v '^commit ' | grep -v '^Author' | grep -v '^Date' | grep -v '^    ' | awk -v R="$r" '$3 !~ /pnpm-lock\.yaml$/ && $3 !~ /generated/ && $3 !~ /\.lock$/ { if ($3 ~ /\.es\.md$/) { addes+=$1+$2; netes+=$1-$2 } else if ($3 ~ /\.md$/) { adden+=$1+$2; neten+=$1-$2 } else { addcode+=$1+$2; netcode+=$1-$2 } } END { printf "=== %s ===\nadd+del total: %d (code/tests=%d, Docs EN=%d, Docs ES=%d)\nnet (add-del): %d (code/tests=%d, Docs EN=%d, Docs ES=%d)\n", R, addcode+adden+addes, addcode, adden, addes, netcode+neten+netes, netcode, neten, netes }'; done
=== b05afcd..9eb288b ===
add+del total: 1934 (code/tests=666, Docs EN=644, Docs ES=624)
net (add-del): 1930 (code/tests=666, Docs EN=642, Docs ES=622)
=== 9eb288b..1c73e4c ===
add+del total: 1163 (code/tests=20, Docs EN=585, Docs ES=558)
net (add-del): 951 (code/tests=20, Docs EN=459, Docs ES=472)
=== 1c73e4c..2a62fa7 ===
add+del total: 4478 (code/tests=2092, Docs EN=1219, Docs ES=1167)
net (add-del): 3224 (code/tests=1502, Docs EN=865, Docs ES=857)
=== 2a62fa7..96f03f6 ===
add+del total: 1598 (code/tests=1004, Docs EN=308, Docs ES=286)
net (add-del): 1572 (code/tests=1002, Docs EN=284, Docs ES=286)
```

La columna de altas+bajas es la que ahora lleva la tabla de §1.1; la columna neta es la medición
vieja (`Total anterior (neto)`). Los desgloses netos reproducen las filas viejas exactas —
666/642/622, 20/459/472, 1502/865/857, 1002/284/286.

**Check 2 — conteo de encabezados `##`, EN vs ES, ambos pares:**

```text
$ for p in odd-doc-structure wu3-contract; do printf '%s: EN=%s ES=%s\n' "$p" "$(grep -c '^## ' odd/tasks/$p.md)" "$(grep -c '^## ' odd/tasks/$p.es.md)"; done
odd-doc-structure: EN=10 ES=10
wu3-contract: EN=10 ES=10
```

**Check 3 — bloques de código cercados idénticos byte a byte, ambos pares.** El par de wu3, que este
registro no toca dentro de sus cercos:

```text
$ awk '/^```/{f=!f;next} f' odd/tasks/wu3-contract.md | md5sum
6e58b62bedfa054f43d9a83cdb1ce708  -
$ awk '/^```/{f=!f;next} f' odd/tasks/wu3-contract.es.md | md5sum
6e58b62bedfa054f43d9a83cdb1ce708  -      # identical
```

El par que contiene estas mismas líneas no puede declarar su propio hash adentro sin circularidad,
así que se mide aparte, en prosa: `awk '/^```/{f=!f;next} f' odd/tasks/odd-doc-structure.md | md5sum` → `f8dd5e327a4391e76ec58d9c557b24be`, y el mismo comando sobre `odd-doc-structure.es.md` → `f8dd5e327a4391e76ec58d9c557b24be` — idéntico.

**Check 4 — todo `[x]` de `## Progress` resuelve a un encabezado del mismo documento:**

```text
$ for f in odd/tasks/odd-doc-structure.md odd/tasks/odd-doc-structure.es.md odd/tasks/wu3-contract.md odd/tasks/wu3-contract.es.md; do
    awk '/^## Progress/{p=1;next} /^## / && p{p=0} p && /^\|/ && /\[x\]/ {print}' "$f" | while read -r row; do
      id=$(printf '%s' "$row" | awk -F'|' '{gsub(/^[ \t]*§?[ \t]*|[ \t]+$/,"",$5); print $5}')
      [ -z "$id" ] && continue
      if grep -q "^### $id" "$f"; then echo "$(basename "$f"): §$id OK"; else echo "$(basename "$f"): §$id MISSING"; fi
    done
  done
odd-doc-structure.md: §1.1 OK
odd-doc-structure.md: §1.2 OK
odd-doc-structure.md: §1.3 OK
odd-doc-structure.md: §1.3a OK
odd-doc-structure.es.md: §1.1 OK
odd-doc-structure.es.md: §1.2 OK
odd-doc-structure.es.md: §1.3 OK
odd-doc-structure.es.md: §1.3a OK
wu3-contract.md: §1.1 OK
wu3-contract.md: §1.2 OK
wu3-contract.md: §1.3 OK
wu3-contract.es.md: §1.1 OK
wu3-contract.es.md: §1.2 OK
wu3-contract.es.md: §1.3 OK
```

**Check 5 — el diff de este work unit.** `git diff --stat` y el numstat propio de la unidad, medidos
después de escribir todo lo de esta sección (los conteos incluyen las líneas de esta misma sección):

```text
$ git diff --stat
 odd/tasks/odd-doc-structure.es.md | 266 +++++++++++++++++++++++++++++++++++---
 odd/tasks/odd-doc-structure.md    | 257 +++++++++++++++++++++++++++++++++---
 odd/tasks/wu3-contract.es.md      |  11 +-
 odd/tasks/wu3-contract.md         |  11 +-
 4 files changed, 501 insertions(+), 44 deletions(-)
```

Una lectura del diff, archivo por archivo: `odd-doc-structure.md` — el bullet del conteo corriente
reemplazado (re-anclado a commits), la tabla de §1.1 corregida con la nueva columna `Old total
(net)` y una nota de corrección etiquetada, la oración del multiplicador corregida (2,9× a 11,2×),
dos notas etiquetadas agregadas al §1.3 (consistencia + superado), la nueva tarea 1.3a, la nueva
fila de `## Progress`, la nueva sección `## Conformidad con el RDD`, la nueva entrada de evidencia
`### 1.3a`, y la actualización de una línea del `## Next step`; `odd-doc-structure.es.md` — los
mismos cambios, traducidos; `wu3-contract.md` y su espejo — sólo el bullet `**Forecast:**` de
`## Delivery`, corregido con el set viejo +1572 conservado y etiquetado. Ninguna otra línea cambió.
Las líneas autoradas propias de la unidad, desde el árbol de trabajo:

```text
$ git diff --numstat ad8b122
247	19	odd/tasks/odd-doc-structure.es.md
238	19	odd/tasks/odd-doc-structure.md
8	3	odd/tasks/wu3-contract.es.md
8	3	odd/tasks/wu3-contract.md

add+del total for this unit: 545 (EN=268, ES=277)
```

**Slices 1.1–1.3, anclados a commits (Decisión 2):**

```text
$ git diff --numstat 96f03f6..ad8b122
384	0	odd/tasks/odd-doc-structure.es.md
372	0	odd/tasks/odd-doc-structure.md
101	2	odd/tasks/repo-hygiene.es.md
96	1	odd/tasks/repo-hygiene.md
49	3	odd/tasks/wu3-contract.es.md
44	2	odd/tasks/wu3-contract.md
```

add+del total: **1054** (515 inglés, 539 español). Un conteo anclado a commits no puede ser
invalidado por el acto de escribirlo, que es por qué el bullet ahora descansa en este rango y no en
el árbol de trabajo. La aritmética de consistencia: el bloque de numstat capturado en §1.3
(382/370/101·2/96·1/49·3/44·2) suma 1050, y el rango commiteado lee 1054 — cuatro líneas del par
aterrizaron entre esa captura y el commit, porque las líneas que afirman el conteo todavía se
estaban escribiendo. Esa es exactamente la circularidad que 1.3a remueve.

**Decisión 3 — el switch de RDD, sólo-lectura:**

```text
$ gentle-ai review mode status
receipt-driven development: on (decided by global)
  global:      on
  clone-local: unset
```

**Lo que se dejó deliberadamente como evidencia escrita.** El párrafo de la trampa (+2106/+450/+454)
y las cifras de participación del texto de la tarea 1.1 son mediciones históricas tomadas con la
fórmula vieja, y se conservan tal como quedaron registradas; la afirmación del espejo que llevan se
sostiene con las dos fórmulas (~49% de las líneas de documentación de cada par). El `## Next step`
del espejo español se había desviado antes de esta unidad — nombraba la pregunta de estrategia de
cadena y la tarea 1.2 — y se regeneró para espejar el inglés, que es donde ese encabezado ahora lee.

### 1.4 — `s1-foundation.md` y su espejo español (2026-09-17)

Las cuatro estructuras agregadas a los dos archivos, y la línea de `Status` corregida — decía
`in progress` sobre una feature que está terminada: las cuatro tareas 1.1–1.4 llevan secciones de
evidencia en el mismo documento, la lista de residuos se cerró en la feature que le sigue,
`repo-hygiene` (commit `6fe5314`), y el tip de esta feature, `9eb288b`, es ancestro de
`origin/main`. El resto de la línea (el puntero a la copia en español y el puntero a *Defectos* /
*Registro de revisión del supervisor*) queda intacto. Los encabezados de tarea conservan su texto;
el estado vive sólo en la tabla `## Progress`. Los checks de abajo son los que la tarea 1.6 va a
re-correr sobre los ocho documentos, corridos acá sobre los dos pares que toca esta unidad,
crudos:

```text
$ for f in s1-foundation.md s1-foundation.es.md odd-doc-structure.md odd-doc-structure.es.md; do
    printf '%s: constraints=%s delivery=%s progress=%s next=%s\n' "$f" \
      "$(grep -c '^## Constraints (non-negotiable)\|^## Restricciones (no negociables)' odd/tasks/$f)" \
      "$(grep -c '^## Delivery$' odd/tasks/$f)" "$(grep -c '^## Progress$' odd/tasks/$f)" \
      "$(grep -c '^## Next step$' odd/tasks/$f)"; done
s1-foundation.md: constraints=1 delivery=1 progress=1 next=1
s1-foundation.es.md: constraints=1 delivery=1 progress=1 next=1
odd-doc-structure.md: constraints=1 delivery=1 progress=1 next=1
odd-doc-structure.es.md: constraints=1 delivery=1 progress=1 next=1

$ for f in odd/tasks/s1-foundation.md odd/tasks/s1-foundation.es.md odd/tasks/odd-doc-structure.md odd/tasks/odd-doc-structure.es.md; do
    awk '/^## Progress/{p=1;next} /^## / && p{p=0} p && /^\|/ && /\[x\]/ {print}' "$f" | while read -r row; do
      id=$(printf '%s' "$row" | awk -F'|' '{gsub(/^[ \t]*§?[ \t]*|[ \t]+$/,"",$5); print $5}')
      [ -z "$id" ] && continue
      if grep -q "^### $id" "$f"; then echo "$(basename "$f"): §$id OK"; else echo "$(basename "$f"): §$id MISSING"; fi
    done
  done
s1-foundation.md: §1.1 OK
s1-foundation.md: §1.2 OK
s1-foundation.md: §1.3 OK
s1-foundation.md: §1.4 OK
s1-foundation.es.md: §1.1 OK
s1-foundation.es.md: §1.2 OK
s1-foundation.es.md: §1.3 OK
s1-foundation.es.md: §1.4 OK
odd-doc-structure.md: §1.1 OK
odd-doc-structure.md: §1.2 OK
odd-doc-structure.md: §1.3 OK
odd-doc-structure.md: §1.3a OK
odd-doc-structure.md: §1.4 OK
odd-doc-structure.es.md: §1.1 OK
odd-doc-structure.es.md: §1.2 OK
odd-doc-structure.es.md: §1.3 OK
odd-doc-structure.es.md: §1.3a OK
odd-doc-structure.es.md: §1.4 OK

$ for f in odd/tasks/s1-foundation.md odd/tasks/s1-foundation.es.md; do
    echo "== $f"
    awk '/^## /{ev=0} /^## Evidence log|^## Log de evidencia/{ev=1} /^### / && ev{print $2}' "$f" | sort | uniq -c
  done
== odd/tasks/s1-foundation.md
      1 1.1
      1 1.2
      1 1.3
      1 1.4
== odd/tasks/s1-foundation.es.md
      1 1.1
      1 1.2
      1 1.3
      1 1.4

$ awk '/^```/{f=!f;next} f' odd/tasks/s1-foundation.md | md5sum
8d954644a76f8076f6367e059d56d6a0  -
$ awk '/^```/{f=!f;next} f' odd/tasks/s1-foundation.es.md | md5sum
8d954644a76f8076f6367e059d56d6a0  -      # identical

$ git log b05afcd..9eb288b --numstat | grep -v '^$' | grep -v '^commit ' | grep -v '^Author' | grep -v '^Date' | grep -v '^    ' | awk -v R="b05afcd..9eb288b" '$3 !~ /pnpm-lock\.yaml$/ && $3 !~ /generated/ && $3 !~ /\.lock$/ { if ($3 ~ /\.es\.md$/) { addes+=$1+$2; netes+=$1-$2 } else if ($3 ~ /\.md$/) { adden+=$1+$2; neten+=$1-$2 } else { addcode+=$1+$2; netcode+=$1-$2 } } END { printf "=== %s ===\nadd+del total: %d (code/tests=%d, Docs EN=%d, Docs ES=%d)\nnet (add-del): %d (code/tests=%d, Docs EN=%d, Docs ES=%d)\n", R, addcode+adden+addes, addcode, adden, addes, netcode+neten+netes, netcode, neten, netes }'
=== b05afcd..9eb288b ===
add+del total: 1934 (code/tests=666, Docs EN=644, Docs ES=624)
net (add-del): 1930 (code/tests=666, Docs EN=642, Docs ES=622)

$ git branch -a --list '*s1-foundation*' | grep . || echo "no s1-foundation branch (local or remote)"
no s1-foundation branch (local or remote)

$ git merge-base --is-ancestor 9eb288b origin/main && echo "9eb288b is an ancestor of origin/main; origin/main is $(git rev-parse --short origin/main)"
9eb288b is an ancestor of origin/main; origin/main is 1c73e4c
```

Este par no puede declarar su propio hash dentro de sus propios cercos sin circularidad — §1.3a
registra la misma restricción. Medido al final de esta entrada, después de la última edición de
cercos: `awk '/^```/{f=!f;next} f' odd/tasks/odd-doc-structure.md | md5sum` → `b1ee203a829db94b174fddd407974dd5`, y el
mismo comando sobre `odd-doc-structure.es.md` → `b1ee203a829db94b174fddd407974dd5` — idéntico.

**Lo que me sorprendió.**

1. **El escaneo de punteros necesitó un límite de sección para ser honesto.** El one-liner de la
   era de §1.3 (`awk '/^## Evidence log|^## Log de evidencia/{ev=1} /^### / && ev{print $2}'`)
   cuenta también los encabezados `### D1`–`### D4`, porque en `s1-foundation` las secciones de
   *Defectos* vienen después del log de evidencia. El escaneo sin límite devuelve 1.1, 1.2, 1.3,
   1.4, D1, D2, D3, D4 en los dos archivos; el escaneo con límite (cada encabezado `## ` resetea
   el guard) devuelve exactamente 1.1–1.4. El escaneo reportado es el delimitado por sección.
2. **El chequeo de hash de pares no se movió para el par de s1.** El par ya tenía muchos bloques
   cercados y las ediciones de esta unidad no agregaron ninguno, así que el hash quedó igual
   (`8d954644…`) y sigue idéntico entre los dos archivos. No es un pase vacuo — el chequeo
   compara bloques reales de salida de comandos y fallaría si una edición del espejo derivara;
   acá nada dentro de los cercos cambió.
3. **Los dos bloques de diff de abajo son valores de captura por diseño.** Los conteos incluyen
   las líneas del propio registro (el mecanismo de re-medición de §1.1), así que son verdaderos
   al momento de capturarlos y sólo se mueven si el registro se edita de nuevo antes del commit.

**Prueba de prosa.** `git diff --stat` (este work unit, sin commitear) y el numstat propio de la
unidad contra el árbol de trabajo:

```text
$ git diff --stat
 odd/tasks/odd-doc-structure.es.md | 148 +++++++++++++++++++++++++++++++++++++-
 odd/tasks/odd-doc-structure.md    | 143 +++++++++++++++++++++++++++++++++++-
 odd/tasks/s1-foundation.es.md     |  51 +++++++++++++-
 odd/tasks/s1-foundation.md        |  48 ++++++++++++-
 4 files changed, 381 insertions(+), 9 deletions(-)

$ git diff --numstat c96dd3d
145	3	odd/tasks/odd-doc-structure.es.md
140	3	odd/tasks/odd-doc-structure.md
49	2	odd/tasks/s1-foundation.es.md
47	1	odd/tasks/s1-foundation.md

add+del total for this slice: 390 (EN=191, ES=199)
```

El diff de trabajo toca sólo los cuatro archivos de documentos, y una lectura del diff muestra que
cada cambio es una de estas cosas: las cuatro estructuras agregadas (constraints + delivery +
progress + next step), la línea de `Status` corregida, o el bookkeeping de este documento. Nada
más se reescribió.

**Sobre el conteo corriente.** Los slices 1.1–1.3 siguen anclados a sus commits
(`96f03f6..ad8b122` = 1054) y el work unit propio de 1.3a mantiene su conteo registrado contra
`ad8b122` (545); este slice no tiene commit todavía, así que su conteo es la medición del árbol de
trabajo de arriba (`git diff --numstat c96dd3d`), que incluye las líneas de este registro. No se
reclama ningún total anclado a commits — el ancla es el árbol de trabajo hasta que el work unit
aterrice.

### 1.5 — `wu2-data-model.md` y su espejo español (2026-09-17)

Las cuatro estructuras agregadas a los dos archivos, y nada más: los encabezados de tarea conservan
su texto, la sección `## Closure (2026-09-17)` queda intacta, y el token de estado `cerrada` del
espejo español se deja exactamente como está (hallazgo más abajo, entregado a la tarea 1.6).
`## Progress` salió completamente en `[x]` — éste era el único documento cuyo estado declarado
(`Status: closed`) ya era veraz — y `## Next step` es un *none* explícito. El bullet de TDD en
`## Constraints (non-negotiable)` ganó el modo/fuente/runner que le faltaba conservando su oración
explicativa; verificado antes de escribir que `openspec/config.yaml:58` es `strict_tdd: true`, que
los scripts `test:api` (`pnpm --filter api --fail-if-no-match run test`) y `test:worker` (`uv run
--project workers/media pytest workers/media/tests -q`) del `package.json` raíz corren exactamente
los dos comandos que la línea nombra, y que `apps/api/package.json` lleva el script `test`
(`vitest run`) al que resuelve la gate de la API. Los checks de abajo son los que la tarea 1.6 va a
re-correr sobre los ocho documentos, corridos acá sobre los cuatro archivos que toca este slice,
crudos:

```text
$ for f in wu2-data-model.md wu2-data-model.es.md odd-doc-structure.md odd-doc-structure.es.md; do
    printf '%s: constraints=%s delivery=%s progress=%s next=%s\n' "$f" \
      "$(grep -c '^## Constraints (non-negotiable)\|^## Restricciones (no negociables)' odd/tasks/$f)" \
      "$(grep -c '^## Delivery$' odd/tasks/$f)" "$(grep -c '^## Progress$' odd/tasks/$f)" \
      "$(grep -c '^## Next step$' odd/tasks/$f)"; done
wu2-data-model.md: constraints=1 delivery=1 progress=1 next=1
wu2-data-model.es.md: constraints=1 delivery=1 progress=1 next=1
odd-doc-structure.md: constraints=1 delivery=1 progress=1 next=1
odd-doc-structure.es.md: constraints=1 delivery=1 progress=1 next=1
```

Todo `[x]` de cualquiera de las dos tablas `## Progress` resuelve a un encabezado de evidencia del
mismo documento; el escaneo delimitado por sección (cada encabezado `## ` resetea el guard) y el
censo de encabezados de evidencia están abajo — el censo es lo que vuelve necesario el límite,
porque en el par de wu2 la forma sin límite contaría los encabezados `### 1.1`–`### 1.3`
duplicados (y un tercer `### 1.1` que viene de `## Tasks`).

```text
$ for f in odd/tasks/wu2-data-model.md odd/tasks/wu2-data-model.es.md odd/tasks/odd-doc-structure.md odd/tasks/odd-doc-structure.es.md; do
    awk '/^## Progress/{p=1;next} /^## / && p{p=0} p && /^\|/ && /\[x\]/ {print}' "$f" | while read -r row; do
      id=$(printf '%s' "$row" | awk -F'|' '{gsub(/^[ \t]*§?[ \t]*|[ \t]+$/,"",$5); print $5}')
      [ -z "$id" ] && continue
      if grep -q "^### $id" "$f"; then echo "$(basename "$f"): §$id OK"; else echo "$(basename "$f"): §$id MISSING"; fi
    done
  done
wu2-data-model.md: §1.1 OK
wu2-data-model.md: §1.2 OK
wu2-data-model.md: §1.3 OK
wu2-data-model.md: §1.4 OK
wu2-data-model.md: §1.5 OK
wu2-data-model.md: §1.6 OK
wu2-data-model.md: §1.7 OK
wu2-data-model.md: §1.8 OK
wu2-data-model.es.md: §1.1 OK
wu2-data-model.es.md: §1.2 OK
wu2-data-model.es.md: §1.3 OK
wu2-data-model.es.md: §1.4 OK
wu2-data-model.es.md: §1.5 OK
wu2-data-model.es.md: §1.6 OK
wu2-data-model.es.md: §1.7 OK
wu2-data-model.es.md: §1.8 OK
odd-doc-structure.md: §1.1 OK
odd-doc-structure.md: §1.2 OK
odd-doc-structure.md: §1.3 OK
odd-doc-structure.md: §1.3a OK
odd-doc-structure.md: §1.4 OK
odd-doc-structure.md: §1.5 OK
odd-doc-structure.es.md: §1.1 OK
odd-doc-structure.es.md: §1.2 OK
odd-doc-structure.es.md: §1.3 OK
odd-doc-structure.es.md: §1.3a OK
odd-doc-structure.es.md: §1.4 OK
odd-doc-structure.es.md: §1.5 OK
```

Las 28 filas resuelven: las 16 de wu2 (EN+ES) y las 12 filas `[x]` del propio par de este
documento (las dos filas `[ ]` — 1.6, 1.7 — quedan intactas por diseño).

```text
$ for f in odd/tasks/wu2-data-model.md odd/tasks/wu2-data-model.es.md; do
    echo "== $f"
    awk '/^## /{ev=0} /^## Evidence log|^## Registro de evidencia/{ev=1} /^### / && ev{print $2}' "$f" | sort | uniq -c
  done
== odd/tasks/wu2-data-model.md
      2 1.1
      2 1.2
      2 1.3
      1 1.4
      1 1.5
      1 1.6
      1 1.7
      1 1.8
== odd/tasks/wu2-data-model.es.md
      2 1.1
      2 1.2
      2 1.3
      1 1.4
      1 1.5
      1 1.6
      1 1.7
      1 1.8
```

Los duplicados son estructurales, no un problema de resolución: las tareas 1.1, 1.2 y 1.3 llevan
cada una dos encabezados de evidencia — la entrada de la corrida RED/GREEN más su entrada de
*verificación independiente*, una consecuencia de la verificación independiente por work unit del
RDD — y los dos encabezados de una tarea están en el mismo `## Evidence log`. El puntero de
progreso resuelve por existencia (`grep -q "^### <id>"`), así que un `[x]` que apunta a §1.1
encuentra su evidencia. Es una forma distinta del caso `### D1`–`### D4` de `s1-foundation`, donde
las secciones *posteriores* al log de evidencia se filtraban en un escaneo sin límite; acá la única
filtración posible serían los propios duplicados.

Los bloques cercados del par de wu2, idénticos byte a byte después de la edición de este slice (el
par ganó exactamente un bloque nuevo, la lista de 20 commits de `## Delivery`):

```text
$ awk '/^```/{f=!f;next} f' odd/tasks/wu2-data-model.md | md5sum
9f41d0d28cb00bb828a2ac48773c69b5  -
$ awk '/^```/{f=!f;next} f' odd/tasks/wu2-data-model.es.md | md5sum
9f41d0d28cb00bb828a2ac48773c69b5  -      # identical
```

**La medición retrospectiva del Delivery**, la fórmula de registro (adiciones más deleciones,
excluyendo `pnpm-lock.yaml`, rutas `generated` y archivos `.lock`):

```text
$ git log 1c73e4c..2a62fa7 --numstat | grep -v '^$' | grep -v '^commit ' | grep -v '^Author' | grep -v '^Date' | grep -v '^    ' | awk -v R="1c73e4c..2a62fa7" '$3 !~ /pnpm-lock\.yaml$/ && $3 !~ /generated/ && $3 !~ /\.lock$/ { if ($3 ~ /\.es\.md$/) { addes+=$1+$2; netes+=$1-$2 } else if ($3 ~ /\.md$/) { adden+=$1+$2; neten+=$1-$2 } else { addcode+=$1+$2; netcode+=$1-$2 } } END { printf "=== %s ===\nadd+del total: %d (code/tests=%d, Docs EN=%d, Docs ES=%d)\nnet (add-del): %d (code/tests=%d, Docs EN=%d, Docs ES=%d)\n", R, addcode+adden+addes, addcode, adden, addes, netcode+neten+netes, netcode, neten, netes }'
=== 1c73e4c..2a62fa7 ===
add+del total: 4478 (code/tests=2092, Docs EN=1219, Docs ES=1167)
net (add-del): 3224 (code/tests=1502, Docs EN=865, Docs ES=857)
```

**Hechos de la branch — por qué la etiqueta de estrategia es `feature-branch`, retrospective, y no
el "no branch ever existed" de `s1-foundation`:**

```text
$ git branch -a --list '*wu2-data-model*'
  feat/wu2-data-model
  remotes/origin/feat/wu2-data-model
$ git rev-parse feat/wu2-data-model
2a62fa7921796028461bad145515a985fc320c78
$ git rev-parse origin/feat/wu2-data-model
2a62fa7921796028461bad145515a985fc320c78
$ git rev-list --left-right --count feat/wu2-data-model...origin/feat/wu2-data-model
0	0
$ git merge-base feat/wu2-data-model origin/main
1c73e4c47be8ffd0e6916992a8023ec7e73d7fe6
$ git rev-parse --short origin/main
1c73e4c
$ git merge-base --is-ancestor 2a62fa7 origin/main && echo merged || echo "2a62fa7 is NOT an ancestor of origin/main"
2a62fa7 is NOT an ancestor of origin/main
$ git ls-remote origin 'refs/pull/*/head'; echo "exit=$?"
exit=0
```

La feature branch existe local **y** en `origin`, las dos apuntan al mismo commit (`2a62fa7`) y
están en sync (`0\t0`); la branch nunca se mergeó a `main` (su merge-base con `origin/main` es
`1c73e4c`, el tip de `origin/main`). La sonda `ls-remote` devolvió salida vacía con exit `0` (ningún
pull ref abierto). Ve sólo PRs abiertos — un PR que se abrió y se cerró sin merge no aparece, así
que esa ausencia no se puede verificar sólo con git.

**El re-ancla de 1.4, medido — el check sobre el que ahora descansa el bullet del conteo corriente:**

```text
$ git diff --numstat c96dd3d..64177be
145	3	odd/tasks/odd-doc-structure.es.md
140	3	odd/tasks/odd-doc-structure.md
49	2	odd/tasks/s1-foundation.es.md
47	1	odd/tasks/s1-foundation.md
```

total altas+bajas: **390 (EN=191, ES=199)** — reproduce exactamente el total del árbol de trabajo
registrado en §1.4, mismos cuatro archivos, mismo numstat. El slice 1.4 queda entonces anclado a
commits, como los slices 1.1–1.3, y su valor histórico del árbol de trabajo (`git diff --numstat
c96dd3d`, también 390, registrado en §1.4) queda visible y etiquetado. Esto cierra el círculo que
§1.4 dejó abierto: "el ancla es el árbol de trabajo hasta que el work unit aterrice, y entonces el
commit pasa a ser el ancla" — `64177be` es ese commit.

**Lo que cada documento ahora dice y antes no.**

- `wu2-data-model.md`: la línea de TDD nombra su modo, fuente y runner (antes era sólo modo: "la
  config declara `strict_tdd: true`"); `## Delivery` registra el forecast retrospectivo (+4478,
  medido), la estrategia (`feature-branch`, retrospective — la branch existe local y en `origin`, en
  sync, nunca mergeada a `main`, sin PR abierto) y la frontera de slice (una branch, un slice, 20
  commits listados verbatim); `## Progress` está completo en `[x]` para 1.1–1.8 con un puntero por
  fila; `## Next step` es un *none* explícito que nombra a WU-3 como su propia feature.
- `wu2-data-model.es.md`: lo mismo, traducido; el token de estado `cerrada` intacto (hallazgo de
  abajo).
- `odd-doc-structure.md`: la tarea 1.5 está `[x]` (§1.5); el conteo corriente re-ancla el slice 1.4
  a su commit `64177be` (390, reproducido arriba) y cuenta este slice contra el árbol de trabajo en
  `64177be`; `## Next step` nombra 1.6 y después 1.7; y los ítems abiertos de abajo quedan
  registrados para la tarea 1.6 en lugar de arreglarse o esconderse acá.

**Prueba de prosa.** — el diff de esta unidad, medido desde el árbol de trabajo en `64177be`
(valores de captura; los conteos incluyen las líneas del propio registro, el mecanismo de
re-medición de §1.1):

```text
$ git diff --stat
 odd/tasks/odd-doc-structure.es.md | 318 ++++++++++++++++++++++++++++++++++++--
 odd/tasks/odd-doc-structure.md    | 305 ++++++++++++++++++++++++++++++++++--
 odd/tasks/wu2-data-model.es.md    |  75 +++++++++-
 odd/tasks/wu2-data-model.md       |  71 ++++++++-
 4 files changed, 745 insertions(+), 24 deletions(-)

$ git diff --numstat 64177be
308	10	odd/tasks/odd-doc-structure.es.md
295	10	odd/tasks/odd-doc-structure.md
72	3	odd/tasks/wu2-data-model.es.md
70	1	odd/tasks/wu2-data-model.md

add+del total for this slice: 769 (EN=376, ES=393)

$ git diff --name-only
odd/tasks/odd-doc-structure.es.md
odd/tasks/odd-doc-structure.md
odd/tasks/wu2-data-model.es.md
odd/tasks/wu2-data-model.md
```

El diff de trabajo toca sólo los cuatro archivos de documentos, y una lectura del diff, archivo por
archivo, muestra que cada cambio es una de estas cosas: las cuatro estructuras agregadas al par de
wu2, el bullet de TDD completado en su `## Constraints` (modo/fuente/runner agregados, oración
explicativa conservada), o el bookkeeping de este documento (la fila de progreso `1.5`, el bullet
del conteo corriente re-anclado, la actualización del `## Next step` y esta entrada). Nada más se
reescribió.

**Sobre el conteo corriente.** Los slices 1.1–1.3 siguen anclados a sus commits
(`96f03f6..ad8b122` = 1054, arriba), el work unit propio de 1.3a mantiene su conteo registrado
contra `ad8b122` (545), y el slice 1.4 también quedó re-anclado — el bullet de `## Delivery`
lleva la actualización, y el re-ancla está medido justo arriba. Este slice no tiene commit todavía,
así que su conteo es la medición del árbol de trabajo (`git diff --numstat 64177be`, en los
bloques de prueba de prosa), que incluye las líneas de este registro. No se reclama ningún total
anclado a commits — el ancla es el árbol de trabajo hasta que el work unit aterrice.

**Lo que me sorprendió.**

1. **`cerrada` vs `closed`: el único token de estado traducido.** Líneas crudas de los ocho
   encabezados de estado, medidas el 2026-09-17:

```text
$ grep -H '^\*\*Status:\*\*' odd/tasks/wu2-data-model.md odd/tasks/s1-foundation.md odd/tasks/repo-hygiene.md odd/tasks/wu3-contract.md
odd/tasks/wu2-data-model.md:**Status:** `closed` 2026-09-17 — tasks 1.1 to 1.8 complete, every work unit verified independently.
odd/tasks/s1-foundation.md:**Status:** `closed` — all four tasks 1.1–1.4 carry recorded evidence; the residue list below was
odd/tasks/repo-hygiene.md:**Status:** complete and pushed (9 commits, `746be7f`…`1c73e4c`, on `origin/main`) — 2026-09-17.
odd/tasks/wu3-contract.md:**Status:** `in progress` — created 2026-09-17.
$ grep -H '^\*\*Estado:\*\*' odd/tasks/wu2-data-model.es.md odd/tasks/s1-foundation.es.md odd/tasks/repo-hygiene.es.md odd/tasks/wu3-contract.es.md
odd/tasks/wu2-data-model.es.md:**Estado:** `cerrada` el 2026-09-17 — tareas 1.1 a 1.8 completas, cada unidad de trabajo verificada de
odd/tasks/s1-foundation.es.md:**Estado:** `closed` — las cuatro tareas 1.1–1.4 llevan evidencia registrada; la lista de
odd/tasks/repo-hygiene.es.md:**Estado:** completo y pusheado (9 commits, `746be7f`…`1c73e4c`, en `origin/main`) — 2026-09-17.
odd/tasks/wu3-contract.es.md:**Estado:** `in progress` — creado el 2026-09-17.
```

   Sólo el par de wu2 traduce el token entre backticks (`cerrada` contra `closed`); `s1-foundation`
   (`closed`) y `wu3-contract` (`in progress`) conservan el token inglés verbatim, y `repo-hygiene`
   no lleva token (su estado es prosa, traducida normalmente). Es una inconsistencia real,
   preexistente. La decisión le pertenece a la tarea 1.6, no a este slice, así que el espejo
   conserva `cerrada` exactamente como está; registrado acá como ítem abierto para 1.6 con las
   líneas crudas de arriba.
2. **Traído delante del slice anterior y dejado a la tarea 1.6.** Dos ítems, registrados acá como
   ítems abiertos en lugar de arreglados u ocultos:
   (a) las filas 1.6 y 1.7 (`[ ]`) de la tabla `## Progress` de este mismo documento llevan sólo
   una razón general — la oración de introducción, "El estado es `[x]` sólo donde el registro de
   evidencia tiene prueba observada" — y no una razón por fila, mientras que la spec de la tarea
   1.6 exige "cada `[ ]` tiene una razón declarada";
   (b) la afirmación de cierre de residuo de §1.4 — "cerrada por la feature que le sigue,
   `repo-hygiene` (commit `6fe5314`)" — está dicha sin salida cruda de git para `6fe5314`. La
   afirmación está corroborada por la propia lista de fronteras de slice de `repo-hygiene.md` (el
   commit `6fe5314` es "S1 residue closure and mirror regeneration"), pero el registro de 1.6
   debería llevar la salida cruda o marcar la afirmación como no verificada.
3. **El "eighteen commits, none pushed" del Cierre no se reproduce — las dos mitades son
   afirmaciones de captura.** El commit de cierre `2a62fa7` (el número 20 del rango) introdujo esa
   oración. Hoy el rango `1c73e4c..2a62fa7` contiene 20 commits (19 en el padre de `2a62fa7`), y la
   branch está pusheada y en sync con `origin` — la entrega que el Cierre registra como pendiente
   ocurrió después de la captura. El conteo se reconcilia como 20 menos el commit de tracking
   (`627979d`) y el propio commit de cierre (`2a62fa7`), lo que es plausible pero no es lo que el
   documento afirma. La sección del Cierre se conserva como contenido aceptado; el `## Delivery` de
   wu2 de este slice afirma la verdad medida (20, pusheado, en sync); y esta discrepancia queda
   registrada como ítem abierto para 1.6.
4. **Ningún check pasó de forma vacua este slice.** La única sonda limitada por construcción es la
   de PR: `git ls-remote origin 'refs/pull/*/head'` devolviendo salida vacía con exit `0` es
   evidencia sobre PRs **abiertos** solamente, y el `## Delivery` de wu2 dice exactamente eso. El
   check de hash de pares sobre el par de wu2 compara contenido real (el par ganó exactamente un
   bloque cercado nuevo; el hash ahora lee `9f41d0d2…`, compartido por los dos archivos), así que
   este pase de hash del slice no es el pase de cadena vacía que §1.2 registró para el par de
   odd-doc-structure, que entonces no tenía bloques.

Este par no puede declarar su propio hash dentro de sus propios cercos sin circularidad — §1.3a y
§1.4 registran la misma restricción. Medido al final de esta entrada, después de la última edición
de cercos (y re-medido tras la corrección in-place del bloque de prueba de prosa de arriba, que es
una edición de cercos): `awk '/^```/{f=!f;next} f' odd/tasks/odd-doc-structure.md | md5sum` →
`0521b8fe4b4a0cf37a3d312d2245a44f`, y el mismo comando sobre `odd-doc-structure.es.md` →
`0521b8fe4b4a0cf37a3d312d2245a44f` — idéntico. El hash del par de wu2, citado en el bloque de
arriba, no lo afecta la prosa de este documento y sigue coincidiendo (`9f41d0d2…`). Las dos
capturas de prueba de prosa de arriba son valores de captura por diseño (el mecanismo de re-medición
de §1.1), y esta nota les suma sus propias líneas — el rango commiteado va a confirmar los números
cuando este work unit aterrice.

## Conformidad con el RDD

Una sección porque el supervisor tomó una decisión explícita sobre los candidatos de esta feature
el 2026-09-17, y la decisión se registra acá en lugar de quedar implícita en una línea de log.

- **Resultado: sin linaje, sin consentimiento, sin captura — los candidatos de esta feature
  quedaron sin revisar por decisión explícita del supervisor.** No existe ninguna transacción de
  revisión nativa para esta feature: no se STARTeó nada, no se emitió ningún envelope de
  consentimiento, y ningún revisor corrió. La revisión nativa sigue siendo el check independiente
  sobre la escritura, y esta feature no tiene uno.
- **Alcance: sólo esta feature.** La decisión no cambia la política del repo. El switch de
  revisión sigue leyendo `global: on`, `clone-local: unset` — verificado con el comando de
  sólo-lectura `gentle-ai review mode status` (salida cruda en §1.3a). El RDD sigue prendido; los
  candidatos de las demás features no se ven afectados.
- **Por qué.** El supervisor fue informado, antes de decidir, de que el candidato estaba sin
  commitear y de que la revisión correría cuatro lentes por work unit. La regla de entrada de la
  revisión tiene una excepción para una edición pasiva trivial de sólo documentación, y esta
  feature sólo cambia Markdown. El precedente en el repo es `repo-hygiene.md` §1.8, donde la
  revisión nativa se salteó con la misma excepción y el camino con riesgo se satisfizo con un
  check recalculado en su lugar.
- **Qué carga con el check en su lugar.** La verificación mecánica de la tarea 1.6 — toda
  estructura presente, todo `[x]` que resuelve, todo `[ ]` con razón, bloques cercados idénticos
  byte a byte, prosa diffeada — incluido el contraejemplo construido que tiene que hacer fallar el
  hash de bloques, para que el check sea demostrablemente capaz de fallar.
- **Qué NO estuvo disponible.** Una revisión nativa aprobada y su veredicto. Esta feature por lo
  tanto no lleva ningún veredicto de revisión; el resultado registrado es el opt-out explícito, y
  todo lo demás en este documento es la verificación propia del writer bajo la decisión del
  supervisor.

## Fuera de alcance

- El fix upstream. El supervisor decidió (2026-09-17) no levantar un issue contra
  `Gentleman-Programming/gentle-shell`; esto es un backfill local, y los documentos corregidos son la
  referencia que el próximo agente copia.
- Un validador, un archivo de plantilla o un skill. Esta feature agrega estructura a documentos; el
  enforcement es una decisión aparte, deliberadamente no tomada acá.
- Reescribir evidencias, hallazgos o decisiones ya aceptadas en los documentos existentes.
- Cerrar `wu3-contract` o `repo-hygiene`. Registrar que están abiertos es el trabajo; terminarlos, no.

## Next step

Correr la tarea 1.6 (verificación sobre los 8 documentos), y después la 1.7 (cierre).
