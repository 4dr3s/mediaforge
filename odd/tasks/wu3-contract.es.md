# Feature — `wu3-contract` (el contrato de dispatch compartido TS↔Python y el registry de tipos de job)

> **Copia de lectura en español.** El documento canónico es `wu3-contract.md` (inglés); si
> divergen, manda el inglés. **Los bloques de código son idénticos a los del inglés, byte a byte**
> (se comparan con un md5 de los bloques extraídos): son salida cruda de comandos y una tabla de
> Markdown, y traducirlos sería falsificarlos. Lo que está traducido es la prosa.

**Workflow:** Organic Driven Development (ODD).
**Fuente de verdad de los requisitos:** `openspec/changes/audio-extract-vertical-slice/` — tratada como
solo-lectura salvo que el supervisor pida una corrección.
**Estado:** `in progress` — creado el 2026-09-17.

---

## Por qué existe esta feature

WU-2 dejó el proyecto con una base de datos y un modelo de datos, y nada que los dos runtimes entiendan
a la vez. WU-3 es la unidad que hace real "un contrato honrado dos veces": un envelope de dispatch
versionado, el registry de tipos de job como **datos**, y un único set de fixtures sobre el que los
validadores de TypeScript y de Python tienen que coincidir.

Es también la primera unidad cuyo entregable es *acuerdo* más que comportamiento. Un contrato que dos
runtimes interpretan distinto no falla ruidosamente — falla como un job que el worker no puede
resolver, o peor, uno que procesa con los parámetros equivocados. Por eso la aceptación es un test de
paridad y no un archivo de schema que se ve bien.

## Entradas autoritativas

| Entrada | Qué gobierna |
| --- | --- |
| `design.md` §2.2 (disposición de módulos) | Dónde vive cada artefacto: `contracts/` para los archivos neutrales al lenguaje, `apps/api/src/contracts/` para los validadores de zod, `workers/media/src/mediaforge/contracts.py` para los modelos de pydantic. |
| `design.md` §7.1 (el contrato de dominio) | Los tres campos del envelope y la regla que los hace suficientes: **una notificación, no la verdad**. Los parámetros, los inputs y el estado siempre se re-leen de Postgres. |
| C3 *One Versioned Message Contract Honored by Both Runtimes* | El envelope se define una vez como un contrato JSON versionado; un consumer que no soporta la versión lo **rechaza** en vez de procesarlo parcialmente. |
| C3 *The Queue Port Is Broker-Agnostic* | **Sin vocabulario de broker** en el contrato de dominio. El schema no debe nombrar Redis, streams, groups ni claims. |
| C1 *The Job-Type Registry Is the Only Source of Submission Rules* | El registry es **datos, no constantes de código**: schema de params, aridad de inputs, tipos de input permitidos, cap de tamaño de input, límite de wall-clock. `audio.extract` = aridad 1, cap de input de 200 MB. |
| C5 *The Handler Asserts Its Registry-Declared Arity and Params* | Los params se validan contra el schema del registry **antes** de que el handler arranque. |

## Restricciones (no negociables)

- **El envelope lleva exactamente tres campos**: `type` (el discriminador de versión), `job_id`,
  `occurred_at`. Agregar un cuarto es un cambio de contrato con una versión nueva, no un detalle de
  implementación — en el momento en que el envelope lleva parámetros o estado deja de ser una
  notificación y se vuelve una segunda copia vieja de la verdad.
- **Sin vocabulario de broker** en los archivos del contrato. `xadd`, `xreadgroup`, `xautoclaim`,
  `group`, `consumer`, `delivery_count` pertenecen al adaptador y no deben aparecer en el schema, en
  el registry ni en los fixtures.
- **El registry es datos.** Cambiar un límite es un cambio de registry, no un cambio de código:
  ningún límite puede estar duplicado como constante en ninguno de los dos runtimes, y los tests leen
  los valores del archivo.
- **Dos validadores, un único set de fixtures.** El test de paridad es el mecanismo que mantiene
  honestos a zod y a pydantic. Un fixture que solo un lado parsea es un test que falla, no uno que se
  saltea.
- **Strict TDD.** Modo `strict`; fuente `openspec/config.yaml:58` (`strict_tdd: true`); runner las dos
  gates: `pnpm --filter api --fail-if-no-match run test` (api) y
  `uv run --project workers/media pytest workers/media/tests -q` (worker). Las dos suites se escriben y
  se observan fallando antes de que existan los archivos del contrato.
- **El RDD sigue prendido**, con el verificador independiente por unidad de trabajo, como en WU-2.

## Decisiones tomadas antes de escribir

1. **Lo que WU-3 no construye.** Los *loaders* del registry que los runtimes van a usar en producción
   (el §2.2 del diseño pone uno en `workers/media/src/mediaforge/registry/`) pertenecen a las unidades
   que los consumen: la validación de submissions de la API (WU-4) y el dispatch de handlers del
   worker (WU-8/9). WU-3 entrega el contrato, los validadores y la prueba de paridad; los tests leen
   `job-types.json` directamente. Construir un loader ahora sería un módulo sin caller.
2. **Los fixtures son la forma ejecutable del contrato.** Toda aserción que las dos suites hacen sobre
   forma, rechazo y contenidos del registry se expresa como un documento en `contracts/fixtures/`,
   así "los dos runtimes aceptan el mismo envelope" se demuestra en vez de describirse.
3. **Las suites de paridad están separadas del E2E.** El escenario de C3 sobre bytes reales es el
   smoke de compose (WU-21). WU-3 prueba que los dos validadores coinciden sobre los mismos
   documentos; WU-21 prueba que los dos procesos coinciden sobre unos reales.

## Delivery

Registrado el 2026-09-17, cuando esta estructura se agregó al documento. Los números se miden
retrospectivamente desde los commits, no se estimaron en la creación — esta feature es anterior al
campo.

- **Estrategia:** `single-pr` (retrospectiva; el campo no existía cuando se planificó el trabajo).
- **Forecast:** +1598 líneas autoradas cambiadas, adiciones más deleciones — la única fórmula que
  el supervisor unificó el 2026-09-17 — lockfiles y archivos generados excluidos: +1004 de código
  y tests, +308 de documentación en inglés, +286 de espejo en español. Eso es ~4× el presupuesto
  advisory de ~400, sin cadena aplicada. *(Corregido en 1.3a, 2026-09-17: esta fila antes leía
  +1572 = +1002/+284/+286 a ~3,9× — esa es la medición *neta* (adiciones menos deleciones) del
  mismo rango, `git log 2a62fa7..96f03f6 --numstat`. El set +1572 queda acá como número
  histórico, y el +1598 = +1004/+308/+286 corregido es la re-medición de adiciones más
  deleciones, salida cruda en el §1.3a de `odd-doc-structure.md`.)*
- **Fronteras de slice:** ninguna, porque no se usó ninguna. El trabajo está en una sola branch local,
  `feat/wu3-contract`, sin upstream y sin pull request, con `e806a4f` (rastreo), `0220b84` (las dos
  suites de paridad), `7b432f6` (el contrato, el registry y los dos validadores) y `96f03f6` (el
  espejo español y el registro de verificación).

## Tareas

Cada tarea cierra con al menos un work-unit commit en la feature branch, evaluado y verificado de
forma independiente.

### 1.1 — RED: las dos suites de paridad · owner: IA

Escribir las dos, contra los mismos documentos de fixture:

- `apps/api/test/contract.parity.spec.ts` (Vitest, zod);
- `workers/media/tests/test_contract_parity.py` (pytest, pydantic).

Tienen que afirmar, de forma idéntica:

- todo envelope golden en `contracts/fixtures/envelopes/` parsea, y el valor parseado lleva **solo**
  `type`, `job_id`, `occurred_at` — un envelope con un campo extra es rechazado;
- un envelope cuyo `type` no es `mediaforge.job.dispatch.v1` es **rechazado** (no ignorado, no
  procesado parcialmente);
- un envelope malformado (campo faltante, tipo incorrecto, `occurred_at` que no es RFC-3339) es
  rechazado;
- `contracts/job-types.json` declara `audio.extract` con aridad 1, un cap de input de 200 MB, un cap
  de salida, un límite de wall-clock, TTL y grace del lease, un presupuesto de intentos, y
  exactamente un parámetro opcional — `quality`, un enum de `128k | 192k | 320k`;
- los fixtures de params parsean en los dos lados, y un valor de param fuera del enum es rechazado;
- **no aparece vocabulario de broker** en el schema, en el registry ni en los fixtures.

**Aceptación:** los dos archivos existen y los dos se observan fallando, con la falla registrada
verbatim. Falla porque los archivos del contrato todavía no existen — no porque una suite esté mal
formada, y el registro de evidencia tiene que mostrar la diferencia.

### 1.2 — GREEN: el contrato, el registry, los fixtures y los dos validadores · owner: IA

- `contracts/dispatch-envelope.schema.json` — el JSON Schema versionado, tres propiedades, sin
  `additionalProperties`, RFC 3339 para `occurred_at`.
- `contracts/job-types.json` — el registry como datos, con `audio.extract` como única entrada.
- `contracts/fixtures/envelopes/` y `contracts/fixtures/params/` — los documentos golden y los que
  deben rechazarse, nombrados para que el caso que falla sea obvio desde el nombre del archivo.
- `apps/api/src/contracts/` — los validadores de zod (envelope y params).
- `workers/media/src/mediaforge/contracts.py` — los modelos de pydantic, las mismas dos validaciones.
- `contracts/README.md` — su tabla deja de decir "nothing here yet".

**Aceptación:** las dos suites pasan sobre los mismos fixtures, y los comandos quedan registrados:

```bash
pnpm test:api
pnpm test:worker
```

### 1.3 — Conformidad con el RDD, por unidad de trabajo · owner: IA

Como en WU-2: evaluar cada unidad de trabajo, registrar el tier y el resultado, y cumplir el plan
resultante con un verificador independiente. El tier esperado es `unassessable`-as-high para los
candidatos sin señal de riesgo (el defecto registrado en `repo-hygiene.md`); un tier distinto es
información nueva para el log.

### 1.3a — Aplicar el plan de fixes del verificador: que el gate aplique el contrato que dice aplicar · owner: IA

Agregada el 2026-09-19, a partir de §1.3. Esta tarea existe porque las refutaciones del verificador
independiente se aceptaron como correctas y quedaron en pie: la tarea 1.3 está `[x]` por haber
*corrido*, y lo que refutó es exactamente el trabajo de esta tarea. El ID lleva el sufijo `a` en vez de
un número nuevo porque `odd-doc-structure.es.md:26` ya cita "la tarea 1.4 (Cierre)" de este documento,
y renumerar invalidaría en silencio una referencia que sostiene otro documento.

- **F1 — afirmar la semántica del schema, en las dos suites.** `contracts/dispatch-envelope.schema.json`
es el artefacto que C3 llama el contrato, y era el único artefacto que ningún gate aplicaba: mutarlo
(una cuarta propiedad permitida, el `const` de versión cambiado a `...v2`, `format: date-time`
cambiado a `date`) pasaba las dos suites sin tocarlas. Las dos suites de paridad deben leer el archivo
del schema y afirmar `additionalProperties: false`, el `const` de versión igual a
`mediaforge.job.dispatch.v1`, `format: date-time` en `occurred_at`, `type: object`, y exactamente las
tres propiedades `type`, `job_id`, `occurred_at` — requeridas las mismas tres.
- **F2 — medir la paridad sobre el dominio, no sobre la muestra.** El lado de Python valida RFC 3339
con un regex pelado, así que acepta cuatro documentos que zod rechaza, y los fixtures entregados nunca
ejercitan la diferencia. Reemplazar la comprobación sólo por regex por gramática **más** validación con
conocimiento de calendario (el regex queda como compuerta de gramática; `datetime.fromisoformat`
aporta la compuerta de calendario y de rango de offset), y agregar los cuatro fixtures faltantes a
`contracts/fixtures/envelopes/invalid/`: una fecha imposible, un mes inválido, un 29 de febrero de año
no bisiesto, y un offset fuera de RFC 3339 (`+24:00`).
- **F3 — el scan debe nombrar al adaptador y cubrir los validadores.** Reducir el vocabulario prohibido
a tokens específicos de Redis (`xadd`, `xreadgroup`, `xack`, `xautoclaim`, `xgroup`, `delivery_count`,
`redis`) — prohibir `consumer` era prohibir la propia palabra del dominio para el lado de Python, que
el texto de C3 usa — y extender el scan a los dos módulos de validadores:
`apps/api/src/contracts/envelope.ts`, `apps/api/src/contracts/job-params.ts` y
`workers/media/src/mediaforge/contracts.py`.

**Aceptación:** las dos suites de paridad pasan, y cada fix *demuestra atrapar el caso para el que se
escribió*, por mutación y no por reporte: F1 falla cuando el schema se muta de a una propiedad y vuelve
a pasar cuando se revierte; F2 falla en los cuatro fixtures nuevos antes de que exista la comprobación
de calendario y pasa después; F3 falla cuando se planta un token de Redis en cualquiera de los dos
módulos de validadores. Las mutaciones se revierten, y la salida cruda de cada corrida está en §1.3a.

### 1.4 — Cierre · owner: IA

`contracts/README.md` y el documento de la feature coinciden con lo que existe; la copia `.es.md` se
genera y se verifica (bloques de código idénticos byte a byte); la feature se cierra con sus gates
registradas.

## Progress

El estado es `[x]` sólo donde el registro de evidencia tiene prueba observada de esa tarea. El tier y
el resultado de RDD por unidad de trabajo viven en el registro de evidencia, donde se registraron a
medida que el trabajo corría.

| ID | Tarea | Estado | Evidencia |
| --- | --- | --- | --- |
| 1.1 | RED: las dos suites de paridad | `[x]` | §1.1 |
| 1.2 | GREEN: el contrato, el registry, los fixtures y los dos validadores | `[x]` | §1.2 |
| 1.3 | Conformidad con el RDD, por unidad de trabajo | `[x]` | §1.3 |
| 1.3a | Aplicar el plan de fixes del verificador (F1, F2, F3) | `[x]` | §1.3a — cuatro commits, 370 líneas, verificado dos veces, review nativa `approved` y quemada |
| 1.4 | Cierre | `[x]` | §1.4 — README, espejo y status coinciden con lo que existe |

La tarea 1.3 está `[x]` porque la verificación que pide *corrió* y sus refutaciones están registradas;
no es una afirmación de que la feature esté sana. Lo que refutó es exactamente lo que la tarea 1.3a
después aplicó.

## Registro de evidencia

Salida cruda, agregada a medida que cierra cada tarea. Verbatim, sin parafrasear.

### 1.1 — RED: las dos suites de paridad (2026-09-17)

```text
$ pnpm --filter api exec vitest run test/contract.parity.spec.ts
Error: Failed to load url ../src/contracts/job-params (resolved id: ../src/contracts/job-params)
       in .../apps/api/test/contract.parity.spec.ts. Does the file exist?
 Test Files  1 failed (1)
      Tests  no tests
[exit=1]

$ uv run --project workers/media pytest workers/media/tests/test_contract_parity.py -q
E   ModuleNotFoundError: No module named 'mediaforge.contracts'
!!!!!!!!!!!!!!!!!!!!!!!!!!! Interrupted: 1 error during collection !!!!!!!!!!!!!!!!!!!!!!!!!!!!
1 error in 0.15s
[exit=2]
```

Las dos son fallas de **ausencia**: la suite de TypeScript nombra el módulo que todavía no existe, y
la de Python falla en el import por la misma razón. Ninguna falló por un archivo de test mal formado,
que es la distinción que hace de esta una corrida RED y no ruido — y el archivo de Python además se
probó sintácticamente válido con `python -m py_compile`, así que la falla no puede ser un error de
sintaxis disfrazado.

**Un hueco encontrado en las propias suites, y cerrado.** Una lectura independiente de los dos
archivos contra sus propios requisitos mostró que **ninguna afirmaba la allowlist de tipos de entrada
del registry**, que C1 exige y `design.md` §2.2 lista junto a los caps. Implementar 1.2 sin notarlo
habría entregado un contrato sin allowlist y una gate que no habría podido atrapar su ausencia. La
aserción se agregó a los dos lados, deliberadamente laxa: no vacía, cada entrada un string, y el
`video/mp4` canónico del slice presente — **no** la lista exacta, porque el punto de un registry como
datos es que agregar un contenedor es un cambio de registry, y un test que fijara la lista
convertiría un cambio de datos en un cambio de test.


### 1.2 — GREEN: el contrato, el registry y los dos validadores (2026-09-17)

El registry, que es **datos**:

```json
{
  "audio.extract": {
    "input_arity": 1,
    "input_size_cap_bytes": 209715200,
    "allowed_input_types": ["video/mp4"],
    "output_size_cap_bytes": 262144000,
    "wall_clock_limit_s": 600,
    "lease_ttl_s": 300,
    "lease_grace_s": 60,
    "attempt_budget": 3,
    "params": {
      "properties": {
        "quality": { "type": "string", "enum": ["128k", "192k", "320k"] }
      }
    }
  }
}
```

Las dos gates, con las suites de paridad adentro:

```text
$ pnpm test:api     -> Test Files 3 passed (3) · Tests 42 passed (42)   [exit=0]
                       (contract.parity 18 + harness 2 + schema 22)
$ pnpm test:worker  -> 33 passed in 0.82s                              [exit=0]
                       (contract parity 19 + privileges 12 + harness 2)
```

**La gate atrapó una fuga real, que es la mejor evidencia de que funciona.** La primera versión del
schema del envelope describía uno de sus campos con la palabra *"consumer"* — vocabulario de adaptador
que C3 prohíbe en el contrato de dominio, metido dentro de un valor string de JSON donde un lector
jamás lo notaría. El scan de vocabulario hizo fallar el build. Se removió de la descripción, no del
scan.

**Dos blockers, y eran de tipos distintos.** pi-lens reportó un import sin resolver de
`mediaforge.contracts` y un bloque de imports desordenado. El primero era una **cache vieja**: el
hallazgo se capturó antes de que el módulo existiera, y la prueba es que el módulo importa y la suite
que lo importa corre diecinueve tests verdes. El segundo era **real, y no donde miré primero**: no era
el agrupamiento — que es correcto, `mediaforge` es first-party — sino el formato: un import de tres
líneas que entra en una (84 caracteres contra un límite de 88). Colapsarlo limpió el hallazgo. Dos
cosas se hicieron antes, y las dos quedan: el proyecto ahora **declara** `known-first-party =
["mediaforge"]` en `pyproject.toml` en vez de dejar la convención implícita, y nada se deformó para
complacer a una herramienta.


### 1.3 — verificación independiente, y qué refutó (2026-09-17)

La gate RDD corrió un verificador adversarial con una sola instrucción que importaba: construir un
contrato incorrecto que pase todas las aserciones. Encontró uno, y después encontró algo a lo que las
mutaciones no habrían podido llegar.

**Refutado, lo más severo primero:**

1. **El archivo de schema es decoración sin enforcement.** Mutar `dispatch-envelope.schema.json` —
   permitir una cuarta propiedad, cambiar el `const` de versión a `...v2`, cambiar
   `format: date-time` a `date` — pasa **las dos suites intactas**. Ninguna suite lee la *semántica*
   del schema; se lo escanea por tokens de vocabulario y nada más. El archivo que C3 llama el
   contrato es el único artefacto al que ninguna gate aplica.
2. **Los dos runtimes no coinciden sobre el dominio RFC 3339**, solo sobre los fixtures entregados. El
   check de Python es un regex pelado sin validación de calendario ni de rango de offsets, así que
   acepta lo que zod rechaza:

   | Documento | zod (TS) | pydantic (Python) |
   | --- | --- | --- |
   | `2026-02-30T12:00:00Z` (fecha imposible) | rechaza | **acepta** |
   | `2026-13-01T12:00:00Z` (mes inválido) | rechaza | **acepta** |
   | `2026-02-29T12:00:00Z` (no es año bisiesto) | rechaza | **acepta** |
   | `2026-09-17T12:00:00+24:00` (offset fuera del RFC 3339) | rechaza | **acepta** |

   La consecuencia es concreta: **el consumer de Python procesaría un envelope que el producer jamás
   podría emitir.** La afirmación fuerte — "los dos runtimes honran el mismo contrato" — es verdadera
   sobre la muestra y falsa sobre el dominio.
3. **La lista de tokens del scan de vocabulario es demasiado ancha, y no escanea los validadores.**
   Prohíbe `consumer`, que es la propia palabra del dominio para el lado de Python (el texto de C3
   dice "the Python consumer"), y se pierde una ocurrencia en un comentario de un validador porque los
   validadores no se escanean. La regla debería nombrar tokens específicos de Redis (`xadd`,
   `xreadgroup`, `xack`, `xautoclaim`, `xgroup`, `delivery_count`, `redis`), no palabras que la spec
   usa para nombrar a sus propios actores.
4. **El enum de `quality` está duplicado por construcción**: el registry lo declara y los dos
   validadores lo hardcodean. El diseño sanciona el mantenimiento a mano ("generated from or
   hand-maintained against the JSON Schema"), y la gate **sí** vigila el drift — agregar `96k` al
   registry hace fallar la suite — así que esto se registra como una duplicación aceptada y vigilada,
   no como un defecto. Cambiarlo sigue costando dos ediciones donde "un cambio de registry, no un
   cambio de código" implica una.

**Lo que se sostuvo, y se sostuvo mecánicamente y no por declaración:** paridad de fixtures sobre los
23 documentos (enumerados de forma independiente: ningún archivo leído por un solo lado, ningún
archivo sin leer); los doce fixtures inválidos inválidos *por la razón que su nombre declara*; el
rechazo del cuarto campo ejecutado por los **parsers** (`additionalProperties` más `.strict()` de zod
y `extra="forbid"` de pydantic), no meramente por un check de keys posterior al parse; los límites
numéricos duplicados en ningún lado salvo el registry; y un contrato **runtime** incorrecto ni
siquiera construible, porque está clavado desde dos direcciones.

**Plan de fixes, antes de que esta feature cierre** — la gate tiene que aplicar el contrato que afirma
aplicar:

- **F1**: aserciones que lean la semántica del schema (`additionalProperties: false`, el `const` de
  versión, `format: date-time`, exactamente tres propiedades), en las dos suites.
- **F2**: validación de fecha con conocimiento de calendario del lado de Python en vez de un regex,
  más fixtures para una fecha imposible, un mes inválido, un 29 de febrero de año no bisiesto y un
  offset de `+24:00` — para que la paridad se mida sobre el **dominio** y no sobre la muestra.
- **F3**: reducir el scan a tokens específicos de Redis e incluir los dos módulos de validadores.

### 1.3a — el plan de fixes aplicado, verificado dos veces y revisado (2026-09-18)

Cuatro commits de unidad de trabajo en `feat/wu3-contract-fixes`, todos **locales y sin pushear**:
`516ca56` (el tracking de esta tarea), `608c375` (F1, F2, F3), `66ec44f` (los tres hallazgos de la
primera ronda de verificación) y `f598a30` (la gramática del offset). **370 líneas autoradas** — 330
adiciones, 40 deleciones, 14 archivos — dentro del presupuesto de 400 líneas que este repositorio se
puso.

**Los tres fixes, cada uno probado por mutación y no por reporte.**

- **F1.** Las dos suites ahora leen `contracts/dispatch-envelope.schema.json` del disco y afirman su
semántica. Cuatro mutaciones del schema, de a una por vez, cada una haciendo fallar **las dos** suites
y cada una revertida después: `additionalProperties: true`; el `const` de versión a `...v2`; `format:
  date-time` a `date`; una cuarta propiedad agregada. Las aserciones nacen verdes por diseño —el
archivo ya era correcto—, así que la mutación *es* el RED.
- **F2.** Los cuatro documentos que el lado de Python aceptaba mientras zod los rechazaba se agregaron
como fixtures **primero**, y la compuerta de Python falló exactamente en esos cuatro mientras la de
TypeScript seguía verde: el defecto de paridad mismo, observado y no argumentado. `occurred_at` ahora
son dos compuertas —el regex pinnea la gramática, `datetime.fromisoformat` aporta el calendario y el
rango de offset— y el orden importa: al revés, `fromisoformat` solo aceptaría `+0000`, un offset sin
dos puntos.
- **F3.** El scan de vocabulario nombra sólo maquinaria de Redis (`xadd`, `xreadgroup`, `xack`,
`xautoclaim`, `xgroup`, `xautoclave`, `group`, `stream`, `delivery_count`, `redis`), liberando
`consumer` —la propia palabra de la especificación para los dos runtimes— y ahora cubre los dos
validadores de zod y los modelos de pydantic. Tokens plantados en los tres módulos de validadores
hacen fallar las dos suites.

**La verificación independiente refutó el primer intento, y la refutación era correcta.** La compuerta
de calendario había *creado* una divergencia: `0000-09-17T12:00:00Z` era aceptado por zod y rechazado
por pydantic, cuando antes de esta tarea **ambos** lo aceptaban. Dos hallazgos más: los *tipos* de las
propiedades del schema seguían sin afirmarse (`properties.job_id.type: "number"` pasaba las dos
suites), y acotar el scan había liberado `stream` y `group`, que C3 prohíbe por nombre. Los tres se
cerraron en `66ec44f`:

- el dominio de instante queda declarado como **años 0001–9999** y aplicado en los dos runtimes: un
  `pattern` de `^(?!0000)` en el schema —una comprobación negativa de prefijo, deliberadamente no una
  cuarta copia de la gramática, que no podría chequear el calendario y se leería como la definición
  del campo—, un `.refine` explícito en el validador de zod, y la compuerta de calendario de Python que
  ya existía. Medido por fixture: `year-zero-occurred-at.json` lo rechazan los dos, con Python
  rechazándolo en la compuerta 2, y `boundary-min-year.json` / `boundary-max-year.json` pinnean el otro
  borde para que el acotamiento no se convierta en silencio en "sólo fechas modernas";
- los dos tipos de propiedad quedan afirmados, cada uno probado haciendo fallar las dos suites por
  mutación;
- `stream`, `group` y `xautoclave` vuelven a la lista, y sólo se liberó `consumer`.

**Un cuarto defecto, pre-existente, encontrado al revisar ese fix.** `datetime.fromisoformat`
*normaliza* los componentes de un offset en vez de chequear su rango: `+02:60` pasaba a `+03:00` y
`+02:99` a `+03:39`, mientras zod rechazaba ambos — o sea que el worker de Python habría procesado un
envelope que el productor nunca podría emitir. La compuerta de gramática ahora pinnea el offset a la
gramática de RFC 3339, `[+-](?:[01]\d|2[0-3]):[0-5]\d`, y
`offset-minutes-out-of-range-occurred-at.json` lo mide. Una matriz de 30 documentos devolvió veredictos
idénticos del validador de zod real y del parser de Python real. Este defecto es anterior al plan de
fixes: el regex original tenía el mismo `[+-]\d{2}:\d{2}` permisivo.

**La segunda ronda de verificación: `holds`.** Un reticulado exhaustivo de **6060 documentos** —cada
offset `[+-]HH:MM` para horas 00–26 y minutos 00–99, más barridos de hora/minuto/segundo, mes, día a lo
largo de los doce meses y de febrero en un año bisiesto y uno no bisiesto, los bordes de año
(`0000–0002`, `1899–1901`, `1999–2001`, `9998–9999`, uno por encima del rango de cuatro dígitos) y los
bordes léxicos (`T`/`t`/espacio, `Z`/`z`, sólo fecha, sin offset, `+0000`, de cero a diez dígitos
fraccionarios, un punto final, formas de segundo intercalar)— produjo **cero divergencias** entre los
dos runtimes, y cada veredicto además coincidió con un modelo de expectativa independiente. Dos trampas
de medición se cazaron en el proceso y vale conservarlas: `z.string().datetime()` solo *no* es el
validador de TypeScript (la exclusión del año 0000 vive en un `.refine`), y `wc -l` cuenta
terminadores mientras `grep -c ''` cuenta ítems.

R1–R3 de §1.3 quedan **cerradas**; R4 (el `quality` duplicado por construcción) sigue siendo la
duplicación aceptada y policiada que se registró.

**Una reescritura sólo del mensaje, registrada porque afecta cómo se puede citar este documento.**
`f8b918c` y `a14ed38` se reescribieron a `66ec44f` y `f598a30` para corregir una cláusula inexacta en
el mensaje de un commit. Los trees son idénticos (`0d8c3cf…` y `e7511d70…`) y el digest del patch del
rango no cambia (`fd1026535d86ac61…`, 599 líneas), así que la verificación aplica al contenido que
queda. Los commits reemplazados son inalcanzables y tarde o temprano se podan, así que **este documento
cita los commits vivos más la igualdad de trees**, nunca los muertos.

**Gates.** `pnpm --filter api exec vitest run test/contract.parity.spec.ts` → **19 passed**;
`uv run --project workers/media pytest workers/media/tests/test_contract_parity.py -q` → **20
passed**; `uvx --from ruff==0.16.8 ruff check workers/media` → limpio. La compuerta de TypeScript corre
por el toolchain de Windows (`cmd.exe /c …`), porque `node_modules` en este árbol de trabajo es una
instalación de Windows y vitest no arranca desde la shell de WSL. `apps/api/test/schema.spec.ts`,
`apps/api/test/harness.spec.ts` y `workers/media/tests/test_db_privileges.py` fallan localmente por
falta de PostgreSQL —no hay daemon de Docker en esta distro— y están verdes en CI; esta tarea no los
tocó.

**La review nativa: `approved`, y después quemada.** Linaje `review-8e2cde82d8c27d94`, riesgo
**medium**, una lente consolidada (`review-reliability`), 14 archivos cambiados, 370 líneas,
presupuesto de corrección 185. El acknowledgement consumió la revisión `sha256:d83fea73…` con
`authority: burned` y `burn_evidence: gentle-ai.review-acknowledged/v1`. Dos hallazgos **advisory**,
los dos `SUGGESTION` / `informational`, ninguno abre una corrección y ninguno es razón para volver a
correr la review: `R3-001` en `workers/media/src/mediaforge/contracts.py:94-95` y `R3-002` en
`:103-108` — en la revisión revisada, ésos son el bloque de comentario de la compuerta 2 y la
comprobación de calendario `try`/`except`. Quedan registrados acá como trabajo de seguimiento.

**La review corrió sobre una presentación staged del mismo contenido, y eso no es un tecnicismo.** Con
el árbol limpio, la ruta de rango commiteado no podía arrancar (bloqueo 3 abajo), así que los cuatro
commits quedaron intactos en `feat/wu3-contract-fixes` y el conjunto de cambios idéntico se presentó al
provider como **cambios staged sobre `origin/main`** en una rama temporal. El `sha256` del índice no
cambió, el diff staged fue exactamente `git diff 0bb898a f598a30` (14 archivos, 330/40), y el árbol
candidato que el provider congeló fue `e7511d70…` — el mismo tree que `f598a30`. El resultado
`delivery` de la review es `ordinary-repository-policy`: no se pusheó nada y no se mergeó nada.

**La compuerta del propio RDD, para el registro.** `assess` devolvió `risk: unassessable` con
`native-assess-unavailable` (una respuesta nativa incompatible de schema), `rddLine: on`, y un plan que
exige un verificador independiente separado además de la autoverificación del writer — que es lo que
es la segunda ronda de §1.3. Esa evaluación nunca mutó autoridad de review.

**Cuatro bloqueos de entorno, registrados porque no son culpa del candidato.** Cada uno se midió, y
cada uno fue un stop duro hasta que se arregló el entorno:

1. **El montaje no podía almacenar modos POSIX.** `/mnt/c` está montado como 9p/DrvFs sin `metadata`,
   así que todo se leía como `0777` y `chmod` era un no-op. El candidate view de la review exige
   `(mode & 0o077) == 0`, que ese montaje no puede satisfacer — medido contra un filesystem nativo,
   `mkdirSync(mode 0o700)` daba `777` en `/mnt/c` y `700` allá. Lo arregló el supervisor:
   `[automount] options = "metadata"` en `/etc/wsl.conf`, un reinicio de WSL, y un `chmod 700` sobre
   el directorio compartido `candidate-views`. No se borró nada.
2. **git 2.34.1 es demasiado viejo.** El builder del candidate view llama a
   `git worktree list --porcelain -z`; 2.34.1 responde `unknown switch 'z'` (exit 129), y la facade lo
   reporta como un fallo del candidate view. Se arregló instalando git 2.55.0 del PPA `git-core/ppa`.
3. **La ruta de rango commiteado no está cableada en gentle-pi 3.2.1.** `start` con `baseRef` +
   `committedOnly` terminaba siempre en `schema-incompatible`: la facade vuelve a correr el STATUS
   nativo con `--projection workspace`, y con el árbol limpio ese candidato es vacío *por
   construcción*, así que el STATUS responde `collect` / `empty_candidate_base_ref_required` y no
   existe ninguna transición `start` ejecutable. El schema del input no expone `projection`, y el
   `--projection staged` del propio nativo nunca se pasa. Se resolvió con la presentación staged
   descrita arriba.
4. **Los assets gestionados estaban viejos.** El stop `managed_assets_outdated` prescribía el sync del
   propio binario pinneado 3.2.1; reportó "All managed assets are already up to date. No files
   changed" y sólo reescribió el digest registrado (`944fa704…` → `61ae1c61…`). La causa de fondo es
   una desalineación de versiones: el `gentle-ai` global es 3.3.0 mientras el paquete de Pi pinnea
   3.2.1.

### 1.4 — Cierre (2026-09-18)

Se cierra la feature con los cuatro puntos de la aceptación verificados por medición, no por lectura:

- **`contracts/README.md` coincide con lo que existe.** Su fila del schema ahora nombra el dominio de
años (`pattern: "^(?!0000)"`), y sus dos filas de fixtures de envelopes nombran los casos que existen
hoy: los de calendario (fecha imposible, mes inválido, 29 de febrero de año no bisiesto), el offset
fuera de rango, el de minutos fuera de rango, el año 0000, y los dos bordes de año en `valid/`. El
párrafo de broker-agnosticismo dejó de decir "el schema, el registry y cada fixture": ahora incluye los
dos validadores de zod y los modelos de pydantic, nombra los diez tokens de Redis y dice por qué
`consumer` no está en la lista.
- **El espejo `.es.md` está regenerado y sus bloques de código son idénticos byte a byte** al inglés
  canónico. La comprobación extrae cada bloque cercado de los dos archivos y los compara de a pares:

```text
$ python3 - <<'PY'
import pathlib, re
fence = '`' * 3
pattern = rf'^{fence}[^\n]*\n(.*?)^{fence}$'
blocks = lambda p: re.findall(pattern, pathlib.Path(p).read_text('utf-8'), flags=re.M | re.S)
en = blocks('odd/tasks/wu3-contract.md')
es = blocks('odd/tasks/wu3-contract.es.md')
print(len(en), len(es), all(a == b for a, b in zip(en, es)))
PY
5 5 True
```
- **Las gates quedan registradas** en §1.3a con sus números, y se volvieron a correr en el cierre sobre
el mismo contenido: el tree de `f598a30` sigue siendo `e7511d70…` y el digest del patch del work unit
sigue siendo `fd1026535d86ac61…`, o sea que lo verificado es lo que está.
- **La review nativa quedó cerrada sobre este candidato**: `approved` y quemada (linaje
`review-8e2cde82d8c27d94`), con sus dos hallazgos advisory registrados como seguimiento en §1.3a.

**Sobre exactamente qué cubrió la review.** El candidato que el provider congeló fue el tree
`e7511d70…` — el mismo tree que `f598a30` — a lo largo de 14 paths, e incluía este documento. Los
commits del cierre son sólo documentación, y la review está cerrada con su autoridad quemada: nada de
acá la reabre. Coherente con el precedente de este repositorio para features de documentación, este
cierre no se manda a review nativa por sí solo.

**Entrega**: `delivery: ordinary-repository-policy`. Los cuatro commits de unidad de trabajo están
locales, la rama no tiene upstream, y push, pull request y merge quedan como decisión del supervisor.

## Fuera de alcance

- Los loaders del registry y cualquier código que *use* el registry para validar una submission
  (WU-4) o para despachar un handler (WU-8/9).
- El puerto de la queue y su adaptador de Redis Streams (WU-6/WU-7). WU-3 define lo que viaja; no lo
  mueve.
- Cualquier segunda versión del envelope. El discriminador de versión existe para que un v2 se pueda
  agregar después; v0.1 entrega una.
- Agregar un tipo de job distinto de `audio.extract`. El registry está formado para más, y los
  fixtures deliberadamente no inventan uno.

## Next step

La tarea 1.4 — el Cierre — es la única tarea abierta que queda. §1.3a aplicó el plan de fixes del
verificador (F1, F2, F3) de §1.3, cerró los tres hallazgos de la primera ronda de verificación y el
defecto de offset pre-existente encontrado al revisarla, y su review nativa está `approved` y quemada.
El cierre significa que `contracts/README.md` y este documento coinciden con lo que existe —incluido el
scan, que ahora cubre los dos módulos de validadores—, que el espejo `.es.md` está regenerado y
verificado byte a byte en sus bloques de código, y que las gates quedan registradas. La entrega —push,
pull request, merge— sigue siendo decisión del supervisor bajo la política ordinaria del repositorio:
los cuatro commits son locales, la rama no tiene upstream, y el propio resultado `delivery` de la review
es `ordinary-repository-policy`.
