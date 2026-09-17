# Worker image -- Python 3.11 + uv. Build context is the repository root (`context: ..`).
#
# Base image is pinned by digest: a tag such as `3.11-slim` moves, and this image is the one that
# will run untrusted media through ffmpeg.
FROM python:3.11-slim@sha256:9534e5a8e315485d4061ed659af0fd78a284c015f9b73661b41d6bab25604534 AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    bubblewrap \
    util-linux \
    wget \
    && rm -rf /var/lib/apt/lists/*

# The worker runs unprivileged. `bubblewrap` and `util-linux` provide bwrap and unshare, which the
# sandbox will need -- and which the container cannot use until WU-15 ships the seccomp profile
# (design/spike-sandbox-namespaces.md measured the EPERM: seccomp, not the kernel, not caps).
RUN groupadd -r mediaforge -g 10001 && \
    useradd -r -g mediaforge -u 10001 -d /app mediaforge

COPY --from=ghcr.io/astral-sh/uv:0.11.19 /uv /uvx /bin/

WORKDIR /app

COPY workers/media ./workers/media

# `--system`, not a virtualenv: the image *is* the environment. The `dev` extras are intentional
# -- pytest inside this container is how the sandbox preconditions get probed (WU-13, WU-15).
# Installed from the project directory: this is the form that already built this image once.
WORKDIR /app/workers/media
RUN uv pip install --system --no-cache -e ".[dev]"

# Numeric on purpose (hadolint DL3066): the shared volume records ownership as uid:gid, and the
# API writes to that same volume as uid 1000. Keeping the number in the CMD keeps the runtime
# identity independent of what /etc/passwd happens to say.
USER 10001:10001

# PLACEHOLDER -- replaced by work unit WU-9, which writes `mediaforge.main` (consume, claim,
# lease, heartbeat, commit, timeout). The container has to stay up for `up -d --wait` to pass in
# the meantime, and a `CMD` naming a module that does not exist would crash-loop instead of
# telling anyone why. When WU-9 lands, this line becomes:
#     CMD ["python", "-m", "mediaforge.main"]
CMD ["sleep", "infinity"]
