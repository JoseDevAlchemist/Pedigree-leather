"""Append an offline item-push event from explicit evidence."""

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re

from catalogue_bulk_import import batch_id_for_plan


PHASE_OUTCOMES = {
    "preparation": {"PREPARED", "FAILED"},
    "validation": {"TESTED", "FAILED"},
    "approval": {"APPROVED", "SKIPPED"},
    "execution": {"IMPORTED", "SKIPPED", "FAILED"},
}
OUTCOMES = ("PREPARED", "TESTED", "APPROVED", "IMPORTED", "SKIPPED", "FAILED")


def activity_event(plan, outcome, project=None, receipt=None, sqlstate=None):
    if outcome not in OUTCOMES:
        raise ValueError("Unknown activity status")
    if project is not None and not re.fullmatch(r"[a-z0-9]{20}", project):
        raise ValueError("Supply only the Supabase project ref")
    if outcome in {"APPROVED", "IMPORTED"} and not project:
        raise ValueError("A verified project ref is required")
    if outcome == "APPROVED" and not plan.get("products"):
        raise ValueError("An empty plan cannot be approved")
    digest = plan["workbook_sha256"]
    if not re.fullmatch(r"[a-f0-9]{64}", digest):
        raise ValueError("Invalid workbook SHA-256")
    batch = batch_id_for_plan(plan)
    event = {
        "event_at": datetime.now(timezone.utc).isoformat(),
        "outcome": outcome, "batch_id": batch, "workbook_sha256": digest,
        "project_ref": project,
    }
    if outcome == "FAILED":
        if not sqlstate or not re.fullmatch(r"[0-9A-Z]{5}", sqlstate) or sqlstate.startswith(("00", "01", "08")):
            raise ValueError("Provide a database SQLSTATE confirming failure, without raw error text")
        event["error_sqlstate"] = sqlstate
    if outcome == "IMPORTED":
        if not receipt or (
            receipt.get("confirmation"), receipt.get("batch_id"), receipt.get("workbook_sha256"),
            receipt.get("mismatched_variants")
        ) != ("COMMITTED", batch, digest, 0) or not receipt.get("imported_products", 0):
            raise ValueError("A matching, reconciled database receipt is required")
        event.update(imported_products=receipt["imported_products"], skipped_products=receipt["skipped_products"])
    return event


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("plan", type=Path)
    parser.add_argument("outcome", choices=OUTCOMES)
    parser.add_argument("--phase", required=True, choices=PHASE_OUTCOMES)
    parser.add_argument("--project-ref")
    parser.add_argument("--receipt", type=Path)
    parser.add_argument("--sqlstate")
    parser.add_argument("--log", type=Path,
                        default=Path("supabase/seeds/item-push/import-events.jsonl"))
    args = parser.parse_args()
    try:
        event = activity_event(
            json.loads(args.plan.read_text(encoding="utf-8")),
            args.outcome, args.project_ref,
            json.loads(args.receipt.read_text(encoding="utf-8")) if args.receipt else None,
            args.sqlstate,
        )
    except (KeyError, ValueError) as error:
        parser.error(str(error))
    if args.outcome not in PHASE_OUTCOMES[args.phase]:
        parser.error("The status is not valid for this phase")
    event["phase"] = args.phase
    if args.outcome == "IMPORTED":
        history = args.log.read_text(encoding="utf-8").splitlines() if args.log.exists() else ()
        if not any(
            previous.get("outcome") == "APPROVED"
            and previous.get("batch_id") == event["batch_id"]
            and previous.get("project_ref") == event["project_ref"]
            for previous in map(json.loads, history)
        ):
            parser.error("Record explicit batch and project approval first")
    with args.log.open("a", encoding="utf-8") as log:
        log.write(json.dumps(event, sort_keys=True) + "\n")


if __name__ == "__main__":
    main()
