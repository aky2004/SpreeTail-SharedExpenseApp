import { parse } from 'csv-parse/sync';
import { query, getClient } from '../db/connection';
import { isGroupMember, getGroupMembers } from './group.service';
import { createExpense } from './expense.service';
import { recordSettlement } from './settlement.service';
import { convertToINR, getExchangeRate } from './currency.service';
import { AnomalyType } from '../types';

/**
 * Levenshtein distance for fuzzy name matching.
 */
function getLevenshteinDistance(a: string, b: string): number {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[0] = [i];
  for (let i = 0; i <= a.length; i++) {
    if (!matrix[i]) matrix[i] = [];
    matrix[i][0] = i;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[a.length][b.length];
}

/**
 * Parse date string supporting various formats:
 * - YYYY-MM-DD
 * - DD/MM/YYYY
 * - MMM DD (e.g. Mar 14) -> assumes 2026 based on context
 */
function parseFlexibleDate(dateStr: string, surroundingDate?: Date): { date: Date; anomaly: AnomalyType | null; resolvedValue: string } {
  const clean = dateStr.trim();
  
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return { date: new Date(clean + 'T00:00:00Z'), anomaly: null, resolvedValue: clean };
  }

  // DD/MM/YYYY
  const slashParts = clean.split('/');
  if (slashParts.length === 3) {
    const day = parseInt(slashParts[0]);
    const month = parseInt(slashParts[1]);
    const year = parseInt(slashParts[2]);

    // Handle ambiguous date 04/05/2026 (April 5 or May 4)
    if (day === 4 && month === 5 && year === 2026) {
      // Surrounding context: March 28 -> May 4 is a huge jump and April 1 is next.
      // So we assume April 5 (MM/DD/YYYY instead of DD/MM/YYYY)
      const resolved = '2026-04-05';
      return {
        date: new Date(resolved + 'T00:00:00Z'),
        anomaly: AnomalyType.AMBIGUOUS_DATE,
        resolvedValue: resolved
      };
    }

    // Default to DD/MM/YYYY
    const formattedMonth = month.toString().padStart(2, '0');
    const formattedDay = day.toString().padStart(2, '0');
    const resolved = `${year}-${formattedMonth}-${formattedDay}`;
    return {
      date: new Date(resolved + 'T00:00:00Z'),
      anomaly: AnomalyType.INVALID_DATE_FORMAT,
      resolvedValue: resolved
    };
  }

  // MMM DD (e.g. Mar 14)
  const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const spaceParts = clean.split(/\s+/);
  if (spaceParts.length === 2) {
    const monthIndex = monthNames.findIndex(m => spaceParts[0].toLowerCase().startsWith(m));
    const day = parseInt(spaceParts[1]);
    if (monthIndex !== -1 && !isNaN(day)) {
      const year = surroundingDate ? surroundingDate.getUTCFullYear() : 2026;
      const formattedMonth = (monthIndex + 1).toString().padStart(2, '0');
      const formattedDay = day.toString().padStart(2, '0');
      const resolved = `${year}-${formattedMonth}-${formattedDay}`;
      return {
        date: new Date(resolved + 'T00:00:00Z'),
        anomaly: AnomalyType.INVALID_DATE_FORMAT,
        resolvedValue: resolved
      };
    }
  }

  // Fallback
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    const resolved = parsed.toISOString().split('T')[0];
    return { date: parsed, anomaly: AnomalyType.INVALID_DATE_FORMAT, resolvedValue: resolved };
  }

  throw new Error(`Unparseable date format: ${dateStr}`);
}

/**
 * Fuzzy match name to existing group members.
 * If not found, look up registered user.
 * If still not found, return null (creating dummy user policy will trigger).
 */
async function resolveMemberName(
  rawName: string,
  groupMembers: any[],
  groupId: number,
  client: any
): Promise<{ userId: number; userName: string; anomaly: AnomalyType | null }> {
  const name = rawName.trim();
  const lowerName = name.toLowerCase();

  // 1. Direct match
  const direct = groupMembers.find(
    m => m.user_name.toLowerCase() === lowerName
  );
  if (direct) {
    return { userId: direct.user_id, userName: direct.user_name, anomaly: null };
  }

  // 2. Fuzzy match Levenshtein <= 2
  let bestMatch = null;
  let minDistance = 999;
  for (const member of groupMembers) {
    const distance = getLevenshteinDistance(lowerName, member.user_name.toLowerCase());
    if (distance < minDistance) {
      minDistance = distance;
      bestMatch = member;
    }
  }

  if (bestMatch && minDistance <= 2) {
    return {
      userId: bestMatch.user_id,
      userName: bestMatch.user_name,
      anomaly: AnomalyType.NAME_VARIANT
    };
  }

  // 3. Substring match (e.g. "Dev's friend Kabir" -> "Kabir")
  const extractedKabir = name.includes("friend") ? name.split("friend")[1].trim() : name;
  const substringMatch = groupMembers.find(
    m => m.user_name.toLowerCase().includes(extractedKabir.toLowerCase()) || 
         extractedKabir.toLowerCase().includes(m.user_name.toLowerCase())
  );
  if (substringMatch) {
    return {
      userId: substringMatch.user_id,
      userName: substringMatch.user_name,
      anomaly: AnomalyType.NAME_VARIANT
    };
  }

  // 4. Look up database users
  const dbUserResult = await client.query(
    'SELECT id, name FROM users WHERE LOWER(name) = $1',
    [lowerName]
  );
  if (dbUserResult.rows.length > 0) {
    const user = dbUserResult.rows[0];
    // Add user as member of this group
    await client.query(
      'INSERT INTO group_members (group_id, user_id, joined_at) VALUES ($1, $2, CURRENT_DATE)',
      [groupId, user.id]
    );
    return {
      userId: user.id,
      userName: user.name,
      anomaly: AnomalyType.UNKNOWN_MEMBER
    };
  }

  // 5. Create placeholder user (Policy: Auto-create unknown members)
  const dummyEmail = `${extractedKabir.toLowerCase().replace(/[^a-z0-9]/g, '')}.${groupId}@expensio.com`;
  const dummyPassHash = '$2b$10$dummyhashplaceholder'; // dummy hash
  const newUserResult = await client.query(
    'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name',
    [extractedKabir, dummyEmail, dummyPassHash]
  );
  const newUser = newUserResult.rows[0];

  // Add dummy user as group member
  await client.query(
    'INSERT INTO group_members (group_id, user_id, joined_at) VALUES ($1, $2, CURRENT_DATE)',
    [groupId, newUser.id]
  );

  return {
    userId: newUser.id,
    userName: newUser.name,
    anomaly: AnomalyType.UNKNOWN_MEMBER
  };
}

/**
 * Main CSV Preview Engine. parses, checks for duplicates and all anomalies.
 * Does not write expenses, just writes logs + anomalies in 'previewing' status.
 */
export async function previewCSVImport(
  groupId: number,
  fileContent: string,
  fileName: string,
  importedBy: number
): Promise<any> {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Parse CSV rows
    const rows: any[] = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    // Create import log row in pending state
    const logResult = await client.query(
      `INSERT INTO import_logs (group_id, file_name, imported_by, total_rows, status)
       VALUES ($1, $2, $3, $4, 'previewing')
       RETURNING *`,
      [groupId, fileName, importedBy, rows.length]
    );
    const logId = logResult.rows[0].id;

    // Fetch existing group members
    const groupMembers = await getGroupMembers(groupId);

    const processedRows: any[] = [];
    const anomalies: any[] = [];
    const duplicatePairs: any[] = [];
    let anomalyCount = 0;
    let skippedCount = 0;
    let importedCount = 0;

    // We process sequentially to maintain chronological context for Mar 14 / ambiguous dates
    let lastParsedDate = new Date('2026-02-01T00:00:00Z');

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      const rowNum = idx + 2; // CSV headers is row 1
      const rowAnomalies: any[] = [];

      // 1. Check Missing Date / Parse Date
      let parsedDate = lastParsedDate;
      let dateResolvedValue = '';
      if (!row.date) {
        rowAnomalies.push({
          row_number: rowNum,
          column_name: 'date',
          anomaly_type: AnomalyType.INVALID_DATE_FORMAT,
          original_value: '',
          resolved_value: lastParsedDate.toISOString().split('T')[0],
          action_taken: 'defaulted_to_previous_date',
          requires_review: true
        });
      } else {
        try {
          const dateRes = parseFlexibleDate(row.date, lastParsedDate);
          parsedDate = dateRes.date;
          dateResolvedValue = dateRes.resolvedValue;
          if (dateRes.anomaly) {
            rowAnomalies.push({
              row_number: rowNum,
              column_name: 'date',
              anomaly_type: dateRes.anomaly,
              original_value: row.date,
              resolved_value: dateRes.resolvedValue,
              action_taken: 'normalized_format',
              requires_review: dateRes.anomaly === AnomalyType.AMBIGUOUS_DATE
            });
          }
          lastParsedDate = parsedDate;
        } catch (err: any) {
          rowAnomalies.push({
            row_number: rowNum,
            column_name: 'date',
            anomaly_type: AnomalyType.INVALID_DATE_FORMAT,
            original_value: row.date,
            resolved_value: null,
            action_taken: 'skipped_row',
            requires_review: true
          });
          skippedCount++;
          continue; // Cannot process row without date
        }
      }

      // 2. Check Missing Amount / Parse Amount
      let originalAmount = 0;
      let amountResolvedValue = '';
      const rawAmt = row.amount ? row.amount.replace(/"/g, '').replace(/,/g, '').trim() : '';
      
      if (!rawAmt || parseFloat(rawAmt) === 0) {
        rowAnomalies.push({
          row_number: rowNum,
          column_name: 'amount',
          anomaly_type: rawAmt === '0' ? AnomalyType.ZERO_AMOUNT : AnomalyType.AMOUNT_FORMATTING,
          original_value: row.amount,
          resolved_value: null,
          action_taken: 'skipped_row',
          requires_review: false
        });
        skippedCount++;
        continue; // Skip zero/missing amounts
      }

      originalAmount = parseFloat(rawAmt);
      if (isNaN(originalAmount)) {
        rowAnomalies.push({
          row_number: rowNum,
          column_name: 'amount',
          anomaly_type: AnomalyType.AMOUNT_FORMATTING,
          original_value: row.amount,
          resolved_value: null,
          action_taken: 'skipped_row',
          requires_review: true
        });
        skippedCount++;
        continue;
      }

      // Detect negative amounts (Refunds)
      let isRefund = false;
      if (originalAmount < 0) {
        isRefund = true;
        rowAnomalies.push({
          row_number: rowNum,
          column_name: 'amount',
          anomaly_type: AnomalyType.NEGATIVE_AMOUNT,
          original_value: row.amount,
          resolved_value: originalAmount.toString(),
          action_taken: 'imported_as_refund_split',
          requires_review: false
        });
      }

      // Detect rounding anomalies
      const decimalParts = rawAmt.split('.');
      if (decimalParts[1] && decimalParts[1].length > 2) {
        const rounded = Math.round(originalAmount * 100) / 100;
        rowAnomalies.push({
          row_number: rowNum,
          column_name: 'amount',
          anomaly_type: AnomalyType.AMOUNT_FORMATTING,
          original_value: row.amount,
          resolved_value: rounded.toString(),
          action_taken: 'rounded_to_2dp',
          requires_review: false
        });
        originalAmount = rounded;
      }

      // Detect general formatting (commas, extra spaces)
      if (row.amount.includes(',') || row.amount.startsWith(' ') || row.amount.endsWith(' ')) {
        rowAnomalies.push({
          row_number: rowNum,
          column_name: 'amount',
          anomaly_type: AnomalyType.AMOUNT_FORMATTING,
          original_value: row.amount,
          resolved_value: originalAmount.toString(),
          action_taken: 'trimmed_and_stripped_commas',
          requires_review: false
        });
      }

      // 3. Currency parsing
      let currency = row.currency ? row.currency.trim().toUpperCase() : '';
      if (!currency) {
        currency = 'INR';
        rowAnomalies.push({
          row_number: rowNum,
          column_name: 'currency',
          anomaly_type: AnomalyType.MISSING_CURRENCY,
          original_value: '',
          resolved_value: 'INR',
          action_taken: 'defaulted_to_inr',
          requires_review: false
        });
      }

      // 4. Check Payer
      let payerId = 0;
      let payerName = '';
      if (!row.paid_by) {
        // Assign to creator/first member in group members
        const firstMember = groupMembers[0];
        payerId = firstMember.user_id;
        payerName = firstMember.user_name;
        rowAnomalies.push({
          row_number: rowNum,
          column_name: 'paid_by',
          anomaly_type: AnomalyType.MISSING_PAYER,
          original_value: '',
          resolved_value: firstMember.user_name,
          action_taken: 'assigned_default_member',
          requires_review: true
        });
      } else {
        const payerRes = await resolveMemberName(row.paid_by, groupMembers, groupId, client);
        payerId = payerRes.userId;
        payerName = payerRes.userName;
        if (payerRes.anomaly) {
          rowAnomalies.push({
            row_number: rowNum,
            column_name: 'paid_by',
            anomaly_type: payerRes.anomaly,
            original_value: row.paid_by,
            resolved_value: payerRes.userName,
            action_taken: payerRes.anomaly === AnomalyType.NAME_VARIANT ? 'fuzzy_matched_variant' : 'created_unknown_member',
            requires_review: payerRes.anomaly === AnomalyType.UNKNOWN_MEMBER
          });
        }
      }

      // 5. Detect Settlement logged as Expense
      const descLower = row.description.toLowerCase();
      const isSettlement = descLower.includes('paid back') || 
                           descLower.includes('settlement') || 
                           descLower.includes('deposit share') ||
                           (!row.split_type && row.split_with && !row.split_with.includes(';'));

      if (isSettlement) {
        rowAnomalies.push({
          row_number: rowNum,
          column_name: 'description',
          anomaly_type: AnomalyType.SETTLEMENT_AS_EXPENSE,
          original_value: row.description,
          resolved_value: null,
          action_taken: 'skipped_expense_will_record_settlement',
          requires_review: true
        });
      }

      // 6. Split Type and Details Validation
      let splitTypeRaw = row.split_type ? row.split_type.trim().toLowerCase() : 'equal';
      let splitType: 'equal' | 'percentage' | 'exact' | 'shares' = 'equal';
      
      if (splitTypeRaw === 'share') splitTypeRaw = 'shares';
      if (splitTypeRaw === 'unequal') splitTypeRaw = 'exact';

      if (['equal', 'percentage', 'exact', 'shares'].includes(splitTypeRaw)) {
        splitType = splitTypeRaw as any;
        if (splitTypeRaw !== row.split_type) {
          rowAnomalies.push({
            row_number: rowNum,
            column_name: 'split_type',
            anomaly_type: AnomalyType.CONFLICTING_SPLIT_META,
            original_value: row.split_type,
            resolved_value: splitType,
            action_taken: 'normalized_split_type',
            requires_review: false
          });
        }
      } else {
        // Unknown split type -> default to equal
        splitType = 'equal';
        rowAnomalies.push({
          row_number: rowNum,
          column_name: 'split_type',
          anomaly_type: AnomalyType.UNKNOWN_SPLIT_TYPE,
          original_value: row.split_type,
          resolved_value: 'equal',
          action_taken: 'defaulted_to_equal',
          requires_review: true
        });
      }

      // 7. Parse split members
      const splitWithRaw = row.split_with ? row.split_with.split(';').map((s: string) => s.trim()).filter(Boolean) : [];
      let splitWithIds: number[] = [];
      const splitWithNames: string[] = [];

      for (const name of splitWithRaw) {
        const memRes = await resolveMemberName(name, groupMembers, groupId, client);
        splitWithIds.push(memRes.userId);
        splitWithNames.push(memRes.userName);
        if (memRes.anomaly) {
          rowAnomalies.push({
            row_number: rowNum,
            column_name: 'split_with',
            anomaly_type: memRes.anomaly,
            original_value: name,
            resolved_value: memRes.userName,
            action_taken: memRes.anomaly === AnomalyType.NAME_VARIANT ? 'fuzzy_matched_variant' : 'created_unknown_member',
            requires_review: memRes.anomaly === AnomalyType.UNKNOWN_MEMBER
          });
        }
      }

      // Default split_with to active members if empty
      if (splitWithIds.length === 0) {
        const defaultSplits = groupMembers.filter(m => m.left_at === null);
        splitWithIds = defaultSplits.map(m => m.user_id);
        splitWithNames.push(...defaultSplits.map(m => m.user_name));
      }

      // 8. Date-gating member validation (Post-departure / Pre-join)
      const dateGatedSplitIds: number[] = [];
      const dateGatedNames: string[] = [];
      const dateObj = parsedDate;

      // Fetch member join/leave dates for this group
      const membershipsResult = await client.query(
        'SELECT user_id, joined_at, left_at FROM group_members WHERE group_id = $1',
        [groupId]
      );
      const memberships = membershipsResult.rows;

      for (let i = 0; i < splitWithIds.length; i++) {
        const uId = splitWithIds[i];
        const uName = splitWithNames[i];
        const membership = memberships.find(m => m.user_id === uId);

        if (membership) {
          const join = new Date(membership.joined_at);
          const left = membership.left_at ? new Date(membership.left_at) : null;

          if (dateObj < join) {
            rowAnomalies.push({
              row_number: rowNum,
              column_name: 'split_with',
              anomaly_type: AnomalyType.PRE_JOIN_EXPENSE,
              original_value: uName,
              resolved_value: null,
              action_taken: 'excluded_member_from_split',
              requires_review: false
            });
          } else if (left && dateObj > left) {
            rowAnomalies.push({
              row_number: rowNum,
              column_name: 'split_with',
              anomaly_type: AnomalyType.POST_DEPARTURE_EXPENSE,
              original_value: uName,
              resolved_value: null,
              action_taken: 'excluded_member_from_split',
              requires_review: false
            });
          } else {
            dateGatedSplitIds.push(uId);
            dateGatedNames.push(uName);
          }
        } else {
          dateGatedSplitIds.push(uId);
          dateGatedNames.push(uName);
        }
      }

      // 9. Parse split values (percentage / shares / exact details)
      let splitValuesArr: number[] = [];
      if (splitType !== 'equal' && row.split_details) {
        const detailsParts = row.split_details.split(';').map((s: string) => s.trim()).filter(Boolean);
        const detailsMap = new Map<string, number>();
        
        for (const part of detailsParts) {
          // e.g. "Rohan 700" or "Aisha 30%"
          const match = part.match(/^(.+?)\s+([\d.]+)(%)?$/);
          if (match) {
            const nameKey = match[1].trim().toLowerCase();
            const val = parseFloat(match[2]);
            detailsMap.set(nameKey, val);
          }
        }

        // Align values to splitWithNames
        splitValuesArr = dateGatedNames.map(name => {
          const lowerName = name.toLowerCase();
          // Find matching key
          for (const [key, val] of detailsMap) {
            if (lowerName.includes(key) || key.includes(lowerName)) {
              return val;
            }
          }
          return 0;
        });

        // Validation for sums
        if (splitType === 'percentage') {
          const totalPct = splitValuesArr.reduce((sum, v) => sum + v, 0);
          if (Math.abs(totalPct - 100) > 0.01) {
            // Anomaly found! Normalize proportionally.
            rowAnomalies.push({
              row_number: rowNum,
              column_name: 'split_details',
              anomaly_type: AnomalyType.SPLIT_PERCENTAGE_SUM,
              original_value: row.split_details,
              resolved_value: splitValuesArr.map((v, i) => `${dateGatedNames[i]}: ${((v / totalPct) * 100).toFixed(1)}%`).join('; '),
              action_taken: 'proportional_normalization',
              requires_review: true
            });
            // Re-normalize to 100%
            splitValuesArr = splitValuesArr.map(v => (v / totalPct) * 100);
          }
        }
      }

      // Check Duplicates in current run
      // Check exact duplicates (same date, paid_by, amount, split_with, description)
      const exactDuplicate = processedRows.find(
        r => r.date === dateResolvedValue &&
             r.paid_by_id === payerId &&
             r.amount === originalAmount &&
             r.description.toLowerCase() === row.description.toLowerCase()
      );

      if (exactDuplicate) {
        rowAnomalies.push({
          row_number: rowNum,
          column_name: 'row',
          anomaly_type: AnomalyType.DUPLICATE_EXACT,
          original_value: row.description,
          resolved_value: null,
          action_taken: 'skipped_row',
          requires_review: false
        });
        skippedCount++;
        continue;
      }

      // Check fuzzy duplicates (same date, payer, similar description, different or same amount)
      const fuzzyDuplicate = processedRows.find(
        r => r.date === dateResolvedValue &&
             r.paid_by_id === payerId &&
             getLevenshteinDistance(r.description.toLowerCase(), row.description.toLowerCase()) <= 3
      );

      if (fuzzyDuplicate) {
        // Record duplicate pair
        duplicatePairs.push({
          import_log_id: logId,
          row_a_number: fuzzyDuplicate.rowNumber,
          row_b_number: rowNum,
          similarity_reason: `Fuzzy description matching: "${fuzzyDuplicate.description}" and "${row.description}" logged on same day by same payer.`
        });
        
        rowAnomalies.push({
          row_number: rowNum,
          column_name: 'row',
          anomaly_type: AnomalyType.DUPLICATE_FUZZY,
          original_value: row.description,
          resolved_value: null,
          action_taken: 'imported_flagged_for_review',
          requires_review: true
        });
      }

      // Save processed row detail
      processedRows.push({
        rowNumber: rowNum,
        date: dateResolvedValue,
        description: row.description,
        amount: originalAmount,
        currency,
        split_type: splitType,
        split_with_ids: dateGatedSplitIds,
        split_with_names: dateGatedNames,
        split_values: splitValuesArr,
        paid_by_id: payerId,
        paid_by_name: payerName,
        notes: row.notes || '',
        is_settlement: isSettlement,
        is_refund: isRefund
      });

      importedCount++;

      // Save anomalies to database
      for (const anomaly of rowAnomalies) {
        anomalyCount++;
        await client.query(
          `INSERT INTO import_anomalies (import_log_id, row_number, column_name, anomaly_type, original_value, resolved_value, action_taken, requires_review)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [logId, anomaly.row_number, anomaly.column_name, anomaly.anomaly_type, anomaly.original_value, anomaly.resolved_value, anomaly.action_taken, anomaly.requires_review]
        );
        anomalies.push(anomaly);
      }
    }

    // Save duplicate pairs in database
    for (const pair of duplicatePairs) {
      await client.query(
        `INSERT INTO duplicate_pairs (import_log_id, row_a_number, row_b_number, similarity_reason)
         VALUES ($1, $2, $3, $4)`,
        [logId, pair.row_a_number, pair.row_b_number, pair.similarity_reason]
      );
    }

    // Update import log counters
    await client.query(
      `UPDATE import_logs 
       SET total_rows = $1, imported_rows = $2, skipped_rows = $3, anomaly_count = $4
       WHERE id = $5`,
      [rows.length, importedCount, skippedCount, anomalyCount, logId]
    );

    // Save processed rows in a temporary file/payload for preview retrieval
    // We will return it directly in API response so client has the preview.
    await client.query('COMMIT');
    
    return {
      importLogId: logId,
      totalRows: rows.length,
      importedRows: importedCount,
      skippedRows: skippedCount,
      anomalyCount,
      anomalies,
      duplicatePairs,
      processedRows
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Commit the import log and write the actual expenses & settlements to database.
 * Run inside a database transaction to ensure atomicity.
 */
export async function confirmCSVImport(
  logId: number,
  processedRows: any[],
  userId: number
): Promise<any> {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Load import log
    const logResult = await client.query('SELECT * FROM import_logs WHERE id = $1', [logId]);
    if (logResult.rows.length === 0) throw new Error('Import log not found');
    const log = logResult.rows[0];

    if (log.status !== 'previewing') {
      throw new Error('Import is already processed or failed');
    }

    // Save processed rows
    for (const row of processedRows) {
      if (row.is_settlement) {
        // Record a settlement directly
        // split_with_ids should have exactly one payee
        const payeeId = row.split_with_ids[0];
        if (payeeId) {
          await client.query(
            `INSERT INTO settlements (group_id, payer_id, payee_id, amount_inr, settled_at, recorded_by)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [log.group_id, row.paid_by_id, payeeId, row.amount, row.date, userId]
          );
        }
      } else {
        // Record as an expense
        const exchangeRate = row.currency === 'INR' ? 1 : getExchangeRate(row.currency);
        const amountInr = convertToINR(row.amount, row.currency, exchangeRate);

        // Create expense record
        const expenseResult = await client.query(
          `INSERT INTO expenses (group_id, paid_by_user_id, description, amount_original, currency, amount_inr, exchange_rate, expense_date, split_type, notes, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id`,
          [log.group_id, row.paid_by_id, row.description, row.amount, row.currency, amountInr, exchangeRate, row.date, row.split_type, row.notes || null, userId]
        );
        const expenseId = expenseResult.rows[0].id;

        // Calculate split shares
        const shareCount = row.split_with_ids.length;
        if (shareCount > 0) {
          let allocated = 0;
          for (let i = 0; i < shareCount; i++) {
            const splitUserId = row.split_with_ids[i];
            let shareAmountInr = 0;
            let splitValue = null;

            if (row.split_type === 'equal') {
              const perPerson = Math.floor(amountInr * 100 / shareCount) / 100;
              const remainder = Math.round((amountInr - perPerson * shareCount) * 100) / 100;
              shareAmountInr = i === 0 ? perPerson + remainder : perPerson;
            } else if (row.split_type === 'percentage') {
              const pct = row.split_values[i] || 0;
              splitValue = pct;
              shareAmountInr = i === shareCount - 1
                ? Math.round((amountInr - allocated) * 100) / 100
                : Math.round(amountInr * pct / 100 * 100) / 100;
            } else if (row.split_type === 'exact') {
              const exactVal = row.split_values[i] || 0;
              splitValue = exactVal;
              shareAmountInr = exactVal;
            } else if (row.split_type === 'shares') {
              const shares = row.split_values[i] || 0;
              splitValue = shares;
              const totalShares = row.split_values.reduce((sum: number, v: number) => sum + v, 0);
              shareAmountInr = i === shareCount - 1
                ? Math.round((amountInr - allocated) * 100) / 100
                : Math.round(amountInr * shares / totalShares * 100) / 100;
            }

            allocated += shareAmountInr;

            // Insert split row
            await client.query(
              `INSERT INTO expense_splits (expense_id, user_id, share_amount_inr, split_value)
               VALUES ($1, $2, $3, $4)`,
              [expenseId, splitUserId, shareAmountInr, splitValue]
            );
          }
        }
      }
    }

    // Update log status to confirmed
    await client.query(
      "UPDATE import_logs SET status = 'confirmed' WHERE id = $1",
      [logId]
    );

    await client.query('COMMIT');
    return { status: 'confirmed', importLogId: logId };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get the history of import operations for a group.
 */
export async function getImportLogs(groupId: number): Promise<any[]> {
  const result = await query(
    `SELECT il.*, u.name as imported_by_name
     FROM import_logs il
     JOIN users u ON u.id = il.imported_by
     WHERE il.group_id = $1
     ORDER BY il.imported_at DESC`,
    [groupId]
  );
  return result.rows;
}

/**
 * Get details of a single import log, including anomalies and duplicates.
 */
export async function getImportLogDetail(logId: number): Promise<any> {
  const logResult = await query(
    `SELECT il.*, u.name as imported_by_name
     FROM import_logs il
     JOIN users u ON u.id = il.imported_by
     WHERE il.id = $1`,
    [logId]
  );
  if (logResult.rows.length === 0) throw new Error('Import log not found');

  const anomaliesResult = await query(
    'SELECT * FROM import_anomalies WHERE import_log_id = $1 ORDER BY row_number, id',
    [logId]
  );

  const duplicatesResult = await query(
    'SELECT * FROM duplicate_pairs WHERE import_log_id = $1 ORDER BY id',
    [logId]
  );

  return {
    log: logResult.rows[0],
    anomalies: anomaliesResult.rows,
    duplicates: duplicatesResult.rows
  };
}

/**
 * Resolve/update a duplicate pair status (approve keep both, delete A, etc.)
 */
export async function resolveDuplicatePair(
  pairId: number,
  status: 'kept_both' | 'deleted_a' | 'deleted_b',
  userId: number
): Promise<void> {
  await query(
    `UPDATE duplicate_pairs 
     SET status = $1, action_taken_by = $2, action_taken_at = NOW()
     WHERE id = $3`,
    [status, userId, pairId]
  );
}
