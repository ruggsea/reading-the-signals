# Reading the Signals: slides

Interactive slides for the interface roundtable "Reading the Signals: Early Career Precarity and the
Future of Europe's Workforce" (The Merode, Brussels, 18 November 2026).

Live: https://ruggsea.github.io/reading-the-signals/

Five slides, one interactive chart each. Arrow keys move between slides; keys 1 to 6 press the buttons of the
current slide in order. Everything is vendored (Reveal.js, Plotly, fonts), so the deck also runs with no
network: `python3 -m http.server` in this folder.

| Slide | Chart | Data |
|---|---|---|
| 1 | Share of early-career graduates in work who are in a junior role, AI talent vs other graduates (plus the difference, and the older all-graduates measure for comparison) | `data/junior_first5_by_field_ai.csv` (new); `junior_stock_ai_vs_not.csv` from the report for the comparison view |
| 2 | Computer science vs all other degrees, or all 15 degree groups; all jobs in the first five years, or starting job only | `data/junior_first5_by_field_ai.csv` (new); `entry_by_fieldgroup_cohort.csv` from the report |
| 3 | Where a first internship leads: region or country, start period, and a later step (did they move up, or who hired them) | `data/internship_flows_country_year.csv` (new) |
| 4 | Map of degree names (sentence embeddings projected with UMAP), as hexagons or as single names | `field_map` and the 60,000-point cloud from the report |

Slides 1 and 2 use the report's like-for-like measure (jobs held 0 to 5 years after graduation). The older measure
(all graduates since 2005, jobs started since 2015) falls mostly because that population ages; the report says not to
quote it, and here it appears only as a labelled comparison.

## Rebuilding

Numbers come from the Oct-2026 report in `revelio_ai` (`figures/longitudinal_careers_2026`) and three aggregations
computed on Snowflake with that repo's engine (`sf_engine.py`, session-temporary objects only):

```
cd ~/Projects/revelio_ai
export REVELIO_BASIS=2026 REVELIO_SUFFIX=full2026 REVELIO_ENGINE=snowflake
.venv/bin/python <this repo>/build/pull_snowflake.py   <this repo>/data    # internships (its second part is no longer used)
.venv/bin/python <this repo>/build/pull_likeforlike.py <this repo>/data    # junior share, first five years, by AI talent and field
.venv/bin/python <this repo>/build/build_data.py                           # data/deck_data.js
python3 <this repo>/build/inline_logo.py                                   # index.html from build/index.src.html
```

The scripts stop if the new files do not reproduce the released ones:
- internship counts by country, start year, outcome and employer equal `internship_outcomes_by_country_year.csv` (9 Nov export), and the
  two-year step equals `internship_pathway_flows.csv` for the scopes checked (all, both periods, Germany, Italy, United States);
- the like-for-like totals equal the report's "age-adjusted (0-5 years after graduation)" series in `junior_stock_measures.csv` for every year;
- the point cloud lines up with the hexagon layout (worst misplacement 0.004 layout units; one hexagon is 0.130).

`node build/qa_shots.cjs <path to playwright>` renders every slide and interaction to `qa/` (needs the local server on port 8765).
Edit `build/index.src.html`, not `index.html`.
