/**
 * Tron Amount Migration Script
 *
 * Backfills `inputPrice` / `isTron` on finance transactions created before the
 * Tron flag existed, and restates their `amount` to the real received value.
 *
 * Legacy rows stored the entered price directly in `amount`, so:
 *   - every legacy row gets `inputPrice = amount` and `isTron = false`
 *   - non-Tron income (income, through the team wallet) is restated to
 *     `amount = round2(inputPrice * 0.98)` -- the 2% transfer fee
 *   - outcomes and non-wallet income count as Tron, so their amount is
 *     unchanged; only `inputPrice` is filled in
 *
 * Because `amount` is what every summary, budget and overview aggregation reads,
 * restating it here is what makes the whole finance module report the real 98%
 * value. Rows that already have `inputPrice` are skipped, so this is idempotent
 * and safe to run multiple times.
 *
 * Run:
 *   node server/src/scripts/migrate-tron-amounts.js
 *   node server/src/scripts/migrate-tron-amounts.js --dry-run   # Log only, no writes
 */

import dotenv from 'dotenv';
import FinanceTransaction from '../models/FinanceTransaction.js';
import { connectDB } from '../config/db.js';

dotenv.config();

const NON_TRON_RATE = 0.98;

const isDryRun = process.argv.includes('--dry-run');

const round2 = (n) => Math.round(n * 100) / 100;

const migrateTronAmounts = async () => {
  try {
    console.log('🔄 Starting Tron amount migration...');
    if (isDryRun) console.log('   [DRY RUN – no changes will be written]\n');

    await connectDB();
    console.log('✅ Connected to database\n');

    // Only rows that predate the feature: `inputPrice` is the marker.
    const legacy = await FinanceTransaction.find({
      $or: [{ inputPrice: { $exists: false } }, { inputPrice: null }],
    })
      .select('type amount currency date throughTeamWallet isTron')
      .lean();

    console.log(`📊 Found ${legacy.length} transaction(s) without inputPrice\n`);

    let restated = 0;
    let backfilledOnly = 0;
    let totalDelta = 0;

    for (const tx of legacy) {
      const inputPrice = tx.amount || 0;

      // Mirrors resolveIsTron() in finance.routes.js: the fee only applies to
      // income that went through the team wallet, and legacy rows carry no flag.
      const isTron =
        tx.type !== 'income' ? true : tx.throughTeamWallet === false;

      const nextAmount = isTron ? inputPrice : round2(inputPrice * NON_TRON_RATE);

      if (isTron) {
        backfilledOnly++;
      } else {
        restated++;
        totalDelta += inputPrice - nextAmount;
        console.log(
          `   • ${String(tx.date).slice(0, 10)} ${tx.type} ` +
            `${tx.amount} ${tx.currency || 'USD'} → ${nextAmount} [${tx._id}]`,
        );
      }

      if (!isDryRun) {
        await FinanceTransaction.updateOne(
          { _id: tx._id },
          { $set: { inputPrice, isTron, amount: nextAmount } },
        );
      }
    }

    console.log('');
    console.log(
      `✅ ${isDryRun ? 'Would restate' : 'Restated'} ${restated} non-Tron income transaction(s) ` +
        `(total reduction: ${round2(totalDelta)})`,
    );
    console.log(
      `✅ ${isDryRun ? 'Would backfill' : 'Backfilled'} ${backfilledOnly} Tron transaction(s) ` +
        `(inputPrice only, amount unchanged)\n`,
    );

    // Verification
    if (!isDryRun) {
      const remaining = await FinanceTransaction.countDocuments({
        $or: [{ inputPrice: { $exists: false } }, { inputPrice: null }],
      });
      if (remaining === 0) {
        console.log('✅ Verification: every transaction now has an inputPrice');
      } else {
        console.log(`⚠️  Warning: ${remaining} transaction(s) still lack inputPrice`);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
};

migrateTronAmounts();
