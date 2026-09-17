# Feature — `wu2-data-model` (el modelo de datos autoritativo: schema de Prisma, primera migración, roles de privilegio mínimo)

> **Copia de lectura en español.** El documento canónico es `wu2-data-model.md` (inglés); si
> divergen, manda el inglés. **Los bloques de código son idénticos a los del inglés, byte a byte**
> (se comparan con un diff): son salida cruda de comandos, y traducirla sería falsificarla. Lo que
> está traducido es la prosa.

**Workflow:** Organic Driven Development (ODD).
**Fuente de verdad de los requisitos:** `openspec/changes/audio-extract-vertical-slice/` (intacto).
**Estado:** `en curso` — creada el 2026-09-17.

---

## Por qué existe esta feature

WU-1 (scaffold del workspace, toolchains, harness) está cerrada, pusheada, y su residuo está cerrado
(`odd/tasks/repo-hygiene.md`). La siguiente unidad del plan del SDD es **WU-2 — Modelo de datos
autoritativo**, y es la primera unidad donde el proyecto deja de ser scaffolding y empieza a tener un
contrato contra el que se escribe el resto del slice: seis estados, intentos como filas, el par de
idempotencia, la intención del outbox, la metadata de artefactos, y los dos roles de runtime que hacen
real "una sola autoridad de DDL".

Todo lo que viene después de WU-2 depende de esto. WU-3 (el contrato de dispatch) y de WU-6 en
adelante (queue, worker, state machine) se escriben *contra* este schema, así que un error acá es una
migración, no un parche.

## Entradas autoritativas

| Entrada | Qué gobierna |
| --- | --- |
| `design.md` §3 *Data model* (línea 129) | **El ERD es el modelo autoritativo**: seis tablas, columnas, tipos, uniques, el índice parcial, los índices de FK, y los dos conjuntos de privilegios de los roles. |
| `design.md` §4 *UUID strategy* | `@default(dbgenerated("uuidv7()")) @db.Uuid` en toda PK salvo `artifacts.id`, que el worker acuña con `SELECT uuidv7()`. Sin ids a nivel ORM, sin generación de id en Python. |
| `design.md` §5 *Migration ownership* | Prisma es dueño de las migraciones. El enum, las tres restricciones CHECK y el índice parcial se **editan a mano dentro de la migración generada**, que sigue siendo la autoridad única. |
| `adr-0003-worker-writes-postgres.md` | El worker escribe directo en Postgres; el schema es de solo lectura del lado de Python. |
| `tasks.md` → WU-2 | Los criterios de aceptación que esta feature espeja, para que el plan del SDD y la feature de ODD sigan siendo reconciliables. |
| Capability specs | C1 (fila de job antes que los bytes), C2 (seis estados, intentos como filas, `attempts_used` derivado, inputs plurales con ordinal único, resultado terminal), C3 (intención de dispatch commiteada con la transición), C6 (puntero de artefacto + metadata, `expires_at` a 7 días). |

**Un archivo que no debe referenciarse:** `design/schema.prisma`. Está nombrado en `tasks.md` como
inexistente, y lo es: `git log --all -- '*schema.prisma'` devuelve cero commits, y no existe registro
de borrado. Una nota de una sesión anterior afirmaba que tenía 145 líneas; el repositorio dice otra
cosa, y el repositorio gana. El ERD de §3 es la entrada.

## Restricciones (no negociables)

- **Strict TDD.** `openspec/config.yaml` declara `strict_tdd: true`: el RED se escribe y se observa
  *fallando* antes de que exista schema alguno. Una suite verde que nunca pasó por rojo no es
  evidencia.
- **Una sola autoridad de DDL.** `apps/api/prisma/migrations/` es el único lugar donde vive el DDL. El
  worker no emite DDL, jamás. Todo cambio de schema es una migración de Prisma del lado de la API.
- **Los roles son parte del schema, no una ocurrencia de último momento.** La migración crea
  `mediaforge_api` y `mediaforge_worker` con exactamente los privilegios que lista §3, y revoca
  `PUBLIC`.
- **No hay columna contadora.** `attempts_used` se deriva de `attempts`. `2.1` afirma la ausencia
  directamente en `information_schema`, porque "no la agregamos" no es un check.
- **Las dos excepciones deliberadas siguen visibles.** `jobs.available_at` existe y nada agenda en
  contra de ella en este slice; `artifacts.id` no tiene default de base y lo acuña el worker.
- **El RDD sigue prendido** (decisión del supervisor, 2026-09-17). Cada unidad de trabajo se evalúa y
  se verifica de forma independiente. El costo es conocido y aceptado: la revisión nativa no puede
  arrancar en este clone, y el camino pasivo de la evaluación es inalcanzable, así que cada unidad va
  por el camino gated por riesgo. Ver el hallazgo F1 de `repo-hygiene.md` y el registro de
  conformidad con el RDD.

## Decisiones tomadas con el supervisor (2026-09-17)

1. **El escritor es la IA; el supervisor lee y objeta.** El plan del SDD etiqueta WU-2 como
   `owner: core` ("el usuario la escribe y la defiende en una entrevista"), y el acuerdo de trabajo
   vigente reemplazó eso el 2026-09-16: la IA escribe cada archivo, el supervisor revisa cada cambio.
2. **El RDD sigue prendido** para esta feature, aceptando el verificador independiente por unidad de
   trabajo.
3. **La secuencia "revisar antes de commitear" se corrige, no se aplica.** Esa regla repara una
   fachada que *funciona*. Hoy anda en un solo camino, y esta decisión se escribió antes de medirlo:
   con el candidato **sin commitear**, `inspect` devuelve una transición `execute` que emite el
   `lineageId` por sí misma y ofrece la ruta completa de `review start` — o sea ahí la secuencia es
   exactamente la correcta. Con el workspace **limpio** (todo commiteado) la proyección queda vacía, la
   transición pasa a `collect` / `empty_candidate_base_ref_required`, y *ese* camino se muere en un
   `lineageId` que su propio paso de collect nunca emite. `assess` falla la validación de schema con
   cualquier candidato que no tenga señal de riesgo. Los work-unit commits siguen, porque son los
   puntos de recuperación y las unidades revisables.

## Tareas

Cada tarea cierra con al menos un work-unit commit en la feature branch, y cada commit se evalúa y se
verifica de forma independiente (restricción de arriba).

### 1.1 — RED: la suite del contrato de schema · owner: IA

Escribir `apps/api/test/schema.spec.ts` (Vitest) que afirme **contra la base migrada**:

- los seis valores del enum de estados y ningún séptimo;
- `unique (job_id, ordinal)` rechaza un ordinal duplicado; `unique (job_id, attempt_no)`;
  `unique (client_id, idempotency_key)` y `unique (job_id)` en `submissions`;
- **sin columna contadora en `jobs`**, leída desde `information_schema`;
- toda PK salvo `artifacts.id` tiene default `uuidv7()`, y `artifacts.id` no tiene default;
- el índice parcial `outbox (published_at) WHERE published_at IS NULL`;
- `CHECK (ordinal >= 1)`, `CHECK (attempt_no >= 1)`, `CHECK (error_class IN (...))`;
- los tipos de columna `timestamptz` / `bigint` / `jsonb`;
- toda columna de foreign key está indexada.

**Aceptación:** el archivo existe y la falla observada está registrada. Falla porque no hay schema, no
porque el archivo esté mal formado — son fallas distintas y el log tiene que mostrar la primera.

### 1.2 — RED: la suite de privilegio mínimo · owner: IA

Escribir `workers/media/tests/test_db_privileges.py` (pytest) que afirme, *conectándose como cada rol*:

- `mediaforge_worker` **no puede** `SELECT` sobre outbox, no puede DDL, no puede DELETE; **puede**
  SELECT sobre `jobs`/`job_inputs`/`submissions`, INSERT/UPDATE sobre `attempts`, INSERT sobre
  `artifacts`, UPDATE sobre `jobs`;
- `mediaforge_api` no puede DDL y no puede DELETE;
- `PUBLIC` está revocado.

**Aceptación:** el archivo existe y la falla observada está registrada, distinguiendo el error de
conexión de la denegación de privilegio (un rol que todavía no existe falla distinto de un rol que
está denegado, y el log tiene que decir cuál pasó).

### 1.3 — GREEN: schema, migración, roles · owner: IA

1. Escribir `apps/api/prisma/schema.prisma` desde el ERD de §3.
2. Generar la primera migración dentro de `apps/api/prisma/migrations/`.
3. Editar a mano esa migración para lo que Prisma no puede expresar: el tipo enum `state`, las tres
   restricciones CHECK y el índice parcial de outbox. Agregar la creación de roles y los grants.
4. `prisma migrate deploy` contra `mediaforge_test`.

**Aceptación — los comandos exactos y su salida registrada:**

```bash
docker compose -f docker/compose.yaml up -d --wait
pnpm --filter api --fail-if-no-match exec prisma migrate deploy
pnpm test:api
pnpm test:worker
pnpm --filter api --fail-if-no-match exec prisma migrate diff \
  --from-schema-datasource apps/api/prisma/schema.prisma --to-schema-datamodel apps/api/prisma/schema.prisma
```

El último comando tiene que reportar **sin drift**. Las dos suites verdes. `--fail-if-no-match` es
obligatorio, no decorativo (defecto D1).

**Ediciones manuales planeadas a la migración generada.** Prisma no puede expresar esto, así que se
agregan al SQL generado para que un solo archivo siga siendo la autoridad única de DDL (`design.md`
§5). El enum **no** está en esta lista: Prisma lo expresa de forma nativa (`CREATE TYPE`), al
contrario de lo que dice la letra de §5.

```sql
-- 1. CHECK constraints -------------------------------------------------------
ALTER TABLE "job_inputs" ADD CONSTRAINT "job_inputs_ordinal_positive" CHECK ("ordinal" >= 1);
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_attempt_no_positive" CHECK ("attempt_no" >= 1);
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_error_class_allowed"
  CHECK ("error_class" IS NULL OR "error_class" IN ('retryable', 'non_retryable'));

-- 2. The partial index the relay poll needs ----------------------------------
CREATE INDEX "outbox_unpublished_idx" ON "outbox" ("published_at") WHERE "published_at" IS NULL;

-- 3. Least-privilege roles (design.md §3) ------------------------------------
-- LOGIN without a password: credentials are a deployment concern and are set out-of-band, so no
-- password is committed in a migration. The privilege suite exercises these roles through SET ROLE
-- and asserts `rolcanlogin` separately. The DO blocks make the migration re-appliable to a second
-- database in the same cluster, where the roles already exist.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mediaforge_api') THEN
    CREATE ROLE "mediaforge_api" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mediaforge_worker') THEN
    CREATE ROLE "mediaforge_worker" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

-- The roles must be able to reach the database and the schema before table grants mean anything.
-- The database name differs between dev and test, so it is read from the current connection.
DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO "mediaforge_api", "mediaforge_worker"',
                 current_database());
END
$$;
GRANT USAGE ON SCHEMA "public" TO "mediaforge_api", "mediaforge_worker";

-- PUBLIC holds nothing (design.md §3).
REVOKE ALL ON ALL TABLES IN SCHEMA "public" FROM PUBLIC;
REVOKE ALL ON SCHEMA "public" FROM PUBLIC;

-- api: SELECT/INSERT/UPDATE on its four tables, SELECT on attempts and artifacts. No DDL, no DELETE.
GRANT SELECT, INSERT, UPDATE ON "jobs", "job_inputs", "submissions", "outbox" TO "mediaforge_api";
GRANT SELECT ON "attempts", "artifacts" TO "mediaforge_api";

-- worker: SELECT on jobs/job_inputs/submissions, full control of attempts, INSERT on artifacts,
-- UPDATE on jobs. No outbox access, and no DELETE for either role: scratch cleanup is a storage
-- operation, never a database DELETE.
GRANT SELECT ON "jobs", "job_inputs", "submissions" TO "mediaforge_worker";
GRANT SELECT, INSERT, UPDATE ON "attempts" TO "mediaforge_worker";
GRANT INSERT ON "artifacts" TO "mediaforge_worker";
GRANT UPDATE ON "jobs" TO "mediaforge_worker";
```

**Una trampa de versiones que vale la pena registrar.** `npx prisma` (al que llega el linter de
schema) resuelve el dist-tag `latest`, y al momento de escribir esto `latest` es **`8.0.0-rc.15`** —
una release candidate. La última estable es **`7.10.0`** (`dist-tag: prev`), y es la que este proyecto
fija, por la misma razón por la que `pyproject.toml` fija Python en `3.11.x` exacto: una toolchain sin
fijar deja silenciosamente de coincidir con la cosa que se está diseñando.

### 1.4 — O2: las aserciones de base del harness pasan al cliente de Prisma · owner: IA

La observación O2 del supervisor, aceptada el 2026-09-16 y **vinculante para esta unidad**: cuando
aterrice WU-2, `apps/api/test/harness.spec.ts` mueve sus aserciones de base al cliente de Prisma, y
`pg` más `@types/pg` salen de `package.json`.

**Aceptación:** no queda ningún import de `pg` en ningún lado; `pg`/`@types/pg` desaparecen del
manifiesto y del lockfile; las dos suites del harness quedan verdes; y el harness queda **más fuerte**
que antes, afirmando `current_database() = 'mediaforge_test'` a través del cliente que la aplicación
realmente usa en vez de a través de un sustituto.

### 1.5 — Las dos excepciones deliberadas, verificadas como presentes · owner: IA

- `jobs.available_at` existe y siempre pasa el guard T4 en este slice; **nada agenda en contra de
  ella**. Verificado leyendo el schema y la migración, y declarado donde un lector mira.
- `artifacts.id` lo escribe el worker vía `SELECT uuidv7()` (WU-12), nunca un generador de UUID de
  Python. En esta unidad se afirma como *default ausente*, que es lo que hace legal la futura
  inserción con id explícito.

**Aceptación:** las dos excepciones las afirma la suite de `1.1` o se documentan con su razón, y la
sección `Fuera de alcance` de abajo nombra qué las violaría.

### 1.6 — Conformidad con el RDD, por unidad de trabajo · owner: IA

Por cada work-unit commit: correr la evaluación, registrar el tier evaluado y el resultado en el
registro de evidencia, y cumplir el plan resultante. Dados los dos defectos conocidos, el registro
esperado es `unassessable`-as-high con un verificador independiente; si algún tier difiere, eso es
información nueva y va al log, no a un hábito.

**Aceptación:** cada unidad de trabajo tiene una línea explícita de tier-o-resultado, y los hallazgos
del verificador independiente quedan registrados con lo que se hizo con cada uno.

## Registro de evidencia

Salida cruda, agregada a medida que cierra cada tarea. Verbatim, sin parafrasear.

### 1.3 — GREEN: schema, migración, roles (2026-09-17)

**Prisma 7, adoptado por decisión del supervisor, y qué cambió eso.** El diseño y el plan asumían el
modelo clásico. Prisma 7 sacó `datasource.url` del schema, requiere `prisma7.config.ts` para la
connection string, reemplaza el generator por `prisma-client` (con `output` explícito) y necesita un
driver adapter para una conexión directa. El adapter depende de `pg`. Registrado porque es un cambio
real en los supuestos del diseño, no un bump de dependencia.

> **Corrección (2026-09-17, mismo día).** Esta sección originalmente afirmaba que "la letra de O2
> sigue en pie — `pg` nunca entra a este manifiesto". **Eso era falso en las dos direcciones y el
> verificador independiente lo refutó.** `pg` y `@types/pg` ya eran devDependencies directas de
> `apps/api` desde el scaffold de S1, y siguen ahí; y `test/harness.spec.ts` todavía importa `Client`
> de `pg`. O2 nunca la satisfizo esta unidad de trabajo — es la **tarea 1.4**, y sigue abierta. La
> afirmación se escribió razonando sobre el adapter en vez de leer el manifiesto, que es exactamente
> la falla que este proyecto no deja de encontrar en los documentos ajenos.

**Una trampa de versiones, medida.** `npm view prisma dist-tags` reporta `latest: 8.0.0-rc.15` — una
release candidate bajo el tag `latest` — y `prev: 7.10.0`. `npx prisma` (al que llega el linter de
schema) resuelve esa RC. Este proyecto fija `7.10.0` en el manifiesto.

**El comando de aceptación 2.4 del plan ya no existe en v7.** `--from-schema-datasource` y
`--to-schema-datamodel` fueron reemplazados por `--from-config-datasource` y `--to-schema`, y
`--exit-code` convierte "sin drift" en exit `0` (vacío: 0, error: 1, no vacío: 2). El reemplazo se
midió en vez de asumirse:

```text
$ pnpm --filter api exec prisma migrate diff --from-config-datasource \
    --to-schema=prisma/schema.prisma --exit-code
Loaded Prisma config from prisma7.config.ts.
No difference detected.
[exit=0]
```

**El ERD y el SQL canónico del propio diseño discrepaban sobre los defaults.** Encontrado revisando la
migración, no leyendo prosa. Dos sentencias de §6 insertan filas sin todas las columnas NOT NULL:

| Línea | SQL canónico | Columnas que omite |
| --- | --- | --- |
| `design.md:355` | `INSERT INTO outbox (job_id, event_type, payload)` | `attempts`, `created_at` |
| `design.md:379` | `INSERT INTO attempts (job_id, attempt_no, lease_owner, lease_expires_at, started_at)` | `created_at` |

Resuelto a favor del SQL canónico: esas tres columnas llevan defaults, y **ninguna otra columna lo
tiene**. La transacción de creación de C1 (jobs, job_inputs, submissions) no tiene SQL canónico en el
diseño, así que no recibe defaults — un valor olvidado ahí falla con ruido en vez de quedar
disimulado. Registrado como decisión en el header del schema, no dejado como una inconsistencia sin
explicar.

**Migración y ediciones manuales.** Generada con `migrate dev --create-only --name init`, y después
editada: el enum `state` **no** está entre las ediciones manuales (Prisma generó el `CREATE TYPE`
solo, refutando la letra de §5 y el header previo de este archivo), mientras que las tres
restricciones CHECK, el índice parcial de outbox y los roles/grants se agregan al mismo archivo, que
sigue siendo la autoridad única de DDL.

```text
$ pnpm --filter api exec prisma migrate deploy
1 migration found in prisma/migrations
Applying migration `20260917183632_init`
All migrations have been successfully applied.
[exit=0]
```

`CREATE ROLE` dentro de la transacción de migración de Prisma funciona — medido acá, porque era una
pregunta abierta y "debería funcionar" no es evidencia.

**Las dos suites verdes, a través de los comandos canónicos:**

```text
$ pnpm test:api      -> Test Files 2 passed (2) · Tests 20 passed (20)   [exit=0]
$ pnpm test:worker   -> 14 passed in 0.70s                              [exit=0]
```

**Tres fallas que solo el GREEN podía revelar — todas bugs de test, no bugs de schema.** En RED cada
aserción fallaba por ausencia, así que nada ejercitaba si las aserciones podían *expresar* un pase:

1. `array_agg` devuelve un **string** (`'{job_id,ordinal}'`) a través de node-postgres, que no
   parsea `text[]`; las comparaciones contra arrays reales no podían pasar nunca. Arreglado con
   `json_agg`, que el driver sí parsea. Es la misma clase que el tema de `pg_constraint` que el
   verificador predijo, y es la razón por la que una suite que está roja por ausencia no puede validar
   sus propias aserciones.
2. La aserción de "exactamente seis tablas" contó `_prisma_migrations`, el ledger propio de Prisma.
   Excluida.
3. Una expectativa de conjunto de columnas únicas escrita en orden de declaración falló contra el
   conjunto correctamente ordenado; el schema estaba bien y la aserción estaba mal. Ahora se compara
   con un `setOf` explícito, para que la insensibilidad al orden viva en el código y no en el `ORDER
   BY` de un helper.

**Un gate que no cubría sus propias suites.** `test:api` corría solo `test:harness`, y `test:worker`
solo `tests/test_harness.py`, así que las suites de schema y de privilegios quedaban fuera de los
comandos canónicos: podían pasar o fallar sin que `pnpm test:api` las corriera nunca. Los dos scripts
(y los targets del `Makefile`) ahora corren la suite completa para su runtime. Misma familia que el
defecto D1 — un gate que no puede fallar no es un gate, y un gate que no corre el test no lo cubre.

**La imagen se reconstruyó y se inspeccionó, no se asumió.** El lockfile cambió, así que un `build`
verde no habría probado nada sobre la imagen (defectos D2/D3):

```text
$ docker compose -f docker/compose.yaml build api   [exit=0]
$ docker compose -f docker/compose.yaml up -d --wait [exit=0]
mediaforge-api Up (healthy) · mediaforge-postgres Up (healthy)
mediaforge-redis Up (healthy) · mediaforge-worker Up

$ docker run --rm --entrypoint sh mediaforge-api:latest -c "..."
/app: apps, node_modules, package.json, pnpm-lock.yaml, pnpm-workspace.yaml
apps/api/dist: app.module.js, health.controller.js, main.js (+ .d.ts, .map)   <- no partial emit
apps/api/prisma/migrations: 20260917183632_init, migration_lock.toml          <- present in the image
apps/api/node_modules/.bin/prisma --version: prisma 7.10.0 / @prisma/client 7.10.0 / linux
```

Un primer intento de esa inspección reportó "prisma not found" y "no dist"; los dos estaban mal porque
los paths asumían un layout plano. En un workspace de pnpm los binarios viven en
`apps/api/node_modules`, y `dist` en `apps/api/dist`. La imagen estaba bien; el check no. Listado acá
porque la corrección es el punto: `docker run` solo es evidencia si el path es el correcto.

### 1.3 — verificación independiente, y qué refutó (2026-09-17)

Siete afirmaciones se sostuvieron: la base viva coincide con el ERD §3/§4 con **cero divergencia en
ninguna de las dos direcciones** (49 columnas de dominio, tipos, nulabilidad, el enum de seis labels
en el orden declarado, cuatro uniques compuestos, los defaults `uuidv7()` y la excepción de
`artifacts.id`, seis foreign keys, tres CHECKs, el índice parcial, y el trace de índices); los dos
roles coinciden con la tabla de privilegios de §3 en las dos direcciones y ninguno es dueño de una
tabla; sin drift, reproducido; las dos gates verdes **y** cubriendo las suites; la decisión de los
defaults sólida dentro de su alcance (verificada contra las dos sentencias canónicas, y la respuesta
a "¿hay alguna otra columna NOT NULL que una sentencia canónica omita?" es no); nada metido de
contrabando.

**Una afirmación fue refutada, y era la propia de esta unidad: O2 no está satisfecha.** Ver la
corrección de arriba. El verificador también notó que la parte transitiva es real —
`@prisma/adapter-pg@7.10.0` depende de `pg` y `@types/pg` — pero la afirmación honesta es que `pg` es
**a la vez** devDependency directa y transitiva, no "solo transitiva".

**La suite todavía se puede engañar, de tres maneras construibles.** El verificador leyó las
dieciocho aserciones y construyó bases incorrectas que las pasan todas:

1. **La más filosa:** reemplazar el CHECK de `error_class` por uno que prohíba NULL
   (`CHECK (error_class IS NOT NULL AND error_class IN (...))`) pasa, porque la suite compara la unión
   de literales entrecomillados. Pero el ERD declara `error_class` nullable y el T6 canónico de §6
   hace `UPDATE attempts SET ... error_class = NULL`, que esa restricción rechazaría.
2. `CHECK (ordinal >= 1 AND ordinal <= 1)` coincide con el regex de la suite — el propio header del
   archivo admite que el regex es un check de ortografía, no una prueba semántica — y el único test de
   comportamiento solo inserta ordinal 1.
3. **Ninguna aserción lee `column_default` para los tres defaults de §6**, así que una base que los
   dropeara pasaría las dieciocho y después fallaría en runtime con los inserts canónicos del propio
   diseño.

Las tres se cierran en el commit de seguimiento de la tarea 1.4. La lección es la misma que esta
feature no deja de producir desde ángulos distintos: una aserción de catálogo prueba lo que lee, y
nada más.

### 1.1 — RED: la suite del contrato de schema (2026-09-17)

```text
$ pnpm --filter api --fail-if-no-match exec vitest run test/schema.spec.ts

 test/schema.spec.ts (11 tests | 11 failed) 262ms
   × schema :: tables exist > creates exactly the six tables of the ERD
     → expected [] to deeply equal [ 'artifacts', 'attempts', …(4) ]
   × schema :: the six states, and no seventh > types jobs.state as an enum whose labels are exactly the six canonical states
     → jobs.state is missing: expected undefined to be defined
   × schema :: uniqueness is enforced, and by the engine > declares the four unique column sets the ERD requires
     → expected [] to deeply equally contain [ 'job_id', 'ordinal' ]
   × schema :: uniqueness is enforced, and by the engine > rejects a duplicate (job_id, ordinal) with a real unique violation
     → relation "jobs" does not exist
   × schema :: no counter column on jobs > has exactly the ERD columns, and none of them is a counter
     → expected [] to deeply equal [ 'id', 'job_type', 'params', …(6) ]
   × schema :: no counter column on jobs > keeps attempts as rows: the table exists and is keyed per attempt
     → expected [] to deeply equal [ 'id', 'job_id', 'attempt_no', …(7) ]
   × schema :: ids are database-minted > defaults every primary key to uuidv7() except artifacts.id
     → .toMatch() expects to receive a string, but got undefined
   × schema :: the partial index the relay poll needs > indexes outbox (published_at) WHERE published_at IS NULL
     → no partial outbox index; found:
   × schema :: CHECK constraints Prisma cannot express > constrains ordinal, attempt_no and error_class
     → expected '' to match /ordinal\s*>=\s*1/
   × schema :: types are the ones the model declares > uses timestamptz, bigint and jsonb where the ERD says so
     → expected undefined to be 'jsonb'
   × schema :: every foreign key is indexed > has an index whose leading column is each foreign-key column
     → expected 0 to be greater than 0

 Test Files  1 failed (1)
      Tests  11 failed (11)
[exit=1]
```

**Por qué este es el RED correcto.** Diez de las once fallan porque el catálogo está vacío, y la
undécima porque el insert de comportamiento no encontró tabla (`relation "jobs" does not exist`).
Ninguna falló por un error de sintaxis o de tipo dentro del archivo de test. Esa distinción es el
sentido entero de registrar una corrida RED: un test mal formado también falla, y esa falla no
probaría nada sobre el schema.

**Un artefacto de plomería que vale la pena registrar.** Una segunda corrida pasada por `head -30`
imprimió `exit=0`. Ese número venía del pipe truncado, no de una suite verde — el exit code
autoritativo es el `1` de la primera corrida, tomado sin truncar. Es el defecto D1 en miniatura: un
status producido por la plomería no es evidencia sobre la cosa que se está midiendo.

**Advertencia del linter, no accionada.** pi-lens reportó un hallazgo de knip **viejo** para
`apps/api/package.json`: `Unused devDependency @nestjs/schematics`. Ese paquete no está en el
manifiesto (verificado directo), así que el hallazgo no se reproduce y no se cambió nada para
silenciarlo — la misma disposición que los hallazgos F4/F5 de `repo-hygiene.md`.

### 1.2 — RED: la suite de privilegio mínimo (2026-09-17)

```text
$ uv run --project workers/media pytest workers/media/tests/test_db_privileges.py -q

E   asyncpg.exceptions.InvalidParameterValueError: role "mediaforge_api" does not exist
=========================== short test summary info ===========================
FAILED ...::test_both_runtime_roles_exist_without_superuser_power
FAILED ...::test_the_privilege_matrix_is_exactly_as_designed[mediaforge_api-granted0]
FAILED ...::test_the_privilege_matrix_is_exactly_as_designed[mediaforge_worker-granted1]
FAILED ...::test_worker_cannot_reach_the_outbox
FAILED ...::test_neither_role_can_run_ddl[mediaforge_api]
FAILED ...::test_neither_role_can_run_ddl[mediaforge_worker]
FAILED ...::test_neither_role_can_delete[mediaforge_api]
FAILED ...::test_neither_role_can_delete[mediaforge_worker]
FAILED ...::test_public_holds_nothing_on_the_tables
FAILED ...::test_worker_can_actually_claim_an_attempt_and_fence_a_job
FAILED ...::test_api_can_actually_write_its_create_transaction
11 failed in 0.99s
[exit=1]
```

La razón de la falla es ausencia (`role "mediaforge_api" does not exist`), no un archivo mal formado.

**La primera corrida pasó un test, y ese pase era vacuo.** Antes del fix, la corrida era
`10 failed, 1 passed`, y el pase era `test_public_holds_nothing_on_the_tables`: sin tablas en
`pg_class`, la query de ACL no devuelve nada, y un resultado vacío satisface "ningún privilegio
filtrado". Verde por una razón ajena a lo que se afirma. Arreglado afirmando `to_regclass(table) IS
NOT NULL` antes de cada check de ACL, que es también lo que hace al test significativo en GREEN.
Segunda corrida: 11 failed, 0 passed. Es la misma familia que el defecto D1 y el CR scan roto — un
check que no puede fallar de la manera que dice fallar.

**Un hallazgo del linter corregido estructuralmente, no silenciado.** La primera versión de este
archivo construía el SQL por interpolación (`SET ROLE "{role}"`) y le pasaba la sentencia a un helper
como string; pi-lens lo marcó como un sink de inyección. Los nombres de rol son constantes de módulo,
así que no era explotable — que es exactamente por qué silenciarlo habría sido la decisión
equivocada. Se eliminó en cambio: `set_config('role', $1, false)` es la misma operación con el rol
como parámetro enlazado, y el context manager `as_role` no recibe SQL en absoluto, así que las
sentencias de denegación son literales en sus call sites. Resultado: `Python clean`.

### 1.2 — verificación independiente, y qué cambió (2026-09-17)

Veredicto: un RED genuino (solo fallas por ausencia, re-corrida de forma independiente), la matriz de
privilegios del diseño coincidió **celda por celda en las dos direcciones**, y el fix del pase vacuo
quedó confirmado como el nivel de aserción correcto — el verificador coincidió en que afirmar "PUBLIC
no tiene nada" es la propiedad que importa y que rechazar un `relacl` NULL sería testear un efecto
secundario.

**Refutado, y arreglado en esta unidad de trabajo:**

- **La matriz barrió cuatro privilegios, no todos.** `GRANT TRUNCATE ON any_table TO either_role`
  pasaba los once tests, contradiciendo la afirmación del propio docstring de que "toda otra
  combinación debe estar ausente". El barrido ahora cubre los siete privilegios de tabla que tiene
  PostgreSQL.
- **§3 exige que las migraciones corran bajo el rol owner, y nada lo afirmaba.** Un owner puede
  `ALTER` o `DROP` una tabla **sin tener ningún grant de DDL**, así que la denegación de DDL podría
  haber sido vacua mientras toda otra aserción seguía verde. Un test nuevo afirma que ningún rol de
  runtime es dueño de una tabla, de forma no vacua: afirma que las seis tablas existen antes de juzgar
  a su owner.
- **El header le daba el crédito a `.env.example`** por los nombres de variable. Ese archivo no existe
  — el supervisor lo dropeó el 2026-09-16 — así que la procedencia es `design.md` §3, y el comentario
  ahora dice solo eso.

**No medible, registrado en vez de asumido:** si `set_config('role', $1, false)` impone el mismo
check de membresía que `SET ROLE` (construir una denegación de no-membresía requiere crear roles,
fuera de la superficie autorizada del verificador; PostgreSQL documenta ambos como el mismo setting,
y la falla por rol inexistente observada es un error de ausencia de cualquier manera); y si `REVOKE
ALL FROM PUBLIC` puede dejar atrás un `aclitem` con cero privilegios (la dirección de la aserción es
sólida de cualquier manera).

**Residual, declarado en vez de implícito:** los grants a nivel columna viven en
`pg_attribute.attacl` y no se barren. La matriz del diseño es a nivel tabla, y `has_table_privilege`
sí devuelve true para privilegios de cualquier columna, así que un grant a nivel columna solo se
atrapa donde toca los dos caminos de escritura ejecutados. Eso ahora está escrito en el header de la
suite en vez de dejado para que un lector lo descubra.

### 1.1 — verificación independiente, y qué cambió (2026-09-17)

La gate RDD de esta unidad de trabajo corrió un verificador independiente contra `schema.spec.ts`.
Veredicto: la suite es un **RED genuino** — 11 de 11, cada falla confirmada como ausencia de schema,
re-corrida de forma independiente — y **no es una gate completa**. Dos ítems encabezan, porque son
defectos más que opiniones:

1. **Un falso RED esperando en GREEN.** `uniqueColumnSets` lee `pg_constraint` (`contype IN ('u','p')`).
   Prisma emite `CREATE UNIQUE INDEX` para `@unique` y `@@unique`, y un índice único no crea **ninguna**
   fila de `pg_constraint`. Sobre un schema generado *correcto*, las cuatro aserciones de uniqueness
   fallarían. La suite tiene que leer la uniqueness como **enforcement** (índices únicos, excluyendo
   los parciales), no como filas de constraint — y la alternativa, editar a mano la migración para
   convertir los uniques en constraints, sería contorsionar el schema para complacer a un test.
2. **Una afirmación falsa en el propio header de este archivo, heredada del diseño.** El header
   afirma que Prisma no puede expresar el enum `state`. Puede: Prisma tiene bloques de enum nativos y
   genera `CREATE TYPE`. `design.md` §5 dice lo mismo y el `2.3` de WU-2 lo repite. Solo las tres
   restricciones CHECK y el índice parcial son genuinamente inexpresables. `design.md` es la fuente de
   solo lectura de esta feature y **no se edita acá**; el hallazgo se registra en cambio.

**El hallazgo que decidió la respuesta.** El verificador construyó un único schema incorrecto que pasa
**las once** aserciones: un orden de declaración de enum mezclado, `CHECK (error_class =
'non_retryable')` (que satisface los tres regex de substring, incluyendo a `/retryable/` matcheando
*adentro* de ese literal), `submissions` sin `creator_token_hash`, `artifacts.id` nullable y sin
primary key, `outbox.payload` como `text`, un índice parcial irrelevante sobre `created_at`, y
`jobs.artifact_id` apuntando a `submissions`. Una gate que admite ese schema no es una gate, así que
la suite se fortalece **antes** del GREEN: una suite medida contra nada produce evidencia verde sobre
nada.

La lista de refuerzos, toda de esa revisión: leer la uniqueness desde los índices únicos; afirmar el
orden declarado del enum además del conjunto de labels; anclar el regex del default `uuidv7()` en vez
de matchear un substring; exigir la **columna principal** del índice parcial y no solo su predicado;
comparar el conjunto de labels de `error_class` de forma exacta en vez de matchear substrings; afirmar
las seis foreign keys esperadas **y** sus targets en vez de solo "toda FK existente está indexada";
afirmar la nulabilidad en las dos direcciones para cada columna que el ERD marca nullable; afirmar una
primary key en cada tabla; afirmar los conjuntos completos de columnas de `job_inputs`, `submissions`,
`artifacts` y `outbox`, que no tenían ninguno; y ampliar las aserciones de tipo a las columnas `int`,
`uuid`, `jsonb` y las `timestamptz` restantes.

## Fuera de alcance

- De WU-3 en adelante: el contrato TS↔Python, la queue, el runtime del worker, la state machine,
  storage.
- **SQL del lado del worker.** Las sentencias `INSERT`/`UPDATE` del worker se escriben en WU-4 y en
  adelante. Esta unidad hace el schema y los roles; el lado de Python solo gana las aserciones de
  privilegio.
- Cualquier DDL desde Python, y cualquier segundo dueño de migraciones. Si una unidad futura necesita
  un cambio de schema, es una migración nueva acá, no un `ALTER` allá.
- Agregar una columna contadora, un `public_id`, un reaper, barridos de retención, o un séptimo
  estado. Los cuatro están nombrados como prohibidos por las specs o el diseño, y ninguno es un atajo
  que esta unidad pueda tomar.
- La copia de lectura `.es.md` se genera al cierre, en sync, con bloques de código idénticos byte a
  byte.