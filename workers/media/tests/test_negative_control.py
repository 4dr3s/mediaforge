"""Scratch file for the CI negative control: proves the `worker` job can fail.

This branch is deleted immediately after the run is observed.
"""


def test_fails_on_purpose() -> None:
    assert 1 == 2
