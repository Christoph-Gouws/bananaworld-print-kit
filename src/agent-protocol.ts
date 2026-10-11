// The print-agent WIRE PROTOCOL — what a depot print agent and the app it polls say to each other
// (CR-DC-227, packhouse API-CHG-005; the DC's EPIC-025-M-03 doors, API-EP-098 / API-EP-099).
//
// The agent claims a batch of label jobs, opens a raw TCP socket to each printer itself, and reports
// back what the printer did. These are the shapes on that wire and the PURE validation of what the
// agent sends. Nothing here reaches a database, a socket, `process.env` or any server-only module: the
// spool (`public.print_job`), the SQL, the auth of the two doors and the audit rows are each app's.
//
// 🔴 `ClaimedPrintJob` IS THE WHOLE OF WHAT THE AGENT IS TOLD, AND NOTHING ELSE. The agent is a machine
//    on a depot LAN running a script somebody may one day copy onto a different machine; it holds no
//    database credential and no service-role JWT, and the way that stays true is that the only thing it
//    is ever handed is an id, an address, some bytes and a count. A widening here that leaked a
//    connection string, a warehouse id or an operator's name would redden the DC's key-set equality.

/** The two doors, as the agent addresses them. */
export const PRINT_AGENT_CLAIM_PATH = "/api/print-agent/claim";
export const PRINT_AGENT_REPORT_PATH = "/api/print-agent/report";

/** What the agent is told about a job. Exact key set — see the header. */
export interface ClaimedPrintJob {
  readonly id: string;
  readonly host: string;
  readonly port: number;
  readonly payload: string;
  readonly copies: number;
}

/** What the agent sends to claim. All three are `unknown` on the wire; `parseClaimRequest` narrows. */
export interface ClaimRequestBody {
  readonly warehouse_id?: unknown;
  readonly agent_id?: unknown;
  readonly max?: unknown;
}

/** What the agent sends to report. */
export interface ReportRequestBody {
  readonly job_id?: unknown;
  readonly outcome?: unknown;
  readonly failure_reason?: unknown;
}

export type PrintJobOutcome = "printed" | "failed";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Diagnosis only, so bounded: a runaway agent cannot write an unbounded string into the spool. */
export const AGENT_ID_MAX_LENGTH = 128;

/**
 * Truncated rather than refused: a socket error string is diagnostic text of unpredictable length, and
 * losing the tail of one is a far better outcome than losing the whole record of a failure.
 */
export const FAILURE_REASON_MAX_LENGTH = 500;

/** The agent's id when it sends none. */
const DEFAULT_AGENT_ID = "print-agent";
/** How many jobs it asks for when it does not say. The app still bounds it. */
const DEFAULT_CLAIM_MAX = 5;

export interface ProtocolRefusal {
  readonly ok: false;
  readonly code: string;
  readonly message: string;
}

export type ParsedClaimRequest =
  | {
      readonly ok: true;
      readonly warehouseId: string;
      readonly agentId: string;
      readonly requestedMax: number;
    }
  | ProtocolRefusal;

/**
 * Narrow a claim body. The refusal text is the wire contract: the agent logs it verbatim.
 *
 * ⚠ `requestedMax` is NOT clamped here. The app bounds it with the query it bounds; a second clamp on
 *   this side would be a second definition of the same ceiling — two numbers that agree today and drift
 *   the day one of them is tuned.
 */
export function parseClaimRequest(body: ClaimRequestBody): ParsedClaimRequest {
  const warehouseId = typeof body.warehouse_id === "string" ? body.warehouse_id.trim() : "";
  if (UUID_RE.test(warehouseId) === false) {
    return {
      ok: false,
      code: "WAREHOUSE_ID_REQUIRED",
      message: "`warehouse_id` must be a warehouse UUID.",
    };
  }
  const agentId =
    typeof body.agent_id === "string" && body.agent_id.trim().length > 0
      ? body.agent_id.trim().slice(0, AGENT_ID_MAX_LENGTH)
      : DEFAULT_AGENT_ID;
  const requestedMax =
    typeof body.max === "number" && Number.isFinite(body.max) ? body.max : DEFAULT_CLAIM_MAX;
  return { ok: true, warehouseId, agentId, requestedMax };
}

export type ParsedReportRequest =
  | {
      readonly ok: true;
      readonly jobId: string;
      readonly outcome: PrintJobOutcome;
      readonly failureReason: string | null;
    }
  | ProtocolRefusal;

/**
 * Narrow a report body.
 *
 * 🔴 A FAILURE WITH NO REASON IS NOT AN OUTCOME. It is the shape of a record that tells a person their
 *    label did not print and nothing else. Refused here, and the app's own CHECK constraint refuses it
 *    again in the database.
 */
export function parseReportRequest(body: ReportRequestBody): ParsedReportRequest {
  const jobId = typeof body.job_id === "string" ? body.job_id.trim() : "";
  if (UUID_RE.test(jobId) === false) {
    return { ok: false, code: "JOB_ID_REQUIRED", message: "`job_id` must be a print-job UUID." };
  }
  if (body.outcome !== "printed" && body.outcome !== "failed") {
    return {
      ok: false,
      code: "OUTCOME_INVALID",
      message: "`outcome` must be 'printed' or 'failed'.",
    };
  }
  const outcome = body.outcome;

  const rawReason = typeof body.failure_reason === "string" ? body.failure_reason.trim() : "";
  if (outcome === "failed" && rawReason.length === 0) {
    return {
      ok: false,
      code: "FAILURE_REASON_REQUIRED",
      message: "A failed print must carry `failure_reason`.",
    };
  }
  const failureReason = outcome === "failed" ? rawReason.slice(0, FAILURE_REASON_MAX_LENGTH) : null;
  return { ok: true, jobId, outcome, failureReason };
}
