import json
with open('dashboard/data/mp_climate_data.json') as f:
    d = json.load(f)
jbp = d['districts']['jabalpur']
print('Jabalpur villages total:', len(jbp['villages']))
print('Jabalpur lat/lng:', jbp['lat'], jbp['lng'])
blocks = jbp.get('blocks', {})
print('Blocks:', list(blocks.keys()))
kundam_villages = [(lgd, v) for lgd, v in jbp['villages'].items() if 'kundam' in v['name'].lower()]
print('Kundam villages found:', len(kundam_villages))
for lgd, v in kundam_villages[:5]:
    vi = v.get('indices', {})
    print(f'  {lgd}: {v["name"]} @ ({v["lat"]}, {v["lon"]}) rain={vi.get("annual_rain_mm")} spi={vi.get("spi_12")}')
