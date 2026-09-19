# Feature — `openpencil-setup` (instalar la herramienta de diseño y confinar el servidor MCP a un directorio)

> **Copia de lectura en español.** El documento canónico es `openpencil-setup.md` (inglés); si divergen,
> manda el inglés. **Los bloques de código son idénticos a los del inglés, byte a byte** (se comparan con
> un diff): son salida cruda de comandos, y traducirla sería falsificarla. Lo que está traducido es la prosa.

**Workflow:** Organic Driven Development (ODD).
**Fuente de verdad de los requisitos:** las decisiones abiertas en `odd/tasks/frontend-style.md` — *Fuera
de alcance* nombró la instalación como feature separada con su propia aceptación en runtime, y *Next step*
la nombró como elección del supervisor. Esta feature ejecuta eso, y la restricción dura del ADR sobre
`OPENPENCIL_MCP_ROOT` es criterio de aceptación acá, no una nota.
**Estado:** `closed` — creada y cerrada el 2026-09-19 en `chore/openpencil-setup`, un commit por encima
de `73e6994`, la corrección del ADR de la que depende. Cuatro de las seis tareas están verificadas en
runtime; la tarea 1.5 está abierta a propósito y lo dice. Este documento no declara su propio hash de commit:
no puede citar el commit que lo contiene, la misma frontera que registró `frontend-style` §1.5.

---

## Por qué existe esta feature

Un documento de decisión no es una herramienta. `frontend-style` eligió OpenPencil y fijó el pipeline, y
registró la instalación explícitamente fuera de alcance por una razón: **seleccionar una herramienta e
instalarla fallan distinto.** La primera falla como juicio; la segunda falla como un comando roto, un
binario ausente, una versión que ya no coincide con los schemas que la decisión asumió o —lo peor—
silenciosamente, cuando la herramienta funciona pero el confinamiento por el que fue elegida no se sostiene.

Por eso el requisito de seguridad es el entregable acá y no una nota al pie. El servidor MCP de OpenPencil
es una superficie de agente con acceso a filesystem, y **en Windows defaultea su root al directorio home**
cuando el root no está seteado. Cablearlo sin un root confinado le habría entregado `~/` a un agente, en un
repositorio que ya había borrado la superficie de SSRF a propósito en `ADR-0001`. Dos de las cinco tareas de
esta feature existen para volver esa afirmación medible en vez de declarada.

La segunda razón es el problema de honestidad del propio ADR. `frontend-style` afirmaba que bun estaba
presente en 1.3.14 — una afirmación que su autor (esta sesión) copió de `openspec/project.md` sin medirla.
Estaba mal, y el modo en que estaba mal es instructivo: `openspec/project.md` está obsoleto en al menos tres
lugares, y un documento que cita a un documento obsoleto hereda la obsolescencia mientras *parece* verificado.
La tarea 1.4 corrige eso en el ADR, dejando el texto original.

## Restricciones (no negociables)

- **Strict TDD.** Modo `strict`; fuente `openspec/config.yaml:58`. **No aplica ciclo RED a los archivos de
  repositorio que esta feature cambia** — son Markdown y un JSON de configuración, y no existe comportamiento
  para el cual escribir un test que falle. Esa exención parcial se declara con precisión, porque esta feature
  *no* está libre de chequeos en runtime: la instalación y el confinamiento tienen criterios de aceptación
  reales abajo, y se corrieron antes de que este documento afirmara nada.
- **Versiones pineadas.** `@open-pencil/cli` y `@open-pencil/mcp` se instalan en `0.15.1`, que es la versión
  que describen las mediciones del ADR. Este repositorio pinea sus linters por la razón de que *un gate cuya
  herramienta deriva es un gate cuyo significado deriva*; una herramienta de diseño cuyos schemas son la
  interfaz merece el mismo trato.
- **Ninguna integridad sin verificar.** **No** se usó `https://bun.sh/install`. Ver §1.2.
- **El confinamiento es criterio de aceptación, no documentación.** Una llamada de herramienta que nombre una
  ruta fuera del root tiene que ser rechazada, y el rechazo tiene que quedar registrado. §1.3 muestra el
  rechazo **y** un control dentro del root — porque un chequeo que solo pasa no prueba nada, que es el defecto
  D1 de este repositorio.
- **No se instala nada del lado Windows, y no se arranca nada en nombre del usuario.** La aplicación de
  escritorio la lanza el usuario; el propio texto de error del servidor lo dice explícitamente.
- **El documento en inglés es canónico.** La copia `.es.md` se regenera; los bloques en fence quedan idénticos
  byte a byte.

## Decisiones tomadas con el supervisor (2026-09-19)

| # | Decisión | Valor | Base |
| --- | --- | --- | --- |
| D1 | Toolchain | **Instalar bun en WSL** y después seguir el ADR al pie de la letra (`bun add -g`), en vez de sustituir por npm o `npx` — aunque npm se midió y funcionaba. | supervisor, sobre las opciones ofrecidas |
| D2 | Root confinado | **`apps/web/design`** — local al repo, así los mockups se versionan y por lo tanto son evidencia de portfolio, que `project.md` nombra como objetivo rector. | supervisor |
| D3 | Alcance | La instalación, la configuración y los archivos de repositorio que necesita. **No** un estilo, no un scaffold, no un mockup. | heredado de `frontend-style` D4 |

## Lo que se instaló, medido

| Cosa | Valor | Cómo se sabe |
| --- | --- | --- |
| `bun` | **1.4.2** | `~/.bun/bin/bun --version` después de una instalación verificada |
| `@open-pencil/cli` | **0.15.1**, binario `openpencil` | `openpencil --version` |
| `@open-pencil/mcp` | **0.15.1**, binarios `openpencil-mcp`, `openpencil-mcp-http` | el handshake `tools/list` devuelve `serverInfo.version` |
| postinstall de `core-js` | **bloqueado, a propósito** | `bun pm -g untrusted` lo nombra; es `require('./postinstall')`, un banner de donación, así que bloquearlo no cuesta nada |

También se midieron tres cosas de la máquina, y cada una contradice `openspec/project.md`:

| `project.md` dice | Medido |
| --- | --- |
| `node v25.2.1` | **v25.9.0** |
| `bun 1.3.14` | **ningún bun en absoluto** en WSL — `~/.bun/bin` existía y estaba vacío; solo `bun.exe` del lado Windows |
| Docker CLI 29.6.2, daemon corriendo | **`docker` no está presente** en esta distro de WSL |

## La configuración, y por qué se commitea

`.mcp.json` en la raíz del repositorio, con un root **relativo**:

```json
{
  "mcpServers": {
    "open-pencil": {
      "command": "bun",
      "args": ["x", "openpencil-mcp"],
      "env": {
        "OPENPENCIL_MCP_ROOT": "apps/web/design"
      },
      "lifecycle": "lazy"
    }
  }
}
```

Cuatro elecciones deliberadas, cada una medida en vez de asumida:

1. **Relativo, no absoluto.** Medido: `OPENPENCIL_MCP_ROOT=opnroot` con cwd `/tmp` resolvió a `/tmp/opnroot`
   y el confinamiento se sostuvo. Un root relativo hace que la configuración sea **idéntica en todos los
   worktrees**, que es lo que vuelve correcto commitearla en vez de meramente cómodo. Una ruta absoluta habría
   clavado un layout de máquina dentro de un archivo compartido, y este repositorio tiene dos worktrees vivos hoy.
2. **Commiteada, no global a la máquina.** Un archivo commiteado es revisable, viaja con la rama, y documenta
   el confinamiento a quien lea el diff. Una entrada en `~/.pi/agent/mcp.json` no se lo documenta a nadie.
3. **`bun x`, no `bunx`.** Medido: **`bunx` no existe** en bun 1.4.2 — `~/.bun/bin` contiene `bun`,
   `openpencil`, `openpencil-mcp`, `openpencil-mcp-http` y nada más. La forma de entrada que documenta el
   skill de agentes de la propia OpenPencil (`{"command":"bunx"}`) habría fallado en el primer arranque. Es la
   clase de detalle que es invisible hasta que deja de serlo, y es el argumento para correr la aceptación en
   vez de escribirla.
4. **`lifecycle: lazy`.** El servidor se levanta bajo demanda. Medido: arranca bien incluso cuando el root no
   existe y falla recién en la llamada de herramienta, así que un checkout sin `apps/web/design` no puede
   romper una sesión por el solo hecho de tener la configuración.

**También existe una entrada puente en `~/.pi/agent/mcp.json`**, con root absoluto apuntando al worktree
principal, porque Pi resuelve la configuración de proyecto desde el cwd *de la sesión* — que en esta sesión es
el worktree principal, donde el `.mcp.json` de esta rama todavía no existe. Esa entrada es de alcance máquina
por naturaleza, así que una ruta absoluta es correcta ahí y equivocada en el archivo commiteado. **Debería
eliminarse cuando esta rama se mergee**, y la tarea 1.5 lo registra: dos fuentes para un mismo servidor son una
trampa, no un cinturón y tirantes.

## Delivery

- **Estrategia:** `single-pr`. Una unidad de trabajo, una rama, apilada sobre `docs/frontend-style-decision`
  porque esta feature implementa ese ADR y lo cita por archivo; la base del PR es esa rama, así un revisor ve
  la instalación y no el documento de decisión otra vez.
- **Pronóstico:** los archivos de repositorio son `826` líneas autoradas en el par de
  documentos (`414` en inglés, `412` en español) — el espejo español es `49.9%`
  del costo, que es la constante medida de este repositorio por quinta feature consecutiva. La instalación en sí
  no aporta líneas de repositorio; cambia la máquina.
- **Fronteras de slice:** ninguna. Hay un archivo de configuración, un directorio y un par de documentos.
- **No entregado:** ningún valor de estilo, el scaffold de Next.js, un mockup y la skill de estilo. Ver
  *Fuera de alcance*.

## Tareas

### 1.1 — Instalar el toolchain, verificado, y pinearlo · owner: AI

Instalar `bun` y los dos paquetes en `0.15.1`, sin aceptar el modelo de integridad del instalador del vendor.

**Aceptación:** `bun --version`, `openpencil --version` y un handshake MCP `tools/list` registrados en §1.2,
con el hash del artefacto que se verificó antes de colocar el binario.

### 1.2 — Probar que el CLI funciona headless, de punta a punta · owner: AI

No `--help`: un documento real. HTML entra, `.fig` sale, se lee de vuelta, se exporta.

**Aceptación:** el `.fig` producido existe con tamaño distinto de cero, `info` y `tree` lo leen, y un export
produce un artefacto no vacío — todo sin ninguna aplicación corriendo.

### 1.3 — Probar el confinamiento, con un control · owner: AI

Dos llamadas `open_file` a través del servidor MCP: una fuera del root, una dentro.

**Aceptación:** la llamada de afuera se rechaza por nombre, **y** la de adentro se comporta distinto. Un test
que no puede distinguir las dos no es un test de confinamiento.

### 1.4 — Corregir el ADR que la medición refutó · owner: AI

`frontend-style` afirmaba que el MCP era headless y que bun estaba presente en 1.3.14. Ambas son falsas. La
corrección aterriza en esa rama como su propia unidad de trabajo, sobre el precedente de `odd-doc-structure`
§1.3a.

**Aceptación:** el ADR carga las correcciones con su texto original preservado y etiquetado; las afirmaciones
equivocadas siguen siendo legibles; y el bloque de chequeos del ADR ya no queda obsoleto con cada edición.

### 1.5 — Registrar lo que *no* se verificó · owner: AI

La mitad honesta. Tres cosas quedan abiertas y se escriben en vez de insinuarse: si el servidor del lado WSL
puede alcanzar una app del lado Windows; si la superficie HTTP de auto-arranque es alcanzable cruzando esa
frontera; y el hecho de que esta sesión todavía ve el servidor como ausente porque Pi lee la configuración MCP
al arrancar.

**Aceptación:** §1.5 nombra cada pregunta abierta, qué la resolvería, y qué se afirma mientras tanto. **Esta
tarea está `[ ]`** — es una pregunta abierta por construcción, no una tarea sin terminar, y marcarla `[x]`
afirmaría una verificación que no existe.

### 1.6 — Verificar este par de documentos mecánicamente · owner: AI

Mecánico, y registrado crudo: los bloques en fence del par idénticos byte a byte, los dos archivos de acuerdo
en conteo de headings, conteo de fences y headings de campo, cada `[x]` resolviendo a un heading en su propio
archivo. El chequeo del espejo se muestra fallando sobre un contraejemplo construido primero, porque la regla
del defecto D1 de este repositorio aplica a sus propios documentos.

**Aceptación:** la salida cruda está en §1.6, el contraejemplo diverge, y la única fila abierta se nombra en
vez de contarse.

## Progress

| ID | Tarea | Estado | Evidencia |
| --- | --- | --- | --- |
| 1.1 | Instalar el toolchain, verificado y pineado | `[x]` | §1.1, §1.2 |
| 1.2 | El CLI funciona headless, de punta a punta | `[x]` | §1.2 |
| 1.3 | Confinamiento probado, con un control | `[x]` | §1.3 |
| 1.4 | ADR corregido | `[x]` | §1.4 |
| 1.5 | Lo que no se verificó | `[ ]` | §1.5 |
| 1.6 | Verificar este par mecánicamente | `[x]` | §1.6 |

La tarea 1.5 está `[ ]` con su razón declarada, y esta es la lectura honesta de la regla del propio repositorio
de que un `[x]` necesita prueba observada: los tres ítems de §1.5 son cosas que nadie observó, incluida esta
feature. Una fila abierta que lo dice vale más que una fila cerrada que miente.

## Log de evidencia

Salida cruda, sin editar.

### 1.1 — el toolchain (2026-09-19)

```text
$ which bun || echo "command -v bun: nada"
command -v bun: nada
$ ls -A ~/.bun/bin
                                # empty: a previous bun install left ~/.bun/install and no binary
$ unzip -v >/dev/null 2>&1 || echo "unzip: no instalado"
unzip: no instalado

$ sha256sum /tmp/bun.zip
36368faef7527875d5ffa52e53cd48021741f2a83eb6208a8dd64068d422a913  /tmp/bun.zip
$ grep -E 'bun-linux-x64\.zip$' /tmp/SHASUMS256.txt
36368faef7527875d5ffa52e53cd48021741f2a83eb6208a8dd64068d422a913  bun-linux-x64.zip
$ ~/.bun/bin/bun --version
1.4.2

$ bun add -g @open-pencil/cli@0.15.1 @open-pencil/mcp@0.15.1
installed @open-pencil/mcp@0.15.1 with binaries:
 - openpencil-mcp
 - openpencil-mcp-http
128 packages installed [2.98s]
Blocked 1 postinstall. Run `bun pm -g untrusted` for details.
$ openpencil --version
0.15.1
```

**La instalación no fue `curl https://bun.sh/install | bash`, y eso es un hallazgo y no una preferencia.** El
script se bajó y se leyó primero: `grep -cE 'shasum|sha256|sha512|gpg|signature'` devuelve **0**. Baja un zip
de release por TLS y lo descomprime. TLS contra GitHub es un ancla de confianza razonable y el modelo del
vendor no es irrazonable — pero las decisiones adyacentes de este repositorio son explícitas sobre integridad,
así que el zip se bajó directo y se verificó contra el `SHASUMS256.txt` publicado del release, cuyo hash
coincide. Existe una firma GPG upstream (`SHASUMS256.txt.asc`, y `gpg` está instalado), y **no** se verificó:
hacerlo exigiría importar la clave de firma desde un keyserver, lo que cambia un ancla TLS por una de
confianza a primera vista. Eso queda registrado como juicio, no como una brecha disfrazada de cobertura.

`unzip` no está en esta distro, así que la extracción usó el `zipfile` de Python — visible arriba como la
razón por la que no aparece ninguna invocación de `unzip`.

### 1.2 — headless, de punta a punta (2026-09-19)

No había nada corriendo: ni aplicación de escritorio, ni editor, ni display.

```text
$ openpencil import /tmp/hero.html -o /tmp/opnroot/hero.fig
    input: /tmp/hero.html
    output: /tmp/opnroot/hero.fig
    format: fig
    pages: 1
    rootElements: 1
$ ls -l /tmp/opnroot/hero.fig
-rw-r--r-- 1 yorsh yorsh 29461 /tmp/opnroot/hero.fig

$ openpencil info /tmp/opnroot/hero.fig
  1 pages, 3 nodes
DOM/CSS  █ 3nodes
1 FRAME, 2 TEXT
Fonts: Inter

$ openpencil tree /tmp/opnroot/hero.fig
[0] [page] "DOM/CSS" (0:3)
  [0] [frame] "div" (0:4)
    [0] [text] "MediaForge" (0:5)
    [1] [text] "Job pipeline status" (0:6)

$ openpencil export /tmp/opnroot/hero.fig -o /tmp/hero.png
✓ Exported /tmp/hero.png (4.1 KB)

$ openpencil export /tmp/opnroot/hero.fig -f jsx --node 0:4 --style tailwind -o /tmp/frame.tsx
<div data-name="div" className="w-[375px] h-50 bg-[#0B1F2A]">
  <p data-name="MediaForge" className="w-20 h-5 text-7 text-[#F2F5F7]">MediaForge</p>
  <p data-name="Job pipeline status" className="w-38 h-5 text-sm text-[#F2F5F7]">Job pipeline status</p>
</div>
```

**Este es el resultado que cambió el ADR.** El pipeline que el documento de decisión describía como una cadena
de exports es también una **entrada**: HTML/CSS/Tailwind entra y un `.fig` sale, sin nada corriendo. Escribir un
mockup en HTML e importarlo es por lo tanto un camino de primera clase, no un rodeo, y el CLI lee el resultado
como estructura — `tree` da ids de nodo, `query` da XPath, `variables` da tokens.

Dos comportamientos registrados acá para que nadie los redescubra como bugs: `export -f jsx` requiere `--node`
(sin él: `ERROR Nothing to export`) porque la salida JSX está orientada a componentes, y `--page` toma el
**nombre** de una página — `--page 0:3` responde `Page "0:3" not found. Available pages: "DOM/CSS"`.

### 1.3 — el confinamiento, con su control (2026-09-19)

Dos llamadas a la misma herramienta, que difieren solo en si la ruta está dentro del root:

```text
$ OPENPENCIL_MCP_ROOT=/tmp/opnroot   # absolute form, same root for both calls
$ open_file {"path":"/etc/hosts"}                    # outside the root
{"error":"Path is outside the allowed root: /tmp/opnroot"}

$ OPENPENCIL_MCP_ROOT=/tmp/opnroot
$ open_file {"path":"inside.fig"}                     # inside the root
{"error":"OpenPencil app is not connected. STOP and tell the user: ..."}
```

Las dos respuestas son distintas, y esa diferencia es el chequeo. Fuera del root: rechazada **por nombre**, con
el root canónico en el mensaje. Dentro del root: aceptada como ruta y rechazada por una razón completamente
distinta — no hay aplicación con la que hablar. La segunda respuesta es además la evidencia de la corrección
del ADR, y por eso un solo experimento resolvió dos preguntas.

La forma relativa se midió por separado, porque la configuración commiteada depende de ella:

```text
$ cd /tmp && OPENPENCIL_MCP_ROOT=opnroot   # relative
$ open_file {"path":"/etc/hosts"}
{"error":"Path is outside the allowed root: /tmp/opnroot"}    # canonicalised against cwd, still refused
```

### 1.4 — la corrección del ADR (2026-09-19)

Aterrizó en `docs/frontend-style-decision` como `73e6994`, un commit, dos archivos. Corrige las dos
afirmaciones que esta corrida refutó, reconstruye el bloque de chequeos del ADR para que afirme invariantes en
vez de conteos que cada edición posterior invalida, y deja las frases originales en pie con las enmiendas
etiquetadas. El §1.6 del propio ADR registra la salida cruda; esta entrada registra dónde fue la corrección en
vez de repetirla.

### 1.5 — lo que *no* se verificó (abierto)

Tres preguntas abiertas, declaradas para que nadie lea esta feature como más amplia de lo que es:

1. **¿Puede el servidor MCP del lado WSL alcanzar una aplicación de escritorio del lado Windows?** El servidor
   descubre la app en `127.0.0.1:7600` (y vía `OPENPENCIL_MCP_DISCOVERY_PATH` / `_SOCKET` / `_TCP`). Si eso
   resuelve cruzando la frontera de WSL no se probó: la app no estaba corriendo, y arrancarla es decisión del
   usuario. **No se afirma.**
2. **¿Es alcanzable desde acá la superficie MCP HTTP que la app auto-arranca?** La documentación dice que un
   build de producción de Tauri levanta `openpencil-mcp-http` en `127.0.0.1:7600` cuando `@open-pencil/mcp`
   está instalado globalmente — **en Windows**, donde no está instalado. Así que el auto-arranque no está en
   juego de ningún lado. **No se afirma.**
3. **¿Ve Pi el servidor vivo en esta sesión?** Medido, y la respuesta es **no**: `mcp({})` sigue reportando
   `0/1 servers`. Pi resuelve la configuración MCP al arrancar, así que tanto el `.mcp.json` commiteado como la
   entrada puente de máquina necesitan un reload. Lo que *sí* está verificado es el servidor mismo: handshake,
   confinamiento, y las diez variables `OPENPENCIL_MCP_*` que honra.

**Qué resolvería 1 y 2:** arrancar la aplicación de escritorio del lado Windows y llamar una herramienta de
documento a través del gateway MCP. Hasta entonces la afirmación honesta es que el CLI está verificado de punta
a punta y el MCP está verificado hasta la frontera de la app, y no más allá.

### 1.6 — el chequeo mecánico del par (2026-09-19)

El contraejemplo corre primero, sobre una copia con un token cambiado dentro de un bloque en fence, así la
comparación se muestra capaz de fallar antes de que cualquier aprobado suyo valga algo. El comando va **indentado
y no en fence a propósito**: un comando dentro de un bloque en fence vive en el contenido que está por
modificar, así que un `sed` que nombra su propio objetivo reescribe la descripción del test y diverge por una
razón degenerada. Indentado, queda fuera del contenido extraído y la divergencia es real:

    cp odd/tasks/openpencil-setup.es.md /tmp/counter.md
    sed -i 's|OPENPENCIL_MCP_ROOT|OPENPENCIL_MCP_ROOTS|' /tmp/counter.md
    rm -f /tmp/counter.md

Medido: el hash de bloques en fence de la corrida del contraejemplo **difiere** del de inglés, como se exige.
La corrida real después reporta:

```text
headings   : same count in both -> equal
fences     : same count in both -> equal
blocks md5 : EN vs ES -> equal
field heads: EN=[## Delivery ## Progress ## Next step ] ES=[## Delivery ## Progress ## Next step ] -> equal
pointers   : 0 unresolved [x] rows (0 = every one resolves to a ### <id> heading)
open rows  : EN=1 ES=1 (0 = the "every [ ] has a reason" criterion is vacuous)
```

La única fila abierta es la tarea 1.5, y carga una razón declarada — así que **el criterio de `[ ]` no es vacuo
acá**, lo que distingue este par de `frontend-style`, donde cerrar todas las tareas dejó ese criterio sin nada
que chequear y se registró como vacuo en vez de verde. Los valores de hash en sí se declaran en prosa, por la
convención del §1.4 del otro documento, no acá: este bloque vive dentro del contenido que hashea. Medido: el par hashea `2489769664d00f69e364cbaf85cafb8d` de los dos lados, y la corrida del
contraejemplo hashea `992229a9a857dfc32d5e32895805c2a8` — distintos, así que la comparación puede fallar.

**Una brecha que esta feature deja, declarada en vez de insinuada.** El chequeo de arriba es un *transcript*.
El script que lo produjo vive en `/tmp` y no está en el repositorio, así que rerunearlo significa volver a
derivar los comandos desde este bloque. Eso es más débil de lo que parece: un chequeo que nadie puede
rerunear es un chequeo que nadie va a rerunear, que es la falla que este repositorio ya registró como defecto
D1 en otra forma. Commitear el script — o cablear estas aserciones al job `lint` del CI existente — le
corresponde a quien toque estos dos pares de documentos después, y queda nombrado acá para que no se
redescubra como sorpresa.

## Fuera de alcance

- **Cualquier valor de estilo.** Ninguna paleta, escala tipográfica, escala de espaciado, breakpoint, componente
  ni mockup. Esta feature instala una superficie, no un diseño.
- **El scaffold de Next.js.** `apps/web` sigue sin dependencias y sin `src/`.
- **Instalar algo del lado Windows.** No hace falta para el camino headless, que es el camino que el ADR
  eligió; haría falta para control en vivo de la app, que es una decisión que nadie tomó.
- **Verificar la firma GPG de bun.** Registrado en §1.1 con la razón, en vez de salteado en silencio.
- **La skill de estilo local al proyecto.** Sigue siendo su propia feature, según *Fuera de alcance* de
  `frontend-style`.

## Next step

La herramienta está instalada y el camino del CLI está verificado. Tres acciones pertenecen al supervisor:

1. **Recargar la sesión** para tomar la configuración MCP, y después arrancar la aplicación de escritorio de
   OpenPencil en Windows si se quiere control en vivo de la app — que es lo que resolvería las dos primeras
   preguntas de §1.5.
2. **Eliminar la entrada puente** de `~/.pi/agent/mcp.json` cuando `chore/openpencil-setup` se mergee, así el
   `.mcp.json` commiteado es la única fuente.
3. **Decidir la próxima feature** — la skill de estilo local al proyecto, o el primer mockup, que ahora es
   posible con `openpencil import` y no necesita más herramientas.
