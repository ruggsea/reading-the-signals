# Reading the Signals: slides

Interactive slides for the interface roundtable "Reading the Signals: Early Career Precarity and the
Future of Europe's Workforce" (The Merode, Brussels, 18 November 2026).

Live: https://ruggsea.github.io/reading-the-signals/

Five slides, one interactive chart each. Arrow keys move between slides. Everything is vendored
(Reveal.js, Plotly, fonts), so the deck also runs with no network: `python3 -m http.server` in this folder.

| Slide | Chart | Data |
|---|---|---|
| 1 | Junior share of employed graduates, AI talent vs other graduates (plus gap, and career stage held fixed) | `junior_stock_ai_vs_not.csv`, `junior_mix` from the Oct-2026 report |
| 2 | CS vs all other fields, or all 15 degree fields; share of employment or first job after graduation | `data/junior_stock_by_field.csv` (new), `entry_cs_vs_noncs_by_cohort.csv`, `entry_by_fieldgroup_cohort.csv` |
| 3 | Where a first internship leads: region or country, period, and a third stage (two years later, or same employer) | `data/internship_flows_country_year.csv` (new) |
| 4 | Map of degree names (UMAP of sentence embeddings, hexagons) | `field_map` from the Oct-2026 report |

## Rebuilding the data

Numbers come from the Oct-2026 report in `revelio_ai` (`figures/longitudinal_careers_2026`) and two
aggregations computed on Snowflake with that repo's engine (`sf_engine.py`, session-temporary objects only):

```
cd ~/Projects/revelio_ai
REVELIO_BASIS=2026 REVELIO_SUFFIX=full2026 REVELIO_ENGINE=snowflake .venv/bin/python <this repo>/build/pull_snowflake.py <this repo>/data
.venv/bin/python <this repo>/build/build_data.py
```

Both scripts stop if the new files do not reproduce the released ones:
- internship counts by country, start year, outcome and employer equal `internship_outcomes_by_country_year.csv` (9 Nov export), and the
  two-year step equals `internship_pathway_flows.csv` for the scopes checked (all, both periods, Germany, Italy, United States);
- the field-group employment shares add up to `junior_stock_ai_vs_not.csv` for every year and group.

`node build/qa_shots.cjs <path to playwright>` renders every slide and interaction to `qa/`.
