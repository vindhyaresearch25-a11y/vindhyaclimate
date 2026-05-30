import json
with open('dashboard/data/mp_climate_data.json') as f:
    d = json.load(f)
jbp = d['districts']['jabalpur']
# Check MP_DISTRICTS hardcoded blocks
# Kundam has villages in the data
kundam_villages = [(lgd, v) for lgd, v in jbp['villages'].items()
                   if v.get('tehsil','').upper() == 'KUNDAM']
print(f'Kundam tehsil villages: {len(kundam_villages)}')
for lgd, v in kundam_villages[:10]:
    vi = v.get('indices', {})
    print(f'  {lgd}: {v["name"]} ({v["lat"]}, {v["lon"]}) rain={vi.get("annual_rain_mm")}')
if len(kundam_villages) == 0:
    # Try name-based
    kundam_villages = [(lgd, v) for lgd, v in jbp['villages'].items()
                       if v.get('tehsil','').upper() in ['KUNDAM', 'KUNDAM', '']]
    print(f'Tehsil-agnostic: {len(kundam_villages)}')
    print(f'First kundam indices: {d["districts"]["jabalpur"]["villages"]["490449"].get("indices", {})}')
