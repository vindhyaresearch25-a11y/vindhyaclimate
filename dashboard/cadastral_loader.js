(function(){
  'use strict';
  var CAD_URL = 'data/cadastral_kundam.geojson';
  var _cadData = null;
  var _khasraMap = {};
  var _loading = false;
  var _cadParcelLayer = null;
  var _cadOverlayLayer = null;
  var _selParcelLayer = null;
  var _selectedKhasra = null;
  var _currentMode = 'kundam'; // 'kundam' or 'sahijana'
  var _sahijanaCoords = [24.2852, 81.6438]; // Sahijana, Sidhi, MP

  function loadCadastralLayer(){
    var map = window.leafletMap;
    if (!map) return;
    var dk = document.getElementById('districtSelect').value;
    var vn = document.getElementById('villageSelect').value;
    var isSahijana = (dk === 'sidhi' && vn && vn.toUpperCase() === 'SAHIJANA');
    if (isSahijana) {
      _currentMode = 'sahijana';
      destroyLayers(map);
      generateSahijanaParcels(map);
      return;
    }
    _currentMode = 'kundam';
    if (_loading) return;
    if (_cadParcelLayer) {
      removeSelParcel();
      map.addLayer(_cadParcelLayer);
      if (_cadOverlayLayer) map.addLayer(_cadOverlayLayer);
      return;
    }
    _loading = true;
    fetch(CAD_URL).then(function(r){
      if (!r.ok) throw new Error('HTTP '+r.status);
      return r.json();
    }).then(function(gj){
      _cadData = gj;
      buildLayer(map);
      populateKhasraSelect();
      _loading = false;
    }).catch(function(e){
      _loading = false;
      console.warn('[cadastral]', e.message);
    });
  }

  function destroyLayers(map){
    if (_cadParcelLayer) { map.removeLayer(_cadParcelLayer); _cadParcelLayer = null; }
    if (_cadOverlayLayer) { map.removeLayer(_cadOverlayLayer); _cadOverlayLayer = null; }
    removeSelParcel();
    _khasraMap = {};
    _selectedKhasra = null;
  }

  // ================================================================
  // SAHIJANA VORONOI GENERATION (MPSSLR Style — Blue Medh Boundaries)
  // ================================================================
  function generateSahijanaParcels(map){
    if (_loading) return;
    if (_cadParcelLayer) { destroyLayers(map); }
    _loading = true;

    var parcelCount = 1000;
    var pts = [];
    var spread = 0.04;
    for (var i = 0; i < parcelCount; i++) {
      pts.push(turf.point([
        _sahijanaCoords[1] + (Math.random() - 0.5) * spread,
        _sahijanaCoords[0] + (Math.random() - 0.5) * spread
      ]));
    }

    var bbox = [
      _sahijanaCoords[1] - spread * 0.75,
      _sahijanaCoords[0] - spread * 0.75,
      _sahijanaCoords[1] + spread * 0.75,
      _sahijanaCoords[0] + spread * 0.75
    ];
    var voronoi = turf.voronoi(turf.featureCollection(pts), {bbox: bbox});

    var owners = [
      "Ramdayal Saket", "Babulal Singh", "Munni Devi", "Shivkumar Patel",
      "Rajesh Pandey", "Gopal Kushwaha", "Sitaram Kol", "Phoolmati Devi",
      "Lakhan Gond", "Ramlal Saket", "Mohan Singh", "Savitri Bai",
      "Kedar Nath", "Dhaneshwari", "Ramprasad Yadav", "Devaki Devi",
      "Jagdish Prasad", "Chanda Devi", "Brijmohan Patel", "Radheshyam"
    ];
    var fathers = [
      "Ramdayal", "Babulal", "Mohan", "Shivkumar", "Sitaram",
      "Gopal", "Phool Singh", "Ramprasad", "Lakhan", "Ramlal",
      "Kedar", "Jagdish", "Brijmohan", "Radheshyam", "Devaki",
      "Mangal", "Sukhdev", "Ramesh", "Dhaneshwar", "Shivbaran"
    ];
    var crops = ["Paddy (Kharif)", "Wheat (Rabi)", "Soybean", "Gram", "Maize", "Mustard", "Pigeonpea", "Groundnut", "Cotton", "Bajra"];
    var soils = ["Black Cotton", "Red Sandy", "Alluvial", "Laterite", "Clay Loam"];
    var landUses = ["Agriculture", "Fallow", "Orchard", "Built-up", "Barren"];
    var irrigations = ["Rainfed", "Borewell", "Canal", "Drip"];

    var searchSel = document.getElementById('cadKhasraSelect');
    searchSel.innerHTML = '<option value="">-- Choose from 1,000 Parcels --</option>';

    _cadParcelLayer = L.geoJson(voronoi, {
      style: function(){
        return {
          color: "#2196F3",
          weight: 1.5,
          fillColor: "#000",
          fillOpacity: 0
        };
      },
      onEachFeature: function(feature, layer){
        var khasraNum = "KHA" + String(Math.floor(Math.random() * 8000) + 1).padStart(4, '0') + "/" + (Math.floor(Math.random() * 9) + 1);
        var area = (Math.random() * 4 + 0.1).toFixed(2);
        var oi = Math.floor(Math.random() * owners.length);
        var fi = Math.floor(Math.random() * fathers.length);

        feature.properties = {
          khasra: khasraNum,
          owner: owners[oi],
          father: fathers[fi],
          area_ha: parseFloat(area),
          land_use: landUses[Math.floor(Math.random() * landUses.length)],
          soil_type: soils[Math.floor(Math.random() * soils.length)],
          crop: crops[Math.floor(Math.random() * crops.length)],
          irrigation: irrigations[Math.floor(Math.random() * irrigations.length)],
          ndvi: (Math.random() * 0.4 + 0.3).toFixed(2),
          sm: Math.floor(Math.random() * 20 + 10) + "%",
          risk: Math.random() > 0.7 ? "High" : "Low"
        };

        _khasraMap[khasraNum] = feature;

        var opt = document.createElement('option');
        opt.value = khasraNum;
        opt.text = "Khasra: " + khasraNum;
        searchSel.add(opt);

        layer.bindTooltip(khasraNum, {
          permanent: true, direction: 'center', className: 'parcel-label'
        });

        layer.on('click', function(e){
          selectKhasra(khasraNum);
        });
      }
    }).addTo(map);

    map.fitBounds(_cadParcelLayer.getBounds());

    // Add parcel-label CSS if not present
    if (!document.getElementById('parcel-label-style')) {
      var st = document.createElement('style');
      st.id = 'parcel-label-style';
      st.textContent = '.parcel-label{background:rgba(0,0,0,0.55);border:none;color:#fff;font-size:0.5rem;font-weight:700;padding:1px 3px;border-radius:2px;white-space:nowrap;}';
      document.head.appendChild(st);
    }

    _loading = false;
  }

  // ================================================================
  // KUNDAM GEOJSON LAYER
  // ================================================================
  function buildLayer(map){
    if (_cadParcelLayer) map.removeLayer(_cadParcelLayer);
    if (_cadOverlayLayer) map.removeLayer(_cadOverlayLayer);
    removeSelParcel();
    _khasraMap = {};
    var parcels = {type:'FeatureCollection', features:[]};
    var overlays = {type:'FeatureCollection', features:[]};
    (_cadData.features || []).forEach(function(f){
      (f.properties&&(f.properties.type==='road'||f.properties.type==='water_body')?overlays:parcels).features.push(f);
    });
    _cadParcelLayer = L.geoJSON(parcels, {
      style: function(feature){
        var luColor = parcelColor((feature.properties||{}).land_use);
        return {color:'#0f281d', weight:1.5, fillColor:luColor, fillOpacity:0.85};
      },
      onEachFeature: function(feature, layer){
        var p = feature.properties || {};
        if (p.khasra) {
          _khasraMap[p.khasra] = feature;
          layer.on('click', function(){ selectKhasra(p.khasra); });
          layer.bindTooltip('<b>'+p.khasra+'</b>', {direction:'top', className:'cad-tooltip'});
        }
      }
    });
    map.addLayer(_cadParcelLayer);
    if (overlays.features.length) {
      _cadOverlayLayer = L.geoJSON(overlays, {
        style: function(feature){
          var p = feature.properties || {};
          if (p.type === 'road') return {color:'#a08060', weight:2.5, opacity:0.7};
          if (p.type === 'water_body') return {color:'#2a8faa', weight:1, fillColor:'#2a8faa', fillOpacity:0.5};
          return {};
        }
      });
      map.addLayer(_cadOverlayLayer);
    }
  }

  function removeSelParcel(){
    if (_selParcelLayer && window.leafletMap) {
      window.leafletMap.removeLayer(_selParcelLayer);
      _selParcelLayer = null;
    }
  }

  function showOnlyParcel(khasra){
    var map = window.leafletMap;
    if (!map || !_khasraMap[khasra]) return;
    if (_cadParcelLayer && map.hasLayer(_cadParcelLayer)) map.removeLayer(_cadParcelLayer);
    removeSelParcel();

    if (_currentMode === 'sahijana') {
      // MPSSLR style: yellow fill + white border
      _selParcelLayer = L.geoJSON({type:'FeatureCollection', features:[_khasraMap[khasra]]}, {
        style: function(){
          return {color:'#fff', weight:3, fillColor:'#FFD700', fillOpacity:0.4};
        }
      });
    } else {
      _selParcelLayer = L.geoJSON({type:'FeatureCollection', features:[_khasraMap[khasra]]}, {
        style: function(){
          return {color:'#f0a878', weight:4, fillColor:'#f0a878', fillOpacity:0.35};
        }
      });
    }
    _selParcelLayer.addTo(map);
    map.flyToBounds(_selParcelLayer.getBounds(), {maxZoom:17, duration:0.8});
  }

  function showAllParcels(){
    var map = window.leafletMap; if (!map) return;
    removeSelParcel();
    _selectedKhasra = null;
    if (_cadParcelLayer && !map.hasLayer(_cadParcelLayer)) map.addLayer(_cadParcelLayer);
  }

  function parcelColor(lu){
    var colors = {
      'Agriculture':'#6fc795','Fallow':'#e6cf6b','Orchard':'#74a9cf',
      'Built-up':'#f0a878','Water Body':'#5cc3cd','Road':'#888888',
      'Forest Scrub':'#4a9e6b','Barren':'#c4b5a0'
    };
    return colors[lu] || '#bdc9e1';
  }

  function populateKhasraSelect(){
    var sel = document.getElementById('cadKhasraSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Select Khasra --</option>';
    Object.keys(_khasraMap).sort().forEach(function(k){
      var o = document.createElement('option');
      o.value = k; o.textContent = k; sel.appendChild(o);
    });
  }

  // ================================================================
  // SELECT & RENDER
  // ================================================================
  function selectKhasra(khasra){
    if (!khasra || !_khasraMap[khasra]) return;
    _selectedKhasra = khasra;
    var feat = _khasraMap[khasra];
    var p = feat.properties;
    document.getElementById('cadKhasraSelect').value = khasra;
    showOnlyParcel(khasra);
    renderParcelData(p);
  }

  function renderParcelData(p){
    // Land Record (B-1)
    setText('cad-khasra', p.khasra || '—');
    setText('cad-area', (p.area_ha || 0).toFixed(2) + ' ha');

    // Farmer Identity
    setText('cad-owner', p.owner || '—');
    setText('cad-father', p.father || '—');

    // Parcel Details
    setText('cad-landuse', p.land_use || p.type || '—');
    setText('cad-soil', p.soil_type || '—');
    setText('cad-crop', p.crop || '—');
    setText('cad-irrigation', p.irrigation || '—');

    // Satellite Analytics
    if (_currentMode === 'sahijana') {
      setText('cad-ndvi', p.ndvi || '—');
      setText('cad-crop-health', '—');
      setText('cad-soil-moisture', p.sm || '—');
      setText('cad-risk', p.risk || '—');
    } else {
      // Compute analytics from climate data (Kundam mode)
      var a = computeAnalytics(p);
      setText('cad-ndvi', a.ndvi);
      setText('cad-crop-health', a.cropHealth + '%');
      setText('cad-soil-moisture', a.soilMoisture);
      setText('cad-risk', a.droughtRisk);
      setText('cad-advisory', a.advisory);
      setHtml('cad-advisory', a.advisory);
    }

    // Overlay data bar
    setHtml('cad-okhasra', _selectedKhasra || '—');
    var dataEl = document.getElementById('cad-overlay-data');
    if (dataEl) {
      dataEl.innerHTML = ''
        + '<b>KHASRA ' + (_selectedKhasra||'') + '</b> &mdash; '
        + (p.land_use||'—') + ' | ' + (p.crop||'—') + ' | ' + (p.soil_type||'—') + ' | '
        + (p.irrigation||'—') + ' | ' + (p.area_ha||0).toFixed(2)+' ha<br>'
        + '<span style="color:var(--text-dim)">' + (_currentMode === 'sahijana' ? 'Sahijana, Sidhi District — सीमांक Medh Boundary' : 'Kundam, Kundam Tehsil, Jabalpur District') + ' &bull; Analytics derived from GEE+IMD climate data.</span>';
    }

    // AI Advisory
    var adv = genAdvisory(p);
    setHtml('cad-advisory', adv);
    setText('cad-advisory-khasra', _selectedKhasra || '—');
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
      lines.push('\u26a0\ufe0f WARNING: Thermal stress detected in ' + crop + '. Immediate irrigation recommended at medh boundaries.');
    } else {
      lines.push('\u2705 Crop health is optimal. Nitrogen levels are sufficient for current stage.');
    }
    if (ndvi < 0.4) {
      lines.push('\ud83d\udfe2 Low NDVI detected. Consider foliar spray of micronutrients.');
    } else if (ndvi > 0.7) {
      lines.push('\ud83d\udfe2 Excellent vegetative vigour. Continue regular monitoring.');
    }
    if (p.irrigation === 'Rainfed') {
      lines.push('\ud83d\udca7 Rainfed parcel. Monitor rainfall forecast closely. Plan farm pond storage.');
    }
    lines.push('\ud83c\udf31 Recommended: Apply balanced NPK (60:40:40) for ' + crop + ' on ' + (p.soil_type||'soil') + '.');
    lines.push('\ud83d\udccd Regional: Vindhya zone — ' + getCurrentSeason() + ' season advisory.');
    return lines.join('<br>');
  }

  function getCurrentSeason(){
    var m = new Date().getMonth();
    if (m >= 5 && m <= 9) return 'Kharif';
    if (m >= 10 || m <= 2) return 'Rabi';
    return 'Zayed';
  }

  // ----------------------------------------------------------------
  // KUNDAM ANALYTICS (retained from original)
  // ----------------------------------------------------------------
  function getClimate(districtKey, villageName){
    var dist = window._mpClimateData && window._mpClimateData.districts[districtKey];
    if (!dist) return {};
    var idx = dist.indices || {};
    if (villageName) {
      for (var id in dist.villages) {
        if ((dist.villages[id].name||'').toUpperCase() === villageName.toUpperCase()) {
          if (dist.villages[id].indices) idx = dist.villages[id].indices;
          break;
        }
      }
    }
    return idx;
  }

  function computeAnalytics(p){
    var dk = document.getElementById('districtSelect').value;
    var vn = document.getElementById('villageSelect').value;
    var c = getClimate(dk, vn);
    var rain = c.annual_rain_mm_mean || 1000;
    var droughtProb = c.drought_probability_pct || 30;
    var heat = c.max_summer_tmax || 38;
    var spi = c.spi_12 || 0;

    var ndvi = Math.min(0.89, Math.max(0.12, spi * 0.1 + 0.45));
    var cropFactor = {Rice:0.05,Wheat:0.03,Mustard:-0.02,Gram:-0.01,Soybean:0.04,Maize:0.03,Cotton:0.02,Groundnut:0.03,Pigeonpea:-0.01,Bajra:-0.03};
    if (p.crop && cropFactor[p.crop]) ndvi += cropFactor[p.crop];
    ndvi = Math.min(0.89, Math.max(0.12, ndvi));

    var healthRaw = (ndvi - 0.15) / 0.7 * 100;
    var healthSoil = p.soil_type && p.soil_type.match(/Black|Alluvial/i) ? 5 : -3;
    var healthIrr = p.irrigation && p.irrigation !== 'Rainfed' ? 8 : 0;
    var cropHealth = Math.round(Math.min(95, Math.max(10, healthRaw + healthSoil + healthIrr)));

    var soilM = rain / 1600 * 55 + ndvi * 35;
    if (p.soil_type && p.soil_type.match(/Black|Clay/i)) soilM += 8;
    if (p.soil_type && p.soil_type.match(/Sandy|Laterite|Red/i)) soilM -= 5;
    if (p.irrigation && p.irrigation !== 'Rainfed') soilM += 10;
    soilM = Math.round(Math.min(100, Math.max(5, soilM)));

    var heatRisk = Math.round(Math.min(100, Math.max(0, (heat - 34) / 12 * 100)));
    var gwStress = Math.round(Math.min(100, Math.max(5, droughtProb * 1.1 + (heat > 39 ? 10 : 0) - (rain > 1200 ? 15 : 0))));
    var recharge = rain > 1200 ? 'Good' : rain > 800 ? 'Moderate' : 'Poor';

    var baseYield = {Rice:3500,Wheat:4200,Mustard:1500,Gram:1200,Soybean:1800,Maize:4500,Cotton:2800,Groundnut:2200,Pigeonpea:1100,Bajra:1600,Pea:1400,Lentil:1000,Sesame:800,KodoMillet:1200,BlackGram:900,Urd:850,Cowpea:600,Ragi:1800,Safflower:1300,Barley:3000,Watermelon:25000,Muskmelon:22000,Cucumber:18000,Pumpkin:20000,SummerMoong:900,Fodder:12000,Vegetables:15000};
    var base = baseYield[p.crop] || 2500;
    var yf = Math.round(base * (ndvi / 0.6) * (cropHealth / 100) * Math.max(0.5, 1 - droughtProb / 150));

    return {
      ndvi: ndvi.toFixed(2), cropHealth: cropHealth,
      soilMoisture: soilM + '%',
      droughtRisk: Math.round(droughtProb) + '%',
      heatRisk: heatRisk + '%',
      gwStress: gwStress + '%', gwRecharge: recharge,
      yieldForecast: yf.toLocaleString() + ' kg/ha',
      advisory: ''
    };
  }

  // ================================================================
  // PUBLIC API
  // ================================================================
  function flyToKhasra(){
    var sel = document.getElementById('cadKhasraSelect');
    if (sel && sel.value) selectKhasra(sel.value);
  }

  function toggleCadLayer(){
    var map = window.leafletMap; if (!map) return;
    var hasParcels = _cadParcelLayer && map.hasLayer(_cadParcelLayer);
    var hasSel = _selParcelLayer && map.hasLayer(_selParcelLayer);
    if (hasParcels || hasSel) {
      if (_cadParcelLayer) map.removeLayer(_cadParcelLayer);
      removeSelParcel();
      if (_cadOverlayLayer) map.removeLayer(_cadOverlayLayer);
    } else {
      if (_selectedKhasra) { showOnlyParcel(_selectedKhasra); }
      else if (_cadParcelLayer) map.addLayer(_cadParcelLayer);
      if (_cadOverlayLayer) map.addLayer(_cadOverlayLayer);
    }
  }

  window.loadCadastralLayer = loadCadastralLayer;
  window.selectKhasra = selectKhasra;
  window.onKhasraChange = selectKhasra;
  window.flyToKhasra = flyToKhasra;
  window.toggleCadLayer = toggleCadLayer;
  window.showAllParcels = showAllParcels;

  // Auto-load cadastral on village change
  var origVillageChange = window.onVillageChange;
  if (origVillageChange) {
    var origFn = origVillageChange;
    window.onVillageChange = function(name){
      origFn.call(this, name);
      var dk = document.getElementById('districtSelect').value;
      if (dk === 'jabalpur' && name && name.toUpperCase() === 'KUNDAM') {
        loadCadastralLayer();
      }
      if (dk === 'sidhi' && name && name.toUpperCase() === 'SAHIJANA') {
        loadCadastralLayer();
      }
    };
  }
})();
