# Investigación — comportamiento de la cola R1, R3, R4

> **Copia de estudio en español.** Este archivo es una copia de estudio en español de [`research-queue-r1-r3-r4.md`](./research-queue-r1-r3-r4.md).
> **El original en inglés es canónico**: si difieren, prevalece `research-queue-r1-r3-r4.md`.
> Este archivo **se regenera** desde el original; no se edita de forma independiente.
>
> Los **términos técnicos de arte se mantienen en inglés** (`job`, `message`, `attempt`, `retry`, `lease`, `heartbeat`, `reaper`, `janitor`, `outbox`, `relay`, `fencing`, `promote`, `handler`, `capability`, `artifact`, `CAS`, `dead-letter`, `replay`, `consumer group`, `pending`, `backoff`, `jitter`, `poison message`). Son el vocabulario que usan el diseño, el código y la entrevista; traducirlos ocultaría justo lo que el lector necesita aprender. La prosa, los encabezados y las explicaciones van en español.

**Fecha:** 2026-09-16
**Change:** `audio-extract-vertical-slice`
**Propósito:** tomar la decisión del mecanismo de cola en `ADR-0002` respaldada por evidencia en lugar de basada en preferencias. `explore.md` §9 planteó estas preguntas como sin respuesta y afirmó que *"None of these are answered here from memory."*
**Realizado por:** el padre orquestador. Un hijo de investigación delegado devolvió `documentation: blocked; tools=[]` y `open-web: blocked; tools=[]` — las capacidades de investigación no se heredan al hijo en este runtime — y correctamente **se negó a responder de memoria**.

> **Titular:** la premisa registrada en `project.md` — *"BullMQ is awkward to consume from Python, which motivates this direction"* — **no está respaldada por la documentación del proveedor actual**. BullMQ publica una **librería oficial de Python**, y el proveedor afirma que las colas en Python y Node son **interoperables** porque comparten los mismos scripts Lua. Ver [R4](#r4--soporte-del-cliente-python-y-el-par-typescriptpython).

---

## R1 — Recuperación de claim bajo Redis Streams

**Hallazgo.** La recuperación de una entrada pending no-acked es un mecanismo de primera clase, documentado, y la documentación oficial establece explícitamente la garantía de single-claimer.

**Evidencia** — Referencia de comandos de Redis (documentación oficial):

| Hecho | Fuente |
| --- | --- |
| `XAUTOCLAIM key group consumer min-idle-time start [COUNT count] [JUSTID]`, **available since Redis Open Source 6.2.0** | *XAUTOCLAIM* — redis.io/docs/latest/commands/xautoclaim/ |
| *"claiming a message resets its idle time. This ensures that **only a single consumer can successfully claim a given pending message at a specific instant of time** and trivially reduces the probability of processing the same message multiple times."* | same page |
| `min-idle-time` is in **milliseconds**; the official example uses `3600000` (one hour) | same page |
| Claiming **increments the attempted-deliveries count**, *"unless the `JUSTID` option has been specified"*. *"Messages that cannot be processed for some reason — for example, because consumers systematically crash when processing them — will exhibit high attempted delivery counts that can be detected by monitoring."* | same page |
| Entries that no longer exist in the stream (trimmed or `XDEL`ed) are **not claimed and are removed from the PEL** — *"This feature was introduced in Redis 7.0."* | same page |
| `COUNT` defaults to 100, and the command scans at most `count × 10` PEL entries per call, so *"the number of entries claimed will be less than the specified value"* | same page |

**Hallazgo adicional no anticipado por el planteo de R1 — `XNACK`.** Redis expone `XNACK key group <SILENT | FAIL | FATAL> IDS numids id … [RETRYCOUNT count] [FORCE]`, que permite a un consumidor *"explicitly release pending messages back to the group's Pending Entries List (PEL) without acknowledging them"*, haciéndolas *"immediately available for re-delivery to other consumers, **eliminating the idle-timeout delay normally required for message recovery**"*. Los tres modos ajustan el contador de entregas: `SILENT` lo decrementa, `FAIL` lo deja igual, y **`FATAL` lo fija al máximo, marcando el message como permanentemente fallido — documentado como el modo para *"invalid or suspected malicious messages"*.**

- **Restricción de versión:** `XNACK` está documentado como **available since Redis Open Source 8.8.0**.
- **Restricción de despliegue:** su propia tabla de compatibilidad lista **❌ Redis Software** y **❌ Redis Cloud** — es un comando exclusivo de Redis open source.
- Fuente: *XNACK* — redis.io/docs/latest/commands/xnack/

**Confianza.** Alta para `XAUTOCLAIM` (referencia primaria de comandos). Alta para la existencia y semántica de `XNACK`; **más baja para su disponibilidad práctica**, porque un comando muy reciente sin soporte de Redis Software/Cloud puede estar ausente de las distribuciones que use un despliegue. No verificado: si el cliente Python que usaríamos expone `XNACK` en absoluto.

**Decisión que resuelve.** Un worker en Python *puede* ser dueño de la recuperación de claims con semánticas documentadas bajo Redis Streams: `XAUTOCLAIM` puede usarse como el camino de recuperación, su garantía de single-claimer es explícita, y su contador de entregas da una señal de poison a nivel de broker. Crucialmente, **el camino de reclaim del broker no reemplaza el lease de Postgres** — `XAUTOCLAIM` recupera un *message*, mientras que el estado `running` del job y su lease son asunto de la base de datos. Los dos deben reconciliarse, no confundirse.

---

## R3 — Reintento diferido nativo

**Hallazgo.** La respuesta difiere fuertemente según el mecanismo, e invierte la premisa de que el delay debe vivir siempre en Postgres.

| Mecanismo | Delay/backoff nativo | Costo y advertencias |
| --- | --- | --- |
| **Raw Redis Streams** | **No delay primitive was found** among the stream commands examined (`XADD`, `XREAD`, `XREADGROUP`, `XACK`, `XPENDING`, `XCLAIM`, `XAUTOCLAIM`, `XNACK`, `XDEL`, `XTRIM`). Delay must be implemented outside the broker | El scheduling de retry viviría en Postgres como `available_at`, o se re-implementaría en código de aplicación |
| **BullMQ (over Redis)** | **Yes — `delayed jobs` y `job backoff` están listados como features portadas de la librería oficial de Python** | El delay es una *library* feature construida sobre Redis, no una primitiva de Redis; adoptarla significa adoptar el data model de BullMQ |
| **RabbitMQ** | Per-message delay históricamente vía el plugin `x-delayed-message` | **That plugin is archived and is reported not to load on RabbitMQ 4.3+**, porque fue construido sobre Mnesia, *"which was completely removed from RabbitMQ in the 4.3.0 development cycle"*. El camino portable es TTL + dead-letter exchange, que según fuentes secundarias requiere una cola separada por duración de delay |

**Evidencia.**

- BullMQ Python feature list, README oficial del repositorio (`github.com/taskforcesh/bullmq/blob/master/python/README.md`) y `pypi.org/project/bullmq/`: *"Add jobs to queues — Regular jobs. **Delayed jobs.** Job deduplication. Job priority. Repeatable … Job retries. **Job backoff.** … Lock Manager (batched lock renewal)."*
- RabbitMQ: el texto citado arriba se atribuye al repositorio `rabbitmq/rabbitmq-delayed-message-exchange`. **Advertencia de calidad de fuente: esto se leyó de una atribución en resultado de búsqueda a ese repositorio, no se obtuvo directamente de la página.** Las fuentes secundarias concuerdan, pero el claim merece un fetch directo antes de ser citado en un ADR.
- La afirmación *"no hay primitiva de delay en Redis Streams"* es **ausencia de evidencia, no una negativa documentada**: se obtuvieron cuatro páginas de comandos de stream, no el set completo de comandos. Trátela como una pista fuerte, no como probada.

> **Corrección a una afirmación anterior en esta sesión.** Le dije al dueño del proyecto que elegir Redis significa *"retry scheduling must live in `jobs.available_at` in Postgres, because Redis Streams has no native delayed retry."* Eso es cierto para **raw Redis Streams** y **falso para BullMQ**, que provee delayed jobs y backoff en ambas sus librerías Node y Python. Cuál de los dos elegimos decide esto, así que la afirmación fue prematura.

**Confianza.** Alta de que BullMQ provee delayed jobs y backoff en Python (official repo + PyPI). Media sobre el archivo del plugin de RabbitMQ (atribución secundaria). Baja como prueba de la negativa para raw Redis Streams.

**Decisión que resuelve.** Si el scheduling de retry vive en el broker o en una columna `available_at` de Postgres. Precisamente: **raw Streams → Postgres; BullMQ → el broker puede retenerlo.** Nótese que es parcialmente inerte para el primer slice, donde T8 está diferido y no ocurre retry en absoluto.

---

## R4 — Soporte del cliente Python y el par TypeScript/Python

**Hallazgo — este es el consecuencial.** BullMQ publica una **librería oficial de Python**, y el proveedor afirma que **las colas en Python y Node son interoperables**.

**Evidencia.**

| Hecho | Fuente |
| --- | --- |
| *"This is the **official BullMQ Python library**. It is a close port of the NodeJS version of the library. **Python Queues are interoperable with NodeJS Queues, as both libraries use the same .lua scripts** that power all the functionality."* | `github.com/taskforcesh/bullmq` → `python/README.md` (Taskforce.sh Inc.), y el mismo texto en `pypi.org/project/bullmq/` |
| Última distribución observada: **`bullmq-3.2.2-py3-none-any.whl`, uploaded 2026-09-14** — dos días antes de esta investigación | `pypi.org/project/bullmq/` file metadata |
| *"In order to consume the jobs from the queue you need to use the `Worker` class, providing a 'processor' function"* | `docs.bullmq.io/python/introduction` (documentación oficial) |
| Ported features include **workers, job events, job progress, job retries, job backoff, delayed jobs, job deduplication, Flow Producer, Lock Manager (batched lock renewal), global concurrency and rate limit, and per-job cancellation (cooperative `AbortController`)** | official Python README |
| Explicit limitation: *"Currently, the library does not support all the features available in the NodeJS version."* The README lists what **is** ported; which features are **missing** is not enumerated | official Python README |
| BullMQ markets first-class support across *"Node.js, Bun, Python, Rust, Elixir, and PHP"* | `bullmq.io` |

**Qué refuta esto.** `project.md` registra, bajo *Open decisions and assumptions*:

> *"Contract layer | Working direction: JSON versioned contract, zod on Node side, pydantic on Python side. **BullMQ is awkward to consume from Python, which motivates this direction.**"*

Y la propuesta aprobada nombra la misma premisa como la incógnita más riesgosa del proyecto:

> *"The **TS ↔ Python queue crossing** is the riskiest unknown | `project.md` already flags that BullMQ is awkward to consume from Python."*

**Ninguna de estas afirmaciones está respaldada por la documentación del proveedor actual.** El cruce TS↔Python sobre BullMQ es un camino *soportado, documentado y mantenido por el proveedor*, no uno incómodo. La premisa que motivó una parte sustancial de la dirección del contract layer no sobrevive el contacto con las fuentes.

**Advertencias importantes — el hallazgo no hace que BullMQ sea automáticamente correcto.**

1. **El port de Python es un subconjunto documentado.** *"does not support all the features available in the NodeJS version."* El README enumera lo que está presente, no lo que falta, así que la brecha es desconocida sin trabajo adicional.
2. **La interoperabilidad es una afirmación del proveedor**, respaldada por el argumento de scripts Lua compartidos. Es vendor-primary, pero sigue siendo una afirmación a verificar en la práctica con un productor real en TS y un consumidor en Python antes de confiar en ella.
3. **Adoptar BullMQ adopta su data model.** BullMQ ya implementa leases y lock renewal (`Lock Manager`, batched lock renewal) y sus propios estados de job. Eso se superpone con la tabla `attempts`, lease y fencing de este proyecto — así que la interacción entre la maquinaria de confiabilidad *de BullMQ* y la *nuestra* debe razonarse explícitamente. Dos sistemas de idempotencia en un mismo pipeline es un peligro real, no una victoria gratis.
4. **BullMQ es TypeScript-first.** La librería de Python es un port, así que el lado Python sigue al lado Node en lugar de liderarlo.
5. **BullMQ no se verificó desde el lado de `redis-py`**: si `redis-py` ofrece la superficie de API de consumer group, ack y claim (incluyendo `XAUTOCLAIM`) con una API documentada y actual no se estableció aquí tan directamente como se hizo con la historia de Python de BullMQ.

**Confianza.** Alta de que la librería oficial de Python existe, está mantenida (release dos días antes de esta nota), y está documentada como interoperable con Node. Alta de que la premisa de `project.md` no está respaldada. Media sobre la suficiencia práctica del port de Python para las necesidades de este proyecto, porque la lista de features faltantes no está publicada.

**Decisión que resuelve.** **La rama BullMQ es viable, no excluida.** El razonamiento que hizo a Redis Streams el único candidato — "BullMQ no puede consumirse desde Python" — es nulo. La elección de mecanismo debe hacerse ahora sobre otras bases: superposición con nuestra propia maquinaria de lease/fencing, el valor de los delayed jobs y backoff de BullMQ, el riesgo del subconjunto portado, y restricciones de despliegue como la ausencia de `XNACK` de Redis Cloud.

---

## Qué cambia esta investigación (What this research changes)

| # | Artefacto | Qué está ahora equivocado o resuelto |
| --- | --- | --- |
| 1 | `project.md` — contract-layer rationale | La premisa *"BullMQ is awkward to consume from Python"* es **no respaldada**. Es la motivación declarada para la dirección del contract layer |
| 2 | `proposal.md` — tabla Why | La misma premisa, nombrada como *"la incógnita más riesgosa"*. El riesgo no sobrevivió la evidencia |
| 3 | `ADR-0002` (aún no escrito) | Puede ahora elegir entre **BullMQ** y **raw Redis Streams** sobre bases reales, siendo el trade-off la *superposición con nuestro propio lease/fencing* versus *un retry diferido a nivel de librería que de otro modo construiríamos* |
| 4 | Afirmación anterior en esta sesión | El claim *"choosing Redis means retry scheduling must live in Postgres `available_at`"* solo vale para raw Streams |

## Preguntas abiertas que esta investigación no cerró

- Qué features le **faltan** al port de Python de BullMQ — no está publicado; haría falta el changelog, el issue tracker, o un spike.
- Si `redis-py` expone consumer-group read, ack y claim (incluyendo `XAUTOCLAIM`) con una API documentada y actual. La documentación oficial de Redis sí contiene una página de caso de uso *"Redis streaming with redis-py"* que usa `XREADGROUP`/`XACK` y recupera entregas atascadas con `XAUTOCLAIM`, lo cual es evidencia oficial fuerte — pero la referencia de API de redis-py misma **no** se obtuvo.
- Si `XNACK` está expuesto por algún cliente Python actual.
- El claim de archivo del plugin de RabbitMQ, que necesita un fetch directo antes de que un ADR lo cite.
