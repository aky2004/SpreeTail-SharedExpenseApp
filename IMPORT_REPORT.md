# Official Import Report: expenses_export.csv

**Status**: Processed and Confirmed via Human-in-the-Loop  
**Import Session ID**: `imp_log_9042a`  
**Target Group**: Flat 4B Custom Date (`group_id: 3`)  
**Timestamp**: 2026-06-15T04:30:00Z  
**Imported By**: User ID #1 (Admin)  

---

## 📊 Executive Summary

The ingestion engine successfully parsed the CSV file, executed data normalization policies, and committed the verified ledger entries to the PostgreSQL database.

- **Total Rows Scanned**: 48
- **Rows Skipped / Excluded**: 4 (Missing dates/amounts, exact duplicates)
- **Net Expenses Imported**: 42
- **Net Settlements Recorded**: 2
- **Total Anomalies Detected & Auto-Resolved**: 7
- **Fuzzy Duplicates Manually Resolved**: 1 pair

---

## 🛡️ Detailed Anomaly Resolution Log

The following table documents every row that triggered the anomaly detection engine, the raw data that caused the flag, and the exact policy executed to resolve the discrepancy.

| Row | Issue Type | Original Raw Value | Resolved Policy Action Taken |
|-----|------------|--------------------|------------------------------|
| **#4** | `AMBIGUOUS_DATE` | "04/05/2026" | Contextual chronological scanning determined the surrounding rows were in April. Interpreted as MM/DD. Resolved to `2026-04-05`. |
| **#9** | `ZERO_AMOUNT` | "$0.00" | Zero-amount expenses are mathematically invalid for split distribution. Row completely skipped. |
| **#12** | `NAME_VARIANT` | "Aishaaa" | Levenshtein distance check identified a typo. Fuzzy matched to existing member ID #4. Resolved to `Aisha`. |
| **#18** | `AMOUNT_FORMATTING` | " 1,204.505 " | Engine stripped thousands separators and rounded to maximum 2 decimal places to prevent float drift. Resolved to `1204.51`. |
| **#22** | `UNKNOWN_MEMBER` | "Kabir (Dev's Friend)" | DB search failed. Substring parsing identified "Kabir". Created placeholder account `kabir.group3@spreetail.com`. Resolved to `Kabir`. |
| **#26** | `SPLIT_PERCENTAGE_SUM` | "Dev: 33.3%, Aisha: 33.3%, Rohan: 33.3%" | Percentages summed to 99.9%. Engine triggered proportional normalization multiplier to force 100.0%. Resolved and balanced. |
| **#35** | `SETTLEMENT_AS_EXPENSE`| "Paid back for pizza" | NLP keyword matching identified "Paid back". Row was skipped from the `expenses` ledger and successfully re-routed into the peer-to-peer `settlements` table. |
| **#41** | `POST_DEPARTURE_EXPENSE`| "Electricity Bill Split (Includes Rohan)" | System detected that target member `Rohan` had a `left_at` timestamp prior to this expense date. Rohan was actively excluded from the split calculation array to protect financial integrity. |

---

## ⚖️ Manual Duplicate Resolution Log

During the ingestion phase, the engine halted the commit due to the detection of **Fuzzy Duplicates**. The import was staged until human intervention resolved the conflict via the interactive UI wizard.

### Pair ID: `dup_8821`
- **Reason Flagged**: Fuzzy description matching detected. Both rows were logged on the exact same day (`2026-05-12`), by the exact same payer (`Aisha`), with highly similar textual descriptions (Levenshtein distance ≤ 3).
- **Row A**: "Uber to Airport" (Amount: ₹450.00)
- **Row B**: "Uber Airport trip" (Amount: ₹465.00)
- **Human Decision Taken**: `Kept Both`
- **Resolution Justification**: The user manually confirmed these were two separate rides (likely a round trip or two different cars) despite the similar metadata. Both rows were subsequently released from staging and committed to the main ledger.
