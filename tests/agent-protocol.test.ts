// The print-agent wire protocol (CR-DC-227 — extracted from the DC's two print-agent doors).
//
// The refusal CODES AND TEXT are the wire contract: the depot agent logs them verbatim, and the DC's
// own door specs assert them through the route. Every one is a written value here for the same reason.

import { describe, expect, it } from "vitest";

import {
  AGENT_ID_MAX_LENGTH,
  FAILURE_REASON_MAX_LENGTH,
  PRINT_AGENT_CLAIM_PATH,
  PRINT_AGENT_REPORT_PATH,
  parseClaimRequest,
  parseReportRequest,
  type ClaimedPrintJob,
} from "../src/agent-protocol";

const UUID = "123e4567-e89b-42d3-a456-426614174000";

describe("the doors", () => {
  it("are the two paths the depot agent knocks on", () => {
    expect(PRINT_AGENT_CLAIM_PATH).toBe("/api/print-agent/claim");
    expect(PRINT_AGENT_REPORT_PATH).toBe("/api/print-agent/report");
  });

  it("🔴 ClaimedPrintJob is an id, an address, some bytes and a count — and NOTHING else", () => {
    // Type-level: this object must satisfy the interface with EXACTLY these keys. Adding a key to the
    // interface breaks the `Record` check below at compile time (run by tsc in CI).
    const job: ClaimedPrintJob = {
      id: UUID,
      host: "10.0.0.5",
      port: 9100,
      payload: "^XA^XZ",
      copies: 1,
    };
    const keys: Record<keyof ClaimedPrintJob, true> = {
      id: true,
      host: true,
      port: true,
      payload: true,
      copies: true,
    };
    expect(Object.keys(job).sort()).toEqual(Object.keys(keys).sort());
  });
});

describe("parseClaimRequest", () => {
  it("accepts a warehouse UUID and defaults the agent id and the batch size", () => {
    expect(parseClaimRequest({ warehouse_id: ` ${UUID} ` })).toEqual({
      ok: true,
      warehouseId: UUID,
      agentId: "print-agent",
      requestedMax: 5,
    });
  });

  it("refuses a missing or malformed warehouse id with the wire's code and words", () => {
    const refused = {
      ok: false,
      code: "WAREHOUSE_ID_REQUIRED",
      message: "`warehouse_id` must be a warehouse UUID.",
    };
    expect(parseClaimRequest({})).toEqual(refused);
    expect(parseClaimRequest({ warehouse_id: "not-a-uuid" })).toEqual(refused);
    expect(parseClaimRequest({ warehouse_id: 42 })).toEqual(refused);
  });

  it("bounds the agent id (diagnosis only) and passes `max` through UNCLAMPED", () => {
    const parsed = parseClaimRequest({
      warehouse_id: UUID,
      agent_id: "a".repeat(AGENT_ID_MAX_LENGTH + 40),
      max: 9999,
    });
    expect(parsed.ok && parsed.agentId.length).toBe(AGENT_ID_MAX_LENGTH);
    expect(parsed.ok && parsed.requestedMax).toBe(9999);
  });

  it("ignores a non-numeric or non-finite `max`", () => {
    expect(parseClaimRequest({ warehouse_id: UUID, max: "9" })).toMatchObject({ requestedMax: 5 });
    expect(parseClaimRequest({ warehouse_id: UUID, max: Number.NaN })).toMatchObject({
      requestedMax: 5,
    });
  });
});

describe("parseReportRequest", () => {
  it("accepts a printed outcome with no reason", () => {
    expect(parseReportRequest({ job_id: UUID, outcome: "printed" })).toEqual({
      ok: true,
      jobId: UUID,
      outcome: "printed",
      failureReason: null,
    });
  });

  it("refuses a bad job id, then a bad outcome, in that order", () => {
    expect(parseReportRequest({ outcome: "printed" })).toEqual({
      ok: false,
      code: "JOB_ID_REQUIRED",
      message: "`job_id` must be a print-job UUID.",
    });
    expect(parseReportRequest({ job_id: UUID, outcome: "done" })).toEqual({
      ok: false,
      code: "OUTCOME_INVALID",
      message: "`outcome` must be 'printed' or 'failed'.",
    });
  });

  it("🔴 a failure with no reason is NOT an outcome", () => {
    expect(parseReportRequest({ job_id: UUID, outcome: "failed" })).toEqual({
      ok: false,
      code: "FAILURE_REASON_REQUIRED",
      message: "A failed print must carry `failure_reason`.",
    });
    expect(
      parseReportRequest({ job_id: UUID, outcome: "failed", failure_reason: "   " }),
    ).toMatchObject({
      ok: false,
      code: "FAILURE_REASON_REQUIRED",
    });
  });

  it("truncates a long failure reason rather than refusing it, and drops any reason on a printed job", () => {
    const failed = parseReportRequest({
      job_id: UUID,
      outcome: "failed",
      failure_reason: "x".repeat(FAILURE_REASON_MAX_LENGTH + 100),
    });
    expect(failed.ok && failed.failureReason?.length).toBe(FAILURE_REASON_MAX_LENGTH);
    expect(
      parseReportRequest({ job_id: UUID, outcome: "printed", failure_reason: "ignored" }),
    ).toMatchObject({ ok: true, failureReason: null });
  });
});
