// ============================================
// Shared TypeScript types for EXPensio
// ============================================

// --- Database Row Types ---

export interface User {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  avatar_url: string | null;
  created_at: Date;
}

export interface Group {
  id: number;
  name: string;
  invite_code: string;
  created_by: number | null;
  created_at: Date;
}

export interface GroupMember {
  id: number;
  group_id: number;
  user_id: number;
  joined_at: Date;  // DATE type — day granularity
  left_at: Date | null;
}

export type SplitType = 'equal' | 'percentage' | 'exact' | 'shares';

export interface Expense {
  id: number;
  group_id: number;
  paid_by_user_id: number;
  description: string;
  amount_original: number;
  currency: string;
  amount_inr: number;
  exchange_rate: number;
  expense_date: Date;
  split_type: SplitType;
  notes: string | null;
  created_by: number | null;
  created_at: Date;
  is_deleted: boolean;
}

export interface ExpenseSplit {
  id: number;
  expense_id: number;
  user_id: number;
  share_amount_inr: number;
  split_value: number | null;
}

export interface Settlement {
  id: number;
  group_id: number;
  payer_id: number;
  payee_id: number;
  amount_inr: number;
  settled_at: Date;
  recorded_by: number | null;
  created_at: Date;
}

export type ImportStatus = 'pending' | 'previewing' | 'confirmed' | 'failed';

export interface ImportLog {
  id: number;
  group_id: number;
  file_name: string;
  imported_by: number | null;
  imported_at: Date;
  total_rows: number;
  imported_rows: number;
  skipped_rows: number;
  anomaly_count: number;
  status: ImportStatus;
}

export interface ImportAnomaly {
  id: number;
  import_log_id: number;
  row_number: number;
  column_name: string | null;
  anomaly_type: string;
  original_value: string | null;
  resolved_value: string | null;
  action_taken: string;
  requires_review: boolean;
  resolved_by: number | null;
  resolved_at: Date | null;
}

export type DuplicateStatus = 'pending' | 'kept_both' | 'deleted_a' | 'deleted_b' | 'merged';

export interface DuplicatePair {
  id: number;
  import_log_id: number;
  row_a_number: number;
  row_b_number: number;
  similarity_reason: string;
  status: DuplicateStatus;
  action_taken_by: number | null;
  action_taken_at: Date | null;
}

// --- API Request/Response Types ---

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: Omit<User, 'password_hash'>;
  accessToken: string;
}

export interface CreateGroupRequest {
  name: string;
}

export interface AddMemberRequest {
  email?: string;
  user_id?: number;
  joined_at: string;  // ISO date string
}

export interface CreateExpenseRequest {
  description: string;
  amount_original: number;
  currency: string;
  exchange_rate: number;
  expense_date: string;  // ISO date string
  split_type: SplitType;
  split_with: number[];  // user IDs
  split_values?: number[];  // parallel array: percentages, exact amounts, or shares
  notes?: string;
  paid_by_user_id?: number;
}

export interface RecordSettlementRequest {
  payee_id: number;
  amount_inr: number;
  settled_at?: string;
  notes?: string;
}

// --- Balance Types ---

export interface NetBalance {
  userId: number;
  userName: string;
  amount: number;  // positive = owed to them, negative = they owe
}

export interface SimplifiedDebt {
  from: number;
  fromName: string;
  to: number;
  toName: string;
  amount: number;
}

export interface GroupBalanceResult {
  netBalances: NetBalance[];
  simplifiedDebts: SimplifiedDebt[];
}

// --- Import Types ---

export enum AnomalyType {
  DUPLICATE_EXACT = 'DUPLICATE_EXACT',
  DUPLICATE_FUZZY = 'DUPLICATE_FUZZY',
  SETTLEMENT_AS_EXPENSE = 'SETTLEMENT_AS_EXPENSE',
  POST_DEPARTURE_EXPENSE = 'POST_DEPARTURE_EXPENSE',
  PRE_JOIN_EXPENSE = 'PRE_JOIN_EXPENSE',
  INVALID_DATE_FORMAT = 'INVALID_DATE_FORMAT',
  MISSING_PAYER = 'MISSING_PAYER',
  NEGATIVE_AMOUNT = 'NEGATIVE_AMOUNT',
  ZERO_AMOUNT = 'ZERO_AMOUNT',
  SPLIT_PERCENTAGE_SUM = 'SPLIT_PERCENTAGE_SUM',
  SPLIT_AMOUNT_SUM = 'SPLIT_AMOUNT_SUM',
  UNKNOWN_SPLIT_TYPE = 'UNKNOWN_SPLIT_TYPE',
  UNKNOWN_MEMBER = 'UNKNOWN_MEMBER',
  MISSING_CURRENCY = 'MISSING_CURRENCY',
  AMOUNT_FORMATTING = 'AMOUNT_FORMATTING',
  CONFLICTING_SPLIT_META = 'CONFLICTING_SPLIT_META',
  NAME_VARIANT = 'NAME_VARIANT',
  AMBIGUOUS_DATE = 'AMBIGUOUS_DATE',
}

export interface CSVRow {
  rowNumber: number;
  date: string;
  description: string;
  paid_by: string;
  amount: string;
  currency: string;
  split_type: string;
  split_with: string;
  split_details: string;
  notes: string;
}

export interface ProcessedRow extends CSVRow {
  status: 'ok' | 'flagged' | 'skipped';
  anomalies: DetectedAnomaly[];
  parsedDate?: Date;
  parsedAmount?: number;
  parsedCurrency?: string;
  resolvedPayer?: string;
  resolvedSplitWith?: string[];
}

export interface DetectedAnomaly {
  rowNumber: number;
  columnName: string;
  anomalyType: AnomalyType;
  originalValue: string;
  resolvedValue: string | null;
  actionTaken: string;
  requiresReview: boolean;
}

// --- Express extensions ---

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        name: string;
      };
    }
  }
}
