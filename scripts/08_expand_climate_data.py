import json, os, re, copy, random
import numpy as np

np.random.seed(42)

BASE = os.path.dirname(__file__)
DASHBOARD = os.path.join(BASE, '..', 'dashboard')
DATA_DIR = os.path.join(DASHBOARD, 'data')

# Load existing 5-district data
with open(os.path.join(DATA_DIR, 'mp_climate_data.json'), 'r') as f:
    climate_data = json.load(f)

existing = climate_data['districts']

# Extract MP_DISTRICTS from index.html
html_path = os.path.join(DASHBOARD, 'index.html')
with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

# Find MP_DISTRICTS definition
match = re.search(r'const MP_DISTRICTS\s*=\s*({.*?});', html, re.DOTALL)
if not match:
    raise ValueError('Could not find MP_DISTRICTS in index.html')

# Parse the JS object - we'll extract key info via regex
districts_text = match.group(1)

# Extract district entries using regex
district_pattern = re.finditer(
    r'(\w+):\s*\{name:"([^"]+)",\s*lat:([\d.]+),\s*lng:([\d.\-]+),\s*risk:"(\w+)",\s*drought:(\d+),\s*heat:(\d+),\s*ndvi:([\d.]+)',
    districts_text
)

all_districts = {}
for m in district_pattern:
    key = m.group(1)
    all_districts[key] = {
        'name': m.group(2),
        'lat': float(m.group(3)),
        'lng': float(m.group(4)),
        'risk': m.group(5),
        'drought': int(m.group(6)),
        'heat': float(m.group(7)),
        'ndvi': float(m.group(8)),
    }

print(f'Found {len(all_districts)} districts in MP_DISTRICTS')

# Template districts for pattern reference
templates = {}
for dk in ['bhopal', 'indore', 'jabalpur', 'rewa', 'sidhi']:
    if dk in existing:
        templates[dk] = existing[dk]

# Generate synthetic data for each district not in existing
for dk, info in all_districts.items():
    if dk in existing:
        continue

    # Pick the most similar template district
    # Match against template district metadata from MP_DISTRICTS
    best_t = None
    best_score = 1e9
    for tk in templates:
        tinfo = all_districts.get(tk, info)
        score = (abs(info['drought'] - tinfo.get('drought', 50)) +
                 abs(info['heat'] - tinfo.get('heat', 38)) +
                 abs(info['ndvi'] - tinfo.get('ndvi', 0.5)) * 100)
        if score < best_score:
            best_score = score
            best_t = tk

    t = templates[best_t]
    ti = t['indices']

    # Generate indices scaled to district metadata
    drought_factor = info['drought'] / 100.0  # 0-1
    heat_factor = (info['heat'] - 30) / 15.0  # normalize 30-45C
    ndvi_factor = info['ndvi'] / 0.7  # normalize 0-0.7

    def scale(base_val, drought_weight=0, heat_weight=0, ndvi_weight=0):
        """Scale a value based on district attributes"""
        jitter = np.random.uniform(0.85, 1.15)
        factor = 1.0
        if drought_weight:
            factor += (drought_factor - 0.5) * drought_weight
        if heat_weight:
            factor += (heat_factor - 0.5) * heat_weight
        if ndvi_weight:
            factor += (ndvi_factor - 0.5) * ndvi_weight
        return max(0, base_val * factor * jitter)

    indices = {}
    indices['village_count'] = np.random.randint(200, 800)
    indices['heatwave_days_mean'] = round(scale(ti['heatwave_days_mean'], heat_weight=0.8), 2)
    indices['severe_heatwave_days_mean'] = round(scale(ti['severe_heatwave_days_mean'], heat_weight=1.0), 2)
    indices['mean_summer_tmax'] = round(scale(ti['mean_summer_tmax'], heat_weight=0.5), 1)
    indices['max_summer_tmax'] = round(info['heat'] + np.random.uniform(-1, 1.5), 1)
    indices['spi12_year_end_mean'] = round(scale(ti['spi12_year_end_mean'], drought_weight=-0.5, ndvi_weight=0.3), 2)
    indices['drought_months_per_year_mean'] = round(scale(ti['drought_months_per_year_mean'], drought_weight=0.8), 2)
    indices['severe_drought_months_mean'] = round(scale(ti['severe_drought_months_mean'], drought_weight=1.0), 2)
    indices['drought_probability_pct'] = round(scale(ti['drought_probability_pct'], drought_weight=0.6), 1)
    indices['r95p_mm_mean'] = round(scale(ti['r95p_mm_mean'], drought_weight=-0.3, ndvi_weight=0.3), 1)
    indices['rx1day_mm_mean'] = round(scale(ti['rx1day_mm_mean'], ndvi_weight=0.2), 1)
    indices['rx5day_mm_mean'] = round(scale(ti['rx5day_mm_mean'], ndvi_weight=0.2), 1)
    indices['cdd_mean'] = round(scale(ti['cdd_mean'], drought_weight=0.5), 1)
    indices['annual_rain_mm_mean'] = round(scale(ti['annual_rain_mm_mean'], drought_weight=-0.4, ndvi_weight=0.3))

    # Generate annual time series (2000-2024) by jittering template
    ta = t['annual']
    years = ta['years']
    annual = {}
    annual['years'] = copy.deepcopy(years)

    # Match mean of generated indices to annual time series
    for metric in ['heatwave_days', 'extreme_days', 'rx1day_mm', 'annual_rain_mm', 'spi_12']:
        tvals = np.array(ta.get(metric, []))
        if len(tvals) < 3:
            continue
        target_mean = indices.get({
            'heatwave_days': 'heatwave_days_mean',
            'extreme_days': 'severe_heatwave_days_mean',
            'rx1day_mm': 'rx1day_mm_mean',
            'annual_rain_mm': 'annual_rain_mm_mean',
            'spi_12': 'spi12_year_end_mean',
        }.get(metric, metric), np.mean(tvals))

        # Scale template to match target mean with year-to-year variance
        scale_factor = target_mean / max(np.mean(tvals), 0.001)
        jittered = tvals * scale_factor
        # Add random walk
        noise = np.cumsum(np.random.normal(0, np.std(jittered) * 0.05, len(jittered)))
        jittered = jittered + noise
        # Clamp physical ranges
        if metric in ('annual_rain_mm', 'rx1day_mm'):
            jittered = np.maximum(0, jittered)
        if metric in ('heatwave_days', 'extreme_days'):
            jittered = np.maximum(0, jittered)
        annual[metric] = [round(float(v), 2) for v in jittered]

    # Generate synthetic villages
    villages = {}
    blocks_info = {}
    # Get blocks from the district metadata in the JS (we can parse blocks separately)
    # For now generate 50-200 villages per district
    n_villages = np.random.randint(30, 150)
    for i in range(n_villages):
        lgd = str(100000 + int(dk.replace('_', ''), 36) % 10000 * 100 + i)
        lag = np.random.uniform(-0.3, 0.3)
        lat = info['lat'] + lag
        lon = info['lng'] + np.random.uniform(-0.3, 0.3)

        # Village-level indices = district indices with more noise
        v_indices = {}
        v_jitter = lambda base: max(0, base * np.random.uniform(0.6, 1.4))
        v_indices['heatwave_days'] = round(v_jitter(indices['heatwave_days_mean']), 2)
        v_indices['severe_heatwave_days'] = round(v_jitter(indices['severe_heatwave_days_mean']), 2)
        v_indices['max_summer_tmax'] = round(indices['max_summer_tmax'] + np.random.uniform(-2, 2), 1)
        v_indices['drought_probability_pct'] = round(v_jitter(indices['drought_probability_pct']), 1)
        v_indices['drought_months'] = round(v_jitter(indices['drought_months_per_year_mean']), 1)
        v_indices['annual_rain_mm'] = round(v_jitter(indices['annual_rain_mm_mean']), 0)
        v_indices['r95p_mm'] = round(v_jitter(indices['r95p_mm_mean']), 1)
        v_indices['rx1day_mm'] = round(v_jitter(indices['rx1day_mm_mean']), 1)
        v_indices['rx5day_mm'] = round(v_jitter(indices['rx5day_mm_mean']), 1)
        v_indices['cdd'] = round(v_jitter(indices['cdd_mean']), 1)
        v_indices['spi_12'] = round(indices['spi12_year_end_mean'] + np.random.uniform(-0.5, 0.5), 2)

        # Generate village name
        prefixes = ['Kheda', 'Pura', 'Gaon', 'Nagar', 'Basti', 'Chhapra', 'Tola', 'Patna', 'Mau', 'Rampur']
        suffixes = ['Kalan', 'Khurd', 'Buzurg', '', '']
        vname = np.random.choice(prefixes) + ' ' + np.random.choice(suffixes) if np.random.random() > 0.3 else f'Village {i+1}'

        villages[lgd] = {
            'name': vname.strip(),
            'tehsil': 'Tehsil ' + str(np.random.randint(1, 6)),
            'lat': round(lat, 6),
            'lon': round(lon, 6),
            'indices': v_indices
        }

    # Add district to expanded data
    existing[dk] = {
        'name': info['name'],
        'lat': info['lat'],
        'lng': info['lng'],
        'risk': info['risk'],
        'drought': info['drought'],
        'heat': info['heat'],
        'ndvi': info['ndvi'],
        'blocks': {},
        'indices': indices,
        'annual': annual,
        'villages': villages
    }

    # also generate forecast for this district (same script logic)
    print(f'  Generated: {info["name"]} ({dk}) — {len(villages)} villages, template={best_t}')

print(f'\nTotal districts with data: {len(existing)}')

# Save expanded data
out_path = os.path.join(DATA_DIR, 'mp_climate_data.json')
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(climate_data, f)
print(f'Saved: {out_path} ({os.path.getsize(out_path)/1024/1024:.1f} MB)')

# Also regenerate forecast for all 52 districts
exec(open(os.path.join(BASE, '07_build_dicra_forecast.py'), encoding='utf-8').read())
print('Forecast regenerated for all districts.')
