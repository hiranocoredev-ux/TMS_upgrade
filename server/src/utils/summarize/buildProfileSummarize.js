import {
  PROFILE_PLATFORMS,
  JOB_PROFILE_KINDS,
  REVIEW_PLATFORM_KEYS,
  WORKING_ROLES,
} from '../../constants/profiles.js';

/**
 * Monthly profile summarize: what each member's citizen profiles add up to,
 * measured against the target a super admin set for the month.
 *
 * How a cell reads
 *   Upwork Dev / Upwork Client / Freelancer Dev → big · reviews · new
 *   every other platform and the job profiles   → big · new
 *
 * How the counted total is reached
 *   Upwork Dev / Client / Freelancer  the profile itself counts 1, and every
 *                                     review adds another — so a new profile is
 *                                     1, one review makes 2, and 12 make 13.
 *   Contra + the AI-training platforms  only established ("big") accounts count,
 *                                     1 each; new ones are not counted.
 *   Caller / Keeper (job members)      every profile counts 1.
 *
 * Percentages
 *   member  counted ÷ profile target (nothing without a target)
 *   job member  the average of that and the job-offer result ÷ offer target
 *   group   the average of its members' percentages
 */

export const REVIEW_KEYS = REVIEW_PLATFORM_KEYS;

const PLATFORM_KEYS = PROFILE_PLATFORMS.map((p) => p.key);
const JOB_KEYS = JOB_PROFILE_KINDS.map((k) => k.key);

/** The columns a table shows for each kind of team. */
export const PROFILE_COLUMNS = Object.freeze({
  normal: PROFILE_PLATFORMS.map((p) => ({
    key: p.key,
    label: p.label,
    short: p.short,
    tab: p.tab,
    reviews: !!p.reviews,
  })),
  job: JOB_PROFILE_KINDS.map((k) => ({
    key: k.key,
    label: k.label,
    short: k.label,
    tab: 'job_working',
    reviews: false,
  })),
});

const round1 = (n) => Math.round(n * 10) / 10;

const rateOf = (value, base) => {
  const total = Number(base) || 0;
  if (total <= 0) return null;
  return round1((Number(value) || 0) / total * 100);
};

const emptyCell = () => ({ big: 0, fresh: 0, reviews: 0, counted: 0 });

const isEstablished = (account) =>
  account.size === 'big' || (Number(account.reviewCount) || 0) > 0;

/** What one account adds to the member's counted total. */
export const countedValue = (platform, account) => {
  if (REVIEW_KEYS.includes(platform)) return 1 + (Number(account.reviewCount) || 0);
  if (JOB_KEYS.includes(platform)) return 1;
  return isEstablished(account) ? 1 : 0;
};

const addAccount = (cell, platform, account) => {
  if (isEstablished(account)) cell.big += 1;
  else cell.fresh += 1;
  cell.reviews += Number(account.reviewCount) || 0;
  cell.counted += countedValue(platform, account);
};

const addCells = (into, from) => {
  for (const [key, cell] of Object.entries(from)) {
    const target = into[key] || (into[key] = emptyCell());
    target.big += cell.big;
    target.fresh += cell.fresh;
    target.reviews += cell.reviews;
    target.counted += cell.counted;
  }
};

const averageOf = (values) => {
  const numbers = values.filter((v) => typeof v === 'number');
  if (!numbers.length) return null;
  return round1(numbers.reduce((sum, v) => sum + v, 0) / numbers.length);
};

/**
 * @param {object} input
 * @param {Array}  input.groups   [{ code, name, sortOrder, type }]
 * @param {Array}  input.users    [{ _id, name, group, workingRole, avatarUrl }]
 * @param {Array}  input.profiles citizen profiles with their accounts
 * @param {Map}    input.targets  userId → { profileTarget, offerTarget, offerResult }
 */
export const buildProfileSummarize = ({ groups = [], users = [], profiles = [], targets = new Map() }) => {
  /* ---------- every member's accounts, gathered from the profiles they own ---------- */
  const cellsByUser = new Map();
  for (const profile of profiles) {
    const ownerId = String(profile.ownerUserId?._id || profile.ownerUserId || '');
    if (!ownerId) continue;
    const cells = cellsByUser.get(ownerId) || cellsByUser.set(ownerId, {}).get(ownerId);
    for (const account of profile.accounts || []) {
      const platform = account.platform;
      if (!PLATFORM_KEYS.includes(platform) && !JOB_KEYS.includes(platform)) continue;
      const cell = cells[platform] || (cells[platform] = emptyCell());
      addAccount(cell, platform, account);
    }
  }

  const groupByCode = new Map(groups.map((g) => [g.code, g]));
  const typeOf = (code) => (groupByCode.get(code)?.type === 'job' ? 'job' : 'normal');

  /* ---------- one row per member ---------- */
  const members = users.map((user) => {
    const id = String(user._id);
    const cells = cellsByUser.get(id) || {};
    const target = targets.get(id) || {};
    const groupType = typeOf(user.group);
    const isBittensor = user.workingRole === WORKING_ROLES.BITTENSOR;

    const counted = Object.entries(cells).reduce((sum, [, cell]) => sum + cell.counted, 0);
    const profileTarget = Number(target.profileTarget) || 0;
    const offerTarget = Number(target.offerTarget) || 0;
    const offerResult = Number(target.offerResult) || 0;

    // A Bittensor member carries no profile target: finance alone scores them.
    const profilePercent = isBittensor ? null : rateOf(counted, profileTarget);
    const offerPercent = groupType === 'job' && !isBittensor ? rateOf(offerResult, offerTarget) : null;
    const total = isBittensor ? null : averageOf([profilePercent, offerPercent]);

    return {
      userId: id,
      name: user.name || user.email || 'Member',
      email: user.email || '',
      group: user.group || '',
      groupType,
      workingRole: user.workingRole || '',
      bittensor: isBittensor,
      avatarUrl: user.avatarUrl || '',
      cells,
      counted,
      profileTarget,
      profilePercent,
      offer: { target: offerTarget, result: offerResult, percent: offerPercent },
      total,
    };
  });

  /* ---------- group rollups ---------- */
  const groupRows = groups
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.code.localeCompare(b.code))
    .map((group) => {
      const groupMembers = members.filter((m) => m.group === group.code);
      const scored = groupMembers.filter((m) => !m.bittensor);
      const cells = {};
      let counted = 0;
      let profileTarget = 0;
      const offer = { target: 0, result: 0, percent: null };

      for (const member of groupMembers) {
        addCells(cells, member.cells);
        counted += member.counted;
        profileTarget += member.profileTarget;
        offer.target += member.offer.target;
        offer.result += member.offer.result;
      }
      offer.percent = group.type === 'job' ? rateOf(offer.result, offer.target) : null;

      return {
        code: group.code,
        name: group.name,
        type: typeOf(group.code),
        memberCount: groupMembers.length,
        cells,
        counted,
        profileTarget,
        offer,
        // The group scores as the average of its members, not as one big pile.
        profilePercent: averageOf(scored.map((m) => m.profilePercent)),
        total: averageOf(scored.map((m) => m.total)),
        members: groupMembers,
      };
    });

  /* ---------- everything, across all groups ---------- */
  const allCells = {};
  let allCounted = 0;
  let allTarget = 0;
  const allOffer = { target: 0, result: 0, percent: null };
  for (const member of members) {
    addCells(allCells, member.cells);
    allCounted += member.counted;
    allTarget += member.profileTarget;
    allOffer.target += member.offer.target;
    allOffer.result += member.offer.result;
  }
  allOffer.percent = rateOf(allOffer.result, allOffer.target);

  const scoredMembers = members.filter((m) => !m.bittensor);

  return {
    columns: PROFILE_COLUMNS,
    members,
    groups: groupRows,
    totals: {
      memberCount: members.length,
      cells: allCells,
      counted: allCounted,
      profileTarget: allTarget,
      offer: allOffer,
      profilePercent: averageOf(scoredMembers.map((m) => m.profilePercent)),
      total: averageOf(scoredMembers.map((m) => m.total)),
    },
  };
};

export default buildProfileSummarize;
