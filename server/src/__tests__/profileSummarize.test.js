import { buildProfileSummarize, countedValue } from '../utils/summarize/buildProfileSummarize.js';

/**
 * The counting rules the monthly profile summarize rests on:
 *   Upwork Dev / Client + Freelancer → the profile counts 1, plus 1 per review
 *   Contra + AI training            → only big accounts count, 1 each
 *   Caller / Keeper                 → every profile counts 1
 */

const groups = [
  { code: 'G1', name: 'Group 1', sortOrder: 1, type: 'normal' },
  { code: 'G4', name: 'Group 4', sortOrder: 4, type: 'job' },
];

const users = [
  { _id: 'u1', name: 'Sun', group: 'G1', workingRole: 'normal_working' },
  { _id: 'u2', name: 'MS', group: 'G1', workingRole: 'normal_working' },
  { _id: 'u3', name: 'Bit', group: 'G1', workingRole: 'bittensor' },
  { _id: 'u4', name: 'Akita', group: 'G4', workingRole: 'job_working' },
];

const profile = (ownerUserId, accounts) => ({ ownerUserId, accounts });

describe('countedValue', () => {
  it('counts the profile itself plus each of its reviews', () => {
    expect(countedValue('upwork_dev', { size: 'big', reviewCount: 12 })).toBe(13);
    expect(countedValue('upwork_dev', { size: 'big', reviewCount: 1 })).toBe(2);
    expect(countedValue('upwork_client', { size: 'new', reviewCount: 0 })).toBe(1);
    expect(countedValue('freelancer_dev', { size: 'big', reviewCount: null })).toBe(1);
  });

  it('counts only established accounts elsewhere', () => {
    expect(countedValue('snorkel', { size: 'big' })).toBe(1);
    expect(countedValue('snorkel', { size: 'new' })).toBe(0);
    expect(countedValue('contra', { size: 'new' })).toBe(0);
  });

  it('counts every job profile', () => {
    expect(countedValue('caller', { size: 'new' })).toBe(1);
    expect(countedValue('keeper', { size: 'big' })).toBe(1);
  });
});

describe('buildProfileSummarize', () => {
  const profiles = [
    // Sun: two Upwork Dev profiles (1+12 and 1+3), a new Upwork client (1),
    // a big Snorkel (1) and a new Outlier (0)
    profile('u1', [
      { platform: 'upwork_dev', size: 'big', reviewCount: 12 },
      { platform: 'snorkel', size: 'big' },
      { platform: 'outlier', size: 'new' },
    ]),
    profile('u1', [
      { platform: 'upwork_dev', size: 'big', reviewCount: 3 },
      { platform: 'upwork_client', size: 'new', reviewCount: 0 },
    ]),
    // MS: one big Freelancer with 5 reviews
    profile('u2', [{ platform: 'freelancer_dev', size: 'big', reviewCount: 5 }]),
    // Akita: two caller profiles and one keeper
    profile('u4', [
      { platform: 'caller', size: 'big' },
      { platform: 'keeper', size: 'new' },
    ]),
    profile('u4', [{ platform: 'caller', size: 'new' }]),
  ];

  const targets = new Map([
    ['u1', { profileTarget: 20 }],
    ['u2', { profileTarget: 10 }],
    ['u4', { profileTarget: 4, offerTarget: 2, offerResult: 1 }],
  ]);

  const result = buildProfileSummarize({ groups, users, profiles, targets });
  const member = (id) => result.members.find((m) => m.userId === id);

  it('reads Upwork cells as big · reviews · new', () => {
    const cell = member('u1').cells.upwork_dev;
    expect(cell).toMatchObject({ big: 2, fresh: 0, reviews: 15, counted: 17 });

    const client = member('u1').cells.upwork_client;
    expect(client).toMatchObject({ big: 0, fresh: 1, reviews: 0, counted: 1 });
  });

  it('leaves new AI-training accounts out of the count', () => {
    expect(member('u1').cells.snorkel).toMatchObject({ big: 1, fresh: 0, counted: 1 });
    expect(member('u1').cells.outlier).toMatchObject({ big: 0, fresh: 1, counted: 0 });
  });

  it('scores a member as counted over their target', () => {
    // 17 (upwork dev) + 1 (upwork client) + 1 (snorkel) + 0 (outlier) = 19 of 20
    expect(member('u1').counted).toBe(19);
    expect(member('u1').profilePercent).toBe(95);
    // one Freelancer profile with 5 reviews = 6 of 10
    expect(member('u2').counted).toBe(6);
    expect(member('u2').profilePercent).toBe(60);
  });

  it('gives a Bittensor member no profile score', () => {
    expect(member('u3').profilePercent).toBeNull();
    expect(member('u3').total).toBeNull();
  });

  it('averages profile and job-offer results for a job member', () => {
    const akita = member('u4');
    expect(akita.counted).toBe(3); // two callers + one keeper
    expect(akita.profilePercent).toBe(75);
    expect(akita.offer).toMatchObject({ target: 2, result: 1, percent: 50 });
    expect(akita.total).toBe(62.5);
  });

  it('scores a group as the average of its scored members', () => {
    const g1 = result.groups.find((g) => g.code === 'G1');
    // Sun 95, MS 60, Bittensor member not counted
    expect(g1.profilePercent).toBe(77.5);
    expect(g1.counted).toBe(25);
    expect(g1.cells.upwork_dev).toMatchObject({ big: 2, reviews: 15, counted: 17 });
  });

  it('totals every group together', () => {
    expect(result.totals.counted).toBe(28);
    expect(result.totals.profileTarget).toBe(34);
    // 95, 60 and 75 — the Bittensor member stays out
    expect(result.totals.profilePercent).toBe(76.7);
  });

  it('has no percentage without a target', () => {
    const noTarget = buildProfileSummarize({
      groups,
      users: [users[0]],
      profiles: [profile('u1', [{ platform: 'upwork_dev', size: 'big', reviewCount: 4 }])],
      targets: new Map(),
    });
    expect(noTarget.members[0].counted).toBe(5);
    expect(noTarget.members[0].profilePercent).toBeNull();
    expect(noTarget.groups[0].profilePercent).toBeNull();
  });
});
