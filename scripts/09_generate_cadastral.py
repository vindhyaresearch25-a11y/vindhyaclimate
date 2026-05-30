"""
Generate synthetic cadastral GeoJSON for Kundam village (Jabalpur district, Kundam tehsil).
Produces land parcels with khasra numbers, field boundaries, and parcel attributes.
"""
import json, math, random, os

random.seed(42)

# Kundam village center (from mp_climate_data.json)
CENTER_LAT = 23.216
CENTER_LNG = 80.350
NUM_PARCELS = 120

# Output
OUT = os.path.join(os.path.dirname(__file__), '..', 'dashboard', 'data', 'cadastral_kundam.geojson')

# Land use types with typical MP proportions
LAND_USE_TYPES = [
    ('Agriculture', 0.55),
    ('Fallow', 0.12),
    ('Orchard', 0.05),
    ('Built-up', 0.08),
    ('Water Body', 0.02),
    ('Road', 0.03),
    ('Forest Scrub', 0.10),
    ('Barren', 0.05),
]

# Soil types for Jabalpur region (Narmada valley alluvial)
SOIL_TYPES = [
    'Alluvial Clay Loam',
    'Deep Black Soil',
    'Medium Black Soil',
    'Sandy Loam',
    'Clay Loam',
]

# Generate parcel polygon (irregular rectangle/hexagon approximating field boundaries)
def gen_parcel_polygon(cx, cy, size_deg):
    """Generate an irregular polygon around center point resembling a field boundary"""
    # Random rotation
    angle = random.uniform(0, math.pi * 2)
    # Number of vertices (4-7 for realistic field shapes)
    n_verts = random.randint(4, 7)
    # Rough radius
    r = size_deg * random.uniform(0.8, 1.2)
    pts = []
    for i in range(n_verts):
        a = angle + (i / n_verts) * math.pi * 2 + random.uniform(-0.3, 0.3)
        ri = r * random.uniform(0.7, 1.3)
        px = cx + ri * math.cos(a) * 1.2  # stretch longitude (wider)
        py = cy + ri * math.sin(a)
        pts.append([round(px, 6), round(py, 6)])
    # Close ring
    pts.append(pts[0])
    return pts

def gen_owner_name():
    first = ['Ram', 'Shyam', 'Mohan', 'Sohan', 'Ravi', 'Vijay', 'Ajay', 'Sanjay', 'Amit', 'Rahul',
             'Sunil', 'Rajesh', 'Mahesh', 'Ramesh', 'Dinesh', 'Gopal', 'Lal', 'Kishore', 'Harish', 'Jagdish']
    last = ['Patel', 'Yadav', 'Sharma', 'Verma', 'Singh', 'Kushwaha', 'Sahu', 'Agrawal', 'Gupta', 'Lodhi',
            'Rawat', 'Prajapati', 'Saket', 'Mishra', 'Dubey', 'Tripathi', 'Pandey', 'Dwivedi', 'Tiwari', 'Choudhary']
    return random.choice(first) + ' ' + random.choice(last)

# Generate parcels
parcels = []
total_area = 0

# Use Poisson-disc-like distribution: divide area into cells
grid_size = 0.002  # ~220m
cols = 15
rows = 10
placed = []

for r in range(rows):
    for c in range(cols):
        if len(parcels) >= NUM_PARCELS:
            break
        # Skip some cells randomly for natural look
        if random.random() < 0.15:
            continue
        cell_cx = CENTER_LNG + (c - cols/2) * grid_size
        cell_cy = CENTER_LAT + (r - rows/2) * grid_size * 0.85
        # Check distance from center (keep within ~1.5km radius)
        dist = math.sqrt((cell_cx - CENTER_LNG)**2 + (cell_cy - CENTER_LAT)**2)
        if dist > 0.016:
            continue
        size = grid_size * random.uniform(0.5, 0.95)
        poly = gen_parcel_polygon(cell_cx, cell_cy, size)
        # Calculate approximate area in sq meters (rough: 1 deg lat = 111km, 1 deg lng = 103km at 23N)
        lat_factor = 111320
        lng_factor = 103500
        area_sqm = 0
        for i in range(len(poly)-1):
            dx = (poly[i+1][0] - poly[i][0]) * lng_factor
            dy = (poly[i+1][1] - poly[i][1]) * lat_factor
            area_sqm += 0.5 * abs(dx * dy)
        # Generate land use weighted random
        lu = random.choices([t[0] for t in LAND_USE_TYPES], weights=[t[1] for t in LAND_USE_TYPES])[0]
        # Determine crop based on land use
        crop = ''
        if lu == 'Agriculture':
            crop = random.choice(['Wheat', 'Rice', 'Soybean', 'Gram', 'Mustard', 'Maize', 'Pigeonpea', 'Sugarcane'])
        # Soil type for Narmada valley
        soil = random.choices(SOIL_TYPES, weights=[0.4, 0.25, 0.15, 0.12, 0.08])[0]
        # Khasra number
        khasra = f'KHA{len(parcels)+1:03d}'
        # Irrigation status
        irrigation = random.choice(['Canal', 'Tube Well', 'Rainfed', 'Drip', 'None'])
        # Owner
        owner = gen_owner_name()
        feature = {
            'type': 'Feature',
            'properties': {
                'khasra': khasra,
                'owner': owner,
                'area_sqm': round(area_sqm, 0),
                'area_ha': round(area_sqm / 10000, 3),
                'land_use': lu,
                'crop': crop,
                'soil_type': soil,
                'irrigation': irrigation,
                'village': 'Kundam',
                'tehsil': 'Kundam',
                'district': 'Jabalpur'
            },
            'geometry': {
                'type': 'Polygon',
                'coordinates': [poly]
            }
        }
        parcels.append(feature)
        total_area += area_sqm
    if len(parcels) >= NUM_PARCELS:
        break

print(f'Generated {len(parcels)} parcels, total area: {total_area/10000:.1f} ha')

# Add road network (linear features)
roads = []
road_coords = []
# Main road through village
road_coords.append([
    [CENTER_LNG - 0.012, CENTER_LAT - 0.005],
    [CENTER_LNG - 0.005, CENTER_LAT - 0.002],
    [CENTER_LNG, CENTER_LAT],
    [CENTER_LNG + 0.008, CENTER_LAT + 0.003],
    [CENTER_LNG + 0.014, CENTER_LAT + 0.006],
])
# Cross road
road_coords.append([
    [CENTER_LNG - 0.003, CENTER_LAT + 0.01],
    [CENTER_LNG, CENTER_LAT],
    [CENTER_LNG + 0.004, CENTER_LAT - 0.008],
])
for rc in road_coords:
    roads.append({
        'type': 'Feature',
        'properties': {'type': 'road', 'name': random.choice(['Village Road', 'Kaccha Path', 'Main Road', 'Link Road'])},
        'geometry': {'type': 'LineString', 'coordinates': rc}
    })

# Water bodies (ponds)
ponds = []
for _ in range(5):
    cx = CENTER_LNG + random.uniform(-0.01, 0.01)
    cy = CENTER_LAT + random.uniform(-0.008, 0.008)
    sz = 0.0015 * random.uniform(0.5, 1.5)
    pts = gen_parcel_polygon(cx, cy, sz)
    ponds.append({
        'type': 'Feature',
        'properties': {'type': 'water_body', 'name': random.choice(['Village Pond', 'Talab', 'Check Dam'])},
        'geometry': {'type': 'Polygon', 'coordinates': [pts]}
    })

# Build final GeoJSON
geojson = {
    'type': 'FeatureCollection',
    'crs': {'type': 'name', 'properties': {'name': 'urn:ogc:def:crs:OGC:1.3:CRS84'}},
    'features': parcels + roads + ponds
}

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(geojson, f)

print(f'Saved: {OUT} ({len(geojson["features"])} features)')
