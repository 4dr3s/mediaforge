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
- **Forecast:** +1572 líneas autoradas cambiadas (adiciones más deleciones, lockfiles y archivos
  generados excluidos) — +1002 de código y tests, +284 de documentación en inglés, +286 de espejo en
  español. Eso es ~3,9× el presupuesto advisory de ~400, sin cadena aplicada.
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
| 1.4 | Cierre | `[ ]` | — **no cerrada**: el plan de fixes del verificador (F1, F2, F3, §1.3) está sin aplicar |

La tarea 1.3 está `[x]` porque la verificación que pide *corrió* y sus refutaciones están registradas;
no es una afirmación de que la feature esté sana. Lo que refutó es la razón por la que 1.4 sigue
abierta.

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

Aplicar el plan de fixes del verificador registrado en §1.3 antes de cerrar — **F1** (afirmar la
semántica del schema en las dos suites: `additionalProperties: false`, el `const` de versión,
`format: date-time`, exactamente tres propiedades), **F2** (validación de fecha con conocimiento de
calendario del lado de Python en lugar del regex, más los cuatro fixtures faltantes: fecha imposible,
mes inválido, un 29 de febrero de año no bisiesto y un offset de `+24:00`) y **F3** (reducir el scan de
vocabulario a tokens específicos de Redis e incluir los dos módulos de validadores). La tarea 1.4 queda
`[ ]` hasta que eso aterrice. Medido el 2026-09-17: F2 no está aplicado — los cuatro fixtures están
ausentes de `contracts/fixtures/envelopes/invalid/` y `workers/media/src/mediaforge/contracts.py` no
contiene `datetime`, `date(` ni `fromisoformat`.