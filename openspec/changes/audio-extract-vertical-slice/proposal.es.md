# Propuesta — `audio-extract-vertical-slice`: el primer job pipeline que funciona

> **Copia de estudio en español.** Este archivo es una copia de estudio en español de [`proposal.md`](./proposal.md).
> **El original en inglés es canónico**: si difieren, prevalece `proposal.md`.
> Este archivo **se regenera** desde el original; no se edita de forma independiente.
>
> Los **términos técnicos de arte se mantienen en inglés** (`job`, `message`, `attempt`, `retry`,
> `lease`, `heartbeat`, `reaper`, `janitor`, `outbox`, `relay`, `fencing`, `promote`, `handler`,
> `capability`, `artifact`, `CAS`, `dead-letter`, `replay`, `consumer group`, `pending`, `backoff`,
> `jitter`, `poison message`). Son el vocabulario que usan el diseño, el código y la entrevista;
> traducirlos ocultaría justo lo que el lector necesita aprender. La prosa, los encabezados y las
> explicaciones van en español.

**La respuesta primero.** El primer slice entrega exactamente un camino que funciona de punta a
punta: un cliente sube un video, la API lo acepta y lo valida, el worker corre `audio.extract` vía
ffmpeg, el mp3 se promueve atómicamente, y el cliente lo descarga a través de un capability grant.
Las cuatro mecánicas que son baratas ahora y estructuralmente caras de retrofittear — una tabla
`attempts` real, dedupe por estado terminal antes de trabajar, promote atómico, y commit fenceado —
entran desde el día uno. Todo lo demás (reaper, DLQ, replay, progress streaming, cooperative cancel,
job types 2 y 3) queda explícitamente diferido.

> **Nombre del change.** `job-pipeline-core` era la etiqueta provisional de `explore.md` §7 y no es
> el scope decidido. El change es **`audio-extract-vertical-slice`**, y el directorio del change se
> renombró para coincidir. Los slices posteriores — hardening, `pdf.merge`, `pdf.split` — son changes
> separados, con directorios separados.

---

## Por qué (Why)

| Driver | Consecuencia |
| --- | --- |
| El objetivo rector es **evidencia verificable de portafolio** | La evidencia más difícil de falsificar es un reviewer que sube un archivo y recibe un artefacto real. Los slices B y C producen sistemas cuya correctitud hay que creer por fe a partir de tests; este slice produce una demo. |
| El **cruce de contrato TS ↔ Python** es lo que este slice prueba | **No porque sea incómodo.** La premisa anterior de que BullMQ es incómodo de consumir desde Python quedó refutada por la research y por la documentación del propio proveedor (`ADR-0002`, R4). El cruce sigue importando: el producer es TypeScript y el consumer es Python, así que la forma del message y el contrato del job tienen que coincidir entre dos lenguajes, y este slice lo prueba con bytes reales. El riesgo residual es más acotado — la superficie de API del cliente Python — y se cierra con un spike antes de implementar |
| No diferir los dos invariantes más difíciles | Fencing y promote atómico son las víctimas habituales de un slice "camino feliz fino". Entran ahora. |
| Contraargumento honesto, en el registro | El slice A **no** demuestra dominio de retry/falla, que es el material más fuerte para una entrevista. Es precisamente por eso que el slice C (hardening) es el **segundo** slice recomendado — antes de los job types 2 y 3, no después. |

---

## Qué cambia (What Changes)

### Componentes que se construyen en este slice

| Área | Lane | Qué entra |
| --- | --- | --- |
| Submission & Validation (C1) | API | Ingestión solo por upload; validación contra el job-type registry; **allowlist de tipo de input + sniffing de magic bytes**; acuñar `job_id` + creator token; filas plurales en `job_inputs` |
| Job Registry & Lifecycle (C2) | SHR | La máquina de 6 estados; transiciones solo por CAS; inmutabilidad terminal; tabla `attempts` real |
| Dispatch & Queue Ingress (C3) | API | Outbox transaccional + relay, contra un **broker detrás de un queue port**. Mecanismo decidido: **Redis Streams con consumer groups** (`ADR-0002`); el port mantiene el contrato del dominio agnóstico del broker |
| Worker Runtime & Lease (C4) | WKR | Claim + lease, renovación por heartbeat, dedupe por estado terminal antes de trabajar, commit fenceado |
| Job-Type Execution (C5) | WKR | Contrato de handler puro `(inputs[], params, scratch) -> outputs`; `audio.extract` vía ffmpeg; **doctrina de sandboxing** |
| Artifact & Storage Lifecycle (C6) | SHR | El storage port (ADR-0001), zonas inbox/work/artifacts, promote atómico, worker solo-lectura sobre inbox |
| Download Grant & Access Control (C8) | API | Autorización por capability (creator token hasheado), `createReadGrant`, el caso de respuesta "succeeded pero artefacto expirado" |

**No se toca en este slice:** C7 (progress/event stream) y C9 (DLQ/replay/reaper) quedan diferidos;
no aportan código acá.

### Mapa capability → spec

Los requisitos de cada capability viven en su propio directorio de spec bajo `specs/`. Este mapeo es
**normativo**: es cómo un lector va de un contexto delimitado a sus requisitos.

| Contexto | Capability | Spec |
| --- | --- | --- |
| C1 | Submission & Validation | `specs/submission-validation/spec.md` |
| C2 | Job Registry & Lifecycle | `specs/job-registry-lifecycle/spec.md` |
| C3 | Dispatch & Queue Ingress | `specs/dispatch-queue-ingress/spec.md` |
| C4 | Worker Runtime & Lease | `specs/worker-runtime-lease/spec.md` |
| C5 | Job-Type Execution | `specs/job-type-execution/spec.md` |
| C6 | Artifact & Storage Lifecycle | `specs/artifact-storage-lifecycle/spec.md` |
| C8 | Download Grant & Access Control | `specs/download-grant-access-control/spec.md` |
| C7, C9 | Diferidos — sin spec en este slice | — |

### Máquina de estados en v0.1

Los seis estados existen y son alcanzables. **Entran seis de diez transiciones; cuatro quedan
diferidas.**

| # | Transición | Dueño | ¿En v0.1? |
| --- | --- | --- | --- |
| T1 | `created` → `queued` | API | ✅ solo upload (sin la cláusula de URL) |
| T3 | `created` → `canceled` | API | ✅ un solo CAS, sin worker |
| T4 | `queued` → `running` | Worker | ✅ claim + lease |
| T5 | `queued` → `canceled` | API | ✅ sin lease activo |
| T6 | `running` → `succeeded` | Worker | ✅ fenceada, después del promote atómico |
| T7 | `running` → `failed` | Worker | ✅ **toda** falla observada por el lease holder — ambas clases commitean, distinguidas por `error_code`. "Retries exhausted" **no es alcanzable en v0.1**: T8 es el único camino de reintento y está diferido, así que `attempts_used` nunca puede pasar de 1 |
| T2 | `created` → `failed` (input TTL) | Janitor | ⛔ diferida (no hay janitor) |
| T8 | `running` → `queued` (lease expirado) | Reaper | ⛔ diferida (no hay reaper) |
| T9 | `running` → `canceled` (cooperativa) | Worker | ⛔ diferida |
| T10 | `queued` → `failed` (poison message) | Reaper | ⛔ diferida |

La inmutabilidad terminal se hace cumplir desde el día uno: `succeeded`, `failed` y `canceled` nunca
se abandonan. `canceled` tiene transiciones de entrada (T3, T5), así que es un estado alcanzable —
ver el razonamiento de AV5 bajo [Supuestos arrastrados](#supuestos-arrastrados-a-validar).

### Modelo de datos (tablas nuevas)

> **Esto no es el schema.** La tabla de abajo lista solo los campos notables y las decisiones que
> tienen pegadas. El DDL concreto — listas completas de columnas, tipos, constraints, índices — y el
> schema de Prisma se escriben en **design**.

| Tabla | Propósito | Notas clave |
| --- | --- | --- |
| `jobs` | Fuente de verdad | `job_id` (UUID, inadivinable), type, params, state, inmutabilidad terminal |
| `job_inputs` | Inputs plurales desde el día uno | PK `id`; **unique `(job_id, ordinal)`**, donde `ordinal` es la posición del input dentro del job (1, 2, …) y la clave de storage es `inbox/{job_id}/{ordinal}` |
| `attempts` | Acá vive la idempotencia | PK `id`; filas reales: `attempt_no`, `lease_owner`, `lease_expires_at`, inicio/fin, clase de error — **no** una columna contador |
| `submissions` | Registro del evento de submission | `idempotency_key`, unique `(client_id, key)`, y **`job_id` como clave foránea** — la submission *registra* el job resultante, no acuña el id. La API escribe `jobs`, `submissions` y la fila del outbox **en una sola transacción** |
| `artifacts` | Producto de bytes inmutable | `artifact_id`; **`storage_key`** — la clave canónica, o sea el puente hacia los bytes; `byte_size`, `content_type`, `checksum`, `filename` (solo display); `created_at`, `expires_at` (política de 7 días) |

**Todas las tablas llevan UUID como clave primaria.** La **base de datos nunca guarda los bytes**: la
fila de un artefacto es un puntero más metadata. Los bytes viven en el storage backend.

**`attempts_used` es derivado, nunca almacenado.** Cualquier guarda que lo necesite — por ejemplo la
de T4, `attempts_used < max_attempts` — lo computa desde la tabla `attempts` (`count(*)`, o
`max(attempt_no)` para ese job). Agregar una columna contador violaría la no-negociable #1.

### Storage (según ADR-0001)

- Un `StoragePort` con el adapter de filesystem local ahora; S3 como adapter coexistente después.
  `promote(ref) → ArtifactHandle`, `putScratch`, `createReadGrant`, `remove`.
- La inbox la escribe **solo la API**; el worker es **solo-lectura** sobre inbox (la ingestión por
  URL queda afuera).
- El upload streamea a disco, nunca bufferiza a memoria (ADR-0001 E4).
- La descarga usa `createReadGrant`; el adapter local devuelve `{ kind: 'proxy' }`, así que la API
  streamea el artefacto. Ningún path de storage ni credencial llega nunca al cliente.

### Contrato del handler

`(inputs[], params, scratch) -> outputs`, desde el día uno. La aridad es un valor del job-type
registry: `audio.extract` = 1, `pdf.merge` = N ≤ 20, `pdf.split` = 1. `audio.extract` afirma aridad 1.
Los handlers nunca tocan la DB, la cola, ni la clave canónica del artefacto.

---

## Impacto (Impact)

### Áreas afectadas

| Contexto | Cambio |
| --- | --- |
| C1 | Acepta solo archivos subidos; valida tipo declarado + magic bytes antes del dispatch |
| C2 | 6 estados, 6 transiciones, inmutabilidad terminal, tabla `attempts` |
| C3 | Outbox + relay detrás de un queue port (mecanismo: Redis Streams, `ADR-0002`) |
| C4 | Claim/lease/heartbeat, dedupe terminal, commit fenceado |
| C5 | Handler `audio.extract` con ffmpeg, sandboxeado, un job por proceso |
| C6 | Storage port + tres zonas, promote atómico, worker solo-lectura sobre inbox |
| C8 | Auth por capability, `createReadGrant`, respuesta "succeeded pero expirado" |
| C7, C9 | Sin código en este slice |

### Consecuencias transversales

- **Ningún estado nuevo más allá de los seis.** El caso del artefacto expirado es una *respuesta*, no
  un estado.
- **La cola es una notificación; Postgres es la verdad.** El worker nunca le cree a un message: lee
  la fila del job y decide a partir del estado.
- **La inmutabilidad terminal** hace que el replay (más adelante) acuñe un job nuevo, y nunca mute uno
  viejo.

---

## Scope (dentro)

1. `audio.extract` de punta a punta con bytes reales: upload → validate → dispatch → claim → ffmpeg →
   promote → download.
2. Las cuatro no-negociables: tabla `attempts` real, dedupe por estado terminal antes de trabajar,
   promote atómico, commit fenceado.
3. El modelo de 6 estados con las transiciones T1, T3, T4, T5, T6, T7.
4. Outbox transaccional + relay (agnóstico de la cola).
5. `job_inputs` plural, con la guarda de aridad declarada por el registry sobre T1.
6. Autorización por capability (`job_id` de 128 bits + creator token hasheado).
7. Política de retención de 7 días declarada; `artifacts.expires_at` escrito.
8. Allowlist de tipo de input + sniffing de contenido por magic bytes (aportado por el dueño).
9. Doctrina de sandboxing: **contenedor por worker** (rootfs solo-lectura, no-root, límites de
   recursos) con **un proceso por job** adentro; el proceso hijo handler corre sin red (aportado por
   el dueño).
10. Cap de tamaño de salida, declarado por job type en el registry y verificado **después del
    promote** y antes de que el outcome commitee; un artefacto que lo excede falla el job.

## Non-goals (fuera de este slice)

- **Reaper / janitor** — sin requeue por lease expirado (T8), sin falla por input-TTL (T2), sin
  poison message (T10), sin barrido de retención, sin barrido de artefactos huérfanos.
- **Dead-letter queue** y **replay** (C9).
- **Progress streaming** (C7) y cualquier payload de event stream.
- **Cancelación cooperativa mientras corre** (T9).
- **Job types 2 y 3** — `pdf.merge` y `pdf.split`.
- **Ingestión por URL pública** — v0.1 acepta solo archivos subidos (AV2).
- **Cuentas de usuario** — sin identidad, sin login, sin scheduling por tenant.
- **UI web** — sin UI en este slice.
- **Re-scheduling de retries / backoff** — T7 puede clasificar una falla, pero el re-despacho
  automático (T8) es trabajo del reaper y queda diferido.
- **Backpressure** — sin umbral de profundidad de cola y sin `429`/`503` en la submission. El
  crecimiento de la cola es ilimitado en este slice, y el rate limit por IP es la única válvula.
  `explore.md` §6 propuso un umbral de profundidad; diferirlo es deliberado, y queda registrado acá en
  lugar de perderse.

---

## Ítems decididos

### Decisiones de producto confirmadas (ronda de preguntas — no re-abrir)

**AV2 — La ingestión por URL pública queda diferida fuera de v0.1.** Solo archivos subidos.

- Toda la superficie de SSRF / DNS rebinding / revalidación por hop / política de egress sale de
  v0.1.
- R8 sale del camino crítico.
- El "upload or URL ingestion plan" de C1 pasa a ser **solo upload**.
- El trigger de T1 pierde su cláusula de URL.
- El worker pierde el acceso de escritura a la zona inbox (queda solo-lectura ahí).

**AV6 — Los inputs del job son plurales desde el día uno.**

- Una tabla `job_inputs` con unique `(job_id, ordinal)`; forma de la clave
  `inbox/{job_id}/{ordinal}`.
- La **aridad** por tipo es un valor del job-type registry (`audio.extract` = 1, `pdf.merge` = N ≤ 20,
  `pdf.split` = 1).
- El contrato del handler es `(inputs[], params, scratch) -> outputs` desde el día uno;
  `audio.extract` afirma aridad 1.
- La guarda de T1 pasa a ser: los handles de input existen, la cantidad coincide con la aridad
  declarada, y cada tamaño está bajo el cap (200 MB según ADR-0001 D5).

**AV1 — Sin cuentas de usuario en v0.1.** La autorización es una capability.

- Un `job_id` inadivinable de 128 bits más un creator token devuelto **una sola vez**, en la
  submission.
- El creator token es un secreto portador: se guarda **hasheado**, y **nunca se loguea** (ni el token
  ni la URL completa).
- El rate limit es **por IP**; la limitación de NAT compartida se registra honestamente en la spec.
- C8 autoriza por capability, nunca por identidad.

**AV4 — La retención está acotada a 7 días**, tanto para inputs como para artefactos.

- La política se declara en v0.1; la fila del artefacto lleva `expires_at`.
- El barrido real llega con el slice de hardening — **no hay janitor en el slice 1**.
- Los estados terminales son inmutables, así que cuando un job está `succeeded` pero su artefacto
  expiró, el job **sigue en `succeeded`**. Esto es un **caso de respuesta** nuevo, no un estado nuevo.
- El endpoint de descarga tiene que distinguir "succeeded pero artefacto expirado" de "failed".

### Requisitos aportados por el dueño (deben entrar como requisitos, no como notas al pie)

1. **Allowlist de tipo de input + sniffing de contenido.** Hacer cumplir los tipos de archivo
   declarados contra el job-type registry, y validar la firma real del archivo (magic bytes) en lugar
   de confiar en la extensión. Razón: con SSRF fuera de v0.1, el **contenido** hostil del archivo es
   el vector principal que queda — `explore.md` §6 cubre "contenedor malformado" pero nunca "tipo
   completamente equivocado".
2. **Sandboxing / contención del blast radius como doctrina.** Un allowlist reduce superficie, pero
   no contiene una CVE de códec. Un contenedor por worker con rootfs solo-lectura, usuario no-root y
   límites de recursos contiene el daño; un proceso nuevo por job evita que un job contamine a otro.
   El **proceso hijo handler** corre sin red — el worker no puede, porque necesita Postgres y la cola.

### Ya aceptado (input, no se re-litiga)

- **ADR-0001** — transporte de ingestión, storage port y camino de delivery. Supersede el cap de
  2 GiB de `explore.md` §6 para v0.1: el cap de input de `audio.extract` es **≤ 200 MB**, como valor
  del registry (D5). Este ADR es la autoridad para v0.1; `explore.md` es el snapshot preservado.

### Política de sandbox (decidida)

- **Un contenedor por worker** — efímero, rootfs solo-lectura, usuario no-root, límites de recursos.
  Esta es la frontera **host ↔ worker**, y es el sandbox.
- **Un proceso por job adentro.** Esta es la frontera **job ↔ job**.
- El **proceso hijo handler** (ffmpeg) corre **sin red**, no-root y con filesystem solo-lectura. El
  **worker en sí mantiene acceso de red limitado a Postgres y a la cola** — necesita ambos para hacer
  el claim y el commit. Decir "sin red" para el worker sería inimplementable.
- Docker está disponible (AV11 resuelto), así que esto es aplicable en v0.1. Se escala a
  contenedor-por-job solo si algún día un job pasa a ser código ejecutable arbitrario — hoy el trabajo
  es "correr ffmpeg sobre un archivo", y no lo es.

---

## Supuestos arrastrados a validar

Estos están **sin resolver** y se registran como supuestos a validar — nunca como hechos decididos.

| # | Supuesto | Recomendación registrada |
| --- | --- | --- |
| AV5 | Alcance de la cancelación | **Partir.** Dejar T3 (`created`→`canceled`) y T5 (`queued`→`canceled`) en v0.1 — cada una es un solo CAS sin participación del worker. Diferir T9 (`running`→`canceled`, cancelación cooperativa). **Razón:** eliminar toda la cancelación le daría a `canceled` cero transiciones de entrada, volviéndolo un estado inalcanzable — el mismo defecto que `explore.md` ya rechazó para `dead_lettered` y `retrying`. |
| AV7 | Orden de la cola | FIFO; sin prioridades ni fairness. |
| AV8 | UI web | No forma parte del primer slice. |
| AV9 | Forma del progreso | Puede ser por etiquetas de etapa en lugar de un porcentaje continuo para los tipos rápidos (atado a R6). |

Siguen abiertos desde `explore.md` §10 y se arrastran: **AV10** (presupuesto de 3 intentos con
backoff exponencial + jitter) — **inerte en v0.1**: con T8 diferido no hay camino de reintento, así
que el presupuesto nunca se puede consumir. Se vuelve significativo cuando aterrice el reaper.

**AV11 — RESUELTO.** Re-verificado en esta sesión: el daemon de Docker **sí** está corriendo (server
`29.6.2`, API `1.55`). Ya no es un bloqueante para el trabajo que dependa de compose. Precaución: hay
un contenedor ajeno corriendo (`tiendita-postgres`) — MediaForge debe usar **su propio** contenedor,
volumen y base de datos, nunca ése.

**AV12** (el worker siempre corre bajo `uv`; el `python` del PATH nunca es el runtime del proyecto).

**AV13 (nueva — aportada por el dueño). Descubrimiento de jobs.** Sin cuentas no hay identidad, y por
lo tanto no hay "mis jobs": un usuario no puede volver a encontrar un job salvo que el cliente haya
guardado localmente su `job_id` y su creator token. Registrada como pregunta de producto a resolver
en design. Opción principal para v0.1: almacenamiento del lado del cliente, con un endpoint de
listado autenticado por token diferido hasta que exista algo parecido a identidad.

---

## Decisiones abiertas

| Decisión | Estado | Quién/qué la cierra |
| --- | --- | --- |
| **Mecanismo de la cola** | **DECIDIDO — Redis Streams con consumer groups.** La familia de broker la eligió el dueño del proyecto; el mecanismo lo decidió `ADR-0002` tras la research R1/R3/R4. El dispatch y el consumo quedan detrás de un queue port y ningún vocabulario específico de broker entra en el contrato de este slice | `ADR-0002` (aceptado). Residual: confirmar por spike la superficie de API del cliente Python (`XREADGROUP`/`XACK`/`XAUTOCLAIM`) antes de implementar |
| Test runner | `unresolved-pending-design` | Fase de design (candidatos: Vitest / pytest / Playwright). No se decide acá. |
| Estrategia de entrega | `ask-on-risk`, presupuesto de review de 400 líneas | **Hace falta** una decisión de entrega — ver abajo. |

**Nota de entrega.** El slice A está estimado en ~800–950 líneas cambiadas, lo que excede el
presupuesto de review de 400 líneas — igual que todos los slices recomendados salvo B. Por lo tanto
hace falta una decisión de entrega (`ask-on-risk`) antes de que avancen design e implementación. Esta
propuesta **registra el requisito**; no elige una chain strategy ni infiere `size:exception` (que
requiere aceptación explícita).

---

## Superficie de arquitectura diferida a design

La propuesta fija el **qué** y el **por qué**. No especifica **cómo está armado el sistema**. Lo
siguiente queda deliberadamente diferido a `sdd-design`, listado acá para que el diferimiento sea
**rastreado** en lugar de leerse como una omisión:

| # | Ítem diferido | Constraint ya registrado |
| --- | --- | --- |
| 1 | Topología de procesos — cuántos procesos, qué corre dónde | La decisión de sandbox de arriba: un contenedor por worker, un proceso por job |
| 2 | Estructura de repositorio / módulos — dónde viven el storage port, el queue port y el contrato compartido | Los contextos delimitados y sus lanes (API / WKR / SHR) son las fronteras a respetar |
| 3 | Acceso a la base desde **dos lenguajes** | **Prisma es la preferencia de ORM (TypeScript).** Prisma no tiene cliente Python, así que el worker necesita su propio camino a Postgres — ver el fork de abajo |
| 4 | Dueño de las migraciones | **Exactamente uno.** O Prisma es dueño de las migraciones, o lo es el lado Python — nunca los dos, o el schema driftea |
| 5 | Mecánica del contrato TS ↔ Python | Dirección ya registrada en `project.md`: contrato JSON versionado, zod del lado Node, pydantic del lado Python |
| 6 | Configuración, secretos, observabilidad | Los creator tokens y las credenciales de DB nunca deben llegar a los logs (AV1) |

### El fork arquitectónico que esto destapa

`C2` (Job Registry & Lifecycle) es lane **SHR** — compartida. Las transiciones **T4, T6 y T7 las posee
el worker**, que corre en **Python**. La invariante *"toda transición es un único
`UPDATE ... WHERE id = ? AND state = ?`"* se implementa, por lo tanto, **dos veces, en dos lenguajes**,
y **la garantía de fencing vive en la mitad Python**.

> Este es el riesgo más grande y más innombrado del proyecto: si las dos implementaciones del CAS
> divergen, el fencing deja de funcionar en silencio y ningún test lo detecta.

| Opción | Cómo | Trade-off |
| --- | --- | --- |
| El worker escribe Postgres directamente | Python ejecuta su propio CAS | Menos saltos. Costo: **la invariante existe dos veces** y tiene que mantenerse semánticamente idéntica |
| **La API es el único escritor** | El worker pide claim/commit por HTTP | **Una sola implementación del CAS** (Prisma). Costo: la API entra en el camino de latencia de cada claim y cada commit, y la máquina de estados pasa a estar detrás de una frontera HTTP |

Design elige una y la registra como ADR.

### Estrategia de UUID

Prisma soporta `uuid(7)`, pero **`uuid()` es a nivel del ORM**: lo genera Prisma Client y no lo genera
la base. Si la API genera ids vía Prisma mientras el worker genera los suyos, el sistema termina con
**dos generadores de id**. La forma de fuente única es `@default(dbgenerated("uuidv7()")) @db.Uuid`,
que deja que **PostgreSQL 18** genere el UUIDv7 — y el contenedor que ya está corriendo es Postgres 18.

Una consecuencia a aceptar conscientemente: un UUIDv7 tiene embebido un timestamp de milisegundos,
así que un `job_id` usado directamente como capability filtra *cuándo* se creó el job. Quedan 74 bits
aleatorios — infactible de adivinar, pero no son 122. Si se requiere cero fuga, hay que llevar un
`public_id` UUIDv4 aparte para la URL.

---

## Riesgos

| Riesgo | Probabilidad / impacto | Mitigación |
| --- | --- | --- |
| El slice A nunca sobrevive un crash (sin reaper → un worker muerto deja el job en `running`) | Aceptado, por diseño | Las cuatro no-negociables están dentro; C-hardening (reaper, retry, DLQ) es el segundo slice recomendado |
| Una falla transitoria **falla** el job en lugar de reintentarlo | Aceptado, por diseño | Ambas clases de falla commitean T7 en v0.1, distinguidas por `error_code`. Reintentar es imposible sin un reaper (T8), y no commitear *nada* dejaría el job trabado o produciría una tormenta de reentregas; fallar es la opción honesta, y la clase retryable pasa a T8 cuando aterrice el reaper |
| Las dos implementaciones del CAS (TS y Python) divergen y el fencing falla en silencio | Media / impacto alto | Decisión arquitectónica explícita en design; cubierto por strict TDD en la guarda del commit |
| La superficie de API del cliente Python (`XREADGROUP` / `XACK` / `XAUTOCLAIM`) no está verificada | Baja | El mecanismo es el camino Python documentado por Redis (la doc oficial trae un caso de uso de streaming con redis-py). Confirmar la superficie de API y registrar la versión con un spike chico antes de implementar — `ADR-0002`, riesgo residual |
| La salida de ffmpeg no es bit-idéntica entre builds | Media | Aseverar *propiedades* del artefacto (duración, códec, bitrate vía ffprobe), nunca hashes |
| 200 MB streameados por la API | Media | Stream a disco (ADR-0001 E4); nunca bufferizar a memoria; el cap es un valor del registry |
| Un archivo hostil de tipo equivocado llega a ffmpeg | Media | Allowlist + sniffing de magic bytes en C1 (requisito aportado por el dueño) |
| Una CVE de códec se ejecuta a pesar del allowlist | Baja / impacto alto | Doctrina de sandboxing: contenedor por worker (rootfs solo-lectura, no-root, límites de recursos) + un proceso por job; el hijo handler corre sin red |
| El rate limit por IP bloquea de más detrás de NAT compartida | Baja | Registrado honestamente como limitación documentada |
| Error de implementación del fencing (un escritor viejo commitea) | Baja / impacto alto | El commit es un único CAS sobre `lease_owner = me AND state = 'running'`; cubierto por strict TDD |

---

## Rollback

Esto es trabajo greenfield y aditivo, sin schema previo ni entorno desplegado que restaurar. El
rollback es un `git revert` del change; las zonas del filesystem local (`inbox/`, `work/`,
`artifacts/`) son descartables y se recrean, y no hay datos de producción en riesgo. No hay migración
de datos que revertir — este slice crea el primer schema.

---

## Criterios de éxito

- [ ] Un reviewer puede subir un video y descargar un mp3 real, de punta a punta, sin pasos manuales.
- [ ] El producer en TS y el consumer en Python interoperan a través de la cola (paridad de contrato probada con bytes reales).
- [ ] Existe una fila en `jobs` antes de aceptar cualquier byte; la guarda de T1 chequea existencia del handle, aridad declarada, y el cap de 200 MB.
- [ ] La tabla `attempts` es una tabla real (no una columna contador) y lleva `lease_owner` y `lease_expires_at`.
- [ ] `attempts_used` se computa desde la tabla `attempts`; no existe ninguna columna contador.
- [ ] Un job terminal se dedupea **por estado** — un message reentregado se ackea sin trabajar.
- [ ] La clave canónica del artefacto solo es alcanzable vía promote atómico; no hay bytes parciales legibles ahí.
- [ ] Un lease holder viejo nunca puede commitear (fencing enforced).
- [ ] Los estados terminales son inmutables; el replay (más adelante) acuña un job nuevo.
- [ ] Un input de tipo equivocado (extensión renombrada) se rechaza antes del dispatch vía chequeo de magic bytes.
- [ ] El worker corre en un contenedor con rootfs solo-lectura, no-root y límites de recursos; un proceso por job; el hijo handler sin red.
- [ ] El endpoint de descarga distingue "succeeded pero artefacto expirado" de "failed" y nunca devuelve un path de storage ni una credencial.
- [ ] El creator token se guarda hasheado y nunca aparece en logs.

---

## Referencias

- `openspec/changes/audio-extract-vertical-slice/explore.md` — snapshot de exploración (preservado, sin editar).
- `openspec/changes/audio-extract-vertical-slice/design/adr-0001-ingestion-storage-port-delivery.md` — aceptado.
- `openspec/changes/audio-extract-vertical-slice/design/adr-0002-queue-mechanism.md` — aceptado. Decide el mecanismo de cola y registra las variantes de BullMQ rechazadas.
- `openspec/changes/audio-extract-vertical-slice/design/research-queue-r1-r3-r4.md` — la evidencia detrás de `ADR-0002`, con la calidad de fuente ítem por ítem.
- `openspec/glossary.md` — vocabulario canónico; las entradas `[+]` se arrastran acá como requisitos.
- `openspec/project.md` — contexto vivo del proyecto.
- `openspec/config.yaml` — configuración de delivery/testing.
