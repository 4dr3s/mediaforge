# Feature — `repo-delivery-policy` (plantilla de PR, proceso de issues y el CI que los hace cumplir)

> **Copia de lectura en español.** El documento canónico es `repo-delivery-policy.md` (inglés); si
> divergen, manda el inglés. **Los bloques de código son idénticos a los del inglés, byte a byte**
> (se comparan con un diff): son salida cruda de comandos, y traducirla sería falsificarla. Lo que
> está traducido es la prosa.

**Workflow:** Organic Driven Development (ODD).
**Fuente de verdad de los requisitos:** la decisión del supervisor del 2026-09-18 (tres respuestas,
registradas bajo *Decisiones tomadas con el supervisor*) más el estado medido del repositorio abajo.
**Estado:** `in progress` — creado el 2026-09-18.

---

## Por qué existe esta feature

El repositorio no tiene ninguna política de entrega, y eso se midió, no se supuso:

| Artefacto | Estado medido el 2026-09-18 | Comando |
| --- | --- | --- |
| Directorio `.github/` | **ausente** — sin workflow, sin plantilla de PR, sin plantilla de issue, sin CODEOWNERS | `ls .github` → *No such file or directory* |
| CI | **ninguno** — nada corre sobre un PR | no hay `.github/workflows/` |
| Labels | **sólo los defaults de GitHub** (`bug`, `documentation`, `enhancement`, …); sin `type:*`, sin `status:approved` | `gh label list` |
| Issues | **habilitados, nunca se abrió ninguno** (`has_issues: true`) | `gh api repos/4dr3s/mediaforge` |
| Scripts de shell | **cero** — así que un job de `shellcheck` no inspeccionaría nada | `find . -name '*.sh'` → vacío |
| `.yamllint` | presente en la raíz del repo, **no lo invoca nada** | — |
| Config de `ruff` | presente en `pyproject.toml`, **no la invoca nada** | — |
| `eslint` / `prettier` | **no instalados, no configurados** | `repo-hygiene.md` §1.6 |
| PR #1 | abierto el 2026-09-18 **sin issue, sin label, sin plantilla** — es anterior a cualquier política | `gh pr view 1` |

Así que las correcciones hechas hasta acá entraron directo al repositorio sin issue, sin label y sin
check. Eso funcionó mientras una sola persona escribía todo; no sobrevive a un segundo colaborador, y
es la razón por la que el propio cuerpo del PR #1 tuvo que explicar su alcance en prosa que nada
valida.

Dos distinciones que esta feature mantiene separadas, porque no son el mismo problema:

- **Política faltante es ambigüedad.** Nada le dice a un colaborador cómo se ve un PR válido.
- **Un check sobre un conjunto vacío es una gate falsa.** `shellcheck` sobre cero scripts, o un job
  de lint cuya herramienta nunca se configuró, reporta éxito sin probar nada — la misma clase que el
  defecto D1 ya registrado en este repositorio (*"una gate que no puede fallar no es una gate"*).

## Entradas autoritativas

| Entrada | Qué gobierna |
| --- | --- |
| Las tres respuestas del supervisor, 2026-09-18 | La estrictez de la política de PR, la disposición del PR #1 y el set de jobs de CI. |
| El comentario del header del `Makefile` | *"This Makefile is kept as the canonical entrypoint for Linux and CI."* — el CI corre los mismos comandos que el repo ya documenta. |
| `odd/tasks/repo-hygiene.md` §1.6 | El estado de lint medido: `eslint` no encontrado, `knip` evaluado y deliberadamente no adoptado. |
| `odd/tasks/s1-foundation.md` D1–D4 | La disciplina de gates: cada check tiene que poder demostrarse capaz de fallar. |
| `docker/compose.yaml` | El único camino de provisioning para Postgres/Redis; su `init-test-db.sql` es lo que crea `mediaforge_test`. |
| `.gitattributes` | `* text=auto eol=lf` — ya cubre el riesgo de CRLF-en-contenedor del que vinieron D2/D3. |

## Decisiones tomadas con el supervisor (2026-09-18)

1. **La política de PR es intermedia.** Un PR debe llevar **exactamente un label `type:*`** y su
   **branch name debe matchear el regex del tipo**. Vincular un issue es **opcional** — si existe, se
   vincula, y si no, la descripción queda sola. El CI valida **label y branch**, no `Closes #N`.
2. **El PR #1 se regulariza, no se exime.** Se abre un issue describiendo lo que lleva (retroactivo,
   marcado `status:approved` porque el trabajo ya está autorizado), el PR gana su label `type:*`,
   y su cuerpo se reescribe con la nueva plantilla y `Closes #2` — el número de issue que GitHub le
   asignó al issue retroactivo, porque issues y pull requests comparten un solo espacio de números y
   el PR #1 ya ocupa el `1`. El bootstrap no deja deuda y el CI está verde desde el primer PR.
3. **El CI corre cuatro jobs**: `api`, `worker`, `lint`, `policy`. El job de lint cubre **`ruff` y
   `yamllint`** — los dos linters que este repo ya configura. **Sin job de `shellcheck`**: el repo
   tiene cero scripts de shell, así que ese check pasaría sobre un conjunto vacío y no probaría nada.
   `eslint` queda igualmente excluido porque no está instalado ni configurado; agregarlo es una
   decisión aparte.

## Restricciones (no negociables)

- **Strict TDD.** Modo `strict`; fuente `openspec/config.yaml:58` (`strict_tdd: true`); runner las dos
  gates: `pnpm --filter api --fail-if-no-match run test` (api) y
  `uv run --project workers/media pytest workers/media/tests -q` (worker). **Ningún ciclo RED aplica
  a los artefactos YAML/Markdown en sí** — un archivo de workflow no tiene unidad bajo test. Lo que lo
  reemplaza es la propia doctrina de gates de este repositorio: cada check de CI tiene que mostrarse
  **fallando** sobre un contraejemplo construido antes de que su pase cuente (tarea 1.5), exactamente
  como lo hizo el §1.6 de `odd-doc-structure`.
- **El CI corre los comandos propios del repo.** El workflow invoca los mismos entrypoints que el
  `Makefile` documenta (`pnpm test:api`, `pnpm test:worker`, `docker compose up -d --wait`) en vez de
  reimplementar el provisioning. Un segundo camino de provisioning sería una segunda cosa que mantener
  verdadera.
- **Sin reglas de lint inventadas.** `ruff` y `yamllint` corren con la configuración que ya existe en
  el repositorio. Si una regla falla, la falla se reporta; la configuración no se afloja para dejar
  el CI verde.
- **Sin secretos en un workflow.** Las credenciales del repositorio son los defaults de compose
  (`postgres`/`postgres`), ya públicos en `docker/compose.yaml`. No se agrega nada a los secretos del
  repositorio, y ningún workflow escribe una credencial en ningún lado.
- **Las gates de política son demostrablemente capaces de fallar.** Un job de `policy` que no puede
  rechazar un PR malo es peor que no tener job: la tarea 1.5 construye un branch name que falla y un
  label faltante, y muestra al job rechazando ambos.
- **La documentación vive con la política.** Una plantilla que nadie puede encontrar no es un
  proceso: la misma work unit que agrega las plantillas agrega el documento de colaborador que las
  explica, en el mismo commit.

## Delivery

- **Strategy:** `single-pr` — una work unit, una branch, un PR contra `main`, consistente con la
  respuesta del supervisor sobre la forma del PR #1.
- **Forecast:** ~450 líneas autoradas cambiadas (adiciones más deleciones) sobre ~8 archivos nuevos (2
  plantillas de issue + 1 config de plantillas + 1 plantilla de PR + 1 workflow + 1 documento de
  colaborador + este documento y su espejo). Etiquetado como **forecast**, no como medición: el cierre
  de `odd-doc-structure` midió su propio forecast en 4,3× el estimado, así que este número se trata
  como una hipótesis a verificar en la tarea 1.5, no como un compromiso.
- **Slice boundaries:** un slice. El set de artefactos es pequeño, sus partes son interdependientes (el
  workflow valida los labels de las plantillas; el documento de colaborador explica ambos), y
  partirlas produciría un PR cuyo CI chequea una política que el mismo PR todavía no documenta.
- **Running count:** ninguno todavía — la primera work unit de esta feature no está commiteada. Medido
  contra el árbol de trabajo en el punto de bifurcación `3032dbf` una vez que los artefactos existan,
  con la salida cruda en §1.5.

## Tareas

Cada tarea cierra con al menos un work-unit commit en la feature branch. Los headers de tarea llevan
la declaración de ruta que el contrato de delegación pide (`orchestrator-delegation.md:136`), en la
forma `· route: … · trigger: …` — la convención que el supervisor fijó el 2026-09-18 para los
documentos escritos desde este punto en adelante.

### 1.1 — Labels, plantillas de issue y la plantilla de PR · owner: IA · route: delegated · trigger: multi-file write rule

Crear el set de labels que la política necesita (`type:feature`, `type:bug`, `type:docs`,
`type:refactor`, `type:chore`, `type:breaking-change`, `status:approved`), las plantillas de issue
(`.github/ISSUE_TEMPLATE/` con un bug report, un feature request y un config), y
`.github/PULL_REQUEST_TEMPLATE.md` cuyas secciones son: resumen, tipo (mapeando cada checkbox a su
label `type:*`), tabla de cambios, test plan con los comandos reales de este repo, un checklist, y
una sección de **divergencias conocidas** — el hábito de disclosure que este repositorio ya practica.

**Aceptación:** los archivos existen; el set de labels existe en el remoto (`gh label list`); el
mapeo checkbox-a-label de la plantilla de PR coincide con los labels efectivamente creados; y las
plantillas no requieren un issue, coincidiendo con la decisión 1.

### 1.2 — El workflow de CI · owner: IA · route: delegated · trigger: multi-file write rule

`.github/workflows/ci.yml` con cuatro jobs, cada uno invocando un comando que el repositorio ya
documenta:

- `api` — levantar Postgres 18 y Redis con `docker compose up -d --wait postgres redis` (el camino
  propio del repo, que corre `init-test-db.sql` y por lo tanto crea `mediaforge_test`), correr
  `prisma generate`, `prisma migrate deploy` contra la base de test, y después
  `pnpm --filter api --fail-if-no-match run test`.
- `worker` — los mismos servicios, y después `uv run --project workers/media pytest workers/media/tests -q`.
- `lint` — `ruff check` y `yamllint`, usando las configuraciones ya presentes en el repositorio.
- `policy` — exactamente un label `type:*` presente, y el branch name de la head matcheando el regex
  del tipo.

**Aceptación:** el workflow es YAML válido; cada comando que contiene existe hoy en el repositorio;
ningún comando es inventado; las dos reglas del job `policy` son exactamente las de la decisión 1; y
el set de jobs es exactamente el de la decisión 3 (sin `shellcheck`, sin `eslint`).

### 1.3 — El documento de colaborador · owner: IA · route: inline · trigger: none (documentation for work already mapped)

Un `CONTRIBUTING.md` en la raíz del repositorio que cubra: cómo abrir un issue y qué piden las
plantillas; el regex de branch naming y la convención de commit messages, ambos ya en uso (los 40
subjects de commits existentes matchean la convención — medido); el vocabulario de labels; cómo
abrir un PR y qué hace cumplir el CI; cómo correr cada check localmente con los mismos comandos que
corre el CI; y una declaración explícita de lo que el CI **no** chequea y por qué (`shellcheck`
sobre cero scripts, `eslint` sin configurar).

**Aceptación:** cada comando citado en el documento se corrió y su salida se observó; el documento
nombra los cuatro jobs de CI y sus reglas exactamente como los implementa el workflow.

### 1.4 — Regularizar el PR #1 · owner: IA · route: inline · trigger: none (a remote mutation, not a file edit)

Según la decisión 2: abrir el issue describiendo lo que el PR #1 lleva, con `status:approved`; agregar
el label `type:*` al PR #1; reescribir su cuerpo con la nueva plantilla incluyendo `Closes #2`; y
confirmar que el job `policy` pasa sobre él.

**Aceptación:** `gh pr view 1` muestra el label, el cuerpo reescrito y el issue vinculado; el job
`policy` del PR #1 está verde; y el propio cuerpo del issue demuestra la forma de la plantilla.

### 1.5 — Verificación, y el forecast chequeado · owner: IA · route: delegated · trigger: verification rule

La doctrina de gates: **cada uno de los cuatro jobs de CI se muestra fallando sobre un contraejemplo
construido**, no meramente pasando. Como mínimo: el job `policy` rechaza un branch name malo y un
label faltante; el job `lint` rechaza un archivo con una violación real de `yamllint` y una violación
real de `ruff`; los jobs `api` y `worker` rechazan una aserción deliberadamente rota. Las ~450 líneas
del forecast se re-miden y se reporta si se sostuvo. Registrado verbatim, incluyendo cualquier falla.

**Aceptación:** la salida cruda de cada corrida real y de cada control negativo está en §1.5; el conteo
de líneas medido está declarado al lado del forecast; y cualquier check que no pudo hacerse fallar se
nombra como tal en vez de reportarse como un pase.

### 1.6 — Cierre · owner: IA · route: inline · trigger: none (bookkeeping)

Las gates registradas, los espejos regenerados y verificados, y la feature cerrada con su residuo y
sus decisiones abiertas listadas.

## Progress

El estado es `[x]` sólo donde el registro de evidencia tiene prueba observada de esa tarea.

| ID | Tarea | Estado | Evidencia |
| --- | --- | --- | --- |
| 1.1 | Labels, plantillas de issue, plantilla de PR | `[x]` | §1.1–1.3 |
| 1.2 | El workflow de CI | `[x]` | §1.1–1.3, §1.5 |
| 1.3 | El documento de colaborador | `[x]` | §1.1–1.3 |
| 1.4 | Regularizar el PR #1 | `[x]` | §1.4 |
| 1.5 | Verificación y el forecast | `[x]` | §1.5 |
| 1.6 | Cierre | `[x]` | §1.6, `## Closure` |

## Registro de evidencia

Salida cruda, agregada a medida que cierra cada tarea. Verbatim, sin parafrasear.

### 1.1–1.3 — los artefactos, el workflow y los docs (2026-09-18)

Creados en una work unit (`8ab9f5e`): los tres YAML de issue forms, la plantilla de PR, el workflow de
cuatro jobs y `CONTRIBUTING.md`. Cada comando que el workflow corre se chequeó contra el archivo que lo
define, y cada YAML se parseó con un parser real:

```text
$ python3 -c "import yaml,sys; [yaml.safe_load(open(f)) for f in sys.argv[1:]]; print('parsed')" \
    .github/ISSUE_TEMPLATE/*.yml .github/workflows/ci.yml
parsed

$ grep -E '^  (api|worker|lint|policy):' .github/workflows/ci.yml
  api:
  worker:
  lint:
  policy:

$ uvx --from ruff==0.16.8 ruff check workers/media
All checks passed!

$ uvx --from yamllint==1.38.0 yamllint -c .yamllint docker/compose.yaml .yamllint \
    pnpm-workspace.yaml openspec/config.yaml .github
  9:1       warning  truthy value should be one of [false, true]  (truthy)   # ci.yml `on:`
exit=0
```

**El job de lint destapó un defecto preexistente real, y se arregló en vez de tolerarse.**
`ruff` reportó un error sobre el árbol intacto, del ruleset que habilita por default:

```text
$ uvx --from ruff==0.16.8 ruff check workers/media --output-format=concise   # before the fix
workers/media/src/mediaforge/contracts.py:77:9: TRY004 Prefer `TypeError` exception for invalid type
Found 1 error.
```

`parse_dispatch_envelope` declara `raw: str | bytes` y levantaba `ValueError` cuando el argumento no
era ninguna de las dos — una **violación de precondición**, que la propia convención de Python (y
TRY004) pone bajo `TypeError`, no bajo un documento rechazado. El fix cambia esa única rama; todo
rechazo a nivel documento sigue levantando `ValueError`, que es lo que afirma la suite de paridad.
Medido en A/B, las dos suites, antes y después:

```text
$ uv run --project workers/media pytest workers/media/tests -q     # with the fix
13 failed, 20 passed in 5.36s
$ uv run --project workers/media pytest workers/media/tests -q     # reverted to baseline
13 failed, 20 passed in 4.04s
```

Idéntico, y las 13 fallas son todas fallas de conexión (`asyncpg` no llega a Postgres: Docker no está
disponible en esta distro de WSL), no aserciones. La suite de paridad sola, que es el blast radius
real del cambio, está verde en ambos: `19 passed`.

### 1.4 — PR #1 regularizado (2026-09-18)

Issue **#2** abierto retroactivamente con `type:chore` y `status:approved`, el PR #1 etiquetado
`type:feature`, y su cuerpo reescrito con la nueva plantilla. El número de issue es **#2, no #1**:
issues y pull requests comparten un solo espacio de números, y el PR #1 ya ocupa el `1`.

```text
$ gh issue view 2 --json number,title,labels --jq '{number,title,labels:[.labels[].name]}'
{"number":2,"title":"chore(repo): add the delivery policy — PR template, issue templates, and CI",
 "labels":["type:chore","status:approved"]}

$ gh pr view 1 --json labels,body --jq '{labels:[.labels[].name], closes:(.body|test("Closes #2"))}'
{"labels":["type:feature"],"closes":true}
```

Las dos reglas de `policy` pasan para el PR #1 a mano: el branch `feat/odd-doc-structure` matchea el
regex, y hay exactamente un label `type:*` presente.

**Un descubrimiento estructural que cambió el plan.** El workflow sólo corre cuando existe en la branch
**head** del pull request, así que el PR #1 — cuya head era `feat/odd-doc-structure` — nunca podría
haber tenido CI en absoluto. La branch se fast-forwardeó sobre esta work unit (`3032dbf..59363c2`) en
vez de dejarla sin gate, consistente con la decisión anterior del supervisor de que el PR #1 lleva
todo.

### 1.5 — verificación, y el forecast chequeado (2026-09-18)

**Mitad A — los cuatro jobs, sobre el PR real.** `gh pr checks 1`:

```text
api     pass    36s
lint    pass     7s
policy  pass     2s
worker  pass    37s
```

Esta es también la primera corrida real de las suites de `api` y `worker`, que no pudieron correr
localmente: la corrida reportó `Tests 1 failed | 42 passed (43)` y `1 failed, 33 passed` **con la
falla scratch de abajo inyectada**, así que las suites propias del repositorio pasan sobre un checkout
limpio en CI.

**Mitad B — el control negativo, sobre una branch descartable real.** La doctrina es que una gate que
no puede fallar no es una gate (defecto D1), así que se pusheó una branch con una aserción
deliberadamente fallada en cada runtime y sin label, y se abrió el PR #3 contra `main`. Los cuatro
jobs fallaron:

```text
$ gh pr checks 3
api     fail    33s
lint    fail     5s
policy  fail     5s
worker  fail    46s
```

Cada uno con una razón real, de los run logs:

| Job | Falla observada |
| --- | --- |
| `api` | `AssertionError: expected 1 to be 2` — `Tests 1 failed \| 42 passed (43)` |
| `worker` | `assert 1 == 2` — `1 failed, 33 passed in 0.62s` |
| `lint` | `PLR0133 Two constants compared in a comparison` — `Found 1 error` |
| `policy` | `rule 1 - exactly one type:* label required, found 0 (none)` **y** `rule 2 - branch "ci-negative-control" does not match /^(feat\|fix\|chore\|docs\|style\|refactor\|perf\|test\|build\|ci\|revert)\/[a-z0-9._-]+$/` |

La falla de `lint` no estaba predicha: la branch scratch agregó sólo archivos de test, y `ruff` atrapó
`PLR0133` en el archivo Python scratch. Es el job de lint encontrando una violación genuina en código
genuino, que es evidencia más fuerte que una sintética. El PR #3 se cerró entonces sin merge y la
branch se borró local y en el remoto.

**El forecast, chequeado.** El forecast de `## Delivery` de **~450** líneas autoradas. Medido:

```text
$ git diff --numstat 3032dbf..HEAD | awk '{a+=$1;d+=$2} END {printf "add+del=%d\n", a+d}'
add+del=678
```

**678** — unas **1,5×** el forecast, sobre 8 archivos en vez de los ~8 predichos (el conteo de archivos
se sostuvo; el tamaño por archivo no). Mejor que el 4,3× de `odd-doc-structure`, y la misma lección: un
forecast es una hipótesis, y lo honesto es imprimir la razón al lado.

**Lo que me sorprendió.**

1. **El job de lint se ganó su lugar en su primera corrida, encontrando un defecto real en código
   intacto.** `TRY004` era preexistente e invisible hasta que se apuntó un linter al árbol. La
   respuesta tentadora — agregar un ignore de regla, o dropear el job — lo habría enterrado.
2. **El workflow no existe para un PR cuya head lo antecede.** Eso no es una sutileza de este
   repositorio; es así como GitHub Actions resuelve los workflows, y produce silenciosamente un PR sin
   ningún check. Se encontró preguntando por qué el PR #1 no tenía CI, no leyendo documentación.
3. **Un control negativo puede encontrar más que la falla para la que fue diseñado.** La branch scratch
   se construyó para fallar `api` y `worker`; `lint` falló solo, sin planificarlo.
4. **Issues y PRs comparten un espacio de números.** El issue retroactivo es #2, no #1.

### 1.6 — cierre (2026-09-18)

La tarea 1.6 es el cierre: las gates están registradas en `## Cierre` de arriba, los espejos de este
documento se regeneran en paso, y la feature cierra con su residuo y sus decisiones abiertas listadas
ahí. El cierre está fechado el 2026-09-18 porque esa es la fecha en que se escribió — cada entrada
anterior de este documento lleva la misma fecha, y ninguna fecha aceptada se cambió.

```text
$ git log --oneline 3032dbf..HEAD
59363c2 fix(docs): correct two citations and the issue number in the policy docs
8ab9f5e feat(ci): delivery policy — templates, four CI gates, docs

$ git diff --numstat 3032dbf..HEAD | awk '{a+=$1;d+=$2} END {printf "add+del=%d\n", a+d}'
add+del=678
```

## Fuera de alcance

- **`eslint` y `prettier`.** Ninguno está instalado ni configurado. Agregar un linter que el equipo no
  eligió es una decisión aparte, no un efecto secundario de agregar CI.
- **`knip`.** Evaluado y deliberadamente no adoptado en `repo-hygiene.md` §1.6; esta feature no lo
  reabre.
- **`shellcheck`.** No existen scripts de shell para chequear. Si alguna vez se agrega uno, el job se
  agrega con él.
- **Una configuración de required-status-check en el remoto.** Volver *bloqueantes* los cuatro jobs es
  un setting del repositorio, y le corresponde al supervisor habilitarlo una vez que los jobs hayan
  corrido verde al menos una vez.
- **Reglas de branch protection, CODEOWNERS, dependabot y automatización de releases.** No pedidas y
  no necesarias para la política elegida.
- **Reescribir historia, o reescribir los commits del PR #1.** Sólo se regularizan su metadata y su
  cuerpo.

## Cierre (2026-09-18)

**Qué se entregó.** La política de entrega del repositorio, en una work unit (`8ab9f5e`) más una
corrección (`59363c2`): dos issue forms y su config, una plantilla de PR, un workflow de CI de cuatro
jobs, `CONTRIBUTING.md`, y un fix de fuente que destapó el job de lint (`contracts.py` ahora levanta
`TypeError` para una violación de precondición). Siete labels se crearon en el remoto.

**Las gates, como quedan**, las cuatro verdes sobre el PR #1 y las cuatro demostradas **fallando**
sobre una branch descartable real (PR #3):

```text
api     pass 36s      |  negative control: fail (AssertionError, 1 failed | 42 passed)
worker  pass 37s      |  negative control: fail (assert 1 == 2, 1 failed, 33 passed)
lint    pass  7s      |  negative control: fail (PLR0133, Found 1 error)
policy  pass  2s      |  negative control: fail (both rules: 0 type:* labels, bad branch name)
```

**La política, como se hace cumplir.** Exactamente un label `type:*`, y una head branch que matchea el
regex del tipo. El vínculo de issue es opcional — la decisión del supervisor, y el job `policy`
implementa exactamente esas dos reglas y ninguna tercera.

**El forecast, saldado.** ~450 predichos, **678** medidos (1,5×), sobre 8 archivos. Declarado al lado
del forecast en vez de reemplazarlo.

**Residuo.** Ninguno en los propios artefactos de esta feature. Tres omisiones deliberadas, cada una
declarada en `CONTRIBUTING.md` para que el hueco sea visible en vez de un descuido: sin `shellcheck`
(cero scripts de shell en el repositorio — el check pasaría sobre un conjunto vacío), sin `eslint` y
sin `prettier` (ninguno está instalado ni configurado; agregar un linter que el equipo no eligió es
una decisión aparte). `knip` sigue sin evaluar por diseño, como registró el §1.6 de `repo-hygiene.md`.

**Lo que esta feature no hace.** No vuelve *requeridos* los cuatro jobs: eso es un setting del
repositorio, y le corresponde al supervisor habilitarlo ahora que los jobs corrieron verde al menos
una vez. No agrega branch protection, ni CODEOWNERS, ni dependabot, ni automatización de releases. No
se retrofitea la política sobre los commits que ya aterrizaron — la anteceden, y reescribirlos sería
desinformación.

**Qué cambió la medición en el camino.** El job de lint encontró un defecto preexistente real en
código intacto (`TRY004`) y se arregló en vez de ignorarse; la no-existencia del workflow para la head
original del PR #1 forzó un fast-forward, porque un PR cuya head antecede al workflow silenciosamente
no tiene ningún check; y el control negativo encontró una falla para la que no fue diseñado (`lint`
fallando sobre un archivo Python scratch).

**Conformidad con el RDD.** Ninguna review nativa corrió para los candidatos de esta feature: es
configuración, YAML, Markdown y un fix de fuente de cuatro líneas, y la decisión permanente del
supervisor para trabajo con forma de documentación aplica. Lo que carga con el check en su lugar es la
batería de verificación de arriba — cada job demostrado capaz de fallar sobre una branch real, no
sobre una afirmación.

**Siguiente.** La tarea 1.6 cierra esta feature. La próxima work unit es el plan de fixes sin aplicar
del verificador de `wu3-contract` (F1, F2, F3); el supervisor es dueño por separado de habilitar el
setting de required-status-check y de cerrar el PR #1.

## Next step

Correr la tarea 1.6 — el cierre —, y con eso esta feature queda hecha y el único hilo abierto es el
plan de fixes sin aplicar del verificador de `wu3-contract` (F1, F2, F3), cuya tarea 1.4 es el único
`[ ]` que queda entre los 8 documentos de la feature anterior.