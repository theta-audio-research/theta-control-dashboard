# THETA Control Room v3.2 — Test Tickets + Return Packets

## What this adds

Each project now has `testTickets[]` and a Project Detail ticket section.

The UI supports:

- Open Test Questions
- clickable checkbox for pass
- status dropdown: open / passed / failed / blocked
- tester field
- version tested field
- notes textbox
- completed/archive section
- Generate Return Packet button

## API settings

Ticket saving from the dashboard uses:

```text
CONTROL_ROOM_API
CONTROL_ROOM_TOKEN
```

The dashboard has an API settings area in the ticket panel.

Default API:

```text
https://theta-control-room-automation.steveneal.workers.dev
```

Paste the Control Room token once into the browser field and click **Save API settings**.
The token is stored only in this browser's `localStorage`.

## Worker endpoints

```text
POST /api/ticket
POST /api/ticket/complete
POST /api/return-packet
```

## Return packet path

Generated return packets are committed to:

```text
reports/return-packets/
```

## Archive path

Passed ticket archive JSON is committed to:

```text
tickets/archive/<project-id>/
```
