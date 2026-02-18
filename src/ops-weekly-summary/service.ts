// File: src/ops-weekly-summary/service.ts

import {
  UnderlyingRecord,
  UnderlyingRecordsQuery,
  WeekRange,
  WeeklyIssueSummaryReport,
} from './types';
import { WeeklyIssueSummaryRepository } from './repository';

export class WeeklyIssueSummaryService {
  constructor(private readonly repo: WeeklyIssueSummaryRepository) {}

  // Returns the weekly summary rows and excluded counts for a selected week range (AC1–AC3, AC12).
  async getWeeklySummaryReport(range: WeekRange): Promise<WeeklyIssueSummaryReport> {
    throw new Error('Not implemented');
  }

  // Returns underlying records contributing to a weekly total for auditability (AC11).
  async getUnderlyingRecords(
    query: UnderlyingRecordsQuery
  ): Promise<UnderlyingRecord[]> {
    throw new Error('Not implemented');
  }
}
