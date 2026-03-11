"use strict";
// File: src/ops-weekly-summary/service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeeklyIssueSummaryService = void 0;
class WeeklyIssueSummaryService {
  constructor(repo) {
    this.repo = repo;
  }
  // Returns the weekly summary rows and excluded counts for a selected week range (AC1–AC3, AC12).
  async getWeeklySummaryReport(range) {
    void range;
    throw new Error("Not implemented");
  }
  // Returns underlying records contributing to a weekly total for auditability (AC11).
  async getUnderlyingRecords(query) {
    void query;
    throw new Error("Not implemented");
  }
}
exports.WeeklyIssueSummaryService = WeeklyIssueSummaryService;
