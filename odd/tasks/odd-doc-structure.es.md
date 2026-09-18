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
- **Conteo corriente:** 1054 líneas autoradas cambiadas a través de los slices 1.1, 1.2 y 1.3
  juntos, medidas desde la base de la feature branch `96f03f6` con `git diff --numstat 96f03f6`
  (incluyendo las ediciones sin commitear del slice 1.3, y las líneas de este mismo bullet): 515
  en los documentos en inglés y 539 en sus espejos en español, así que los espejos vuelven a ser
  ~51% del costo. Son altas más bajas, la única fórmula que el supervisor unificó el 2026-09-17;
  los cuatro totales de §1.1 son *netos*, que es el defecto registrado abajo y corregido en 1.3a.
  La base es la lección dura de §1.1, el punto de bifurcación y no el tip de la feature anterior:
  un rango que arranca en `2a62fa7` se tragaría los cuatro commits de `wu3-contract`, ancestros
  de esta branch.
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
| 1.4 | `s1-foundation.md` + espejo | `[ ]` | — |
| 1.5 | `wu2-data-model.md` + espejo | `[ ]` | — |
| 1.6 | Verificación sobre los 8 documentos | `[ ]` | — |
| 1.7 | Cierre | `[ ]` | — |

## Registro de evidencia

Salida cruda, agregada a medida que cierra cada tarea. Verbatim, sin parafrasear.

### 1.1 — la forma y los hechos medidos (2026-09-17)

Líneas autoradas por feature, medidas con `git log <rango> --numstat`, adiciones más deleciones,
excluyendo `pnpm-lock.yaml`, rutas `generated` y archivos `.lock`:

| Feature | Rango | Total | Código/tests | Docs EN | Docs ES |
| --- | --- | --- | --- | --- | --- |
| `s1-foundation` | `b05afcd..9eb288b` | +1930 | +666 | +642 | +622 |
| `repo-hygiene` | `9eb288b..1c73e4c` | +951 | +20 | +459 | +472 |
| `wu2-data-model` | `1c73e4c..2a62fa7` | +3224 | +1502 | +865 | +857 |
| `wu3-contract` | `2a62fa7..96f03f6` | +1572 | +1002 | +284 | +286 |

Cada feature supera el presupuesto advisory de ~400 líneas, por 2,4× a 8×. En tres de cuatro, el espejo
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
esta misma sección.

**Lo que me sorprendió.**

1. **La fila de `repo-hygiene` de §1.1 (+951 = +20/+459/+472) no se reproduce con su fórmula
   declarada.** Sumando adiciones *más* deleciones sobre `git log 9eb288b..1c73e4c --numstat` da
   +1163, no +951. El desglose +951 se reproduce exacto sólo como adiciones *menos* deleciones por
   archivo: 430 + 445 + 23 + 27 + 10 + 3 + 7 + 6 = 951 (repo-hygiene.md, repo-hygiene.es.md,
   s1-foundation.md, s1-foundation.es.md, .gitattributes, package.json, Makefile y el `tasks.md`
   del SDD agrupado en los docs en inglés). La aritmética de §1.1 contradice su propia oración de
   fórmula; el forecast corregido (adiciones más deleciones) está registrado en `## Delivery` de
   `repo-hygiene.md`, y la fila de §1.1 queda intacta como evidencia aceptada.
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

## Fuera de alcance

- El fix upstream. El supervisor decidió (2026-09-17) no levantar un issue contra
  `Gentleman-Programming/gentle-shell`; esto es un backfill local, y los documentos corregidos son la
  referencia que el próximo agente copia.
- Un validador, un archivo de plantilla o un skill. Esta feature agrega estructura a documentos; el
  enforcement es una decisión aparte, deliberadamente no tomada acá.
- Reescribir evidencias, hallazgos o decisiones ya aceptadas en los documentos existentes.
- Cerrar `wu3-contract` o `repo-hygiene`. Registrar que están abiertos es el trabajo; terminarlos, no.

## Next step

Responder la pregunta de estrategia de cadena registrada en `## Delivery`, y después correr la tarea 1.2.
