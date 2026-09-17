"""MediaForge media worker.

Empty on purpose. This slice (S1) only bootstraps the workspace and the test harness; the
worker's runtime -- consume, claim, lease, heartbeat, commit, timeout (`design.md` §2.2,
capability C4 / work unit WU-9) -- is not stubbed here. An entrypoint that does nothing would
look like an implementation and read as a mystery to anyone opening the file later.
"""
