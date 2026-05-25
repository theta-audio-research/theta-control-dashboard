#!/usr/bin/env python3
"""
Create a starter Control Room delta JSON file.

Example:
  python tools/make_delta_template.py --project FOCUSGRID --version v0.3.2 --status blocked --out deltas/focusgrid.json
"""

import argparse
import json
from datetime import date
from pathlib import Path

def project_id(name: str) -> str:
    return name.strip().lower().replace("_", "-").replace(" ", "-")

parser = argparse.ArgumentParser()
parser.add_argument("--project", required=True)
parser.add_argument("--version", default="Needs confirmation")
parser.add_argument("--status", default="blocked", choices=["active", "blocked", "decision", "parked", "historical"])
parser.add_argument("--out", default="")
args = parser.parse_args()

pid = project_id(args.project)
payload = {
    "schemaVersion": "1.0",
    "type": "project_delta",
    "date": date.today().isoformat(),
    "title": "THETA Control Room — Project Delta",
    "mode": "Changed projects only.",
    "allowNewProjects": False,
    "changedProjects": [
        {
            "id": pid,
            "changeType": "Project update",
            "status": args.status,
            "latestVersion": args.version,
            "shipReadiness": 10,
            "sourceCertainty": "medium",
            "lastKnownStatus": "Update this field.",
            "blocker": "Update this field.",
            "nextAction": "Update this field.",
            "tomorrowFirstAction": "Update this field.",
            "endStatus": "Update this field."
        }
    ],
    "dashboardUpdateDecision": {
        "dashboardDataChanged": True,
        "tomorrowFirstControlRoomAction": "Review dashboard and continue active projects."
    }
}

text = json.dumps(payload, indent=2)
if args.out:
    path = Path(args.out)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text + "\n", encoding="utf-8")
    print(path)
else:
    print(text)
