"""WU-2 / task 1.2 -- the least-privilege suite (RED-first).

The design (``design.md`` §3, "Least privilege roles") declares two runtime roles and no superuser:

| Role               | Privileges                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| ``mediaforge_api`` | SELECT/INSERT/UPDATE on ``jobs``, ``job_inputs``, ``submissions``, ``outbox``; SELECT on ``attempts``, ``artifacts``. No DDL, no DELETE. |
| ``mediaforge_worker`` | SELECT on ``jobs``, ``job_inputs``, ``submissions``; SELECT/INSERT/UPDATE on ``attempts``; INSERT on ``artifacts``; UPDATE on ``jobs``. No DDL, no DELETE, no ``outbox`` access. |

Scratch cleanup is a storage operation, never a database ``DELETE``, which is why neither role has
DELETE at all.

**How the two directions are asserted, and why they differ.**
*Positives* are read from the catalog with ``has_table_privilege``: that function is PostgreSQL's own
answer to "does this role hold this privilege on this table", so asserting it is asserting the
requirement rather than a proxy for it.

*Denials* are asserted by **execution** (``SET ROLE`` and then run the statement, expecting SQLSTATE
42501). A denial is a security property, and the only thing that proves it is the engine refusing the
statement: a missing grant and a wrong grant look identical in a catalog query read the wrong way.

``SET ROLE`` is used instead of connecting as each role because it tests the same privilege
enforcement without requiring role credentials. Credentials are a deployment concern (the roles must
be able to log in for the API and worker processes to connect), and they are asserted separately as
``rolcanlogin`` rather than by shipping passwords into a test.

**Known residual, stated rather than implied.** Column-level grants live in ``pg_attribute.attacl``
and are not swept here; the design's matrix is table-level, and ``has_table_privilege`` does return
true for any-column privileges, so a column-level grant is only caught where it touches the two
executed write paths. Table ownership is asserted separately, because an owner can ``ALTER``/``DROP``
without any DDL grant, which would make the DDL denial meaningless.

Expected RED: neither role exists yet, so ``has_table_privilege`` raises "role ... does not exist"
and ``SET ROLE`` fails the same way. That is an absence failure, and the evidence log records it as
such -- a suite that fails because *it* is malformed would prove nothing.

Names come from ``design.md`` §3, not from invention: ``DATABASE_URL_TEST`` points at the dedicated
``mediaforge_test`` database.
"""

import os
from contextlib import asynccontextmanager

import asyncpg
import pytest

DATABASE_URL_TEST = os.environ.get(
    "DATABASE_URL_TEST", "postgresql://postgres:postgres@localhost:5432/mediaforge_test"
)

API_ROLE = "mediaforge_api"
WORKER_ROLE = "mediaforge_worker"

TABLES = ["jobs", "job_inputs", "attempts", "submissions", "artifacts", "outbox"]

# Every table privilege PostgreSQL has. The matrix sweeps all seven in both directions: an earlier
# version swept only SELECT/INSERT/UPDATE/DELETE, so `GRANT TRUNCATE ON any_table TO either_role`
# passed the whole suite while contradicting its own "every other combination must be absent" claim.
ALL_TABLE_PRIVILEGES = (
    "SELECT",
    "INSERT",
    "UPDATE",
    "DELETE",
    "TRUNCATE",
    "REFERENCES",
    "TRIGGER",
)

# design.md §3, verbatim as a matrix: {table: (privileges granted, privileges withheld)}.
API_GRANTED = {
    "jobs": {"SELECT", "INSERT", "UPDATE"},
    "job_inputs": {"SELECT", "INSERT", "UPDATE"},
    "submissions": {"SELECT", "INSERT", "UPDATE"},
    "outbox": {"SELECT", "INSERT", "UPDATE"},
    "attempts": {"SELECT"},
    "artifacts": {"SELECT"},
}

WORKER_GRANTED = {
    "jobs": {"SELECT", "UPDATE"},
    "job_inputs": {"SELECT"},
    "submissions": {"SELECT"},
    "attempts": {"SELECT", "INSERT", "UPDATE"},
    "artifacts": {"INSERT"},
    "outbox": set(),
}


async def owner_connection() -> asyncpg.Connection:
    """One connection per test, as in ``test_harness.py``, and for the same measured reason:
    a shared fixture turns an unreachable database into collection errors that read as "nothing
    was checked" instead of "PostgreSQL is not answering"."""
    return await asyncpg.connect(DATABASE_URL_TEST)


async def holds(connection: asyncpg.Connection, role: str, table: str, privilege: str) -> bool:
    return bool(
        await connection.fetchval(
            "SELECT has_table_privilege($1, $2, $3)", role, table, privilege
        )
    )


async def assume_role(connection: asyncpg.Connection, role: str) -> None:
    """Switch the session to ``role`` without building SQL from a string.

    ``SET ROLE`` takes no bind parameters, so the equivalent ``set_config('role', $1, false)`` is used
    instead: same operation, same permission check, but the role name travels as a parameter and the
    file contains no interpolated SQL for a linter to flag and no sink for anyone to widen later.
    """
    await connection.execute("SELECT set_config('role', $1, false)", role)


async def reset_role(connection: asyncpg.Connection) -> None:
    """Back to the session user. ``role = 'none'`` is how ``RESET ROLE`` is spelled for
    ``set_config``."""
    await connection.execute("SELECT set_config('role', 'none', false)")


@asynccontextmanager
async def as_role(connection: asyncpg.Connection, role: str):
    """Run a block as ``role`` and always come back, even when the block raises.

    This helper deliberately takes **no SQL**: the statements that get denied are written inline at
    each call site as literals. An earlier version passed the statement in as a string, which is the
    dynamic-execution pattern a linter flags for good reason -- today's callers all pass constants,
    and tomorrow's caller is the one that matters.
    """
    await assume_role(connection, role)
    try:
        yield
    finally:
        await reset_role(connection)


@pytest.mark.asyncio
async def test_both_runtime_roles_exist_without_superuser_power() -> None:
    connection = await owner_connection()
    try:
        for role in (API_ROLE, WORKER_ROLE):
            row = await connection.fetchrow(
                "SELECT rolcanlogin, rolsuper, rolcreatedb, rolcreaterole "
                "FROM pg_roles WHERE rolname = $1",
                role,
            )
            assert row is not None, f"role {role} does not exist"
            assert row["rolcanlogin"] is True, f"{role} must be able to log in for its service"
            assert row["rolsuper"] is False, f"{role} must not be a superuser"
            assert row["rolcreatedb"] is False, f"{role} must not create databases"
            assert row["rolcreaterole"] is False, f"{role} must not create roles"
    finally:
        await connection.close()


@pytest.mark.asyncio
@pytest.mark.parametrize("role,granted", [(API_ROLE, API_GRANTED), (WORKER_ROLE, WORKER_GRANTED)])
async def test_the_privilege_matrix_is_exactly_as_designed(role: str, granted: dict) -> None:
    """Every privilege is asserted in both directions: granted ones must be held, and every other
    combination must be absent. A role that silently holds an extra privilege is a least-privilege
    failure even when every named denial still holds."""
    connection = await owner_connection()
    try:
        for table in TABLES:
            for privilege in ALL_TABLE_PRIVILEGES:
                expected = privilege in granted.get(table, set())
                actual = await holds(connection, role, table, privilege)
                assert actual is expected, (
                    f"{role} on {table}: {privilege} is {actual}, design says {expected}"
                )
    finally:
        await connection.close()


@pytest.mark.asyncio
async def test_no_runtime_role_owns_a_table() -> None:
    """``design.md`` §3: migrations run under the owner role. Ownership is asserted separately from
grants because an owner can ``ALTER`` or ``DROP`` a table **without holding any DDL grant**, which
would make the DDL denial in this suite meaningless while every other assertion stayed green."""
    connection = await owner_connection()
    try:
        rows = await connection.fetch(
            """
            SELECT c.relname AS table, pg_get_userbyid(c.relowner) AS owner
              FROM pg_class c
              JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = ANY($1::text[])
            """,
            TABLES,
        )

        # Non-vacuous: every table must be present before its owner can be judged.
        assert sorted(row["table"] for row in rows) == sorted(TABLES)

        owned_by_runtime = [
            row["table"] for row in rows if row["owner"] in (API_ROLE, WORKER_ROLE)
        ]
        assert owned_by_runtime == [], f"runtime roles own tables: {owned_by_runtime}"
    finally:
        await connection.close()


@pytest.mark.asyncio
async def test_worker_cannot_reach_the_outbox() -> None:
    # The outbox is the API's dispatch intent. The worker consuming it would make the relay's
    # ownership ambiguous, so the denial is part of the design, not an accident of grants.
    #
    # Every denial below asserts SQLSTATE 42501 specifically. "It threw" would also be satisfied by a
    # typo in the statement, and that is exactly the false evidence this repository keeps hunting for.
    connection = await owner_connection()
    try:
        async with as_role(connection, WORKER_ROLE):
            with pytest.raises(asyncpg.exceptions.InsufficientPrivilegeError):
                await connection.execute("SELECT 1 FROM outbox")
    finally:
        await connection.close()


@pytest.mark.asyncio
@pytest.mark.parametrize("role", [API_ROLE, WORKER_ROLE])
async def test_neither_role_can_run_ddl(role: str) -> None:
    # One DDL authority (design.md §5): the migration owns the schema, and no runtime role may
    # change it. Asserted by trying, not by reading a grant.
    connection = await owner_connection()
    try:
        async with as_role(connection, role):
            with pytest.raises(asyncpg.exceptions.InsufficientPrivilegeError):
                await connection.execute("CREATE TABLE ddl_probe (id int)")
    finally:
        await connection.close()


@pytest.mark.asyncio
@pytest.mark.parametrize("role", [API_ROLE, WORKER_ROLE])
async def test_neither_role_can_delete(role: str) -> None:
    connection = await owner_connection()
    try:
        async with as_role(connection, role):
            with pytest.raises(asyncpg.exceptions.InsufficientPrivilegeError):
                await connection.execute("DELETE FROM attempts")
    finally:
        await connection.close()


@pytest.mark.asyncio
async def test_public_holds_nothing_on_the_tables() -> None:
    """``REVOKE ALL ... FROM PUBLIC`` is a design requirement. It is checked through the ACL rather
    than through a role name, because ``PUBLIC`` is not a role: it appears as grantee ``0``.

    The existence assertion is not decoration. Without it this test **passed in the RED run**, while
    no table existed: an empty catalog produces an empty ACL result, and an empty result satisfies
    "no privilege leaked". That is a vacuous pass -- green for a reason unrelated to what is being
    asserted -- and it is the failure mode this repository keeps finding in other people's gates.
    """
    connection = await owner_connection()
    try:
        for table in TABLES:
            exists = await connection.fetchval("SELECT to_regclass($1) IS NOT NULL", table)
            assert exists, f"{table} does not exist, so its ACL check would pass vacuously"

            leaked = await connection.fetch(
                """
                SELECT a.privilege_type
                  FROM pg_class c
                  CROSS JOIN LATERAL aclexplode(c.relacl) AS a
                 WHERE c.relname = $1 AND a.grantee = 0
                """,
                table,
            )
            assert leaked == [], f"PUBLIC holds {[row['privilege_type'] for row in leaked]} on {table}"
    finally:
        await connection.close()


@pytest.mark.asyncio
async def test_worker_can_actually_claim_an_attempt_and_fence_a_job() -> None:
    """The worker's write path, executed rather than declared: insert an attempt and move the job
    to ``running``. A grant that exists in the catalog but cannot be used would pass every other test
    in this file and fail in WU-9, which is the worst place to find out."""
    connection = await owner_connection()
    try:
        await connection.execute("BEGIN")
        job_id = await connection.fetchval(
            """
            INSERT INTO jobs (job_type, params, state, available_at, created_at, updated_at)
            VALUES ('audio.extract', '{}'::jsonb, 'queued', now(), now(), now())
            RETURNING id
            """
        )
        await assume_role(connection, WORKER_ROLE)
        try:
            await connection.execute(
                """
                INSERT INTO attempts (job_id, attempt_no, lease_owner, lease_expires_at, started_at, created_at)
                VALUES ($1, 1, 'worker-1', now() + interval '60 seconds', now(), now())
                """,
                job_id,
            )
            await connection.execute(
                "UPDATE jobs SET state = 'running', updated_at = now() WHERE id = $1", job_id
            )
        finally:
            await reset_role(connection)
        await connection.execute("ROLLBACK")
    finally:
        await connection.close()


@pytest.mark.asyncio
async def test_api_can_actually_write_its_create_transaction() -> None:
    """The API's create path (C1): a job row, its submission row and -- in T1 -- the outbox row.
    Executed for the same reason as the worker's path above."""
    connection = await owner_connection()
    try:
        await connection.execute("BEGIN")
        await assume_role(connection, API_ROLE)
        try:
            job_id = await connection.fetchval(
                """
                INSERT INTO jobs (job_type, params, state, available_at, created_at, updated_at)
                VALUES ('audio.extract', '{}'::jsonb, 'created', now(), now(), now())
                RETURNING id
                """
            )
            await connection.execute(
                """
                INSERT INTO submissions (job_id, idempotency_key, creator_token_hash, created_at)
                VALUES ($1, 'key-1', 'sha256:deadbeef', now())
                """,
                job_id,
            )
            await connection.execute(
                """
                INSERT INTO outbox (job_id, event_type, payload, attempts, created_at)
                VALUES ($1, 'job.queued', '{}'::jsonb, 0, now())
                """,
                job_id,
            )
        finally:
            await connection.execute("RESET ROLE")
        await connection.execute("ROLLBACK")
    finally:
        await connection.close()
