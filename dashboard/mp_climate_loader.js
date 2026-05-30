/* ===========================================================================
   mp_climate_loader.js  (VILLAGE-LEVEL)
   ---------------------------------------------------------------------------
   Loads data/mp_climate_data.json (village-level), patches MP_DISTRICTS,
   rebuilds the bottom charts per district, and shows village-level metrics
   when a village is picked from the dropdown.
   ======================================================================== */
(function(){
  'use strict';
  var DATA_URL = 'data/mp_climate_data.json';
  var state = { data: null, currentDistrict: null, currentVillage: null };

  function fmt(n, d){
    if (n === null || n === undefined || isNaN(n)) return '—';
    return Number(n).toFixed(d == null ? 1 : d);
  }

  function applyDistrictPatch(payload){
    if (typeof MP_DISTRICTS === 'undefined') return false;
    Object.keys(payload.districts).forEach(function(key){
      var d = payload.districts[key];
      if (!MP_DISTRICTS[key]) {
        // Add the district if it wasn't there (key matches the dashboard convention)
        MP_DISTRICTS[key] = {name: d.name, lat: d.lat, lng: d.lng, blocks: {}};
      }
      MP_DISTRICTS[key].name    = d.name;
      MP_DISTRICTS[key].lat     = d.lat;
      MP_DISTRICTS[key].lng     = d.lng;
      MP_DISTRICTS[key].risk    = d.risk;
      MP_DISTRICTS[key].drought = d.drought;
      MP_DISTRICTS[key].heat    = d.heat;
      if (d.ndvi != null) MP_DISTRICTS[key].ndvi = d.ndvi;
      MP_DISTRICTS[key].blocks  = d.blocks || {};   // real tehsil → villages
      MP_DISTRICTS[key]._imd    = d.indices;
      MP_DISTRICTS[key]._annual = d.annual;
      MP_DISTRICTS[key]._villages = d.villages || {};
      MP_DISTRICTS[key]._future = d.future_2040 || null;
    });
    console.log('[mp_climate_loader] patched', Object.keys(payload.districts).length, 'districts');
    return true;
  }

  function killChart(canvasId){
    var c = document.getElementById(canvasId); if (!c) return;
    var existing = Chart.getChart ? Chart.getChart(c) : null;
    if (existing) existing.destroy();
  }

  function rebuildCharts(districtKey){
    if (typeof Chart === 'undefined' || !state.data) return;
    var ch = state.data.charts;
    var rain = ch.rainfall_monthly_mm[districtKey];
    var temp = ch.temperature_monthly_C[districtKey];
    if (!rain || !temp) return;

    var grid = {color:'rgba(138,211,170,0.15)'};
    var commonOpts = (typeof chartOpts === 'function') ? chartOpts(grid)
      : {responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'top'}}};

    killChart('chartRain');
    var rc = document.getElementById('chartRain');
    if (rc) new Chart(rc, {type:'bar', data:{
      labels: rain.labels,
      datasets: [
        {label:'Actual (mm)', data: rain.actual, backgroundColor:'rgba(92,195,205,0.5)', borderColor:'#5cc3cd', borderWidth:1},
        {label:'Climatology (mm)', type:'line', data: rain.normal, borderColor:'#6fc795', backgroundColor:'transparent', tension:0.4, borderWidth:2, pointRadius:0}
      ]}, options: commonOpts});

    killChart('chartTemp');
    var tc = document.getElementById('chartTemp');
    if (tc) new Chart(tc, {type:'line', data:{
      labels: temp.labels,
      datasets: [
        {label:'Tmax °C', data: temp.tmax, borderColor:'#f0a878', backgroundColor:'rgba(240,168,120,0.1)', fill:true, tension:0.4, borderWidth:2, pointRadius:2},
        {label:'Tmin °C', data: temp.tmin, borderColor:'#5cc3cd', backgroundColor:'transparent', tension:0.4, borderWidth:2, pointRadius:2}
      ]}, options: commonOpts});

    killChart('chartDrought');
    var dc = document.getElementById('chartDrought');
    if (dc && ch.rankings && ch.rankings.drought) {
      var labels = ch.rankings.drought.map(function(x){return x.district_name;});
      var vals   = ch.rankings.drought.map(function(x){return x.drought_probability_pct;});
      var colors = vals.map(function(v){return v>=70?'#ec8b9b':v>=50?'#f0a878':v>=30?'#e6cf6b':'#6fc795';});
      new Chart(dc, {type:'bar', data:{
        labels: labels,
        datasets: [{label:'Drought probability %', data: vals, backgroundColor: colors}]
      }, options: commonOpts});
    }
  }

  function decorateHistoricalPanel(districtKey){
    var d = state.data && state.data.districts[districtKey];
    if (!d) return;
    var host = document.getElementById('historical-indices-panel');
    if (!host) return;
    var idx = d.indices;
    host.innerHTML = ''
      + '<div class="section-header"><i class="fa fa-chart-line" style="color:var(--cyan);font-size:0.7rem"></i>'
      + '<div class="section-title">HISTORICAL INDICES 2000–2024 ('+ d.name +', '+ (idx.village_count||0) +' villages)</div></div>'
      + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.5rem;padding:0.75rem;">'
      + '  <div class="metric-card"><div class="metric-label">HEATWAVE DAYS/YR</div><div class="metric-value cyan">'+fmt(idx.heatwave_days_mean,1)+'</div></div>'
      + '  <div class="metric-card"><div class="metric-label">SEVERE HW DAYS</div><div class="metric-value" style="color:var(--red)">'+fmt(idx.severe_heatwave_days_mean,1)+'</div></div>'
      + '  <div class="metric-card"><div class="metric-label">MEAN SUMMER TMAX</div><div class="metric-value" style="color:var(--orange)">'+fmt(idx.mean_summer_tmax,1)+'°C</div></div>'
      + '  <div class="metric-card"><div class="metric-label">MAX SUMMER TMAX</div><div class="metric-value" style="color:var(--red)">'+fmt(idx.max_summer_tmax,1)+'°C</div></div>'
      + '  <div class="metric-card"><div class="metric-label">DROUGHT MONTHS/YR</div><div class="metric-value" style="color:var(--orange)">'+fmt(idx.drought_months_per_year_mean,1)+'</div></div>'
      + '  <div class="metric-card"><div class="metric-label">DROUGHT PROB %</div><div class="metric-value" style="color:var(--orange)">'+fmt(idx.drought_probability_pct,1)+'%</div></div>'
      + '  <div class="metric-card"><div class="metric-label">SPI-12</div><div class="metric-value" style="color:var(--blue)">'+fmt(idx.spi12_year_end_mean,2)+'</div></div>'
      + '  <div class="metric-card"><div class="metric-label">ANNUAL RAIN</div><div class="metric-value" style="color:var(--blue)">'+fmt(idx.annual_rain_mm_mean,0)+' mm</div></div>'
      + '  <div class="metric-card"><div class="metric-label">R95p / YR</div><div class="metric-value" style="color:var(--blue)">'+fmt(idx.r95p_mm_mean,1)+' mm</div></div>'
      + '  <div class="metric-card"><div class="metric-label">Rx1day</div><div class="metric-value" style="color:var(--blue)">'+fmt(idx.rx1day_mm_mean,1)+' mm</div></div>'
      + '  <div class="metric-card"><div class="metric-label">Rx5day</div><div class="metric-value" style="color:var(--blue)">'+fmt(idx.rx5day_mm_mean,1)+' mm</div></div>'
      + '  <div class="metric-card"><div class="metric-label">CDD</div><div class="metric-value" style="color:var(--orange)">'+fmt(idx.cdd_mean,1)+' d</div></div>'
      + '</div>';
  }

  function renderFuturePanel(districtKey){
    var d = state.data && state.data.districts[districtKey];
    if (!d) return;
    var f = d.future_2040;
    var host = document.getElementById('future-2040-panel'); if (!host) return;
    if (!f) {
      host.innerHTML = '<div style="padding:0.6rem;font-size:0.65rem;color:var(--text-dim)">'
        + 'CMIP6 future projection unavailable. Run scripts/05_gee_cmip6_2040.js.</div>';
      return;
    }
    function delta(v, unit, invert){
      var arrow = v > 0.5 ? '▲' : v < -0.5 ? '▼' : '◆';
      var color = invert ? (v > 0 ? 'var(--green)' : 'var(--red)')
                         : (v > 0 ? 'var(--red)' : 'var(--green)');
      return '<span style="color:'+color+'">'+arrow+' '+fmt(Math.abs(v),1)+unit+'</span>';
    }
    host.innerHTML = ''
      + '<div class="section-header"><i class="fa fa-clock-rotate-left" style="color:var(--orange);font-size:0.7rem"></i>'
      + '<div class="section-title">2040 PROJECTION (SSP2-4.5, 8-MODEL CMIP6 ENSEMBLE)</div></div>'
      + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.5rem;padding:0.75rem;">'
      + '  <div class="metric-card"><div class="metric-label">HEATWAVE DAYS/YR</div><div class="metric-value cyan">'+fmt(f.heatwave_days_per_yr,1)+'</div><div style="font-size:0.55rem">vs baseline: '+delta(f.delta_heatwave_days_per_yr,' d')+'</div></div>'
      + '  <div class="metric-card"><div class="metric-label">PEAK TMAX</div><div class="metric-value" style="color:var(--red)">'+fmt(f.max_summer_tmax,1)+'°C</div><div style="font-size:0.55rem">vs baseline: '+delta(f.delta_max_summer_tmax,'°C')+'</div></div>'
      + '  <div class="metric-card"><div class="metric-label">R95p mm/yr</div><div class="metric-value" style="color:var(--blue)">'+fmt(f.r95p_mm_per_yr,1)+'</div><div style="font-size:0.55rem">vs baseline: '+delta(f.delta_r95p_mm_per_yr,' mm',true)+'</div></div>'
      + '  <div class="metric-card"><div class="metric-label">Rx1day mm</div><div class="metric-value" style="color:var(--blue)">'+fmt(f.rx1day_mm,1)+'</div><div style="font-size:0.55rem">vs baseline: '+delta(f.delta_rx1day_mm,' mm',true)+'</div></div>'
      + '</div>';
  }

  function renderVillagePanel(districtKey, villageName){
    var d = state.data && state.data.districts[districtKey];
    var host = document.getElementById('village-detail-panel'); if (!host) return;
    if (!d || !villageName) { host.innerHTML = ''; return; }
    // village name lookup
    var match = null;
    var vmap = d.villages || {};
    for (var id in vmap) {
      if ((vmap[id].name||'').toUpperCase() === (villageName||'').toUpperCase()) {
        match = vmap[id]; match._id = id; break;
      }
    }
    if (!match) {
      host.innerHTML = '<div style="padding:0.6rem;font-size:0.65rem;color:var(--text-dim)">'
        + 'No data for village "'+villageName+'" — village may not be in shapefile.</div>';
      return;
    }
    var i = match.indices;
    host.innerHTML = ''
      + '<div class="section-header"><i class="fa fa-house" style="color:var(--green);font-size:0.7rem"></i>'
      + '<div class="section-title">VILLAGE: '+match.name+' (tehsil '+match.tehsil+', LGD '+match._id+')</div></div>'
      + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.5rem;padding:0.75rem;">'
      + '  <div class="metric-card"><div class="metric-label">HEATWAVE D/YR</div><div class="metric-value cyan">'+fmt(i.heatwave_days,1)+'</div></div>'
      + '  <div class="metric-card"><div class="metric-label">MAX TMAX</div><div class="metric-value" style="color:var(--red)">'+fmt(i.max_summer_tmax,1)+'°C</div></div>'
      + '  <div class="metric-card"><div class="metric-label">DROUGHT %</div><div class="metric-value" style="color:var(--orange)">'+fmt(i.drought_probability_pct,1)+'%</div></div>'
      + '  <div class="metric-card"><div class="metric-label">DROUGHT MO</div><div class="metric-value" style="color:var(--orange)">'+fmt(i.drought_months,1)+'</div></div>'
      + '  <div class="metric-card"><div class="metric-label">SPI-12</div><div class="metric-value" style="color:var(--blue)">'+fmt(i.spi_12,2)+'</div></div>'
      + '  <div class="metric-card"><div class="metric-label">ANNUAL RAIN</div><div class="metric-value" style="color:var(--blue)">'+fmt(i.annual_rain_mm,0)+' mm</div></div>'
      + '  <div class="metric-card"><div class="metric-label">R95p</div><div class="metric-value" style="color:var(--blue)">'+fmt(i.r95p_mm,1)+' mm</div></div>'
      + '  <div class="metric-card"><div class="metric-label">Rx1day</div><div class="metric-value" style="color:var(--blue)">'+fmt(i.rx1day_mm,1)+' mm</div></div>'
      + '</div>'
      + '<div style="font-size:0.55rem;color:var(--text-dim);padding:0 0.75rem 0.5rem">'
      + '  Centroid: '+fmt(match.lat,4)+', '+fmt(match.lon,4)+' — sampled from nearest IMD 0.05° pixel</div>';
  }

  function injectPanels(){
    var bp = document.getElementById('bottom-panel');
    if (!bp || document.getElementById('historical-indices-panel')) return;
    var wrap = document.createElement('div');
    wrap.style.cssText = 'flex:1;overflow-y:auto;border-right:1px solid var(--border);min-width:380px;max-width:500px;';
    var h = document.createElement('div'); h.id = 'historical-indices-panel'; wrap.appendChild(h);
    var f = document.createElement('div'); f.id = 'future-2040-panel'; wrap.appendChild(f);
    var v = document.createElement('div'); v.id = 'village-detail-panel'; wrap.appendChild(v);
    bp.insertBefore(wrap, bp.firstChild);
  }

  function refreshAll(districtKey, villageName){
    state.currentDistrict = districtKey;
    state.currentVillage  = villageName || null;
    rebuildCharts(districtKey);
    decorateHistoricalPanel(districtKey);
    renderFuturePanel(districtKey);
    renderVillagePanel(districtKey, villageName);
  }

  function hookDistrictChange(){
    if (typeof onDistrictChange !== 'function') return;
    if (window._mpClimateHooked) return;
    var origDist = onDistrictChange;
    window.onDistrictChange = function(key){
      origDist.call(this, key);
      if (key && state.data && state.data.districts[key]) refreshAll(key, null);
    };
    if (typeof onVillageChange === 'function') {
      var origVil = onVillageChange;
      window.onVillageChange = function(name){
        origVil.call(this, name);
        var dk = document.getElementById('districtSelect').value;
        if (dk && state.data && state.data.districts[dk]) refreshAll(dk, name);
      };
    }
    window._mpClimateHooked = true;
  }

  function init(){
    fetch(DATA_URL).then(function(r){
      if (!r.ok) throw new Error('HTTP '+r.status+' loading '+DATA_URL);
      return r.json();
    }).then(function(payload){
      state.data = payload;
      var tries = 0;
      var iv = setInterval(function(){
        if (applyDistrictPatch(payload) || ++tries > 40) {
          clearInterval(iv);
          injectPanels(); hookDistrictChange();
          // pick a default district
          var first = Object.keys(payload.districts)[0];
          refreshAll(first, null);
        }
      }, 250);
    }).catch(function(err){
      console.error('[mp_climate_loader] failed:', err);
      var bp = document.getElementById('bottom-panel');
      if (bp) {
        var div = document.createElement('div');
        div.style.cssText='padding:1rem;color:var(--red);font-size:0.75rem';
        div.textContent = 'IMD data not loaded: '+err.message;
        bp.insertBefore(div, bp.firstChild);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
