"""S1 harness -- proves the worker's real dependencies exist before any pipeline code does.

RED-first (``openspec/config.yaml`` -> ``testing.strict_tdd``). These assertions are the gate for
every later task: if either can pass against the wrong service, every downstream test lies.
Written before the worker project existed, so the expected RED is "there is no pyproject.toml
and no database yet" -- see the S1 evidence log in ``odd/tasks/s1-foundation.md``.

Names come from ``.env.example`` and ``design.md`` §2.1/§11, not from invention:
``DATABASE_URL_TEST`` points at the dedicated ``mediaforge_test`` database, and
``REDIS_URL_TEST`` at Redis database number 1.
"""

import os

import asyncpg
import pytest
import redis.asyncio as redis

DATABASE_URL_TEST = os.environ.get(
    "DATABASE_URL_TEST", "postgresql://postgres:postgres@localhost:5432/mediaforge_test"
)
REDIS_URL_TEST = os.environ.get("REDIS_URL_TEST", "redis://localhost:6379/1")


@pytest.mark.asyncio
async def test_asyncpg_connects_to_the_dedicated_test_database() -> None:
    connection = await asyncpg.connect(DATABASE_URL_TEST)
    try:
        assert await connection.fetchval("SELECT current_database()") == "mediaforge_test"
    finally:
        await connection.close()


@pytest.mark.asyncio
async def test_redis_is_reachable_on_the_test_database_number() -> None:
    # Database 1, never 0: the test suite must not flush the broker's default database, which
    # the running pipeline uses for the dispatch stream (ADR-0002).
    client = redis.from_url(REDIS_URL_TEST)
    try:
        assert await client.ping() is True
    finally:
        await client.aclose()
