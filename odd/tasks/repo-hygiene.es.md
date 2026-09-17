# Feature — `repo-hygiene` (cierre de las inconsistencias conocidas que dejó la reconstrucción de S1)

> **Copia de lectura en español.** El documento canónico es `repo-hygiene.md` (inglés); si
> divergen, manda el inglés. **Los bloques de código son idénticos a los del inglés, byte a byte**
> (se comparan con un diff): son salida cruda de comandos, y traducirla sería falsificarla. Lo que
> está traducido es la prosa.

**Workflow:** Organic Driven Development (ODD).
**Fuente de verdad de los requisitos:** `openspec/changes/audio-extract-vertical-slice/` (intacto).
**Estado:** `en curso`.

---

## Por qué existe esta feature

`odd/tasks/s1-foundation.md` termina con una sección, *"Known inconsistencies left behind (open
decisions)"*, cuya última línea dice: *"Ninguna de estas bloquea la tarea 1.4, que está
completa."* Ese es exactamente el problema. Cada item de esa lista es chico, ninguno bloquea nada,
y juntos son la diferencia entre un repositorio que dice la verdad y uno que arrastra afirmaciones
que nadie midió. La reconstrucción de S1 está cerrada; el residuo no.

El supervisor revisó `docker/`, entendió el stack, y pidió atacar el residuo en paralelo el
2026-09-17.

## Regla de método de esta feature

Cada item de la lista de S1 se re-midió contra el repositorio **antes** de escribirlo acá, porque
dos ya se habían desviado del código que describen. Una lista de problemas conocidos es en sí una
afirmación sobre el repositorio, y esta estaba vieja. Los hallazgos que resultaron no necesitar
trabajo se registran como hallazgos, no se dropean en silencio: "revisamos y ya era verdad" también
es evidencia.

## Decisiones tomadas con el supervisor (2026-09-17)

| # | Pregunta | Decisión |
| --- | --- | --- |
| 1 | `make` no está instalado en esta máquina; ¿conservar o dropear el `Makefile`? | **Conservar los dos.** El `Makefile` queda como entrypoint de Linux/CI y los scripts del `package.json` de la raíz quedan como el camino portable. La regla se documenta (tarea 1.5). |
| 2 | 5 commits locales, `origin` vacío | **Pushear ahora**, antes del churn de fin de línea, como red de seguridad y para que el remoto deje de ser un punto único de falla. |
| 3 | El plan SDD acredita 7 artefactos que ya no existen, y prescribe el gate roto de D1 | **Destildar los 7 y arreglar el runner.** Los checkboxes vuelven a `[ ]` con una nota que explica por qué, y la línea del runner toma el comando verificado. |
| 4 | `core.autocrlf=true` deja CRLF en la copia de trabajo, que es lo que Docker copia al build context | **LF para todo texto**, en el repositorio y en la copia de trabajo: `* text=auto eol=lf`. |

## Hallazgos que cambiaron la lista
### F1 — el registro de runtime viejo del SDD ya no se puede cerrar, y no es eso lo que reporta `next: apply`

La lista de S1 dice que el registro de runtime
`.git/gentle-ai/sdd-runtime/v1/audio-extract-vertical-slice/` tiene un `attempt/begin` sin su
`end` correspondiente, y que por eso `gentle-ai sdd-status` sigue reportando `next: apply`. La
mitad de eso está mal.

```text
$ gentle-ai sdd-attempt --help
Usage: gentle-ai sdd-attempt grant [flags]
Record explicit per-change edit authority. Runtime attempt operations are retired.
```

El runtime nativo **retiró las operaciones de attempt**; solo sobrevive `grant`. No hay operación
soportada para cerrar o abortar ese registro, así que "cerrar el attempt" nunca fue un fix
disponible. El registro es estado legacy inerte y borrarlo a mano sería manipular un audit store
para que un documento se vea más prolijo.

Y `next: apply` no viene de ese registro: viene de las 67 tareas destildadas del plan. Va a seguir
diciendo `apply` mientras el plan SDD tenga unidades de trabajo sin terminar, que es la respuesta
correcta para un plan cuya ejecución se mudó a ODD. No hay nada que reparar acá; hay algo que
documentar. Registrado en la tarea 1.7.

### F2 — `odd/tasks/s1-foundation.md` describe mal su propia historia

La sección *Git history* dice *"Four commits on `main`"* y lista cuatro, pero `main` tiene cinco:
el quinto (`9eb288b`) es el commit que escribió esa sección. También dice *"Nothing has been pushed
yet."* Las dos afirmaciones son ahora falsas, y la segunda se volvió falsa durante esta feature
(decisión 2). Una sección de historia que omite el commit que la documenta es una cosa chica;
también es la tercera instancia en este repositorio de un documento que afirma algo que nadie
re-midió. Registrado en la tarea 1.7.

### F3 — items que no necesitan trabajo, re-chequeados

- **Sin baseline contra el cual diffear la reconstrucción.** Verdadero e irreparable: el
  repositorio tenía cero commits antes de la reconstrucción. El tarball de seguridad ahora es
  redundante, porque el árbol reconstruido está commiteado **y pusheado**. El item se cierra por
  resolución, no por acción.
- **Hallazgos de pi-lens / knip.** `knip` marcó todas las dependencias de NestJS como no usadas
  mientras `src/` no existía; desaparecieron cuando aterrizó el código. Re-medido en la tarea 1.6
  con el árbol actual, no confiado de la nota vieja.
- **`.env.example`.** Resuelto por decisión del supervisor el 2026-09-16 (dropeado; las variables
  documentadas en `docker/compose.yaml` y en el doc de S1). Sin acción.
- **O2 (las aserciones de base del harness se mudan al cliente Prisma, `pg` sale de
  `package.json`).** Sigue vinculante, y sigue perteneciendo a WU-2, no acá. Es una constraint
  sobre una feature futura, no un residuo de esta.

### F4 — el advisory `large-class` se reproduce, y la regla es lo que está mal

Re-medido el 2026-09-17 con el analyzer de pi-lens 4.2.0 instalado, sobre el árbol actual:

```text
🔎 pi-lens: apps\api\src\health.controller.ts — 0 blocking, 0 warning(s), 1 advisory(ies)
  ⚠ L18 large-class: [slop] Large class detected — consider splitting responsibilities
```

Sale con `0`. Se reproduce, y no hay que accionarlo: el mensaje afirma "more than 20 methods"
mientras la regla publicada no lleva **ninguna condición de cantidad de métodos**, y el fixture de
test de la propia regla marca `class A { foo() {} }` — una clase de un método — como violación. La
herramienta marca cualquier clase con al menos un método. Disposición: dejar el controller como
está, no suprimir nada en código. Si el ruido alguna vez importa, el defecto a arreglar es la
aridad de la regla, no el archivo.

### F5 — el hallazgo de knip en `apps/api` ya no está, y knip encontró otro que es real

La afirmación original — todas las dependencias NestJS de `apps/api/package.json` reportadas como
no usadas — **no se reproduce**. `pnpm dlx knip --workspace api` sale con `0` sin salida sobre el
árbol actual: la premisa de ese hallazgo era que `apps/api/src/` no existía, y ahora existe.

Pero la corrida full-workspace expone algo que la lista de S1 nunca notó:

```text
Unlisted binaries (1)
uv  package.json
```

`uv` es una herramienta a nivel de máquina que el script `test:worker` del `package.json` de la
raíz invoca, y knip tiene razón: el script depende de un binario que el manifiesto nunca declara —
la misma clase de problema que `make` ausente, una capa más abajo. Está **registrado, no
accionado**: knip no es una dependencia del proyecto y no tiene configuración en este repositorio
(corre vía `pnpm dlx`), así que agregar un `knip.json` para callar a una herramienta que nadie
enchufó a CI sería inventar scope. El hallazgo pertenece a la decisión de adoptar knip, y está
listado en *Fuera de alcance* con esa razón.

También no disponible, y que no se confunda con limpio: `pnpm --filter api exec eslint .` falla
con `Command "eslint" not found`. Este proyecto no tiene dependencia de ESLint ni configuración de
ESLint, así que ese chequeo está **no disponible**, no pasando.

## Tareas

### 1.1 — Baseline: el stack está verde antes de tocar nada · owner: IA

El commit de renormalización (1.2) reescribe cada archivo trackeado del index, y 1.4 cambia la
instalación de dependencias. Sin un baseline verde, un resultado rojo posterior no se puede
atribuir.

```bash
docker compose -f docker/compose.yaml up -d --wait
pnpm test:api
pnpm test:worker
```

**Aceptación:** la salida cruda de los tres, con los exit codes, está en el log de evidencia.

### 1.2 — `.gitattributes`: LF en el repositorio y en la copia de trabajo · owner: IA

```bash
# create .gitattributes
git add --renormalize .
git add .gitattributes
git commit -m "chore(repo): force LF line endings so the build context never sees CRLF"
git checkout-index -f -a          # bring the working copy to LF as well
git status --short                # must print nothing
```

**Aceptación:**

- `git ls-files --eol` reporta `i/lf w/lf` para cada archivo de texto trackeado.
- `git diff --ignore-cr-at-eol HEAD~1 HEAD` no imprime nada: el commit cambió **solo** carriage
  returns. Esa es la prueba de que la renormalización no tocó contenido.
- `git status --short` queda vacío, o sea que la copia de trabajo y el index vuelven a coincidir.

### 1.3 — Reconciliar el plan SDD con lo que existe · owner: IA

`openspec/changes/audio-extract-vertical-slice/tasks.md`:

- Los 7 checkboxes que acreditan artefactos borrados (1.1–1.4, 5.1, 5.2, 13.2) vuelven a `[ ]`,
  con una nota que dice por qué: su evidencia se borró con el output de apply de S1 y el trabajo se
  reconstruyó bajo ODD en `s1-foundation`.
- La línea del runner de la `API` toma el reemplazo verificado de D1.

**Aceptación — medida, con el control corregido después de medirlo mal.**

La primera versión de este criterio usaba un *archivo de test* que no matcheaba como control
negativo. Ese control no vale nada, y hizo falta una medición para verlo: `vitest run
no/such/spec.ts` sale con `1` por sí solo, con o sin el flag, así que queda rojo por una razón que
no tiene nada que ver con el fix. Era un control plausible, que es exactamente lo que lo hacía
peligroso.

El defecto vive en el **selector `--filter`**, así que el control tiene que cambiar el selector
manteniendo el flag apagado y prendido. A/B, medido el 2026-09-17:

```bash
pnpm --filter nosuchpkg run test:harness                              # exit 0  <- D1 alive
pnpm --filter nosuchpkg --fail-if-no-match run test:harness           # exit 1
pnpm --filter nosuchpkg exec vitest run test/harness.spec.ts          # exit 0  <- D1 alive, in the shape the plan prescribed
pnpm --filter nosuchpkg --fail-if-no-match exec vitest run test/harness.spec.ts  # exit 1
pnpm --filter api --fail-if-no-match exec vitest run test/harness.spec.ts        # exit 0  real suite, green
```

El flag es lo que vuelve al gate capaz de fallar. Es la lección de D1 repitiéndose un nivel más
arriba: el primer control fue una conjetura que se leía como evidencia, y solo el A/B la desmintió.

**La observación que mató al primer control, como medición propia** (corrida del escritor,
2026-09-17 — un verificador independiente marcó que el párrafo de arriba la afirmaba sin un
comando reproducible en el documento, que es exactamente la clase de afirmación que esta feature
existe para frenar):

```bash
pnpm --filter api exec vitest run no/such/spec.ts                 # exit 1, without the flag
pnpm --filter api --fail-if-no-match exec vitest run no/such/spec.ts  # exit 1, with the flag
```

Los dos en rojo, así que ese control no puede distinguir el fix de que vitest falle solo. Mide a
vitest, no al gate.

### 1.4 — Fijar los build scripts permitidos · owner: IA

`pnpm install` reporta dos build scripts ignorados (`@nestjs/core`, `esbuild`). Inofensivo mientras
un humano corra el install; una diferencia silenciosa en la imagen que arma un pipeline.

```bash
# add pnpm.onlyBuiltDependencies to the root package.json
pnpm install
pnpm test:api && pnpm test:worker
```

**Aceptación:** `pnpm install` deja de reportar build scripts ignorados, y las dos suites siguen
verdes. `pnpm-lock.yaml` cambia solo si el lockfile requiere un cambio.

### 1.5 — Documentar los dos entrypoints · owner: IA

Decisión 1, escrita donde el próximo la va a buscar: un comentario en el encabezado del `Makefile`
que diga que GNU make no está instalado en la máquina Windows del autor, que los scripts del
`package.json` de la raíz son el camino portable, y que el `Makefile` existe para Linux y CI.

**Aceptación:** el comentario existe; no cambió ninguna receta; `pnpm test:api` y `pnpm test:worker`
siguen saliendo con 0.

### 1.6 — Re-medir los hallazgos que nunca se accionaron · owner: IA

pi-lens marcó `apps/api/src/health.controller.ts` con `ast-grep:large-class`, y `knip` marcó todas
las dependencias de NestJS como no usadas antes de que `src/` existiera. Los dos quedaron sin
accionar. Re-correr el chequeo contra el árbol actual.

**Aceptación:** o un hallazgo crudo más una decisión, o evidencia registrada de que ya no se
reproduce. Sin skip silencioso, y sin acción tomada solo para callar un linter. **Lista —
veredictos en F4 y F5.**

### 1.7 — Cerrar el círculo en el documento de S1, y mantener honestas las copias en español · owner: IA

- Reescribir la lista *"Known inconsistencies left behind"* en `odd/tasks/s1-foundation.md` para
  que cada item diga **resolved**, **inert (con la razón)**, o **binding on a future feature** —
  ningún item puede quedar ambiguo. Apuntar a esta feature y a los commit ids.
- Corregir las dos afirmaciones falsas de su sección *Git history* (hallazgo F2), y dropear la
  oración vieja *"Two more, and then 1.3 is closed"*.
- Regenerar `odd/tasks/s1-foundation.es.md` en sync, y crear `odd/tasks/repo-hygiene.es.md`.

**Aceptación:** las dos copias `.es.md` tienen sus secciones `##` en el mismo orden que el inglés,
y los bloques de código son byte-idénticos — verificado con el mismo chequeo que registra el doc de
S1:

```bash
awk '/^```/{f=!f;next} f' <file> | md5sum
```

### 1.8 — Registro de conformidad RDD · owner: IA

El contrato RDD exige una evaluación después de cada commit de work-unit y un registro por tarea del
tier y el outcome evaluados. El slice se evaluó una sola vez, al cierre, lo que fue una desviación,
y el registro corregido resultó imposible de producir tal como estaba escrito. Tanto el barrido como
las razones están en el log de evidencia, bajo *1.8 — Registro de conformidad RDD*.

**Aceptación:** cada work unit lleva un outcome explícito, y la razón por la que no puede llevar un
tier está medida, no asumida.

## Log de evidencia

Salida cruda, agregada a medida que cierra cada tarea. Verbatim, sin parafrasear.

### 1.1 — Baseline (2026-09-17)

El primer intento fue rojo y fue un hecho del entorno, no una regresión. `docker compose` falló con
`failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine; check if the
path is correct and see if the daemon is running`, y las dos suites fallaron con connection refused
a Postgres y Redis. Se arrancó Docker Desktop (server 29.6.2) y la corrida de abajo es el segundo
intento:

```text
$ docker compose -f docker/compose.yaml up -d --wait
 mediaforge-redis Healthy · mediaforge-postgres Healthy · mediaforge-api Healthy · mediaforge-worker Healthy
[exit=0]
$ pnpm test:api
 Test Files  1 passed (1) · Tests  2 passed (2)
[exit=0]
$ pnpm test:worker
 2 passed in 0.24s
[exit=0]
```

### 1.2 — `.gitattributes` (2026-09-17)

La parte interesante: un primer escaneo de bytes reportó los 54 archivos como conteniendo CR, y ese
número era basura. `xargs` parte los argumentos por whitespace, y un carriage return *es*
whitespace, así que el patrón le llegó a `grep` vacío y matcheó cada línea de cada archivo. La
re-corrida usa un patrón PCRE de dos caracteres (`\r`) para que ningún byte de control crudo viaje
por `argv`. Conclusión medida: nada en disco tenía CRLF; el peligro era latente, esperando al
próximo clone o checkout, y `eol=lf` lo elimina.

```text
$ git ls-files --eol | awk '{print $1, $2}' | sort | uniq -c
     54 i/lf w/lf
$ git ls-files -z | xargs -0 grep -lUP '\r'      # correct scan
(no output)  -> 0 of 54 tracked files contain a carriage return
$ awk 'BEGIN{n=0} /\r/{n++} END{...}' Makefile .gitattributes package.json docker/compose.yaml
 0 CR lines each
$ git add --renormalize .
(staged nothing beyond .gitattributes)
$ git check-attr text eol -- package.json
package.json: text: auto
package.json: eol: lf
```

Dos aclaraciones para quien lo re-corra. El censo dice **54** porque es el número al momento del
scan, antes de que `.gitattributes` mismo estuviera trackeado; en `HEAD` los mismos comandos
reportan **55**, y los dos números son el conjunto trackeado entero (`54 de 54`, `55 de 55`). Lo que
cuenta es que el conjunto escaneado esté completo, no el número.

### 1.3 — el gate del runner

El bloque A/B ya está en el cuerpo de la tarea de más arriba; medido el 2026-09-17, así que no hay
nada nuevo que registrar acá.

### 1.4 — el pin de pnpm (2026-09-17)

Las duraciones citadas abajo (`581ms`, `0.23s`) son de una sola muestra, como lo es toda salida
cruda: la verificación independiente re-corrió los mismos comandos y obtuvo `585ms` y `0.20s`, con
idénticos conteos de tests, exit codes y versión de pnpm. La evidencia son los conteos y los exit
codes; los tiempos son lo que la máquina hizo ese segundo.

```text
$ pnpm install
Scope: all 3 workspace projects
Lockfile is up to date, resolution step is skipped
Already up to date
Done in 581ms using pnpm v10.33.0
[exit=0]   (no "Ignored build scripts" notice)
$ wc -c pnpm-lock.yaml   -> 120856 before and 120856 after
$ pnpm test:api -> Test Files 1 passed (1) · Tests 2 passed (2)  [exit=0]
$ pnpm test:worker -> 2 passed in 0.23s                          [exit=0]
```

### 1.5 — los entrypoints (2026-09-17)

```text
$ command -v make
(no output) [exit=1]
$ make --version
make: command not found [exit=127]
```

### 1.7 — el cierre (2026-09-17)

Lo que cambió esta tarea: la lista de residuos de S1 ahora marca cada item resolved, inert o
binding; las dos afirmaciones falsas de su sección de historial de git quedaron corregidas; y las
dos copias `.es.md` se regeneraron y se verificaron byte-idénticas en sus bloques de código.

**Commit ids para el log de evidencia:** `746be7f` feature tracking · `914b65d` SDD plan
reconciliation · `758df00` Makefile entrypoints · `b8f1c7d` pnpm build scripts · `42a189b` lint
re-measurement and D1 control · `23585e5` LF line endings. Los cinco commits que precedieron a
esta feature son `b05afcd`, `892f706`, `9d05ebd`, `ab47532`, `9eb288b`.

### 1.8 — Registro de conformidad RDD (2026-09-17)

El contrato RDD exige una evaluación después de cada commit de work-unit y un registro por tarea del
tier y el outcome evaluados (`granted | declined | passive | deferred to slice | unavailable`).
Medido después de que el slice se pusheara, ese registro no puede producirse tal como está escrito,
por dos razones independientes — una de ellas mía.

**Razón una (mía): el paso no se dio cuando era expresable.** Corrí una sola evaluación al cierre
del slice en vez de una por commit. El camino pasivo del contrato es lo que avanza el boundary
revisado; sin evaluación por commit, el boundary nunca se movió del punto de ramificación, así que
el candidato se acumuló hasta 8 archivos y 943 líneas. La acumulación fue estructural, no
incidental.

**Razón dos (de la herramienta): el camino pasivo es inalcanzable, así que el avance del boundary
nunca fue posible de todos modos.** `assess` resuelve el candidato como `<baseRef>..HEAD`. HEAD
ahora está fijo, así que los tiers retroactivos por commit no son expresables: cada base produce el
rango acumulado en vez del commit. Y todo rango que no lleva señal de riesgo vuelve como
`unassessable`:

| baseRef | `Makefile` dentro del rango | resultado |
| --- | --- | --- |
| `9eb288b` (padre del slice) | sí | `high` · `process_boundary` · 8 archivos, 943 líneas |
| `914b65d` | sí | `high` · `process_boundary` · 7 archivos, 786 líneas |
| `758df00` | no | `unassessable` — `native response is schema incompatible` |
| `42a189b` | no | `unassessable` — ídem |
| `23585e5` | no | `unassessable` — ídem |
| `6fe5314` | no | `unassessable` — ídem |

La única señal de riesgo de este slice es el `Makefile`, porque el cambio toca un boundary de
proceso shell. Los rangos que lo contienen evalúan bien; los que no lo tienen fallan la validación
de schema del lado de Pi. El caso limpio — el que el contrato mapea a *"passive/low: no reviewer or
consent ceremony, and the boundary advances"* — es precisamente el caso que no puede producir un
veredicto, y el contrato entonces instruye tratar una evaluación fallida como `high`. El mecanismo
está **inferido de cuatro casos refutados y dos confirmados, no leído del schema**: apoyo fuerte
para una hipótesis, no un diagnóstico.

Dos sondas anteriores devolvieron `native command returned empty output` en su lugar. Esa cadena
significa que el argumento base-ref no se resolvió a un commit (estaba mal escrito), y se distingue
de la incompatibilidad de schema de arriba — útil al reproducir, porque las dos fallas se parecen y
no son lo mismo.

**Outcome registrado, por work unit: `unavailable`** — las ocho, para la review nativa; y
`unassessable` tratado como `high` dondequiera que se probó una base ref. No se inventó nada para
llenar el campo.

**Consecuencia, dicha sin vueltas.** Este slice recibió el camino gateado por riesgo:
auto-verificación del escritor más un verificador independiente obligatorio. Habría recibido
exactamente eso con RDD apagado. El camino más liviano del contrato nunca estuvo disponible para él,
y ningún cambio de secuenciación lo habría hecho disponible.

**Work unit siguiente (el espejo en español), evaluado el 2026-09-17.** Este **sí** se evaluó en la
proyección workspace, como pide el contrato, y falla igual:

```text
$ gentle_review {"operation":"assess"}    # ambient working tree, two .md files
risk: unassessable
reasons: [{"code":"native-assess-unavailable",
           "detail":"native review assess failed: native response is schema incompatible"}]
nativeReviewOutcome: unknown · outcome_source: unknown
```

Así que el defecto no se trata de rangos commiteados: se trata de que el candidato **no lleve
señal de riesgo**. Siete puntos de datos ahora, todos consistentes — seis base refs más este
candidato del workspace. Outcome registrado: `unassessable` tratado como `high`. La review nativa
se salteó para este candidato según los propios términos de la regla de entrada (*"a trivial passive
documentation-only edit"*), y el camino gateado por riesgo se satisfizo con el chequeo de hashes del
par, re-corrido de forma independiente por el padre después de que el worker lo reportara.

## Fuera de alcance

- WU-2 y todo lo posterior (schema de Prisma, contenido del contrato, máquina de estados). La
  constraint O2 queda registrada acá pero pertenece a la feature de WU-2.
- WU-5 (spike de redis-py) y WU-13 (precheck de namespaces del sandbox): su evidencia se borró por
  decisión y hay que revisitarlas antes de WU-6 y WU-14, dentro del plan SDD.
- Restaurar la denegación de egreso en la red del compose (`internal: true`, defecto D4). Eso exige
  mover la aceptación adentro de un contenedor primero; es un cambio propio.
- **Adoptar knip como dependencia del proyecto**, y con eso el hallazgo de binario no listado `uv`
  de F5. Agregar configuración para una herramienta de la que el repositorio no depende no es
  higiene, es scope.
- ESLint. El repositorio no tiene dependencia de ESLint ni configuración; eso es una decisión de
  stack, no un residuo para limpiar.