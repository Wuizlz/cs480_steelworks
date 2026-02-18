// File: src/ops-weekly-summary/repository.ts

import {
  ExcludedCountRow,
  UnderlyingRecord,
  UnderlyingRecordsQuery,
  WeekRange,
  WeeklySummaryRow,
} from './types';

// Repository contract for raw SQL access (no ORM). Implementations must apply
// normalization and exclusion rules per schema + ACs.
export interface WeeklyIssueSummaryRepository {
  fetchWeeklySummary(range: WeekRange): Promise<WeeklySummaryRow[]>;
  fetchExcludedCounts(range: WeekRange): Promise<ExcludedCountRow[]>;
  fetchUnderlyingRecords(query: UnderlyingRecordsQuery): Promise<UnderlyingRecord[]>;
}
