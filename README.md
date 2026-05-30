# MP Climate Intelligence — Heatwave, Drought & Extreme Precipitation Dashboard

Village/district-level climate hazard dashboard for **5 major Madhya Pradesh districts** (Bhopal, Indore, Jabalpur, Rewa, Sidhi). Uses IMD 0.05° gridded NetCDF data (2000–2024) for historical analysis and CMIP6 (NEX-GDDP) via Google Earth Engine for 2040 future projections under SSP2-4.5.

## What's inside

```
mp_climate_dashboard/
├── scripts/                    Python + GEE pipeline
│   ├── config.py               paths, year range, district centroids
│   ├── common.py               NetCDF loader + sampling helpers
│   ├── 01_extract_district_timeseries.py
│   ├── 02_compute_indices.py
│   ├── 03_build_chart_data.py
│   ├── 04_build_dashboard_json.py
│   ├── 05_gee_cmip6_2040.js    (paste into Earth Engine)
│   ├── 06_convert_gee_export.py
│   └── run_all.bat             one-click Windows runner
├── dashboard/
│   ├── index.html              your original HTML, with loader injected
│   ├── mp_climate_loader.js    binds the JSON into the dashboard
│   └── data/
│       └── mp_climate_data.json  ← the file the dashboard reads
├── outputs/                    intermediate CSVs and final indices
├── docs/
│   ├── METHODOLOGY.md          for your submission write-up
│   └── DEPLOYMENT.md           hosting instructions
├── requirements.txt
└── README.md
```

## Quickstart (Windows)

```bat
cd mp_climate_dashboard
pip install -r requirements.txt
scripts\run_all.bat
```

This produces `dashboard/data/mp_climate_data.json`. Open `dashboard/index.html` in a browser — the dashboard auto-loads the JSON and the bottom-panel charts switch to real IMD numbers as you select districts.

A demo `mp_climate_data.json` ships with the project so the dashboard renders before you run anything. Real values overwrite it after you run the pipeline.

## Adding the 2040 forecast (CMIP6 via GEE)

1. Open https://code.earthengine.google.com and switch to project `symmetric-host-497914-e5`.
2. Paste `scripts/05_gee_cmip6_2040.js`, click Run.
3. In the Tasks tab, click Run on the two export tasks (`cmip6_future_2040_mp5`, `ndvi_current_mp5`) → exports to your Drive folder `GEE_MP_Climate`.
4. Download both CSVs into `outputs/gee_downloads/`.
5. Run:
   ```bat
   python scripts\06_convert_gee_export.py
   python scripts\04_build_dashboard_json.py
   ```
6. Refresh the dashboard. The Future 2040 panel now shows ensemble-mean projections.

## What gets computed

**Heatwave** (IMD plains definition)
- `heatwave_days/year` — days flagged as heatwave (Tmax ≥ 40°C with departure ≥ 4.5°C above climatology, or Tmax ≥ 45°C absolute) inside runs of ≥ 2 consecutive days
- `severe_heatwave_days/year` — departure ≥ 6.5°C threshold
- Restricted to Mar–Jun heatwave season

**Drought** (SPI – McKee, Doesken & Kleist 1993)
- `SPI-3`, `SPI-6`, `SPI-12` — gamma-fitted Standardized Precipitation Index
- `drought_months/year`, `drought_probability_pct`

**Extreme Precipitation** (ETCCDI)
- `R95p` / `R99p` — annual sum of rain on days above 95th / 99th percentile
- `Rx1day`, `Rx5day` — max 1-day and 5-day rainfall
- `CDD`, `CWD` — max consecutive dry / wet day runs

**Future (2040)**
- 10-year window 2036–2045 centred on 2040
- 8-model CMIP6 ensemble mean, SSP2-4.5
- Reported as `future`, `baseline (2000–2014)`, and `delta = future − baseline`
- The delta is the meaningful number — it cancels most model bias

## Caveats — be honest about these in your submission

1. **"Village level" is really 5.5 km pixel level.** IMD 0.05° ≈ 5.5 km. We sample a ±0.1° box (~11 km, 5×5 pixels) around each district centroid and take the mean. Most villages in MP are smaller than a single pixel.
2. **25 years is shorter than the WMO climate normal of 30 years.** SPI fitting is less stable, percentile thresholds are noisier.
3. **NDVI isn't in IMD data.** It comes from MODIS via GEE.
4. **A single year (2040) is not a forecast.** The CMIP6 output is a 10-year window centred on 2040. Use the delta-from-baseline, not the absolute future value.
5. **Single scenario, single ensemble.** Real climate-services work uses multiple SSPs (1-2.6, 2-4.5, 5-8.5) and reports uncertainty bands.

See `docs/METHODOLOGY.md` for a writeup you can adapt for the submission.
