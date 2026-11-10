# GL Fencing Schedule 2026–27

A static, single-page schedule for Governor Livingston High School fencing: dual meets, tournaments, a map of venues, calendar downloads and three seasons of head-to-head history.

## Updating

Everything lives in `js/data.js`.

- **Record a result:** find the meet in `events` and fill in GL's score first, e.g.
  `"result": { "boys": { "gl": 15, "opp": 12 }, "girls": { "gl": 13, "opp": 14 } }`.
  The season records at the top of the page update on their own.
- **Change a meet:** edit `date` (`YYYY-MM-DD`), `time` (24-hour, or `null`) and `site` (`"home"`, `"away"` or `"tbc"`). Keep `events` in date order.

## Viewing locally

Open `index.html` in a browser. No build step.

## Publishing on GitHub Pages

1. Push this folder to a GitHub repository.
2. In the repository, go to Settings → Pages, choose "Deploy from a branch", and pick `master` and `/ (root)`.

## Sources

- Schedule: team season-calendar slide, Nov 9, 2026 snapshot.
- Past results: NJ.com high school sports (collected once, Nov 2026).
- Tournament dates: NJSIAA 2026–27 fencing regulations. The Cetrulo and Santelli dates are projected from those regulations and are marked as such on the page.
- Map tiles: CARTO, using OpenStreetMap data. School logos belong to their schools.

The `research/` folder holds the raw research notes and is not used by the page.
