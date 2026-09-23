// The browser workspace of Guild (§10.4) comes back from localStorage, which any script of the
// origin, an extension or the reader can edit: `parseGuildWorkspace` reads it as untrusted
// input, snapshot by snapshot and field by field.
import { describe, expect, it } from 'vitest';

import { defaultGuildSettings } from '@/components/guild/GoalsDialog';
import { parseGuildWorkspace, serializeGuildWorkspace } from '@/components/guild/GuildRoot';

import sample from '../fixtures/guild-export.sample.json';

const EMPTY = { snapshots: [], settings: defaultGuildSettings(), overrides: {} };

describe('parseGuildWorkspace', () => {
  it('starts empty from nothing or from text that is not a workspace', () => {
    for (const stored of [null, '', 'not json', '[]', '42', 'null', '"text"']) {
      expect(parseGuildWorkspace(stored)).toEqual(EMPTY);
    }
  });

  it('keeps the snapshots the engine can place and drops the rest', () => {
    const workspace = parseGuildWorkspace(
      JSON.stringify({
        snapshots: [
          { snapshotId: 'kept', payload: sample },
          { snapshotId: 'no-date', payload: { ...sample, exportedAt: 'yesterday' } },
          { snapshotId: 'no-members', payload: { guild: 'Test Guild' } },
          'not a snapshot',
        ],
      }),
    );
    expect(workspace.snapshots.map((snapshot) => snapshot.observationDate)).toEqual(['2026-09-10']);
    expect(workspace.snapshots[0]?.snapshotId).toBe('kept');
  });

  it('keeps only splits with a well-formed key and whole, non-negative counts', () => {
    const valid = { normal: 2, wildscape: 1, primal: 1 };
    const workspace = parseGuildWorkspace(
      JSON.stringify({
        difficultyOverrides: {
          '2026-09-10:alpha player': valid,
          'alpha player': valid,
          '2026-09-10:beta player': { normal: -1, wildscape: 0, primal: 0 },
          '2026-09-10:gamma player': { normal: 1.5, wildscape: 0, primal: 0 },
          '2026-09-10:delta player': { normal: '2', wildscape: 0, primal: 0 },
        },
      }),
    );
    expect(workspace.overrides).toEqual({ '2026-09-10:alpha player': valid });
  });

  it('falls back to the default inactivity threshold outside 1 to 30', () => {
    const read = (inactivityDays: unknown) =>
      parseGuildWorkspace(JSON.stringify({ inactivityDays })).settings.inactivityDays;
    expect(read(5)).toBe(5);
    expect(read(99)).toBe(defaultGuildSettings().inactivityDays);
    expect(read('5')).toBe(defaultGuildSettings().inactivityDays);
  });

  it('reads back what it writes', () => {
    const workspace = parseGuildWorkspace(
      JSON.stringify({ snapshots: [{ snapshotId: 'kept', payload: sample }] }),
    );
    const again = parseGuildWorkspace(serializeGuildWorkspace(workspace));
    expect(again.snapshots.map((snapshot) => snapshot.observationDate)).toEqual(['2026-09-10']);
    expect(again.settings).toEqual(workspace.settings);
  });
});
