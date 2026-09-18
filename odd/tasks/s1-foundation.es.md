# Feature — `s1-foundation` (reconstrucción de la fase de apply S1 del SDD)

> **Copia de lectura en español.** El documento canónico es `s1-foundation.md` (inglés); si
> divergen, manda el inglés. **Los bloques de código son idénticos a los del inglés, byte a byte**
> (se comparan con un diff): son salida cruda de comandos, y traducirla sería falsificarla. Lo que
> está traducido es la prosa.

**Workflow:** Organic Driven Development (ODD).
**Fuente de verdad de los requisitos:** `openspec/changes/audio-extract-vertical-slice/` (intacto).
**Estado:** `closed` — las cuatro tareas 1.1–1.4 llevan evidencia registrada; la lista de
residuos de más abajo se re-midió y se cerró en la feature que le sigue, `repo-hygiene` (commit
`6fe5314`, 2026-09-17); y el tip de esta feature, `9eb288b`, es ancestro de `origin/main`. Ver
*Defectos* (D1–D4) y el *Registro de revisión del supervisor*.

---

## Por qué existe esta feature

La fase de apply del SDD arrancó la unidad de trabajo **S1 foundation** (WU-1 scaffold, spike de
redis-py WU-5, precheck de namespaces del sandbox WU-13) y escribió ≈930 líneas repartidas entre
`apps/`, `workers/`, `docker/`, `contracts/` y los manifiestos de la raíz. El usuario no entendía
el resultado, no podía modificarlo, y no podía explicar qué hacía cada archivo.

Decisión tomada con el usuario el 2026-09-16:

1. **Borrar todo artefacto de esa primera fase de apply** (sin rescate de la evidencia de spikes).
2. **Reconstruirlo bajo ODD**, con cada cambio explicado lo suficiente para que el usuario lo lea,
   lo cuestione y lo defienda.

El objetivo tampoco es la velocidad: es que no aterrice en el repositorio ningún archivo que el
supervisor no pueda leer e interrogar.

## Acuerdo de trabajo (revisado el 2026-09-16)

| Rol | Quién | Responsabilidad |
| --- | --- | --- |
| Escritor | IA | Escribe cada archivo, corre cada comando, registra la salida cruda |
| Supervisor | usuario | Lee y revisa cada cambio; plantea lo que no cierra; la IA lo resuelve |
| Delegación | a criterio de la IA | Aplica la escalera de ruteo: trabajo mecánico multi-archivo puede ir a un escritor acotado. Las escrituras se mantienen en un solo hilo |

Historia de la revisión: el primer acuerdo (el usuario escribía, la IA dirigía) duró una tarea y
fue reemplazado por la instrucción del supervisor: *"vos vas a hacer este proyecto como siempre, yo
el supervisor que cada cambio voy revisando y leyendo, si algo no me cuadra te lo digo y resolves"*.

Regla del check: una tarea se marca `[x]` solo cuando su comando de aceptación corrió y su salida
fue vista. "Sin evidencia no hay check." La revisión del supervisor es un segundo gate; una
objeción planteada reabre la tarea en vez de tildarla.

## Registro de revisión del supervisor

Observaciones planteadas por el supervisor al leer el trabajo, y qué pasó con cada una.

### O1 — "veo una nueva dirección en contracts, ¿eso lo generaste por ODD o porque se creó?" (2026-09-16)

Respondido: el directorio no es invención de ODD. Viene de `design.md` §2.2 (layout de módulos:
`dispatch-envelope.schema.json`, `job-types.json`, `fixtures/`) y de la tarea 1.2 del plan. Existía
en el scaffold borrado como un README de 11 líneas y se recreó acá; solo el texto del README es
nuevo. Los archivos de contrato en sí son de WU-3. Oferta vigente: si suena a ruido, se borra el
directorio hasta WU-3.

### O2 — "usaste `pg` para conectar con Postgres; Prisma genera su propio cliente, así que no crees
dos clientes" (2026-09-16) — **aceptada, y vinculante para WU-2**

El instinto es correcto en la estructura y en el riesgo: este slice no debe hacer crecer dos
caminos de acceso a datos independientes, y hay dos variables (`DATABASE_URL` para la aplicación,
`DATABASE_URL_TEST` para el harness) que apuntan a bases distintas a propósito — que es exactamente
donde vive el bug de "escribí en la base equivocada".

Disposición, con el matiz honesto:

- `pg` está en `devDependencies`, no en `dependencies`, y `test/harness.spec.ts` es el único archivo
  que lo importa. No hay un segundo pool de conexiones en runtime.
- Está ahí porque el harness de WU-1 tiene que correr **antes** de que Prisma exista: WU-2 es dueño
  de `schema.prisma`, de `prisma generate` y de la primera migración. Pasar esta aserción a Prisma
  hoy significaría hacer WU-2 primero, sobre un schema vacío.
- **Constraint vinculante:** cuando aterrice WU-2, `test/harness.spec.ts` mueve sus aserciones de
  base al cliente Prisma y `pg` + `@types/pg` salen de `package.json`. Eso deja el harness **más
  fuerte** que hoy: afirmaría `current_database() = 'mediaforge_test'` a través del cliente que la
  aplicación realmente usa, en vez de a través de un sustituto. WU-2 no termina cuando entra
  Prisma; termina cuando este cambio también está hecho.

## Registro del borrado (2026-09-16)

Borrado: `apps/`, `workers/`, `docker/`, `contracts/`, `node_modules/`, `package.json`,
`pnpm-workspace.yaml`, `pnpm-lock.yaml`, `Makefile`, `.env`, `.env.example`, `.gitignore`,
`.dockerignore`. Conservado: `openspec/`, `.git/`, `.pi/`, `.atl/`.

Estado de runtime borrado: contenedores `mediaforge-{api,postgres,redis,worker}`, volúmenes
`docker_mediaforge-{pgdata,redisdata,storage}`, red `docker_mediaforge-internal`, imágenes
`docker-api:latest` y `docker-worker:latest`.

Red de seguridad (el repositorio tenía **cero commits**, así que el borrado era irreversible):
`C:/Users/andre/Documents/Trabajo/_backups/mediaforge-s1-baseline-20260916-202423.tar.gz`
(186 KB, 89 entradas, excluye `node_modules`, `.venv`, `__pycache__`, `.pytest_cache`, `.git`).
Restaurar: `tar -xzf <archivo> -C <destino>`.

Residuo: el directorio vacío `apps/api` no se pudo borrar — un proceso de Windows mantiene un handle
sobre él. No contiene archivos. La tarea 1.2 lo reutilizó tal cual.

## Variables de entorno

No hay `.env.example`. El supervisor lo dropeó después de que la política de rutas rechazara ese
nombre de archivo, y los valores por defecto lo vuelven innecesario: cada variable tiene uno, y
coinciden con lo que asumen los tests de harness del host. `.env` sigue gitignoreado, así que las
credenciales nunca entran al repositorio.

| Variable | Default | La consume | Significado |
| --- | --- | --- | --- |
| `POSTGRES_USER` | `postgres` | compose | usuario de la base |
| `POSTGRES_PASSWORD` | `postgres` | compose | password de la base |
| `POSTGRES_DB` | `mediaforge` | compose | nombre de la base de desarrollo |
| `POSTGRES_PORT` | `5432` | compose | puerto del **host** para PostgreSQL |
| `REDIS_PORT` | `6379` | compose | puerto del **host** para Redis |
| `API_PORT` | `3000` | compose | puerto del **host** para la API; el contenedor siempre escucha en 3000 |

Compuestas dentro de los bloques de entorno de cada servicio, no puestas a mano:

| Variable | Valor dentro de los contenedores |
| --- | --- |
| `DATABASE_URL` | `postgresql://<usuario>:<password>@postgres:5432/mediaforge` |
| `DATABASE_URL_TEST` | mismo host, base `mediaforge_test` |
| `REDIS_URL` | `redis://redis:6379/0` — el broker que usa el pipeline |
| `REDIS_URL_TEST` | `redis://redis:6379/1` — el número de base de test |

Los tests de harness del host **no** necesitan ninguna variable: `test/harness.spec.ts` y
`test_harness.py` caen por defecto en `localhost:5432` / `localhost:6379`, los mismos nombres de
base, y Redis base 1. Si cambiás `POSTGRES_PORT` o `REDIS_PORT`, tenés que exportar además las dos
URLs `_TEST` en tu shell, o los tests siguen mirando los puertos viejos.

## Historial de git

Cinco commits en `main`, cada uno una unidad revisable en vez de una importación en bloque. Los
primeros cuatro se crearon el 2026-09-16; el quinto (`9eb288b`) es el commit que escribió esta
sección:

| Commit | Asunto | Tamaño |
| --- | --- | --- |
| `b05afcd` | `chore(sdd): import the approved SDD artifacts for audio-extract-vertical-slice` | 24 archivos, 5798 inserciones |
| `892f706` | `docs(odd): track the S1 foundation rebuild as an ODD feature` | 2 archivos, 1176 inserciones |
| `9d05ebd` | `feat(scaffold): pnpm workspace, NestJS api, uv worker project and dependency harness` | 20 archivos, 4363 inserciones |
| `ab47532` | `feat(docker): local stack with PostgreSQL 18, Redis 7 and both service images` | 6 archivos, 331 inserciones |
| `9eb288b` | `docs(odd): record the git history and the line-ending finding` | 2 archivos, 56 inserciones |

La quinta fila es de lo que trataba el hallazgo F2 en `repo-hygiene.md`: esta sección solía
decir *"Four commits on `main`"* y omitía el commit que la escribió.

El remoto `origin` es `https://github.com/4dr3s/mediaforge.git`, verificado público y **vacío**
antes del primer commit (`git ls-remote` no devolvió refs), así que no hizo falta merge.
**Pusheado el 2026-09-17:** `main` fue a `origin` llevando los cinco commits, hasta `9eb288b`.
Los seis commits de la feature `repo-hygiene` — `746be7f` feature tracking · `914b65d` SDD plan
reconciliation · `758df00` Makefile entrypoints · `b8f1c7d` pnpm build scripts · `42a189b` lint
re-measurement y D1 control · `23585e5` LF line endings — son locales, no pusheados.

## Inconsistencias conocidas que quedan (cerradas)

Cada item de abajo se re-midió el 2026-09-17 dentro de la feature que le sigue,
[`repo-hygiene`](repo-hygiene.md), y ahora termina en exactamente uno de tres estados:
**resolved** (resuelto), **inert** (inerte, con la razón), o **binding on a future feature**
(vinculante a una feature futura, cuál, dicha abajo). Ningún item queda ambiguo.

- **La acreditación del `tasks.md` del SDD** — **resolved** por el commit `914b65d`. Los 7
  checkboxes viejos (1.1–1.4, 5.1, 5.2, 13.2) volvieron a `[ ]` (0/74), con una nota que dice que
  su evidencia se borró con el output de apply de S1 y que el trabajo se reconstruyó bajo ODD en
  esta feature.
- **El `tasks.md` §"Runners and canonical commands" prescribe el comando de D1** — **resolved**
  por el mismo commit `914b65d`: el reemplazo verificado quedó escrito de vuelta en el plan SDD, y
  las dos líneas de runners llevan `--fail-if-no-match`. La afirmación de que el reemplazo "has
  not been written back into the SDD plan" ya no es verdad.
- **El registro de runtime del SDD** — **inert**. `gentle-ai sdd-attempt --help` reporta *"Runtime
  attempt operations are retired"*: ninguna operación soportada puede cerrar o abortar el
  `attempt/begin`, así que "cerrar el attempt" nunca fue un fix disponible, y borrar el registro a
  mano sería manipular un audit store. `next: apply` viene de las 67 tareas destildadas del plan,
  no del registro, y es la respuesta correcta para un plan cuya ejecución se mudó a ODD.
- **Fin de línea (encontrado al commitear, 2026-09-16)** — **resolved** por el commit `23585e5`.
  La nota original afirmaba un mecanismo no medido: el contenido se guarda con LF *"y la copia de
  trabajo recibe CRLF"*. Medido el 2026-09-17, la copia de trabajo ya era LF — 54 de 54 archivos
  trackeados, sin un byte CR en ningún lado (`git ls-files --eol` reporta `i/lf w/lf` para cada
  archivo). La conversión era un riesgo **latente** que se habría materializado en el próximo
  clone o checkout; el modo de falla que preocupaba a la nota (un script de shell o entrypoint
  copiado dentro de un contenedor Linux) es real, y el `.gitattributes` (`* text=auto eol=lf`)
  elimina el riesgo.
- **Historial y remoto de git** — **resolved** (hallazgo F2 en `repo-hygiene.md`): las dos
  afirmaciones falsas quedaron corregidas en la sección *Historial de git* de más arriba.
- **Sin baseline contra el cual diffear la reconstrucción** — **resolved** por resolución. El
  árbol reconstruido está ahora commiteado **y pusheado** (2026-09-17), así que el tarball de
  seguridad dejó de ser la única copia del output de S1 borrado.
- **`make` no está instalado en esta máquina** — **resolved** por decisión más el commit
  `758df00`. Los dos entrypoints quedan: el `Makefile` sigue siendo el entrypoint de Linux/CI y
  los scripts del `package.json` de la raíz (`pnpm test:api`, `pnpm test:worker`) siguen siendo el
  camino portable; la regla quedó documentada en el comentario del encabezado del `Makefile`.
- **`pnpm install` ignora dos build scripts** (`@nestjs/core`, `esbuild`) — **resolved** por el
  commit `b8f1c7d`: el conjunto permitido quedó fijado (`pnpm.onlyBuiltDependencies`) y `pnpm
  install` ya no reporta el aviso de scripts ignorados.
- **pi-lens / knip** — **resolved con veredictos** (hallazgos F4/F5 en `repo-hygiene.md`), sin
  accionar. La afirmación de `knip` sobre `apps/api` no se reproduce sobre el árbol actual
  (`pnpm dlx knip --workspace api` sale con `0` sin salida). El advisory `large-class` se
  reproduce pero es un defecto de la regla — la regla publicada no lleva condición de cantidad de
  métodos mientras su mensaje afirma "more than 20 methods" — no de `health.controller.ts`. La
  corrida full-workspace de knip expuso un hallazgo vivo que la lista nunca tuvo: `uv` como
  binario no listado para `test:worker` (una herramienta a nivel de máquina que el script de la
  raíz invoca). Está registrado y diferido: solo se vuelve vinculante si knip se adopta como
  dependencia del proyecto (`repo-hygiene.md`, *Fuera de alcance*).
- **O2 (aserciones de base del harness)** — **binding on WU-2**, no de esta feature. Cuando
  aterrice WU-2, `test/harness.spec.ts` mueve sus aserciones de base al cliente Prisma, y `pg` +
  `@types/pg` salen de `package.json` en esa misma tarea; ver el registro de revisión del
  supervisor.
- **`.env.example`** — **resolved**; la resolución está registrada en la sección *Variables de
  entorno* de más arriba. Dropeado por decisión del supervisor el 2026-09-16 (la política de rutas
  rechazó el nombre de archivo; cada variable tiene un default, documentado acá y en
  `docker/compose.yaml`).

## Restricciones (no negociables)

- **Strict TDD.** Modo `strict`; fuente `openspec/config.yaml:58` (`strict_tdd: true`); runner las dos
  gates: `pnpm --filter api --fail-if-no-match run test` (api) y
  `uv run --project workers/media pytest workers/media/tests -q` (worker).

## Delivery

Registrado el 2026-09-17, medido retrospectivamente desde los commits, no estimado a la creación —
esta feature es anterior al campo.

- **Strategy:** `single-pr`, retrospectivo. La etiqueta es el vocabulario más cercano, pero la verdad
  medida es que nunca existió una branch ni un pull request: los cuatro commits de este slice fueron
  directo a `main` y se pushearon hasta `9eb288b`, que es ancestro de `origin/main`. Verificado: no
  existe ninguna branch `s1-foundation` (local ni remota) y `9eb288b` es ancestro de `origin/main`.
- **Forecast:** +1934 líneas autoradas cambiadas (adiciones más deleciones), medidas
  retrospectivamente con `git log b05afcd..9eb288b --numstat`, excluyendo `pnpm-lock.yaml`, rutas
  `generated` y archivos `.lock`; desglose +666 código/tests, +644 documentos en inglés, +624 espejo
  en español. Salida cruda y descomposición por archivo en `odd-doc-structure.md` §1.4.
- **Slice boundaries:** ninguna, porque no se usaron. El trabajo es lineal sobre `main`: los cuatro
  commits del slice — `9eb288b` (historial de git y registro de fin de línea) · `ab47532` (stack
  local con docker) · `9d05ebd` (scaffold del workspace) · `892f706` (feature tracking) — fueron
  directo a `main` y se pushearon; no existe ninguna branch `s1-foundation` (local ni remota) y
  `9eb288b` es ancestro de `origin/main`.

---

## Tareas

Fuente: `openspec/changes/audio-extract-vertical-slice/tasks.md` → WU-1 (criterios de aceptación
idénticos, para que el plan SDD y la feature ODD sigan siendo reconciliables).
`openspec/config.yaml` declara `strict_tdd: true`, así que RED precede a GREEN en cada tarea.

### 1.1 — RED: escribir los dos tests de harness y verlos fallar · owner: IA

Escribir:

- `apps/api/test/harness.spec.ts` (Vitest): afirma una conexión viva a la base `mediaforge_test`, y
  que `SELECT uuidv7()` devuelve un UUID versión 7.
- `workers/media/tests/test_harness.py` (pytest): afirma que `asyncpg` conecta a la misma base y
  que Redis responde.

**Aceptación:** los dos archivos existen, y el fallo exacto observado al correrlos queda registrado
verbatim en el log de evidencia. El RED esperado acá es "todavía no existe el runner" — sin
proyecto, sin entorno.

**Resultado:** RED-2 se comportó como fue diseñado. RED-1 expuso el defecto **D1** — el comando
planeado de la API sale con `0` sin correr nada — y por eso la tarea 1.4 ahora lleva un control
negativo.

### 1.2 — Scaffold del workspace · owner: IA

Escribir:

- `package.json`, `pnpm-workspace.yaml` (workspace de pnpm)
- esqueleto NestJS en `apps/api`, `apps/web` como placeholder únicamente (no hay UI en este slice)
- `workers/media` con `uv` + `pyproject.toml`
- `contracts/`
- config de Vitest, config de pytest-asyncio, targets del `Makefile`

**Aceptación:** `pnpm install` resuelve el workspace; la app NestJS compila; `uv sync` (o
equivalente) crea el entorno del worker. Referencia: `design.md` §2 (topología y layout de
módulos); `openspec/project.md` (stack).

**Trampa a evitar:** el `Makefile` borrado tenía un target `test-sandbox` apuntando a
`workers/media/tests/test_sandbox_precheck.py`, un archivo que nunca existió. No recrear targets
muertos.

**Resultado:** cumplida. Salida cruda en el log de evidencia. Tres desvíos deliberados del plan,
cada uno registrado en vez de colado:

1. **`.gitignore` adelantado de 1.3 a 1.2.** `pnpm install` y `uv sync` crean `node_modules/` y
   `.venv/` enseguida; una tarea de exposición a un `git add -A` distraído no valía la limpieza del
   reparto.
2. **`apps/web` sin dependencias.** Next.js + React + React DOM son ~300 MB de árbol para un paquete
   sin código en este slice. El slot lo sostienen `package.json` + `README.md`.
3. **Los paquetes del workspace se llaman `api` y `web`, sin scope.** Los comandos canónicos del
   plan dicen `--filter api`; un nombre con scope (`@mediaforge/api`) habría vuelto ambiguo cada uno
   de ellos. El scaffold anterior tenía el nombre con scope *y* el filtro sin scope — un desajuste
   esperando que le echaran la culpa a otra cosa.

También se fijó `requires-python = ">=3.11,<3.12"` en vez de `">=3.11"`: el rango ancho deja que uv
resuelva 3.13 en una máquina que lo tenga, y el worker dejaría de ser Python 3.11 sin que nadie se
entere.

### 1.3 — Contenedores, volúmenes y entorno · owner: IA

Escribir:

- `docker/compose.yaml`: Postgres 18, Redis 7, volúmenes nombrados incluyendo `mediaforge-storage`,
  base `mediaforge` más la base de test `mediaforge_test`
- `docker/api.Dockerfile`, `docker/worker.Dockerfile`
- `.env.example` (credenciales desde el entorno; `.env` gitignoreado), `.gitignore`

**Aceptación:** `docker compose -f docker/compose.yaml up -d --wait` reporta cada servicio sano.
Referencia: `design.md` §2.1.

**Nota:** `.gitignore` es el primer archivo que conviene escribir, porque sin él `git status` lista
el estado del harness (`.atl/`, `.pi/`) y cada futuro `node_modules` como untracked.

**Resultado:** cumplida. `up -d --wait` sale con `0` con los cuatro servicios sanos (evidencia
abajo). Los archivos de imagen se recuperaron del tarball de seguridad y se revisaron línea por
línea en vez de reinventarlos, porque ese build se sabía funcionando. Ocho cambios, todos
deliberados:

1. **`.dockerignore` ancla cada patrón con `**/`.** Un `node_modules/` pelado matchea solo el primer
   nivel, así que el `apps/api/node_modules` anidado del host se copió encima del install de la
   propia imagen — shims de Windows y symlinks absolutos incluidos — y el build del api murió
   (defecto D2). Las cachés de build del host se filtraban igual (defecto D3).
2. **`--fail-if-no-match` en el comando de build de la imagen**, mismo razonamiento que D1: sin el
   flag, un filtro que no matchea nada produce una imagen sin `dist/` y reporta éxito.
3. **La imagen del api ya no corre como root** (`USER 1000:1000`, numérico por hadolint DL3066 para
   que el número que dos contenedores tienen que compartir quede a la vista). Anotado en el archivo:
   la primera vez que la API escriba en el volumen compartido (WU-16/WU-17), su dueño pasa a ser una
   decisión real.
4. **El puerto del contenedor está fijo en 3000**, y solo el puerto del host sigue `API_PORT`. En el
   archivo recuperado seguían los dos, así que `API_PORT=8080` publicaba un mapping a un puerto
   donde nadie escuchaba.
5. **El healthcheck del api apunta a `127.0.0.1`**, no a `localhost`: la app bindea solo IPv4, y
   adentro del contenedor `localhost` también resuelve a `::1`. Medido en el host: las dos formas
   dan `200`, así que esto reduce riesgo, no arregla un defecto.
6. **El worker corre `sleep infinity` como placeholder documentado**, con el `CMD` de WU-9 que va a
   reemplazarlo escrito al lado. Un `CMD` nombrando un módulo inexistente quedaría en crash-loop.
7. **Postgres ya no monta `mediaforge-storage`.** La base no tiene nada que hacer escribiendo en el
   volumen de artefactos; el diseño comparte ese volumen entre la API y el worker.
8. **La red pierde `internal: true`.** Medido, no asumido — ver el experimento A/B/A en la evidencia
   de 1.4 y el defecto D4.

**`.env.example`: dropeado por decisión del supervisor** (2026-09-16). La política de rutas rechaza
ese nombre de archivo, y la opción elegida fue dropear el archivo en vez de escribirlo por afuera
del camino normal. Las variables quedan documentadas donde el lector las necesita: el encabezado de
`docker/compose.yaml` y la sección *Variables de entorno* más arriba. Costo aceptado: no hay
template para copiar y pegar, que los valores por defecto del compose vuelven innecesario igual.

### 1.4 — GREEN: registrar la evidencia · owner: IA

Correr y registrar la salida exacta de estos tres comandos:

```bash
docker compose -f docker/compose.yaml up -d --wait
pnpm --filter api exec vitest run test/harness.spec.ts
uv run --project workers/media pytest workers/media/tests/test_harness.py
```

**Aceptación:** compose sano y los dos tests de harness pasando contra un PostgreSQL 18 **real** y
un Redis **real**. Nunca SQLite: produce falsos negativos en `uuidv7()`, `FOR UPDATE`, índices
parciales y semántica de CAS. Nunca el `python` del PATH — `project.md` lo registra como un
virtualenv ajeno.

**Control negativo (exigido por D1):** el comando del harness de la API debe salir **non-zero**
cuando falta el workspace o falta la base de test. Probarlo dos veces: una antes de que `apps/api`
tenga scaffold, y otra con los contenedores bajados. Un gate que devuelve `0` sin correr nada no es
un gate.

**La feature termina cuando:** los tres comandos de arriba pasan, su salida queda registrada acá, y
el control negativo sale non-zero.

**Resultado:** cumplida. Las dos suites del host pasan contra el stack corriendo (`2 passed` /
`2 passed`), y el control negativo se sostiene en las dos direcciones (`--filter no-such-project`
sale `1`; el filtro real sin base sale `1`). Salida cruda en el log de evidencia.

**Rollback:** borrar `apps/`, `workers/`, `contracts/`, `docker/` y los manifiestos de la raíz.

## Progress

El estado es `[x]` sólo donde el registro de evidencia tiene prueba observada de esa tarea.

| ID | Tarea | Estado | Evidencia |
| --- | --- | --- | --- |
| 1.1 | RED: escribir los dos tests de harness y verlos fallar | `[x]` | §1.1 |
| 1.2 | Scaffold del workspace | `[x]` | §1.2 |
| 1.3 | Contenedores, volúmenes y entorno | `[x]` | §1.3 |
| 1.4 | GREEN: registrar la evidencia | `[x]` | §1.4 |

---

## Log de evidencia

Salida cruda, agregada a medida que cierra cada tarea. Verbatim, sin parafrasear.

### 1.1 — RED (2026-09-16)

Toolchain presente: `pnpm 10.33.0` (`AppData/Roaming/npm/pnpm`) y `uv 0.11.19`
(`AppData/Local/hermes/bin/uv`). Los dos ya estaban instalados, de la sesión S1 borrada.

**RED-1 — API (Vitest).** Comando y salida, exactamente como salieron:

```text
$ pnpm --filter api exec vitest run test/harness.spec.ts
No projects found in "C:\Users\andre\Documents\Trabajo\mediaforge"
[exit=0]
```

Observado: no corrió nada, y el estado de salida es `0`. Queda registrado como defecto **D1**, no
como RED válido. La aserción nunca tuvo la chance de estar equivocada, así que esta corrida no
prueba nada sobre el test en sí.

**RED-2 — worker (pytest).** Comando y salida, exactamente como salieron:

```text
$ uv run --project workers/media pytest workers/media/tests/test_harness.py -q
error: Failed to spawn: `pytest`
  Caused by: program not found
[exit=2]
```

Observado: RED válido, y ruidoso. No hay `workers/media/pyproject.toml` ni `pytest` en ningún
entorno, así que falta el runner mismo — que es exactamente la precondición que 1.1 existe para
exponer.

### 1.2 — Scaffold del workspace (2026-09-16)

**Instalación (los dos runtimes).**

```text
$ pnpm install
Scope: all 3 workspace projects
Packages: +395
WARN  1 deprecated subdependencies found: glob@10.4.5
╭ Warning ─────────────────────────────────────────────────────────────────╮
│   Ignored build scripts: @nestjs/core@10.4.22, esbuild@0.21.5.           │
│   Run "pnpm approve-builds" to pick which dependencies should be allowed │
╰──────────────────────────────────────────────────────────────────────────╯
Done in 12.1s using pnpm v10.33.0
[exit=0]
```

Los tres proyectos del workspace son la raíz, `api` y `web` — así que los nombres sin scope los
resuelve pnpm como se esperaba. pnpm 10 bloquea por defecto los postinstall de las dependencias;
tanto `nest build` como `vitest` funcionan en esta máquina sin aprobarlos, así que queda registrado
como item abierto (fijar el conjunto permitido antes de que exista CI) en vez de accionado acá.

```text
$ uv sync --project workers/media --extra dev
Using CPython 3.11.9 interpreter at: AppData/Local/Microsoft/WindowsApps/.../python.exe
Creating virtual environment at: workers\media\.venv
Resolved 12 packages in 510ms
 + asyncpg==0.31.0
 + mediaforge-media-worker==0.1.0 (from file:///.../workers/media)
 + pytest==9.1.1
 + pytest-asyncio==1.4.0
 + redis==8.1.0
[exit=0]
```

El pin `>=3.11,<3.12` se sostuvo: uv tomó el intérprete 3.11 en vez de los más nuevos disponibles en
esta máquina. `redis==8.1.0` coincide con la versión que midió el spike borrado (`RESULTS.md`), así
que los hallazgos sobre consumer groups siguen válidos para el código que viene.

**Build.**

```text
$ pnpm --filter api run build
> api@0.1.0 build C:\Users\andre\Documents\Trabajo\mediaforge\apps\api
> nest build

[exit=0]
```

`apps/api/dist/` emitió `main`, `app.module` y `health.controller` (`.js` + `.d.ts` + maps).

**Controles negativos de D1 — los candidatos a fix, probados en vez de asumidos.**

```text
$ pnpm --filter no-such-project exec vitest run test/harness.spec.ts
No projects matched the filters in "C:\Users\andre\Documents\Trabajo\mediaforge"
[exit=0]

$ pnpm --filter no-such-project run test:harness
No projects matched the filters in "C:\Users\andre\Documents\Trabajo\mediaforge"
[exit=0]

$ pnpm --filter no-such-project --fail-if-no-match run test:harness
No projects matched the filters in "C:\Users\andre\Documents\Trabajo\mediaforge"
[exit=1]
```

**Del lado del worker, la misma disciplina:**

```text
$ uv run --project no-such-dir pytest -q
warning: Project directory `no-such-dir` does not exist. This will become an error in a future
release. Use `--preview-features project-directory-must-exist` to error on this now.
error: Failed to spawn: `pytest`
  Caused by: program not found
[exit=2]
```

Falla cerrado, por dos razones independientes, una de las cuales uv ya declaró deprecada. No
necesita flag, pero el comando es robusto a un directorio de proyecto borrado solo por accidente.

**RED intermedio — el runner existe, los servicios no.** Este es el estado entre 1.2 y 1.4, y es el
RED honesto para estas aserciones:

```text
$ pnpm test:api
     Tests  2 failed (2)
ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  api@0.1.0 test:harness: `vitest run test/harness.spec.ts`
Exit status 1
[exit=1]

$ pnpm test:worker
FAILED workers\media\tests\test_harness.py::test_asyncpg_connects_to_the_dedicated_test_database
FAILED workers\media\tests\test_harness.py::test_redis_is_reachable_on_the_test_database_number
2 failed in 8.80s
[exit=1]
```

**Corrección hecha durante esta tarea.** La primera versión de `harness.spec.ts` compartía un
`Client` en un `beforeAll`. Sin base, eso producía `Test Files 1 failed (1)` y `Tests 2 skipped
(2)`: el fallo se le atribuía al archivo, y las dos aserciones quedaban reportadas como salteadas —
indistinguible de "nunca corrieron", que es justo la clase de ambigüedad de la que trata D1. El
archivo ahora abre una conexión por test, espejando `test_harness.py`, y el lado de Python ya
reportaba `2 failed` exactamente por eso.

**Chequeo de higiene de `git status`:** las entradas untracked son `.gitignore`, `Makefile`, `apps/`,
`contracts/`, `odd/`, `openspec/`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`,
`workers/`. No aparecen ni `node_modules/`, ni `.venv/`, ni `dist/`, ni `.atl/`, ni `.pi/`.

### 1.3 — Contenedores, volúmenes y entorno (2026-09-16)

```text
$ docker compose -f docker/compose.yaml up -d --wait
 Container mediaforge-postgres Healthy
 Container mediaforge-redis Healthy
 Container mediaforge-worker Healthy
 Container mediaforge-api Healthy
[exit=0]

$ docker compose -f docker/compose.yaml ps
NAME                  STATUS                   PORTS
mediaforge-api        Up 5 seconds (healthy)   0.0.0.0:3000->3000/tcp, [::]:3000->3000/tcp
mediaforge-postgres   Up 3 minutes (healthy)   0.0.0.0:5432->5432/tcp, [::]:5432->5432/tcp
mediaforge-redis      Up 3 minutes (healthy)   0.0.0.0:6379->6379/tcp, [::]:6379->6379/tcp
mediaforge-worker     Up 2 minutes
```

**Los dos fallos de build en el camino**, los dos de la familia "el build mintió" (defectos D2 y D3,
descritos más abajo):

```text
# D2 -- api image build, after `COPY apps/api ./apps/api` overwrote the image's own install
Error: Cannot find module '/app/apps/api/node_modules/@nestjs/cli/bin/nest.js'
  code: 'MODULE_NOT_FOUND'
ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  api@0.1.0 build: `nest build`

# D3 -- api container, from an image whose `nest build` had reported success
Error: Cannot find module './app.module'
    at Object.<anonymous> (/app/apps/api/dist/main.js:4:22)
```

Y lo que contiene la imagen ya arreglada, mirando adentro en vez de inferirlo del log verde:

```text
$ docker run --rm --entrypoint sh mediaforge-api -c 'ls /app/apps/api/dist'
app.module.d.ts  app.module.js  app.module.js.map
health.controller.d.ts  health.controller.js  health.controller.js.map
main.d.ts  main.js  main.js.map  tsconfig.tsbuildinfo
```

### 1.4 — GREEN, y el control negativo de D1 (2026-09-16)

```text
$ pnpm test:api
 Test Files  1 passed (1)
      Tests  2 passed (2)
[exit=0]

$ pnpm test:worker
..                                                                       [100%]
2 passed in 0.26s
[exit=0]
```

Las dos suites corrieron **en el host**, contra los contenedores corriendo, contra un PostgreSQL 18
real y un Redis real. Eso es la aceptación — y vale notar que la primera corrida de la secuencia de
build del api se veía verde en cada paso mientras el contenedor no podía arrancar.

**El experimento `internal: true` (A/B/A).** El compose recuperado ponía la red detrás de
`internal: true`. Se la había sacado por un motivo que nunca se midió, así que se midió:

```text
without internal: true   ->  pnpm test:api 2 passed  ·  pnpm test:worker 2 passed  [exit=0]
with internal: true      ->  pnpm test:api 1 failed  ·  pnpm test:worker 2 failed  [exit=1]
     (containers stayed healthy and `up --wait` stayed green; only the host lost the ports)
without internal: true   ->  pnpm test:api 2 passed  ·  pnpm test:worker 2 passed  [exit=0]
```

La tercera pata es lo que vuelve la atribución causal y no casual. Consecuencia, registrada como
defecto D4: con la red como la tenía el scaffold borrado, la aceptación del host **no podía** pasar
mientras `up --wait` reportaba todos los servicios sanos. Sea lo que sea que acreditaba el GREEN
registrado de S1, no es reproducible contra ese archivo.

## Defectos encontrados en el plan

### D1 — el comando planeado para el harness de la API no puede fallar (encontrado el 2026-09-16, durante 1.1)

`tasks.md` §"Runners and canonical commands" prescribe:

```bash
pnpm --filter api exec vitest run <file>
```

Corrido hoy, sin workspace presente, pnpm imprime `No projects found in "<repo>"` y **sale con
`0`**. El comando no puede distinguir "la suite pasó" de "la suite nunca corrió", así que un job de
CI montado sobre él reporta verde en un repositorio vacío.

**Resolución — verificada el 2026-09-16, después de que el primer intento quedara desmentido.** El
primer supuesto fue que `run` falla cerrado donde `exec` no. El control negativo lo mató: **los dos
salen con `0`** cuando no hay proyecto que matchee. El fix es el flag explícito:

```bash
pnpm --filter api --fail-if-no-match run test:harness
```

Vive en el `Makefile` (target `test-api`) y en el `package.json` de la raíz (`test:api`). Verificado
en las dos direcciones: `--filter no-such-project` sale `1`, y `--filter api` sin base sale `1`. El
comando del worker no necesita flag — `uv run --project <inexistente>` ya sale non-zero.

La lección es barata de enunciar y cara de aprender: el primer fix fue un supuesto plausible leído
del comportamiento, y solo el control negativo probó que estaba mal.

## Defectos encontrados mientras se implementaba 1.2–1.3 (D2–D4)

D2 y D3 son defectos en archivos que escribió esta feature. D4 es un defecto del scaffold que se
borró. Los tres comparten una forma, y es la forma que también tiene D1: **algo reportó éxito
produciendo un resultado roto.**

### D2 — `.dockerignore` no excluye `node_modules` anidados

`node_modules/` matchea solo el directorio de primer nivel, no `apps/api/node_modules`. En un
workspace de pnpm los anidados son los importantes, así que el install del host se copió dentro de
la imagen **encima** del install Linux de la propia imagen, con shims de Windows y symlinks
absolutos incluidos:

```text
apps/api/node_modules/@nestjs/cli -> /c/Users/andre/.../node_modules/.pnpm/@nestjs+cli@10.4.9/...
```

`nest build` murió entonces con `Cannot find module
'/app/apps/api/node_modules/@nestjs/cli/bin/nest.js'`.

**Fix:** cada patrón de `.dockerignore` anclado con `**/`. Verificado reconstruyendo la imagen del
api con `--no-cache`, porque una capa cacheada en ese punto habría producido un verde falso.

### D3 — una caché de build incremental del host se filtró a la imagen

`apps/api/tsconfig.tsbuildinfo` (148 KB) vivía al lado de `tsconfig.json`, así que `**/dist/` no lo
excluía. El `nest build` de la imagen leyó la caché del host, concluyó que `app.module.js` y
`health.controller.js` ya estaban emitidos, emitió solo `main.js` y los `.d.ts`, y reportó éxito. La
imagen se construyó; el contenedor murió con `Cannot find module './app.module'`.

**Fix, las dos mitades:**

- `.dockerignore` excluye `**/*.tsbuildinfo` y `**/.eslintcache`; `.gitignore` excluye
  `*.tsbuildinfo`.
- `apps/api/tsconfig.build.json` — el config de build convencional de NestJS que este scaffold no
  tenía — fija `tsBuildInfoFile` **dentro de** `dist/`. La caché queda entonces gitignoreada, fuera
  del contexto de build, y se descarta junto con el output que describe.

### D4 — `internal: true` volvía imposible la aceptación mientras todo se veía sano

Medido en 1.4 (A/B/A en el log de evidencia): contenedores sanos, `--wait` verde, los dos comandos
del host en rojo. El flag **no** se restaura. Los comandos del host son lo que convierte la tarea
1.4 en evidencia en vez de una afirmación, y ese requisito está por encima del bloqueo de egreso.
Recuperar el bloqueo de egreso implica mover la aceptación adentro de un contenedor primero — un
cambio propio, no un flag.

## Fuera de alcance

- WU-5 (spike de consumer groups de redis-py) y WU-13 (precheck de namespaces del sandbox): su
  evidencia se borró por decisión. Las dos se tienen que revisitar antes de WU-6 y WU-14
  respectivamente. Los documentos de requisitos que sobreviven son
  `design/spike-sandbox-namespaces.md` y `design/adr-0002-queue-mechanism.md`.
- Todo lo posterior a WU-1 (modelo de datos, contrato, ports, máquina de estados). Está trackeado en
  el `tasks.md` del SDD y se va a re-planificar como features ODD de a una.

## Next step

Ninguno — no queda trabajo sobre este documento: la feature está cerrada (las cuatro tareas
1.1–1.4 llevan evidencia registrada; la lista de residuos de más arriba se re-midió y se cerró en
`repo-hygiene`; el tip `9eb288b` es ancestro de `origin/main`). Los hilos abiertos viven en otro
lado: las dos decisiones diferidas del *Fuera de alcance* de `repo-hygiene.md` — adoptar knip
(con el hallazgo del binario no listado `uv`) y la configuración ausente de ESLint — pertenecen al
supervisor.
