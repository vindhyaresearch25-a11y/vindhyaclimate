(function(){
  'use strict';
  var _khasraMap = {};
  var _loading = false;
  var _cadParcelLayer = null;
  var _selectedKhasra = null;
  var _cadVillageCenter = null;
  var _cropFilter = null;

  var OWNERS = ["Ramdayal Saket","Babulal Singh","Munni Devi","Shivkumar Patel","Rajesh Pandey","Gopal Kushwaha","Sitaram Kol","Phoolmati Devi","Lakhan Gond","Ramlal Saket","Mohan Singh","Savitri Bai","Kedar Nath","Dhaneshwari","Ramprasad Yadav","Devaki Devi","Jagdish Prasad","Chanda Devi","Brijmohan Patel","Radheshyam","Mangal Singh","Sukhdev Rao","Rameshwar","Dhaneshwar","Shivbaran"];
  var FATHERS = ["Ramdayal","Babulal","Mohan","Shivkumar","Sitaram","Gopal","Phool Singh","Ramprasad","Lakhan","Ramlal","Kedar","Jagdish","Brijmohan","Radheshyam","Devaki","Mangal","Sukhdev","Ramesh","Dhaneshwar","Shivbaran"];
  var CROPS = ["Paddy (Kharif)","Wheat (Rabi)","Soybean","Gram","Maize","Mustard","Pigeonpea","Groundnut","Cotton","Bajra"];
  var SOILS = ["Black Cotton","Red Sandy","Alluvial","Laterite","Clay Loam"];
  var LAND_USES = ["Agriculture","Fallow","Orchard","Built-up","Barren"];
  var IRRIGATIONS = ["Rainfed","Borewell","Canal","Drip"];

  var CROP_COLORS = {
    "Paddy (Kharif)":"#2ecc71","Wheat (Rabi)":"#f1c40f","Soybean":"#3498db","Gram":"#e67e22","Maize":"#9b59b6","Mustard":"#f39c12","Pigeonpea":"#1abc9c","Groundnut":"#d35400","Cotton":"#ecf0f1","Bajra":"#95a5a6"
  };

  function getVillageCenter(){
    var dk = document.getElementById('districtSelect').value;
    var vn = document.getElementById('villageSelect').value;
    if (!dk || !vn) return null;
    var dist = window._mpClimateData && window._mpClimateData.districts[dk];
    if (!dist) return null;
    var vmap = dist.villages || {};
    for (var id in vmap) {
      if ((vmap[id].name||'').toUpperCase() === vn.toUpperCase()) {
        if (vmap[id].lat != null && vmap[id].lon != null)
          return {lat: vmap[id].lat, lng: vmap[id].lon, name: vmap[id].name};
        break;
      }
    }
    return {lat: dist.lat || 23.5, lng: dist.lng || 78, name: vn};
  }

  function loadCadastralLayer(){
    var map = window.leafletMap;
    if (!map) return;
    var vn = document.getElementById('villageSelect').value;
    if (!vn) { destroyLayers(map); return; }
    var ctr = getVillageCenter();
    if (!ctr) { destroyLayers(map); return; }
    _cadVillageCenter = ctr;
    destroyLayers(map);
    generateParcels(map, ctr);
  }

  function destroyLayers(map){
    if (_cadParcelLayer) { map.removeLayer(_cadParcelLayer); _cadParcelLayer = null; }
    resetHighlight();
    _khasraMap = {};
    _selectedKhasra = null;
    _cropFilter = null;
  }

  function generateParcels(map, ctr){
    if (_loading) return;
    _loading = true;

    var count = 200 + Math.floor(Math.random() * 300);
    var spread = 0.025;
    var pts = [];
    for (var i = 0; i < count; i++) {
      pts.push(turf.point([
        ctr.lng + (Math.random() - 0.5) * spread,
        ctr.lat + (Math.random() - 0.5) * spread
      ]));
    }
    var bbox = [
      ctr.lng - spread * 0.75, ctr.lat - spread * 0.75,
      ctr.lng + spread * 0.75, ctr.lat + spread * 0.75
    ];
    var voronoi = turf.voronoi(turf.featureCollection(pts), {bbox: bbox});

    var sel = document.getElementById('cadKhasraSelect');
    sel.innerHTML = '<option value="">-- Select Khasra --</option>';

    _khasraMap = {};
    var cropCounts = {};
    CROPS.forEach(function(c){ cropCounts[c] = 0; });
    window._cadParcelsData = [];

    _cadParcelLayer = L.geoJson(voronoi, {
      style: function(feature){
        var crop = feature.properties.crop;
        var fill = CROP_COLORS[crop] || '#bdc9e1';
        return {color:"#555", weight:1, fillColor: fill, fillOpacity:0.6};
      },
      onEachFeature: function(feature, layer){
        var khasraNum = "KHA" + String(Math.floor(Math.random() * 9000) + 1000);
        var area = (Math.random() * 4 + 0.1).toFixed(2);
        var oi = Math.floor(Math.random() * OWNERS.length);
        var crop = CROPS[Math.floor(Math.random() * CROPS.length)];
        cropCounts[crop] = (cropCounts[crop] || 0) + 1;
        feature.properties = {
          khasra: khasraNum,
          owner: OWNERS[oi],
          father: FATHERS[Math.floor(Math.random() * FATHERS.length)],
          area_ha: parseFloat(area),
          land_use: LAND_USES[Math.floor(Math.random() * LAND_USES.length)],
          soil_type: SOILS[Math.floor(Math.random() * SOILS.length)],
          crop: crop,
          irrigation: IRRIGATIONS[Math.floor(Math.random() * IRRIGATIONS.length)],
          ndvi: (Math.random() * 0.4 + 0.3).toFixed(2),
          sm: Math.floor(Math.random() * 20 + 10) + "%",
          risk: Math.random() > 0.7 ? "High" : "Low"
        };
        _khasraMap[khasraNum] = {feature: feature, layer: layer};
        window._cadParcelsData.push(feature.properties);

        var opt = document.createElement('option');
        opt.value = khasraNum;
        opt.text = khasraNum + " | " + crop;
        sel.add(opt);

        layer.bindTooltip("<b>"+khasraNum+"</b> "+crop, {
          permanent: true, direction: 'center', className: 'parcel-label'
        });
        layer.on('click', function(){ selectKhasra(khasraNum); });
      }
    }).addTo(map);

    map.fitBounds(_cadParcelLayer.getBounds());

    updateCropLegend(cropCounts);
    // Trigger village-level advisory update with cadastral data
    if (typeof updateAdvisories === 'function') {
      var dk = document.getElementById('districtSelect').value;
      if (dk) window.updateAdvisories(dk);
    }

    if (!document.getElementById('parcel-label-style')) {
      var st = document.createElement('style');
      st.id = 'parcel-label-style';
      st.textContent = '.parcel-label{background:rgba(0,0,0,0.6);border:none;color:#fff;font-size:0.45rem;font-weight:700;padding:1px 3px;border-radius:2px;white-space:nowrap;}';
      document.head.appendChild(st);
    }

    document.getElementById('cad-village-name').textContent = ctr.name.toUpperCase();
    _loading = false;
  }

  function updateCropLegend(cropCounts){
    var el = document.getElementById('cad-crop-legend');
    if (!el) return;
    var html = '<div style="font-size:0.55rem;font-weight:700;color:var(--text-dim);margin-bottom:0.3rem;letter-spacing:1px;">CROP LEGEND</div>';
    var total = 0;
    for (var k in cropCounts) total += cropCounts[k];
    for (var crop in cropCounts) {
      var pct = total > 0 ? Math.round(cropCounts[crop]/total*100) : 0;
      var color = CROP_COLORS[crop] || '#bdc9e1';
      html += '<div class="legend-row" style="cursor:pointer" onclick="window.filterByCrop(\''+crop+'\')">' +
        '<div class="legend-dot" style="background:'+color+'"></div>' +
        '<span>'+crop+' <span style="color:var(--text-dim)">('+cropCounts[crop]+')</span></span>' +
        '</div>';
    }
    html += '<div class="legend-row" style="cursor:pointer;margin-top:0.2rem" onclick="window.filterByCrop(null)">' +
      '<span style="color:var(--cyan);font-weight:700">Show All</span></div>';
    el.innerHTML = html;

    var filterSel = document.getElementById('cadCropFilter');
    if (filterSel) {
      filterSel.innerHTML = '<option value="">-- All Crops --</option>';
      for (var crop in cropCounts) {
        var opt = document.createElement('option');
        opt.value = crop;
        opt.textContent = crop + ' (' + cropCounts[crop] + ')';
        filterSel.appendChild(opt);
      }
    }
  }

  window.filterByCrop = function(crop){
    _cropFilter = crop;
    if (!_cadParcelLayer) return;
    _cadParcelLayer.eachLayer(function(layer){
      var feat = layer.feature;
      if (!feat || !feat.properties) return;
      var show = !crop || feat.properties.crop === crop;
      if (show) {
        if (!_cadParcelLayer.hasLayer(layer)) _cadParcelLayer.addLayer(layer);
        layer.setStyle({opacity:1, fillOpacity:0.6});
      } else {
        layer.setStyle({opacity:0.15, fillOpacity:0.05});
      }
    });
  };

  function resetHighlight(){
    if (_selectedKhasra && _khasraMap[_selectedKhasra]) {
      var entry = _khasraMap[_selectedKhasra];
      if (entry && entry.layer) {
        entry.layer.setStyle({color:"#555", weight:1});
      }
    }
    _selectedKhasra = null;
  }

  function highlightKhasra(khasra){
    var entry = _khasraMap[khasra];
    if (!entry || !entry.layer) return;
    entry.layer.setStyle({color:'#FFD700', weight:3, fillColor:'#FFD700', fillOpacity:0.35});
    entry.layer.bringToFront();
  }

  function selectKhasra(khasra){
    if (!khasra || !_khasraMap[khasra]) return;
    resetHighlight();
    _selectedKhasra = khasra;
    highlightKhasra(khasra);
    var map = window.leafletMap;
    var entry = _khasraMap[khasra];
    if (map && entry && entry.layer) {
      map.flyToBounds(entry.layer.getBounds(), {maxZoom:17, duration:0.8});
    }
    document.getElementById('cadKhasraSelect').value = khasra;
    renderParcelData(entry.feature.properties);
  }

  function renderParcelData(p){
    setText('cad-khasra', p.khasra || '—');
    setText('cad-area', (p.area_ha || 0).toFixed(2) + ' ha');
    setText('cad-owner', p.owner || '—');
    setText('cad-father', p.father || '—');
    setText('cad-landuse', p.land_use || '—');
    setText('cad-soil', p.soil_type || '—');
    setText('cad-crop', p.crop || '—');
    setText('cad-irrigation', p.irrigation || '—');
    setText('cad-ndvi', p.ndvi || '—');
    setText('cad-crop-health', '—');
    setText('cad-soil-moisture', p.sm || '—');
    setText('cad-risk', p.risk || '—');

    var dataEl = document.getElementById('cad-overlay-data');
    if (dataEl) {
      dataEl.innerHTML = '<b>KHASRA ' + (_selectedKhasra||'') + '</b> &mdash; '
        + (p.land_use||'—') + ' | ' + (p.crop||'—') + ' | ' + (p.soil_type||'—') + ' | '
        + (p.irrigation||'—') + ' | ' + (p.area_ha||0).toFixed(2)+' ha<br>'
        + '<span style="color:var(--text-dim)">' + (_cadVillageCenter ? _cadVillageCenter.name : '') + ' — ' + document.getElementById('districtSelect').value + '</span>';
    }
    setText('cad-advisory-khasra', _selectedKhasra || '—');
    setHtml('cad-advisory', genAdvisory(p));
  }

  function setText(id, v){
    var e = document.getElementById(id);
    if (e) e.textContent = v;
  }
  function setHtml(id, v){
    var e = document.getElementById(id);
    if (e) e.innerHTML = v;
  }

  function genAdvisory(p){
    var ndvi = parseFloat(p.ndvi) || 0.5;
    var risk = p.risk || 'Low';
    var crop = p.crop || 'crop';
    var lines = [];
    if (risk === 'High') {
      lines.push('WARNING: Thermal stress detected in ' + crop + '. Immediate irrigation recommended.');
    } else {
      lines.push('Crop health is optimal. Nitrogen levels are sufficient for current stage.');
    }
    if (ndvi < 0.4) lines.push('Low NDVI detected. Consider foliar spray of micronutrients.');
    else if (ndvi > 0.7) lines.push('Excellent vegetative vigour. Continue regular monitoring.');
    if (p.irrigation === 'Rainfed') lines.push('Rainfed parcel. Monitor rainfall forecast closely.');
    lines.push('Recommended: Apply balanced NPK (60:40:40) for ' + crop + ' on ' + (p.soil_type||'soil') + '.');
    lines.push('Regional: Vindhya zone — ' + getCurrentSeason() + ' season advisory.');
    return lines.join('<br>');
  }

  function getCurrentSeason(){
    var m = new Date().getMonth();
    if (m >= 5 && m <= 9) return 'Kharif';
    if (m >= 10 || m <= 2) return 'Rabi';
    return 'Zayed';
  }

  function showAllParcels(){
    window.filterByCrop(null);
    resetHighlight();
    _selectedKhasra = null;
    var map = window.leafletMap;
    if (!map) return;
    if (_cadParcelLayer && !map.hasLayer(_cadParcelLayer)) map.addLayer(_cadParcelLayer);
  }

  function flyToKhasra(){
    var sel = document.getElementById('cadKhasraSelect');
    if (sel && sel.value) selectKhasra(sel.value);
  }

  function toggleCadLayer(){
    var map = window.leafletMap; if (!map) return;
    if (_cadParcelLayer) {
      if (map.hasLayer(_cadParcelLayer)) map.removeLayer(_cadParcelLayer);
      else map.addLayer(_cadParcelLayer);
    }
  }

  window.loadCadastralLayer = loadCadastralLayer;
  window.selectKhasra = selectKhasra;
  window.onKhasraChange = selectKhasra;
  window.flyToKhasra = flyToKhasra;
  window.toggleCadLayer = toggleCadLayer;
  window.showAllParcels = showAllParcels;

  var origVillageChange = window.onVillageChange;
  if (origVillageChange) {
    var origFn = origVillageChange;
    window.onVillageChange = function(name){
      origFn.call(this, name);
      var dk = document.getElementById('districtSelect').value;
      if (dk && name) {
        setTimeout(loadCadastralLayer, 300);
      }
    };
  }
})();
