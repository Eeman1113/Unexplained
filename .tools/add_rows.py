#!/usr/bin/env python3
"""Append pipe-delimited rows to the dataset with correct CSV quoting.

Reads '|'-separated records on stdin (one per line, 18 fields), validates
field count, id sequence, controlled vocabularies and absence of em dashes,
then appends properly quoted rows.
"""
import csv, io, sys

CSV = "unexplained_phenomena.csv"
STATUS = {"OPEN_HARD_PROBLEM","OPEN_TECHNICAL","PARTIALLY_EXPLAINED","DISPUTED",
          "LIKELY_MUNDANE","PSEUDO_RESOLVED","ANECDOTAL_UNVERIFIED"}
EVID = {"ROBUST","MODERATE","WEAK","NONE"}
REPRO = {"YES","NO","PARTIAL","ONE_OFF","NA"}

existing = list(csv.reader(io.open(CSV, encoding="utf-8")))
hdr, body = existing[0], existing[1:]
next_id = int(body[-1][0]) + 1 if body else 1
seen = {r[1].strip().lower() for r in body}

new, errs = [], []
for ln, line in enumerate(sys.stdin, 1):
    line = line.rstrip("\n")
    if not line.strip():
        continue
    f = [c.strip() for c in line.split("|")]
    if len(f) != 18:
        errs.append(f"line {ln}: {len(f)} fields, need 18 -> {f[1][:50] if len(f)>1 else f[0][:50]}")
        continue
    if f[0] != str(next_id):
        errs.append(f"line {ln}: id {f[0]} should be {next_id}")
    if f[9] not in STATUS:  errs.append(f"line {ln}: bad status_code {f[9]!r}")
    if f[10] not in EVID:   errs.append(f"line {ln}: bad evidence_strength {f[10]!r}")
    if f[11] not in REPRO:  errs.append(f"line {ln}: bad reproducible {f[11]!r}")
    if f[1].lower() in seen: errs.append(f"line {ln}: duplicate phenomenon {f[1]!r}")
    if "—" in line or "–" in line:
        errs.append(f"line {ln}: contains an em or en dash")
    seen.add(f[1].lower())
    new.append(f); next_id += 1

if errs:
    print("REJECTED, nothing written:", file=sys.stderr)
    for e in errs[:40]: print("  " + e, file=sys.stderr)
    sys.exit(1)

with io.open(CSV, "a", encoding="utf-8", newline="") as fh:
    csv.writer(fh, lineterminator="\n").writerows(new)

rows = list(csv.reader(io.open(CSV, encoding="utf-8")))
assert all(len(r) == 18 for r in rows), "field count broke"
print(f"appended {len(new)} rows, total {len(rows)-1}")
