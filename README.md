# Unexplained Phenomena Dataset

A structured, honestly-annotated catalogue of **1000 phenomena that humans know happen (or are reported to happen) but cannot currently explain**, spanning fundamental physics, cosmology, biology, neuroscience, medicine, earth sciences, archaeology, cryptography, and anomalistics.

**File:** [`unexplained_phenomena.csv`](unexplained_phenomena.csv): 1000 rows × 18 columns, RFC-4180 compliant.

**[Explore it in the browser →](https://eeman1113.github.io/Unexplained/)** - filter by tier, field, evidence
quality and difficulty; every chart and the full record list re-render against the same slice. Works on phones.

## Why this isn't just another listicle

Most "unsolved mysteries" lists put the quantum measurement problem next to Bigfoot. That makes them useless. Every row here carries a `status_code` recording *what kind* of unexplained it is, plus independent columns for evidence quality and reproducibility, so you can filter down to the genuine hard core.

| `status_code` | n | Meaning |
|---|---:|---|
| `OPEN_HARD_PROBLEM` | 36 | May resist explanation in principle: consciousness, quantum measurement, P vs NP |
| `OPEN_TECHNICAL` | 352 | Genuinely unsolved but solvable in principle: dark matter, high-Tc superconductivity, abiogenesis |
| `PARTIALLY_EXPLAINED` | 403 | Mechanism partly known, real gaps remain: Tunguska, Dyatlov Pass, Cambrian explosion |
| `DISPUTED` | 159 | The *anomaly itself* is contested: Havana syndrome, Mpemba effect, cold fusion, phosphine on Venus |
| `LIKELY_MUNDANE` | 18 | Famous "mystery", boring answer: Rendlesham Forest, Phoenix Lights, cattle mutilations |
| `PSEUDO_RESOLVED` | 29 | Solved, yet still circulates as unexplained: crop circles, spontaneous human combustion |
| `ANECDOTAL_UNVERIFIED` | 3 | No verified phenomenon to explain: poltergeists, reincarnation cases |

Paired with:

- **`evidence_strength`**: ROBUST (671) / MODERATE (231) / WEAK (90) / NONE (8)
- **`reproducible`**: YES (342) / NO (382) / PARTIAL (86) / ONE_OFF (42) / NA (148)

## Schema

| Column | Description |
|---|---|
| `id` | Row identifier, 1 to 1000 |
| `phenomenon` | Name |
| `category` | Broad field (Fundamental physics, Biology, Archaeology, …) |
| `domain` | Specific subfield |
| `first_documented` | Year or era of first record |
| `locus` | Where/what it occurs in |
| `observation_summary` | What is actually observed |
| `why_it_resists_explanation` | The specific epistemic obstacle, not just "it's hard" |
| `leading_hypotheses` | Candidate explanations, mainstream first, fringe flagged as such |
| `status_code` | See table above |
| `evidence_strength` | ROBUST / MODERATE / WEAK / NONE |
| `reproducible` | YES / NO / PARTIAL / ONE_OFF / NA |
| `mainstream_view` | Where scientific consensus actually stands |
| `testable_prediction` | What would resolve it |
| `key_evidence_or_cases` | Landmark observations, experiments, incidents |
| `notable_names` | Key researchers, including prominent critics |
| `difficulty_1_10` | Subjective estimate of resolution difficulty |
| `implication_if_solved` | Why it would matter |

## Coverage

46 categories. Largest blocks:

| Field | Rows | Field | Rows |
|---|---:|---|---:|
| Biology | 223 | Mathematics | 20 |
| Medicine | 146 | History | 19 |
| Archaeology | 127 | Social science | 17 |
| Astronomy | 93 | Technology | 16 |
| Fundamental physics | 58 | Condensed matter physics | 14 |
| Geology | 45 | Oceanography | 14 |
| Anomalistics | 38 | Psychology | 14 |
| Neuroscience | 29 | Linguistics | 14 |
| Geophysics | 23 | Atmospheric science | 14 |

Remaining rows cover epigraphy and undeciphered scripts, paleoclimatology, machine learning, cryptography, archaeometry, metascience, maritime and aviation disappearances, UAP cases, parapsychology, materials science, pharmacology, and philosophy of physics.

## Editorial stance

- Mainstream consensus is reported as mainstream consensus. Fringe hypotheses are listed where they're historically significant, and explicitly marked as rejected or unsupported where that's the case.
- Pyramid construction, Puma Punku, and Nazca rows state plainly that no credible researcher invokes non-human builders.
- Entries where the "mystery" has dissolved under scrutiny are kept and labelled, rather than quietly dropped. The pattern of how anomalies deflate is itself informative.
- Reaching 1000 entries required widening the aperture past marquee problems like dark matter to include narrower open questions: individual conjectures with computationally verified but unproven patterns, single unidentified signals, species, scripts, sounds and sites. The `status_code` and `difficulty_1_10` columns are what keep those tiers separable, so filter before drawing conclusions about scale.
- Where a famous claim failed replication (Bem's precognition, Morgellons, cold fusion, Mandela-effect "timeline" readings), the failure is recorded in the row.

## The visualiser

[eeman1113.github.io/Unexplained](https://eeman1113.github.io/Unexplained/) is a dependency-free static page
that reads the CSV directly. Charts are inline SVG built against a
[validated](https://github.com/Eeman1113/Unexplained#readme) colour palette:

- Tier and field counts are **single-series bars**, so order is carried by axis position rather than by hue.
- The field chart collapses the seven tiers into three groups, because three categorical hues clear the
  all-pairs colourblind-separation gate and seven do not.
- The evidence/reproducibility cross-tab is a **single-hue sequential** heatmap with the count printed in
  every cell, so colour is never the only encoding.
- Light and dark are two separately chosen palettes, not one auto-inverted set. The sequential ramp runs
  away from the surface in both.

## Usage

```python
import pandas as pd

df = pd.read_csv("unexplained_phenomena.csv")

# The genuine hard core: solid evidence, reproducible, still unexplained
core = df[
    (df.evidence_strength == "ROBUST")
    & (df.reproducible == "YES")
    & (df.status_code.isin(["OPEN_HARD_PROBLEM", "OPEN_TECHNICAL"]))
]
print(core[["phenomenon", "category", "difficulty_1_10"]].sort_values("difficulty_1_10", ascending=False))
```

## Caveats

Compiled from general scientific knowledge, not from a systematic literature review; treat it as a well-organized starting map, not a citable source. At 1000 rows the per-entry depth is a paragraph, not a review article. Dates, counts, and attributions should be verified against primary literature before use in published work. Status codes reflect the state of play as of late 2025; several rows (Hubble tension, dark energy evolution, W boson mass, dark oxygen) are actively moving.

## License

[CC0 1.0](LICENSE). Public domain. Use it however you like.
