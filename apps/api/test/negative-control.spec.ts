import { describe, expect, it } from 'vitest';

// Scratch file for the CI negative control: proves the `api` job can fail.
// This branch is deleted immediately after the run is observed.
describe('negative control', () => {
  it('fails on purpose', () => {
    expect(1).toBe(2);
  });
});
