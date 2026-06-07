#!/usr/bin/env python3
# THETA Control Room v3.8 — attach optional ticketPacket to a delta before sending.
# Usage: _attach_ticketpacket.py <delta.json> <tickets.json> [version]
# Non-fatal: any error is reported and the delta is left unchanged.
import json, sys

def main():
    if len(sys.argv) < 3:
        return
    delta_path, tickets_path = sys.argv[1], sys.argv[2]
    version = sys.argv[3] if len(sys.argv) > 3 else ""
    delta = json.load(open(delta_path))
    raw = json.load(open(tickets_path))
    if isinstance(raw, list):
        tickets, src, ver = raw, tickets_path, version
    elif isinstance(raw, dict):
        tickets = raw.get("tickets", [])
        src = raw.get("source", tickets_path)
        ver = raw.get("version", version)
    else:
        return
    if tickets:
        delta["ticketPacket"] = {"source": src, "version": ver, "tickets": tickets}
        json.dump(delta, open(delta_path, "w"), indent=2)
        sys.stderr.write(f"[hook] attached ticketPacket: {len(tickets)} tickets\n")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        sys.stderr.write(f"[hook] ticketPacket injection skipped: {e}\n")
    sys.exit(0)
