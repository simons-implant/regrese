
/* ══════════════════════════════════════════════
   STATE
══════════════════════════════════════════════ */
let chartInst  = null;
let isDark     = false;
let themeChoice = 'system';
let lastResult = null;
let lastData   = null;
let regressionOn = false;
let showCI = false;
let axisLabels = {x:'x', y:'y'};
let axisLabelsFromFile = false;
let manualRange = {active:false, xMin:null, xMax:null, yMin:null, yMax:null}; // true pouze pokud byla detekována hlavička ze souboru
let combineState = {open:false, enabled:false, expanded:false, op:'+', dsA:null, dsB:null};
let integralState = {enabled:false, expanded:false, fnKey:null, lo:null, hi:null};
let derivativeState = {enabled:false, expanded:false, fnKey:null, x0:null};
const REGRESSION_TYPE_SHORT = {
  linear:'Lineární', exponential:'Exponenciální', polynomial:'Polynomická',
  logarithmic:'Logaritmická', gaussian:'Gauss', gaussian2:'2× Gauss',
  gaussian3:'3× Gauss', rational:'Lomenná', fourier:'Fourier', custom:'Vlastní rovnice'
};

/* ══════════════════════════════════════════════
   VÍCE SAD DAT (max 5 záložek)
══════════════════════════════════════════════ */
const DATASET_COLORS = [
  {point:'#4a9eff', fit:'#1a5fc9', ciBorder:'rgba(26,95,201,0.4)',  ciBg:'rgba(26,95,201,0.16)',  excl:'#4a9eff'},
  {point:'#f5a623', fit:'#e07b00', ciBorder:'rgba(224,123,0,0.45)',  ciBg:'rgba(224,123,0,0.16)',  excl:'#f5a623'},
  {point:'#2ecc71', fit:'#1f9d57', ciBorder:'rgba(31,157,87,0.45)',  ciBg:'rgba(31,157,87,0.16)',  excl:'#2ecc71'},
  {point:'#b06fe0', fit:'#8a3fc0', ciBorder:'rgba(138,63,192,0.45)', ciBg:'rgba(138,63,192,0.16)', excl:'#b06fe0'},
  {point:'#e05c8a', fit:'#c02a5f', ciBorder:'rgba(192,42,95,0.45)',  ciBg:'rgba(192,42,95,0.16)',  excl:'#e05c8a'}
];

/* ── Typy bodů pro jednotlivé datasety ── */
const POINT_STYLES = [
  {key:'circle',       label:'Kruh',                   icon:'●', chart:'circle',   rotation:0,   sizeMult:1},
  {key:'triangle',     label:'Trojúhelník',             icon:'▲', chart:'triangle', rotation:0,   sizeMult:1.35},
  {key:'triangleDown',label:'Obrácený trojúhelník',    icon:'▼', chart:'triangle', rotation:180, sizeMult:1.35},
  {key:'rect',          label:'Čtverec',                 icon:'■', chart:'rect',     rotation:0,   sizeMult:1.15},
  {key:'diamond',      label:'Kosočtverec',             icon:'◆', chart:'rectRot',  rotation:0,   sizeMult:1.15}
];
const POINT_STYLE_ICON = Object.fromEntries(POINT_STYLES.map(o=>[o.key,o.icon]));

function getPointStyleMeta(key){
  return POINT_STYLES.find(o=>o.key===key) || POINT_STYLES[0];
}

function makeEmptyDataset(name){
  return {
    name, fileLabel:null,
    tableRows:[],
    xLabel:'x', yLabel:'y',
    regressionType:'linear', regressionOn:false, showCI:false,
    fourierHarmonics:3, fourierAutoHarmonics:true,
    fourierManualPeriodOn:false, fourierManualPeriod:null,
    hiddenSeries:{data:false, excl:false, fit:false, ci:false},
    customFormula:null, pointStyle:'circle',
    lastResult:null, x:[], y:[], excl:[]
  };
}

function escapeHtmlAttr(s){
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
}

function escapeXml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Sdílená SVG ikonka pro chybové/varovné hlášky (nahrazuje dřívější emoji ⚠/❗,
// které se v tmavém režimu vykreslovaly nekonzistentně — currentColor se
// naopak vždy napojí na barvu okolního textu v obou motivech).
function errIconSvg(){
  return '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1.5px;flex-shrink:0;"><path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/></svg>';
}

function okIconSvg(){
  return '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1.5px;flex-shrink:0;"><path d="M20 6 9 17l-5-5"/></svg>';
}

function captureTableRows(){
  const tb=document.getElementById('tbody');
  const rows=[];
  if(!tb) return rows;
  for(let i=0;i<tb.rows.length;i++){
    const row=tb.rows[i];
    const cb=row.cells[1].querySelector('input[type="checkbox"]');
    const xInput=row.cells[2].querySelector('input');
    const yInput=row.cells[3].querySelector('input');
    rows.push({x:xInput?xInput.value:'', y:yInput?yInput.value:'', checked:cb?cb.checked:true});
  }
  return rows;
}

function restoreTableRows(rows){
  const tb=document.getElementById('tbody');
  if(!tb) return;
  tb.innerHTML='';
  rows.forEach((r,i)=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td class="row-num">${i+1}</td>
      <td><input type="checkbox" ${r.checked?'checked':''} onchange="autoRecompute()"></td>
      <td><input class="cell" type="text" value="${escapeHtmlAttr(r.x)}" data-r="${i}" data-c="x"
                 onkeydown="handleKey(event,${i},'x')" oninput="autoRecompute()"></td>
      <td><input class="cell" type="text" value="${escapeHtmlAttr(r.y)}" data-r="${i}" data-c="y"
                 onkeydown="handleKey(event,${i},'y')" oninput="autoRecompute()"></td>`;
    tb.appendChild(tr);
  });
}

let datasets = [makeEmptyDataset('Data 1')];
let activeDatasetIdx = 0;

function renderTabsUI(){
  const wrap=document.getElementById('dataset-tabs');
  if(!wrap) return;
  let html='';
  datasets.forEach((ds,i)=>{
    const col=DATASET_COLORS[i%DATASET_COLORS.length];
    const label=ds.fileLabel ? `${ds.name}: ${ds.fileLabel}` : ds.name;
    const pStyle=ds.pointStyle||'circle';
    html+=`<div class="ds-row">`
        + `<div class="ds-tab${i===activeDatasetIdx?' active':''}" onclick="switchDataset(${i})" title="${label.replace(/"/g,'&quot;')}">`
        +   `<span class="ds-dot" style="background:${col.point};"></span>`
        +   `<span class="ds-label">${label}</span>`
        + `</div>`
        + `<div class="ds-point-wrap">`
        +   `<button class="ds-point-btn" onclick="event.stopPropagation(); toggleDsPointDropdown(${i})" title="Typ bodu grafu">${POINT_STYLE_ICON[pStyle]||'●'}</button>`
        +   `<div class="ds-point-dropdown" id="ds-point-dropdown-${i}">`
        +     POINT_STYLES.map(o=>`<button class="ds-point-option${pStyle===o.key?' selected':''}" onclick="event.stopPropagation(); selectDsPointStyle(${i},'${o.key}')">${o.icon}&nbsp;&nbsp;${o.label}</button>`).join('')
        +   `</div>`
        + `</div>`
        + `</div>`;
  });
  wrap.innerHTML=html;
  const addBtn=document.createElement('button');
  addBtn.className='ds-tab-add';
  addBtn.title='Přidat novou sadu dat';
  addBtn.textContent='+';
  addBtn.disabled=datasets.length>=5;
  addBtn.onclick=addDataset;
  wrap.appendChild(addBtn);

  const saveAllBtn=document.getElementById('btn-save-all');
  if(saveAllBtn){
    const nWithData=datasets.filter(ds=>ds.x.length>0||ds.excl.length>0).length;
    saveAllBtn.style.display=nWithData>=2?'inline-flex':'none';
  }
}

function toggleDsPointDropdown(idx){
  const dd=document.getElementById('ds-point-dropdown-'+idx);
  if(!dd) return;
  const wasOpen=dd.classList.contains('open');
  document.querySelectorAll('.ds-point-dropdown.open').forEach(d=>d.classList.remove('open'));
  if(!wasOpen) dd.classList.add('open');
}

function selectDsPointStyle(idx, style){
  datasets[idx].pointStyle=style;
  document.querySelectorAll('.ds-point-dropdown.open').forEach(d=>d.classList.remove('open'));
  renderTabsUI();
  renderCombinedChart();
}

function syncRtypeUI(type){
  const sel=document.getElementById('rType');
  if(sel) sel.value=type;
  document.querySelectorAll('.rtype-option').forEach(b=>{
    const onclickAttr=b.getAttribute('onclick')||'';
    b.classList.toggle('selected', onclickAttr.includes(`'${type}'`));
  });
  updateFourierUI(type==='fourier');
}

function syncFourierControlsUI(ds){
  const hSlider=document.getElementById('fourier-harmonics-slider');
  const hLbl=document.getElementById('fourier-harmonics-val');
  if(hSlider){ hSlider.value=ds.fourierHarmonics; hSlider.disabled=ds.fourierAutoHarmonics;
    hSlider.style.opacity=ds.fourierAutoHarmonics?'.45':'1';
    hSlider.style.cursor=ds.fourierAutoHarmonics?'not-allowed':'pointer'; }
  if(hLbl) hLbl.textContent=ds.fourierHarmonics;
  const autoTrack=document.getElementById('fourier-auto-track');
  const autoKnob=document.getElementById('fourier-auto-knob');
  if(autoTrack){ autoTrack.style.background=ds.fourierAutoHarmonics?'#c83030':'var(--btn)';
    autoTrack.style.borderColor=ds.fourierAutoHarmonics?'#c83030':'var(--border)'; }
  if(autoKnob) autoKnob.style.left=ds.fourierAutoHarmonics?'18px':'1px';
  const pTrack=document.getElementById('fourier-period-track');
  const pKnob=document.getElementById('fourier-period-knob');
  const pRow=document.getElementById('fourier-period-row');
  const pInput=document.getElementById('fourier-period-input');
  if(pTrack){ pTrack.style.background=ds.fourierManualPeriodOn?'#c83030':'var(--btn)';
    pTrack.style.borderColor=ds.fourierManualPeriodOn?'#c83030':'var(--border)'; }
  if(pKnob) pKnob.style.left=ds.fourierManualPeriodOn?'18px':'1px';
  if(pRow) pRow.style.display=ds.fourierManualPeriodOn?'flex':'none';
  if(pInput) pInput.value=ds.fourierManualPeriod!=null?ds.fourierManualPeriod:'';
}

function saveActiveDatasetSnapshot(){
  const ds=datasets[activeDatasetIdx];
  ds.tableRows=captureTableRows();
  ds.xLabel=axisLabels.x; ds.yLabel=axisLabels.y;
  const sel=document.getElementById('rType');
  if(sel) ds.regressionType=sel.value;
  ds.regressionOn=regressionOn;
  ds.showCI=showCI;
  ds.fourierHarmonics=fourierHarmonics;
  ds.fourierAutoHarmonics=fourierAutoHarmonics;
  ds.fourierManualPeriodOn=fourierManualPeriodOn;
  ds.fourierManualPeriod=fourierManualPeriod;
}

function loadDatasetSnapshotUI(idx){
  const ds=datasets[idx];
  restoreTableRows(ds.tableRows);
  axisLabels.x=ds.xLabel; axisLabels.y=ds.yLabel;
  const lx=document.getElementById('label-x'), ly=document.getElementById('label-y');
  if(lx) lx.value=ds.xLabel;
  if(ly) ly.value=ds.yLabel;
  syncRtypeUI(ds.regressionType);
  regressionOn=ds.regressionOn;
  showCI=ds.showCI;
  const ciBtn=document.getElementById('btn-ci');
  if(ciBtn){
    ciBtn.style.opacity=showCI?'1':'.6';
    ciBtn.style.color=showCI?'var(--accent)':'var(--text)';
  }
  fourierHarmonics=ds.fourierHarmonics;
  fourierAutoHarmonics=ds.fourierAutoHarmonics;
  fourierManualPeriodOn=ds.fourierManualPeriodOn;
  fourierManualPeriod=ds.fourierManualPeriod;
  syncFourierControlsUI(ds);
  const br=document.getElementById('btn-regrese');
  if(br){
    br.style.color=regressionOn?'var(--accent)':'var(--text)';
    br.style.opacity=regressionOn?'1':'.6';
    br.title=regressionOn?'Skrýt regresi':'Spustit analýzu';
  }
  updateGeneralEq();
  const fl=document.getElementById('file-label');
  if(fl){
    if(ds.fileLabel){ fl.textContent=ds.fileLabel; fl.style.display='block'; }
    else { fl.textContent=''; fl.style.display='none'; }
  }
}

function switchDataset(idx){
  if(idx===activeDatasetIdx || idx<0 || idx>=datasets.length) return;
  saveActiveDatasetSnapshot();
  activeDatasetIdx=idx;
  loadDatasetSnapshotUI(idx);
  renderTabsUI();
  recomputeKeepVis();
}

function addDataset(){
  if(datasets.length>=5) return;
  saveActiveDatasetSnapshot();
  datasets.push(makeEmptyDataset('Data '+(datasets.length+1)));
  activeDatasetIdx=datasets.length-1;
  loadDatasetSnapshotUI(activeDatasetIdx);
  initTable();
  renderTabsUI();
  recomputeKeepVis();
}


const sysMQ = window.matchMedia('(prefers-color-scheme: dark)');
sysMQ.addEventListener('change', () => {
  if(themeChoice === 'system') applyTheme(true);
});

function applyTheme(rerender){
  isDark = themeChoice === 'system'
         ? sysMQ.matches
         : themeChoice === 'dark';
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  const thumb=document.getElementById('theme-thumb');
  if(thumb) thumb.style.left = isDark ? '31px' : '3px';
  if(rerender && chartInst){
    const vis = chartInst.data.datasets.map((_,i)=>chartInst.isDatasetVisible(i));
    if(regressionOn) computeRegression(); else showPointsOnly();
    if(chartInst) vis.forEach((v,i)=>{ if(!v) chartInst.hide(i); });
    if(chartInst) chartInst.update();
  }
}

function toggleTheme(){
  themeChoice = isDark ? 'light' : 'dark';
  applyTheme(true);
}

function setTheme(choice){
  themeChoice = choice;
  applyTheme(true);
}

/* ══════════════════════════════════════════════
   MATH UTILITIES
══════════════════════════════════════════════ */

















/* ══════════════════════════════════════════════
   REGRESSION FUNCTIONS
══════════════════════════════════════════════ */












/* ── Gauss-Jordan solver (pro LM) ── */


/* ── Levenberg-Marquardt ── */


/* ── 4×4 matrix inverse (pro SE gaussovky) ── */




/* ── Fourierova řada (3 harmonické) ── */










/* ── Multi-Gaussian fit ── */


/* ══════════════════════════════════════════════
   TABLE MANAGEMENT
══════════════════════════════════════════════ */
function addRow(){
  const tb=document.getElementById('tbody');
  const row=tb.rows.length;
  const tr=document.createElement('tr');
  tr.innerHTML=`
    <td class="row-num">${row+1}</td>
    <td><input type="checkbox" checked onchange="autoRecompute()"></td>
    <td><input class="cell" type="text" placeholder="" data-r="${row}" data-c="x"
               onkeydown="handleKey(event,${row},'x')" oninput="autoRecompute()"></td>
    <td><input class="cell" type="text" placeholder="" data-r="${row}" data-c="y"
               onkeydown="handleKey(event,${row},'y')" oninput="autoRecompute()"></td>`;
  tb.appendChild(tr);
}

function handleKey(e,row,col){
  if(e.key!=='Enter') return;
  e.preventDefault();
  if(col==='x'){
    focusCell(row,'y');
  } else {
    const tb=document.getElementById('tbody');
    if(row===tb.rows.length-1) addRow();
    focusCell(row+1,'x');
  }
}

function focusCell(row,col){
  const el=document.querySelector(`[data-r="${row}"][data-c="${col}"]`);
  if(el) el.focus();
}

function initTable(){
  for(let i=0;i<6;i++) addRow();
}

function getTableData(){
  const tb=document.getElementById('tbody');
  const x=[],y=[],excl=[];
  for(let i=0;i<tb.rows.length;i++){
    const row=tb.rows[i];
    const cb=row.cells[1].querySelector('input[type="checkbox"]');
    const xv=row.cells[2].querySelector('input').value.trim().replace(',','.');
    const yv=row.cells[3].querySelector('input').value.trim().replace(',','.');
    if(!xv||!yv) continue;
    const xf=parseFloat(xv), yf=parseFloat(yv);
    if(isNaN(xf)||isNaN(yf)) continue;
    if(cb&&cb.checked){ x.push(xf); y.push(yf); }
    else excl.push([xf,yf]);
  }
  return{x,y,excl};
}

/* ══════════════════════════════════════════════
   ULOŽENÍ / NAČTENÍ CELÉHO PROJEKTU (.json)
   Ukládá všechny sady dat (tabulky + nastavení regrese),
   ne jen aktivní záložku.
══════════════════════════════════════════════ */
function extractXYFromRows(rows){
  const x=[], y=[], excl=[];
  (rows||[]).forEach(r=>{
    const xv=String(r.x||'').trim().replace(',','.');
    const yv=String(r.y||'').trim().replace(',','.');
    if(!xv||!yv) return;
    const xf=parseFloat(xv), yf=parseFloat(yv);
    if(isNaN(xf)||isNaN(yf)) return;
    if(r.checked){ x.push(xf); y.push(yf); }
    else excl.push([xf,yf]);
  });
  return {x,y,excl};
}

function getSessionState(){
  saveActiveDatasetSnapshot();
  return {
    app:'regresni-analyza', version:1, savedAt:new Date().toISOString(),
    activeDatasetIdx,
    customEquationLibrary:customEquationLibrary,
    datasets:datasets.map(ds=>({
      name:ds.name, fileLabel:ds.fileLabel, tableRows:ds.tableRows,
      xLabel:ds.xLabel, yLabel:ds.yLabel,
      regressionType:ds.regressionType, regressionOn:ds.regressionOn,
      fourierHarmonics:ds.fourierHarmonics, fourierAutoHarmonics:ds.fourierAutoHarmonics,
      fourierManualPeriodOn:ds.fourierManualPeriodOn, fourierManualPeriod:ds.fourierManualPeriod,
      showCI:ds.showCI,
      hiddenSeries:ds.hiddenSeries||{data:false,excl:false,fit:false,ci:false},
      customFormula:ds.customFormula||null,
      pointStyle:ds.pointStyle||'circle'
    })),
    tools:{
      combine:{enabled:combineState.enabled, op:combineState.op, dsA:combineState.dsA, dsB:combineState.dsB},
      integral:{enabled:integralState.enabled, fnKey:integralState.fnKey, lo:integralState.lo, hi:integralState.hi},
      derivative:{enabled:derivativeState.enabled, fnKey:derivativeState.fnKey, x0:derivativeState.x0}
    }
  };
}

async function saveSession(){
  const state=getSessionState();
  const json=JSON.stringify(state,null,2);

  // Moderní prohlížeče (Chrome/Edge): nabídni skutečný dialog "Uložit jako"
  if(window.showSaveFilePicker){
    try{
      const handle=await window.showSaveFilePicker({
        suggestedName:'regrese_projekt.json',
        types:[{description:'Projekt appky (JSON)', accept:{'application/json':['.json']}}]
      });
      const writable=await handle.createWritable();
      await writable.write(json);
      await writable.close();
      return;
    }catch(err){
      if(err && err.name==='AbortError') return; // uživatel dialog zrušil — nic dalšího nedělej
      // jinak (např. chyba zápisu) spadni do fallbacku níže
    }
  }

  // Fallback (Firefox/Safari apod.) — normální stažení do složky Stažené soubory
  const blob=new Blob([json], {type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='regrese_projekt.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function loadSession(input){
  const file=input.files[0];
  if(!file) return;
  input.value='';
  const reader=new FileReader();
  reader.onload=e=>{
    let state;
    try{ state=JSON.parse(e.target.result); }
    catch(err){ alert('Soubor se nepodařilo přečíst — není to platný JSON projekt.'); return; }
    if(!state||!Array.isArray(state.datasets)||!state.datasets.length){
      alert('Tenhle soubor neobsahuje platný projekt appky.'); return;
    }
    applySessionState(state);
  };
  reader.readAsText(file);
}

function applySessionState(state){
  if(Array.isArray(state.customEquationLibrary)){
    state.customEquationLibrary.forEach(eq=>{
      if(!eq||!eq.formula||!eq.name) return;
      const exists=customEquationLibrary.some(e=>e.formula===eq.formula && e.name===eq.name);
      if(!exists){
        customEquationLibrary.push({
          id: eq.id || ('custom_'+Date.now()+'_'+Math.random().toString(36).slice(2,7)),
          name: eq.name, formula: eq.formula
        });
      }
    });
    saveCustomEquationLibrary();
    renderCustomEquationDropdownItems();
  }

  datasets=state.datasets.map(d=>Object.assign(makeEmptyDataset(d.name||'Data 1'), {
    fileLabel:d.fileLabel||null,
    tableRows:Array.isArray(d.tableRows)?d.tableRows:[],
    xLabel:d.xLabel||'x', yLabel:d.yLabel||'y',
    regressionType:d.regressionType||'linear',
    regressionOn:!!d.regressionOn,
    fourierHarmonics:d.fourierHarmonics||3,
    fourierAutoHarmonics:d.fourierAutoHarmonics!==false,
    fourierManualPeriodOn:!!d.fourierManualPeriodOn,
    fourierManualPeriod:d.fourierManualPeriod||null,
    showCI:!!d.showCI,
    hiddenSeries:Object.assign({data:false,excl:false,fit:false,ci:false}, d.hiddenSeries||{}),
    customFormula:d.customFormula||null,
    pointStyle:d.pointStyle||'circle'
  }));
  activeDatasetIdx=Math.min(Math.max(state.activeDatasetIdx||0,0), datasets.length-1);

  // Přepočítej x/y/excl a případný fit pro VŠECHNY sady (ne jen aktivní),
  // ať se v kombinovaném grafu hned po načtení zobrazí úplně všechno.
  const prevH=fourierHarmonics, prevAuto=fourierAutoHarmonics, prevPeriod=fourierManualPeriod;
  datasets.forEach(ds=>{
    const {x,y,excl}=extractXYFromRows(ds.tableRows);
    ds.x=x; ds.y=y; ds.excl=excl;
    ds.lastResult=null;
    if(ds.regressionOn && x.length>=2){
      fourierHarmonics=ds.fourierHarmonics;
      fourierAutoHarmonics=ds.fourierAutoHarmonics;
      fourierManualPeriod=ds.fourierManualPeriod;
      try{
        ds.lastResult=computeFitForType(x,y,ds.regressionType,ds);
        if(ds.regressionType==='fourier') ds.fourierHarmonics=fourierHarmonics;
      }catch(e){ ds.lastResult=null; }
    }
  });
  fourierHarmonics=prevH; fourierAutoHarmonics=prevAuto; fourierManualPeriod=prevPeriod;

  loadDatasetSnapshotUI(activeDatasetIdx);
  renderTabsUI();

  const activeDs=datasets[activeDatasetIdx];
  if(activeDs.lastResult){
    displayResults(activeDs.lastResult, activeDs.x.length, activeDs.x.length+activeDs.excl.length);
  } else {
    const eqEl=document.getElementById('resEq'), pmEl=document.getElementById('resParams');
    if(eqEl) eqEl.textContent = activeDs.x.length<2 ? '—' : '—';
    if(pmEl) pmEl.innerHTML='';
  }
  lastResult=activeDs.lastResult;
  lastData={x:activeDs.x,y:activeDs.y,excl:activeDs.excl};
  lastFourierResult=(activeDs.regressionType==='fourier')?activeDs.lastResult:lastFourierResult;

  const tools=state.tools||{};
  const c=tools.combine||{};
  combineState.op = (c.op==='+'||c.op==='-'||c.op==='*') ? c.op : '+';
  combineState.dsA = Number.isInteger(c.dsA) && c.dsA>=0 && c.dsA<datasets.length ? c.dsA : null;
  combineState.dsB = Number.isInteger(c.dsB) && c.dsB>=0 && c.dsB<datasets.length ? c.dsB : null;
  combineState.enabled = !!c.enabled && combineState.dsA!==null && combineState.dsB!==null && combineState.dsA!==combineState.dsB;
  combineState.open=false; combineState.expanded=false;

  const it=tools.integral||{};
  integralState.fnKey = typeof it.fnKey==='string' ? it.fnKey : null;
  integralState.lo = Number.isFinite(it.lo) ? it.lo : null;
  integralState.hi = Number.isFinite(it.hi) ? it.hi : null;
  integralState.enabled = !!it.enabled;
  integralState.expanded=false;

  const dv=tools.derivative||{};
  derivativeState.fnKey = typeof dv.fnKey==='string' ? dv.fnKey : null;
  derivativeState.x0 = Number.isFinite(dv.x0) ? dv.x0 : null;
  derivativeState.enabled = !!dv.enabled;
  derivativeState.expanded=false;

  const panel=document.getElementById('combine-panel');
  const btn=document.getElementById('btn-combine');
  if(panel) panel.classList.remove('open');
  if(btn) btn.classList.remove('active');
  updateToolExpandUI();

  renderCombinedChart();
}

/* ══════════════════════════════════════════════
   COMPUTE
══════════════════════════════════════════════ */
function toggleCI(){
  showCI=!showCI;
  const btn=document.getElementById('btn-ci');
  if(showCI){
    btn.style.opacity='1';
    btn.style.color='var(--accent)';
  } else {
    btn.style.opacity='.6';
    btn.style.color='var(--text)';
  }
  recomputeKeepVis();
}

function toggleRtypeDropdown(){
  const dd=document.getElementById('rtype-dropdown');
  dd.classList.toggle('open');
}

function selectRtype(value, btn){
  // Update hidden select
  const sel=document.getElementById('rType');
  sel.value=value;
  // Update option highlight
  document.querySelectorAll('.rtype-option').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected');
  // Close dropdown
  document.getElementById('rtype-dropdown').classList.remove('open');
  updateFourierUI(value==='fourier');
  updateGeneralEq();
  recomputeKeepVis();
}

let fourierHarmonics=3;
function setFourierHarmonics(val){
  fourierHarmonics=parseInt(val,10)||3;
  const lbl=document.getElementById('fourier-harmonics-val');
  if(lbl) lbl.textContent=fourierHarmonics;
  updateGeneralEq();
  recomputeKeepVis();
}

let fourierAutoHarmonics=true;
let lastFourierResult=null;

function toggleFourierAutoHarmonics(){
  fourierAutoHarmonics=!fourierAutoHarmonics;
  const track=document.getElementById('fourier-auto-track');
  const knob=document.getElementById('fourier-auto-knob');
  const slider=document.getElementById('fourier-harmonics-slider');
  if(track){
    track.style.background=fourierAutoHarmonics?'#c83030':'var(--btn)';
    track.style.borderColor=fourierAutoHarmonics?'#c83030':'var(--border)';
  }
  if(knob) knob.style.left=fourierAutoHarmonics?'18px':'1px';
  if(slider){
    slider.disabled=fourierAutoHarmonics;
    slider.style.opacity=fourierAutoHarmonics?'.45':'1';
    slider.style.cursor=fourierAutoHarmonics?'not-allowed':'pointer';
  }
  recomputeKeepVis();
}

let fourierManualPeriodOn=false;
let fourierManualPeriod=null;

function toggleFourierManualPeriod(){
  fourierManualPeriodOn=!fourierManualPeriodOn;
  const track=document.getElementById('fourier-period-track');
  const knob=document.getElementById('fourier-period-knob');
  const row=document.getElementById('fourier-period-row');
  if(track) track.style.background=fourierManualPeriodOn?'#c83030':'var(--btn)';
  if(track) track.style.borderColor=fourierManualPeriodOn?'#c83030':'var(--border)';
  if(knob) knob.style.left=fourierManualPeriodOn?'18px':'1px';
  if(row) row.style.display=fourierManualPeriodOn?'flex':'none';
  if(!fourierManualPeriodOn){
    fourierManualPeriod=null;
    recomputeKeepVis();
  } else {
    const input=document.getElementById('fourier-period-input');
    setFourierPeriod(input?input.value:'');
  }
}

function setFourierPeriod(val){
  const p=parseFloat(String(val).replace(',','.'));
  fourierManualPeriod=(fourierManualPeriodOn && isFinite(p) && p>0)?p:null;
  recomputeKeepVis();
}

function updateFourierUI(isFourier){
  const box=document.getElementById('chartBox');
  if(box) box.classList.toggle('fourier-active', isFourier);
  const panel=document.getElementById('fourier-settings');
  if(panel) panel.style.display=isFourier?'flex':'none';
  ['tblWrap','resultsPanel','eqBar','graph-zoom-panel','topBar'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.classList.toggle('fourier-active', isFourier);
  });
}

/* ══════════════════════════════════════════════
   VLASTNÍ ROVNICE (beta)
══════════════════════════════════════════════ */
function openCustomFormulaModal(){
  const ds=datasets[activeDatasetIdx];
  const input=document.getElementById('custom-formula-input');
  if(input) input.value=ds.customFormula||'';
  document.getElementById('custom-formula-overlay').style.display='flex';
  document.body.style.overflow='hidden';
  const err=document.getElementById('custom-formula-error');
  if(err) err.style.display='none';
  updateCustomFormulaPreview();
}

function showFormulaError(msg){
  const err=document.getElementById('custom-formula-error');
  if(!err) return;
  err.innerHTML=errIconSvg()+' '+escapeHtmlAttr(msg);
  err.style.display='block';
}

function closeCustomFormulaModal(){
  document.getElementById('custom-formula-overlay').style.display='none';
  document.body.style.overflow='';
}

function updateCustomFormulaPreview(){
  const input=document.getElementById('custom-formula-input');
  const preview=document.getElementById('custom-formula-preview');
  const err=document.getElementById('custom-formula-error');
  const raw=(input?.value||'').trim();
  if(!raw){
    preview.innerHTML='<span style="color:var(--text-muted);font-size:13px;">Náhled rovnice se zobrazí tady…</span>';
    if(err) err.style.display='none';
    return;
  }
  try{
    const node=math.parse(raw);
    const tex='y = '+node.toTex();
    katex.render(tex, preview, {throwOnError:true, displayMode:false});
    if(err) err.style.display='none';
  }catch(e){
    preview.innerHTML='<span style="color:var(--text-muted);font-size:13px;">(rovnici zatím nejde vykreslit)</span>';
    if(err) showFormulaError(e.message);
  }
}

function confirmCustomFormula(){
  const input=document.getElementById('custom-formula-input');
  const raw=(input?.value||'').trim();
  const err=document.getElementById('custom-formula-error');
  if(!raw){ if(err) showFormulaError('Zadej prosím nějakou rovnici.'); return; }
  try{
    const {paramNames}=buildCustomFitter(raw);
    if(paramNames.length===0){
      if(err) showFormulaError('Rovnice neobsahuje žádný parametr k fitování (jen x).');
      return;
    }
  }catch(e){
    if(err) showFormulaError(e.message);
    return;
  }
  const ds=datasets[activeDatasetIdx];
  ds.customFormula=raw;
  const btn=[...document.querySelectorAll('.rtype-option')].find(b=>b.getAttribute('onclick')==='openCustomFormulaModal()');
  if(btn) selectRtype('custom', btn);
  closeCustomFormulaModal();
}

/* ── Knihovna uložených vlastních rovnic (rychlý výběr) ── */
let customEquationLibrary=[];

function loadCustomEquationLibrary(){
  try{
    const raw=localStorage.getItem('customEquationLibrary');
    customEquationLibrary=raw?JSON.parse(raw):[];
    if(!Array.isArray(customEquationLibrary)) customEquationLibrary=[];
  }catch(e){ customEquationLibrary=[]; }
}

function saveCustomEquationLibrary(){
  try{ localStorage.setItem('customEquationLibrary', JSON.stringify(customEquationLibrary)); }
  catch(e){ /* localStorage nedostupné — ignorovat, knihovna zůstane jen pro tuto session */ }
}

function renderCustomEquationDropdownItems(){
  const sep=document.getElementById('custom-eq-library-sep');
  const container=document.getElementById('custom-eq-library-items');
  if(!container||!sep) return;
  if(!customEquationLibrary.length){
    sep.style.display='none';
    container.innerHTML='';
    return;
  }
  sep.style.display='block';
  container.innerHTML=customEquationLibrary.map(eq=>`
    <div class="rtype-option custom-saved" data-eq-id="${eq.id}" onclick="selectCustomEquationById('${eq.id}',this)">
      <span class="eq-name">${escapeHtmlAttr(eq.name)}</span>
      <button class="eq-remove" onclick="event.stopPropagation(); removeCustomEquation('${eq.id}')" title="Odebrat rovnici"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
    </div>
  `).join('');
}

function selectCustomEquation(formula, btnEl){
  datasets[activeDatasetIdx].customFormula=formula;
  const sel=document.getElementById('rType');
  sel.value='custom';
  document.querySelectorAll('.rtype-option').forEach(b=>b.classList.remove('selected'));
  if(btnEl) btnEl.classList.add('selected');
  document.getElementById('rtype-dropdown').classList.remove('open');
  updateFourierUI(false);
  updateGeneralEq();
  recomputeKeepVis();
}

function selectCustomEquationById(id, btnEl){
  const eq=customEquationLibrary.find(e=>e.id===id);
  if(!eq) return;
  selectCustomEquation(eq.formula, btnEl);
}

function removeCustomEquation(id){
  const eq=customEquationLibrary.find(e=>e.id===id);
  if(!eq) return;
  if(!confirm(`Opravdu odebrat rovnici "${eq.name}"?`)) return;
  customEquationLibrary=customEquationLibrary.filter(e=>e.id!==id);
  saveCustomEquationLibrary();
  renderCustomEquationDropdownItems();
}

function addCustomFormulaToLibrary(){
  const input=document.getElementById('custom-formula-input');
  const raw=(input?.value||'').trim();
  const err=document.getElementById('custom-formula-error');
  if(!raw){ if(err) showFormulaError('Nejdřív napiš rovnici.'); return; }
  try{
    const {paramNames}=buildCustomFitter(raw);
    if(paramNames.length===0){
      if(err) showFormulaError('Rovnice neobsahuje žádný parametr k fitování (jen x).');
      return;
    }
  }catch(e){
    if(err) showFormulaError(e.message);
    return;
  }
  const name=prompt('Zadejte název rovnice:', '');
  if(name===null) return;
  const trimmedName=name.trim();
  if(!trimmedName) return;
  const id='custom_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);
  customEquationLibrary.push({id, name:trimmedName, formula:raw});
  saveCustomEquationLibrary();
  renderCustomEquationDropdownItems();

  const ds=datasets[activeDatasetIdx];
  ds.customFormula=raw;
  const btn=document.querySelector(`.rtype-option.custom-saved[data-eq-id="${id}"]`);
  const sel=document.getElementById('rType');
  sel.value='custom';
  document.querySelectorAll('.rtype-option').forEach(b=>b.classList.remove('selected'));
  if(btn) btn.classList.add('selected');
  document.getElementById('rtype-dropdown').classList.remove('open');
  updateFourierUI(false);
  updateGeneralEq();
  recomputeKeepVis();
  closeCustomFormulaModal();
}

// Close dropdown when clicking outside
document.addEventListener('click',e=>{
  const wrap=document.getElementById('rtype-wrap');
  if(wrap && !wrap.contains(e.target)){
    document.getElementById('rtype-dropdown')?.classList.remove('open');
  }
  if(!e.target.closest('.ds-point-wrap')){
    document.querySelectorAll('.ds-point-dropdown.open').forEach(d=>d.classList.remove('open'));
  }
});

function getFullXRange(){
  const {x,excl}=getTableData();
  const allX=[...x,...excl.map(p=>p[0])];
  if(!allX.length) return null;
  return {min:Math.min(...allX), max:Math.max(...allX)};
}

let graphZoomPct=100, graphPanPct=0;

function applyGraphZoomPan(){
  const panRow=document.getElementById('graph-pan-row');
  const range=getFullXRange();
  if(!range || graphZoomPct>=100){
    if(panRow) panRow.style.display='none';
    if(range){
      document.getElementById('range-xmin').value=parseFloat(range.min.toPrecision(6));
      document.getElementById('range-xmax').value=parseFloat(range.max.toPrecision(6));
    } else {
      document.getElementById('range-xmin').value='';
      document.getElementById('range-xmax').value='';
    }
    applyRange();
    return;
  }
  if(panRow) panRow.style.display='flex';
  const fullSpan=range.max-range.min;
  const winSpan=fullSpan*(graphZoomPct/100);
  const maxStart=Math.max(fullSpan-winSpan,0);
  const start=range.min+maxStart*(graphPanPct/100);
  const end=start+winSpan;
  document.getElementById('range-xmin').value=parseFloat(start.toPrecision(6));
  document.getElementById('range-xmax').value=parseFloat(end.toPrecision(6));
  applyRange();
}

function setGraphZoom(val){
  graphZoomPct=parseInt(val,10)||100;
  const lbl=document.getElementById('graph-zoom-val');
  if(lbl) lbl.textContent=graphZoomPct+'%';
  applyGraphZoomPan();
}

function setGraphPan(val){
  graphPanPct=parseInt(val,10)||0;
  applyGraphZoomPan();
}

function syncZoomPanFromRange(xMin, xMax){
  const zs=document.getElementById('graph-zoom-slider');
  const zv=document.getElementById('graph-zoom-val');
  const ps=document.getElementById('graph-pan-slider');
  const pr=document.getElementById('graph-pan-row');
  const range=getFullXRange();

  if(!range || isNaN(xMin) || isNaN(xMax) || xMax<=xMin){
    graphZoomPct=100; graphPanPct=0;
    if(zs) zs.value=100;
    if(zv) zv.textContent='100%';
    if(ps) ps.value=0;
    if(pr) pr.style.display='none';
    return;
  }

  const fullSpan=range.max-range.min;
  if(fullSpan<=0) return;
  const winSpan=Math.min(xMax-xMin, fullSpan);
  const zoomPct=Math.max(5, Math.min(100, (winSpan/fullSpan)*100));
  graphZoomPct=zoomPct;
  if(zs) zs.value=Math.round(zoomPct);
  if(zv) zv.textContent=Math.round(zoomPct)+'%';

  if(zoomPct>=99.5){
    graphPanPct=0;
    if(ps) ps.value=0;
    if(pr) pr.style.display='none';
  } else {
    const maxStart=Math.max(fullSpan-winSpan,0);
    const panPct=maxStart>0 ? Math.max(0,Math.min(100,((xMin-range.min)/maxStart)*100)) : 0;
    graphPanPct=panPct;
    if(ps) ps.value=Math.round(panPct);
    if(pr) pr.style.display='flex';
  }
}

function applyRange(){
  const xMin=parseFloat(document.getElementById('range-xmin').value.replace(',','.'));
  const xMax=parseFloat(document.getElementById('range-xmax').value.replace(',','.'));
  const yMin=parseFloat(document.getElementById('range-ymin').value.replace(',','.'));
  const yMax=parseFloat(document.getElementById('range-ymax').value.replace(',','.'));
  manualRange={
    active: !isNaN(xMin)||!isNaN(xMax)||!isNaN(yMin)||!isNaN(yMax),
    xMin: isNaN(xMin)?null:xMin,
    xMax: isNaN(xMax)?null:xMax,
    yMin: isNaN(yMin)?null:yMin,
    yMax: isNaN(yMax)?null:yMax
  };
  syncZoomPanFromRange(xMin, xMax);

  if(!chartInst){
    // Graf ještě neexistuje (např. úplně první vykreslení) — musí se postavit.
    if(regressionOn) computeRegression(); else showPointsOnly();
    return;
  }

  // Rychlá cesta: mění se jen zobrazený výřez os, ne data ani fit —
  // stačí přenastavit meze os na už existujícím grafu, BEZ nového
  // přefitování regrese a BEZ zbourání/znovupostavení celého grafu.
  const xOpts=getScaleOpts('x'), yOpts=getScaleOpts('y');
  const xs=chartInst.options.scales.x, ys=chartInst.options.scales.y;
  if(xOpts.min!==undefined) xs.min=xOpts.min; else delete xs.min;
  if(xOpts.max!==undefined) xs.max=xOpts.max; else delete xs.max;
  if(yOpts.min!==undefined) ys.min=yOpts.min; else delete ys.min;
  if(yOpts.max!==undefined) ys.max=yOpts.max; else delete ys.max;
  chartInst.update('none');
  requestAnimationFrame(updateRangeInputs);
}

function resetRange(){
  manualRange={active:false,xMin:null,xMax:null,yMin:null,yMax:null};
  ['range-xmin','range-xmax','range-ymin','range-ymax'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.value='';
  });
  graphZoomPct=100; graphPanPct=0;
  const zs=document.getElementById('graph-zoom-slider'); if(zs) zs.value=100;
  const zv=document.getElementById('graph-zoom-val'); if(zv) zv.textContent='100%';
  const ps=document.getElementById('graph-pan-slider'); if(ps) ps.value=0;
  const pr=document.getElementById('graph-pan-row'); if(pr) pr.style.display='none';
  recomputeKeepVis();
}

function getScaleOpts(axis){
  // Vrátí min/max pro osu pokud je manuálně nastaveno
  if(!manualRange.active) return {};
  const mn = axis==='x' ? manualRange.xMin : manualRange.yMin;
  const mx = axis==='x' ? manualRange.xMax : manualRange.yMax;
  const opts={};
  if(mn!==null) opts.min=mn;
  if(mx!==null) opts.max=mx;
  return opts;
}

function updateRangeInputs(){
  // Po překreslení doplní inputy aktuálními hodnotami pokud jsou prázdné
  if(!chartInst||manualRange.active) return;
  const xs=chartInst.scales.x, ys=chartInst.scales.y;
  const fmt=v=>parseFloat(v.toPrecision(6));
  document.getElementById('range-xmin').value=fmt(xs.min);
  document.getElementById('range-xmax').value=fmt(xs.max);
  document.getElementById('range-ymin').value=fmt(ys.min);
  document.getElementById('range-ymax').value=fmt(ys.max);
}

function renderEq(elId, latex, color){
  const el=document.getElementById(elId);
  if(!el) return;
  try{
    katex.render(latex, el, {throwOnError:false, displayMode:false});
    if(color) el.style.color=color;
  }catch(e){
    el.textContent=latex;
  }
}

const GENERAL_TEX={
  linear:       'y = a\\,x + b',
  exponential:  'y = a\\cdot e^{bx}',
  polynomial:   'y = a\\,x^2 + b\\,x + c',
  logarithmic:  'y = a\\cdot\\ln(x) + b',
  gaussian:     'y = A\\,\\exp\\!\\left(-\\dfrac{(x-\\mu)^2}{2\\sigma^2}\\right) + c',
  gaussian2:    'y = A_1\\,\\exp\\!\\left(-\\dfrac{(x-\\mu_1)^2}{2\\sigma_1^2}\\right) + A_2\\,\\exp\\!\\left(-\\dfrac{(x-\\mu_2)^2}{2\\sigma_2^2}\\right) + c',
  gaussian3:    'y = A_1\\,\\exp\\!\\left(-\\dfrac{(x-\\mu_1)^2}{2\\sigma_1^2}\\right) + A_2\\,\\exp\\!\\left(-\\dfrac{(x-\\mu_2)^2}{2\\sigma_2^2}\\right) + A_3\\,\\exp\\!\\left(-\\dfrac{(x-\\mu_3)^2}{2\\sigma_3^2}\\right) + c',
  rational:     'y = \\dfrac{ax + b}{cx + 1}'
};

function updateGeneralEq(){
  const type=document.getElementById('rType').value;
  const el=document.getElementById('eq-general');
  if(!el) return;
  let tex;
  if(type==='fourier'){
    tex=`y = a_0 + \\sum_{k=1}^{${fourierHarmonics}}\\left[a_k\\cos(k\\omega x) + b_k\\sin(k\\omega x)\\right]`;
  } else if(type==='custom'){
    const ds=datasets[activeDatasetIdx];
    if(ds && ds.customFormula){
      try{ tex='y = '+math.parse(ds.customFormula).toTex(); }
      catch(e){ tex='y = '+ds.customFormula; }
    } else {
      tex='\\text{(zadej vlastní rovnici)}';
    }
  } else {
    tex=GENERAL_TEX[type]||'';
  }
  try{
    katex.render(tex, el, {throwOnError:false, displayMode:false});
  }catch(e){
    el.textContent=tex;
  }
}

function recomputeKeepVis(){
  const vis=chartInst?chartInst.data.datasets.map((_,i)=>chartInst.isDatasetVisible(i)):[];
  if(regressionOn) computeRegression(); else showPointsOnly();
  if(chartInst) vis.forEach((v,i)=>{ if(!v) chartInst.hide(i); });
  if(chartInst) chartInst.update();
}

let recomputeTimer=null;
function autoRecompute(){
  updateMasterCheckbox();
  clearTimeout(recomputeTimer);
  recomputeTimer=setTimeout(()=>{ recomputeKeepVis(); },350);
}

function toggleAll(checked){
  const tb=document.getElementById('tbody');
  for(let i=0;i<tb.rows.length;i++){
    const cb=tb.rows[i].cells[1].querySelector('input[type="checkbox"]');
    if(cb) cb.checked=checked;
  }
  clearTimeout(recomputeTimer);
  recomputeTimer=setTimeout(recomputeKeepVis,350);
}

function updateMasterCheckbox(){
  const tb=document.getElementById('tbody');
  const cbs=[...tb.querySelectorAll('input[type="checkbox"]')];
  if(!cbs.length) return;
  const all=cbs.every(c=>c.checked);
  const none=cbs.every(c=>!c.checked);
  const master=document.getElementById('cb-all');
  if(master){ master.checked=all; master.indeterminate=!all&&!none; }
}

function toggleRegression(){
  if(!regressionOn){
    regressionOn=true;
    recomputeKeepVis();
  } else {
    regressionOn=false;
    const _br=document.getElementById('btn-regrese'); if(_br){_br.style.color='var(--text)';_br.style.opacity='.6';_br.title='Spustit analýzu';}
    const _eq=document.getElementById('resEq'); if(_eq) _eq.textContent='—';
    document.getElementById('resParams').textContent='';
    lastResult=null;
    // Zachovej viditelnost bodů
    const vis=chartInst?chartInst.data.datasets.map((_,i)=>chartInst.isDatasetVisible(i)):[];
    showPointsOnly();
    if(chartInst) vis.forEach((v,i)=>{ if(!v) chartInst.hide(i); });
    if(chartInst) chartInst.update();
  }
}

function showPointsOnly(){
  const {x,y,excl}=getTableData();
  const ds=datasets[activeDatasetIdx];
  ds.x=x; ds.y=y; ds.excl=excl; ds.lastResult=null;
  renderCombinedChart();
}

/* ══════════════════════════════════════════════
   VLASTNÍ ROVNICE — obecný nelineární fit (beta)
══════════════════════════════════════════════ */








function pulseRegressionButton(){
  const btn=document.getElementById('btn-regrese');
  if(!btn) return;
  btn.classList.remove('btn-pulse');
  void btn.offsetWidth; // vynutí reflow, aby se animace spustila znovu i při rychlém opakovaném kliknutí
  btn.classList.add('btn-pulse');
}

function flashResultsPanel(){
  const pmEl=document.getElementById('resParams');
  if(!pmEl) return;
  pmEl.classList.remove('res-flash');
  void pmEl.offsetWidth;
  pmEl.classList.add('res-flash');
}

function computeRegression(){
  const {x,y,excl}=getTableData();
  const eqEl=document.getElementById('resEq');
  const pmEl=document.getElementById('resParams');
  const ds=datasets[activeDatasetIdx];
  ds.x=x; ds.y=y; ds.excl=excl;

  if(x.length<2){
    eqEl.innerHTML='<span class="err">'+errIconSvg()+' Zadejte alespoň 2 zaškrtnuté body.</span>';
    pmEl.innerHTML='';
    ds.lastResult=null;
    renderCombinedChart();
    return;
  }

  pulseRegressionButton();

  const type=document.getElementById('rType').value;
  let result;
  try{
    result=computeFitForType(x,y,type,ds);
    if(type==='fourier'){
      ds.fourierHarmonics=fourierHarmonics;
      const slider=document.getElementById('fourier-harmonics-slider');
      if(slider) slider.value=fourierHarmonics;
      const lbl=document.getElementById('fourier-harmonics-val');
      if(lbl) lbl.textContent=fourierHarmonics;
      lastFourierResult=result;
    }
  }catch(err){
    eqEl.innerHTML=`<span class="err">${errIconSvg()} ${escapeHtmlAttr(err.message)}</span>`;
    pmEl.innerHTML='';
    ds.lastResult=null;
    renderCombinedChart();
    return;
  }

  displayResults(result, x.length, x.length+excl.length);
  flashResultsPanel();
  ds.lastResult=result;
  lastResult=result; lastData={x,y,excl};
  const _br2=document.getElementById('btn-regrese'); if(_br2){_br2.style.color='var(--accent)';_br2.style.opacity='1';_br2.title='Skrýt regresi';}
  renderCombinedChart();
}

/* ══════════════════════════════════════════════
   DISPLAY RESULTS
══════════════════════════════════════════════ */
function resultToTex(r){
  const n=v=>v<0?`(${f6(v)})`:f6(v);
  if(r.type==='linear')
    return `y = ${n(r.a)}\\,x + ${n(r.b)}`;
  if(r.type==='exponential')
    return `y = ${n(r.a)}\\cdot e^{${n(r.b)}x}`;
  if(r.type==='polynomial')
    return `y = ${n(r.a)}\\,x^2 + ${n(r.b)}\\,x + ${n(r.c)}`;
  if(r.type==='logarithmic')
    return `y = ${n(r.a)}\\cdot\\ln(x) + ${n(r.b)}`;
  if(r.type==='rational')
    return `y = \\dfrac{${n(r.a)}\\,x + ${n(r.b)}}{${n(r.c)}\\,x + 1}`;
  if(r.type==='gaussian')
    return `y = ${n(r.a)}\\,\\exp\\!\\left(-\\dfrac{(x-${n(r.b)})^2}{2\\cdot${n(r.c)}^2}\\right) + ${n(r.d)}`;
  if(r.type==='gaussian2'||r.type==='gaussian3'){
    const nPeaks=r.nPeaks;
    const parts=[];
    for(let k=0;k<nPeaks;k++){
      const A=r.params[k*3], mu=r.params[k*3+1], sig=r.params[k*3+2];
      parts.push(`${n(A)}\\,\\exp\\!\\left(-\\dfrac{(x-${n(mu)})^2}{2\\cdot${n(sig)}^2}\\right)`);
    }
    return `y = ${parts.join(' + ')} + ${n(r.params[r.params.length-1])}`;
  }
  if(r.type==='fourier'){
    const parts=[`${n(r.params[0])}`];
    for(let k=1;k<=r.nH;k++){
      const ak=r.params[1+2*(k-1)], bk=r.params[2+2*(k-1)];
      parts.push(`${n(ak)}\\cos(${k}\\cdot${f6(r.omega)}x) + ${n(bk)}\\sin(${k}\\cdot${f6(r.omega)}x)`);
    }
    return `y = ${parts.join(' + ')}`;
  }
  if(r.type==='custom'){
    try{
      const node=math.parse(r.formula);
      const handler=(node2, options)=>{
        if(node2.isSymbolNode && r.paramNames.includes(node2.name)){
          const idx=r.paramNames.indexOf(node2.name);
          return n(r.params[idx]);
        }
        return undefined;
      };
      return 'y = '+node.toTex({handler});
    }catch(e){
      return r.eq;
    }
  }
  return r.eq;
}

function displayResults(r, used, total){
  // Render fitted equation as KaTeX
  const eqEl=document.getElementById('resEq');
  if(eqEl){
    try{ katex.render(resultToTex(r), eqEl, {throwOnError:false, displayMode:false}); }
    catch(e){ eqEl.textContent=r.eq; }
  }
  let html='';
  if(r.type==='gaussian'){
    html+=`• A = (${f6(r.a)} ± ${f6(r.seA)})<br>`
         +`• μ = (${f6(r.b)} ± ${f6(r.seB)})<br>`
         +`• σ = (${f6(r.c)} ± ${f6(r.seC)})<br>`
         +`• FWHM = (${f6(r.FWHM)} ± ${f6(r.seFWHM)})<br>`
         +`• c = (${f6(r.d)} ± ${f6(r.seD)})<br>`;
  } else if(r.type==='gaussian2'||r.type==='gaussian3'){
    for(let k=0;k<r.nPeaks;k++){
      const A=r.params[k*3], mu=r.params[k*3+1], sig=r.params[k*3+2];
      const seA=r.se[k*3], seMu=r.se[k*3+1], seSig=r.se[k*3+2];
      html+=`<b>Peak ${k+1}:</b><br>`
           +`• A${k+1} = (${f6(A)} ± ${f6(seA)})<br>`
           +`• μ${k+1} = (${f6(mu)} ± ${f6(seMu)})<br>`
           +`• σ${k+1} = (${f6(sig)} ± ${f6(seSig)})<br>`
           +`• FWHM${k+1} = (${f6(r.FWHMs[k].FWHM)} ± ${f6(r.FWHMs[k].seFWHM)})<br>`;
    }
    html+=`• c = (${f6(r.params[r.params.length-1])} ± ${f6(r.se[r.se.length-1])})<br>`;
  } else if(r.type==='fourier'){
    const hrStyle="border:none;border-top:1px solid var(--border);margin:5px 0;";
    html+=`• a₀ = (${f6(r.params[0])} ± ${f6(r.se[0])})<br>`;
    html+=`<hr style="${hrStyle}">`;
    for(let k=1;k<=r.nH;k++){
      const h=r.harmonics[k-1];
      html+=`• a${k} = (${f6(h.ak)} ± ${f6(h.seAk)})<br>`
           +`• b${k} = (${f6(h.bk)} ± ${f6(h.seBk)})<br>`
           +`• R${k} = (${f6(h.Rk)} ± ${f6(h.seRk)})<br>`
           +`• φ${k} = (${f6(h.phik)} ± ${f6(h.sePhik)}) rad<br>`;
      html+=`<hr style="${hrStyle}">`;
    }
    if(r.periodFixed){
      html+=`• ω = ${f6(r.omega)} rad (pevné)<br>`
           +`• Perioda T = ${f6(r.period)} (zadáno ručně)<br>`;
    } else {
      html+=`• ω = (${f6(r.omega)} ± ${f6(r.seOmega)}) rad<br>`
           +`• Perioda T = (${f6(r.period)} ± ${f6(r.sePeriod)})<br>`;
    }
  } else if(r.type==='custom'){
    r.paramNames.forEach((name,i)=>{
      html+=`• ${name} = (${f6(r.params[i])} ± ${f6(r.se[i])})<br>`;
    });
  } else {
    html+=`• a = (${f6(r.a)} ± ${f6(r.seA)})<br>`
         +`• b = (${f6(r.b)} ± ${f6(r.seB)})<br>`;
    if(r.type==='polynomial')
      html+=`• c = (${f6(r.c)} ± ${f6(r.seC)})<br>`;
    if(r.type==='rational')
      html+=`• c = (${f6(r.c)} ± ${f6(r.seC)})<br>`;
  }
  html+=`• R² = <span class="r2">${r.r2.toFixed(6)}</span><br>`
       +`• Použito bodů: ${used} / ${total}`;
  document.getElementById('resParams').innerHTML=html;
}

/* ══════════════════════════════════════════════
   CHART
══════════════════════════════════════════════ */
function chartColors(){
  return isDark
    ? {bg:'#1c1c24',grid:'rgba(255,255,255,.08)',tick:'#a0a0b8',axis:'#505068'}
    : {bg:'#fafafa', grid:'rgba(0,0,0,.07)',     tick:'#444456',axis:'#ccccd8'};
}

function setChartEmptyState(show){
  const el=document.getElementById('chart-empty-state');
  if(el) el.style.display = show ? 'flex' : 'none';
}

function clearChart(){
  if(chartInst){chartInst.destroy();chartInst=null;}
  const c=chartColors();
  const canvas=document.getElementById('myChart');
  const ctx=canvas.getContext('2d');
  ctx.fillStyle=c.bg;
  ctx.fillRect(0,0,canvas.width,canvas.height);
  setChartEmptyState(true);
}

function buildCiBand(result, x, y, xSmooth, ySmooth, useCI){
  if(!(useCI && result && result.yp)) return null;
  const n=x.length;
  const p = result.type==='polynomial'?3 : result.type==='gaussian'?4 :
            result.type==='gaussian2'?7 : result.type==='gaussian3'?10 :
            result.type==='rational'?3 : 2;
  const rmse=Math.sqrt(result.yp.reduce((s,ypi,i)=>s+(y[i]-ypi)**2,0)/Math.max(n-p,1));
  const tCrit = n>30 ? 1.96 : n>10 ? 2.228 : 2.776;

  if(result.type==='linear'){
    const xMean=x.reduce((s,v)=>s+v,0)/n;
    const Sxx=x.reduce((s,v)=>s+(v-xMean)**2,0);
    return {
      upper:xSmooth.map((xi,i)=>({x:xi,y:ySmooth[i]+tCrit*rmse*Math.sqrt(1/n+((xi-xMean)**2)/Sxx)})),
      lower:xSmooth.map((xi,i)=>({x:xi,y:ySmooth[i]-tCrit*rmse*Math.sqrt(1/n+((xi-xMean)**2)/Sxx)}))
    };
  } else if(result.type==='fourier' && result.covMatrix && result.jacFn){
    const cov=result.covMatrix;
    const seY=xSmooth.map(xi=>{
      const jv=result.jacFn(xi);
      let s2=0;
      for(let i=0;i<jv.length;i++) for(let j=0;j<jv.length;j++) s2+=jv[i]*cov[i][j]*jv[j];
      return Math.sqrt(Math.max(0,s2));
    });
    return {
      upper:xSmooth.map((xi,i)=>({x:xi,y:ySmooth[i]+tCrit*seY[i]})),
      lower:xSmooth.map((xi,i)=>({x:xi,y:ySmooth[i]-tCrit*seY[i]}))
    };
  }
  return {
    upper:xSmooth.map((xi,i)=>({x:xi,y:ySmooth[i]+tCrit*rmse})),
    lower:xSmooth.map((xi,i)=>({x:xi,y:ySmooth[i]-tCrit*rmse}))
  };
}

/* ══════════════════════════════════════════════
   KOMBINACE DVOU REGRESÍ (+, −, ×)
══════════════════════════════════════════════ */
function getCombinableDatasets(){
  return datasets
    .map((ds,i)=>({ds,i}))
    .filter(({ds})=> ds.x.length>0 && ds.lastResult && typeof ds.lastResult.smooth==='function');
}

function combineOptionLabel(ds){
  const t=ds.lastResult && ds.lastResult.type;
  const short=REGRESSION_TYPE_SHORT[t] || t || '';
  return `${ds.name} — ${short}`;
}

function toggleCombinePanel(){
  combineState.open=!combineState.open;
  const panel=document.getElementById('combine-panel');
  const btn=document.getElementById('btn-combine');
  if(panel) panel.classList.toggle('open', combineState.open);
  if(btn) btn.classList.toggle('active', combineState.open);
  renderCombinedChart();
}

// Schová panel Nástroje na lištu (tlačítko "podtržítko" uvnitř panelu) —
// analýza (zapnuté nástroje) zůstává beze změny běžet dál, stejně jako
// při skrytí kliknutím na tlačítko "Nástroje".
function hideToolsPanel(){
  if(!combineState.open) return;
  combineState.open=false;
  const panel=document.getElementById('combine-panel');
  const btn=document.getElementById('btn-combine');
  if(panel) panel.classList.remove('open');
  if(btn) btn.classList.remove('active');
  renderCombinedChart();
}

// Zavře panel křížkem A VYPNE všechny nástroje (na rozdíl od hideToolsPanel).
function closeToolsPanelAndDisable(){
  combineState.open=false;
  combineState.enabled=false;
  integralState.enabled=false;
  derivativeState.enabled=false;
  const panel=document.getElementById('combine-panel');
  const btn=document.getElementById('btn-combine');
  if(panel) panel.classList.remove('open');
  if(btn) btn.classList.remove('active');
  renderCombinedChart();
}

function toggleToolExpand(tool){
  if(tool==='combine') combineState.expanded=!combineState.expanded;
  else if(tool==='integral') integralState.expanded=!integralState.expanded;
  else if(tool==='derivative') derivativeState.expanded=!derivativeState.expanded;
  updateToolExpandUI();
}

function updateToolExpandUI(){
  const cBody=document.getElementById('combine-tool-body');
  const cChevron=document.getElementById('combine-chevron');
  if(cBody) cBody.classList.toggle('expanded', combineState.expanded);
  if(cChevron) cChevron.classList.toggle('expanded', combineState.expanded);

  const iBody=document.getElementById('integral-tool-body');
  const iChevron=document.getElementById('integral-chevron');
  if(iBody) iBody.classList.toggle('expanded', integralState.expanded);
  if(iChevron) iChevron.classList.toggle('expanded', integralState.expanded);

  const dBody=document.getElementById('derivative-tool-body');
  const dChevron=document.getElementById('derivative-chevron');
  if(dBody) dBody.classList.toggle('expanded', derivativeState.expanded);
  if(dChevron) dChevron.classList.toggle('expanded', derivativeState.expanded);
}

function toggleCombineEnabled(){
  if(!combineState.enabled && (combineState.dsA===null || combineState.dsB===null)) return;
  combineState.enabled=!combineState.enabled;
  renderCombinedChart();
}

function updateCombineSwitchUI(){
  const track=document.getElementById('combine-enable-track');
  const knob=document.getElementById('combine-enable-knob');
  if(track){
    track.style.background=combineState.enabled?'var(--accent)':'var(--btn)';
    track.style.borderColor=combineState.enabled?'var(--accent)':'var(--border)';
  }
  if(knob) knob.style.left=combineState.enabled?'18px':'1px';
}

function setCombineOp(op){
  combineState.op=op;
  renderCombinedChart();
}

function onCombineSelectChange(){
  const selA=document.getElementById('combine-ds-a');
  const selB=document.getElementById('combine-ds-b');
  if(!selA||!selB) return;
  combineState.dsA = selA.value===''? null : parseInt(selA.value,10);
  combineState.dsB = selB.value===''? null : parseInt(selB.value,10);
  if(combineState.dsA===null || combineState.dsB===null || combineState.dsA===combineState.dsB){
    combineState.enabled=false;
  }
  renderCombinedChart();
}

function updateCombineOpButtons(){
  document.querySelectorAll('.combine-op-btn').forEach(b=>{
    b.classList.toggle('active', b.dataset.op===combineState.op);
  });
}

function combineFnParamsHtml(ds){
  const r=ds.lastResult;
  const short=REGRESSION_TYPE_SHORT[r.type]||r.type||'';
  let rows='';
  if(r.type==='gaussian'){
    rows+=`• A = (${f6(r.a)} ± ${f6(r.seA)})<br>`
        +`• μ = (${f6(r.b)} ± ${f6(r.seB)})<br>`
        +`• σ = (${f6(r.c)} ± ${f6(r.seC)})<br>`
        +`• FWHM = (${f6(r.FWHM)} ± ${f6(r.seFWHM)})<br>`
        +`• c = (${f6(r.d)} ± ${f6(r.seD)})<br>`;
  } else if(r.type==='gaussian2'||r.type==='gaussian3'){
    for(let k=0;k<r.nPeaks;k++){
      const A=r.params[k*3], mu=r.params[k*3+1], sig=r.params[k*3+2];
      const seA=r.se[k*3], seMu=r.se[k*3+1], seSig=r.se[k*3+2];
      rows+=`<b>Peak ${k+1}:</b><br>`
          +`• A${k+1} = (${f6(A)} ± ${f6(seA)})<br>`
          +`• μ${k+1} = (${f6(mu)} ± ${f6(seMu)})<br>`
          +`• σ${k+1} = (${f6(sig)} ± ${f6(seSig)})<br>`
          +`• FWHM${k+1} = (${f6(r.FWHMs[k].FWHM)} ± ${f6(r.FWHMs[k].seFWHM)})<br>`;
    }
    rows+=`• c = (${f6(r.params[r.params.length-1])} ± ${f6(r.se[r.se.length-1])})<br>`;
  } else if(r.type==='fourier'){
    const hrStyle="border:none;border-top:1px solid var(--border);margin:5px 0;";
    rows+=`• a₀ = (${f6(r.params[0])} ± ${f6(r.se[0])})<br>`;
    rows+=`<hr style="${hrStyle}">`;
    for(let k=1;k<=r.nH;k++){
      const h=r.harmonics[k-1];
      rows+=`• a${k} = (${f6(h.ak)} ± ${f6(h.seAk)})<br>`
          +`• b${k} = (${f6(h.bk)} ± ${f6(h.seBk)})<br>`
          +`• R${k} = (${f6(h.Rk)} ± ${f6(h.seRk)})<br>`
          +`• φ${k} = (${f6(h.phik)} ± ${f6(h.sePhik)}) rad<br>`;
      rows+=`<hr style="${hrStyle}">`;
    }
    if(r.periodFixed){
      rows+=`• ω = ${f6(r.omega)} rad (pevné)<br>`
          +`• Perioda T = ${f6(r.period)} (zadáno ručně)<br>`;
    } else {
      rows+=`• ω = (${f6(r.omega)} ± ${f6(r.seOmega)}) rad<br>`
          +`• Perioda T = (${f6(r.period)} ± ${f6(r.sePeriod)})<br>`;
    }
  } else if(r.type==='custom'){
    r.paramNames.forEach((name,i)=>{
      rows+=`• ${name} = (${f6(r.params[i])} ± ${f6(r.se[i])})<br>`;
    });
  } else {
    rows+=`• a = (${f6(r.a)} ± ${f6(r.seA)})<br>`
        +`• b = (${f6(r.b)} ± ${f6(r.seB)})<br>`;
    if(r.type==='polynomial') rows+=`• c = (${f6(r.c)} ± ${f6(r.seC)})<br>`;
    if(r.type==='rational') rows+=`• c = (${f6(r.c)} ± ${f6(r.seC)})<br>`;
  }
  rows+=`• R² = <span class="r2">${r.r2.toFixed(6)}</span><br>`;
  return `<div class="combine-fn-block"><b>${escapeHtmlAttr(ds.name)}</b> <span class="combine-fn-type">(${escapeHtmlAttr(short)})</span><br>${rows}</div>`;
}

function combinedResultToTex(resultA, resultB, op){
  const texA=resultToTex(resultA).replace(/^y\s*=\s*/,'');
  const texB=resultToTex(resultB).replace(/^y\s*=\s*/,'');
  const opTex = op==='+' ? '+' : op==='-' ? '-' : '\\cdot';
  return `y = \\left(${texA}\\right) ${opTex} \\left(${texB}\\right)`;
}

function combineGeneralTexPart(ds){
  const type=ds.regressionType;
  const r=ds.lastResult;
  if(type==='fourier'){
    const nH=(r && r.nH) || ds.fourierHarmonics || 3;
    return `a_0 + \\sum_{k=1}^{${nH}}\\left[a_k\\cos(k\\omega x) + b_k\\sin(k\\omega x)\\right]`;
  }
  if(type==='custom'){
    if(ds.customFormula){
      try{ return math.parse(ds.customFormula).toTex(); }
      catch(e){ return ds.customFormula; }
    }
    return '?';
  }
  return (GENERAL_TEX[type]||'').replace(/^y\s*=\s*/,'');
}

function combinedGeneralTex(dsA, dsB, op){
  const texA=combineGeneralTexPart(dsA);
  const texB=combineGeneralTexPart(dsB);
  const opTex = op==='+' ? '+' : op==='-' ? '-' : '\\cdot';
  return `y = \\left(${texA}\\right) ${opTex} \\left(${texB}\\right)`;
}

function updateCombineDisplay(){
  const paramsEl=document.getElementById('combine-result-eq');
  const eqLine=document.getElementById('combine-eq-line');
  const eqGeneralEl=document.getElementById('combine-eq-general');
  const eqTexEl=document.getElementById('combine-eq-tex');
  const a=datasets[combineState.dsA], b=datasets[combineState.dsB];
  const hasSelection = a && b && a.lastResult && b.lastResult;
  const paramsVisible = combineState.enabled && hasSelection;
  const eqVisible = combineState.enabled && hasSelection;

  if(paramsEl) paramsEl.innerHTML = paramsVisible ? (combineFnParamsHtml(a)+combineFnParamsHtml(b)) : '';

  if(eqLine) eqLine.style.display = eqVisible ? 'block' : 'none';
  if(eqVisible){
    if(eqGeneralEl){
      try{ katex.render(combinedGeneralTex(a,b,combineState.op), eqGeneralEl, {throwOnError:false, displayMode:false}); }
      catch(e){ eqGeneralEl.textContent=''; }
    }
    if(eqTexEl){
      try{ katex.render(combinedResultToTex(a.lastResult,b.lastResult,combineState.op), eqTexEl, {throwOnError:false, displayMode:false}); }
      catch(e){
        const opSym = combineState.op==='+' ? '+' : combineState.op==='-' ? '−' : '×';
        eqTexEl.textContent = `${a.name}(x) ${opSym} ${b.name}(x)`;
      }
    }
  } else {
    if(eqGeneralEl) eqGeneralEl.textContent='';
    if(eqTexEl) eqTexEl.textContent='';
  }

  updateCombineSwitchUI();
}

function refreshCombinePanelOptions(){
  if(!combineState.open){ updateCombineDisplay(); return; }
  const selA=document.getElementById('combine-ds-a');
  const selB=document.getElementById('combine-ds-b');
  const msgEl=document.getElementById('combine-msg');
  const opRow=document.getElementById('combine-op-row');
  if(!selA||!selB) return;

  const list=getCombinableDatasets();

  if(list.length<2){
    selA.style.display='none'; selB.style.display='none';
    selA.previousElementSibling && (selA.previousElementSibling.style.display='none');
    selB.previousElementSibling && (selB.previousElementSibling.style.display='none');
    if(opRow) opRow.style.display='none';
    if(msgEl) msgEl.style.display='block';
    combineState.dsA=null; combineState.dsB=null; combineState.enabled=false;
    updateCombineDisplay();
    return;
  }

  if(msgEl) msgEl.style.display='none';
  selA.style.display=''; selB.style.display='';
  selA.previousElementSibling && (selA.previousElementSibling.style.display='');
  selB.previousElementSibling && (selB.previousElementSibling.style.display='');
  if(opRow) opRow.style.display='';

  const validIdx=list.map(o=>o.i);
  if(list.length===2){
    combineState.dsA=list[0].i; combineState.dsB=list[1].i;
  } else {
    if(!validIdx.includes(combineState.dsA)) combineState.dsA=list[0].i;
    if(!validIdx.includes(combineState.dsB) || combineState.dsB===combineState.dsA){
      const alt=list.find(o=>o.i!==combineState.dsA);
      combineState.dsB = alt ? alt.i : null;
    }
  }
  if(combineState.dsA===null || combineState.dsB===null) combineState.enabled=false;

  selA.innerHTML=list.map(({ds,i})=>
    `<option value="${i}"${i===combineState.dsA?' selected':''}>${escapeHtmlAttr(combineOptionLabel(ds))}</option>`).join('');
  selB.innerHTML=list.map(({ds,i})=>
    `<option value="${i}"${i===combineState.dsB?' selected':''}>${escapeHtmlAttr(combineOptionLabel(ds))}</option>`).join('');

  updateCombineOpButtons();
  updateCombineDisplay();
}

function computeCombinedSeries(){
  const a=datasets[combineState.dsA], b=datasets[combineState.dsB];
  if(!a || !b || combineState.dsA===combineState.dsB) return null;
  if(!a.lastResult || !b.lastResult) return null;
  if(typeof a.lastResult.smooth!=='function' || typeof b.lastResult.smooth!=='function') return null;

  const allX=[...a.x, ...b.x];
  if(!allX.length) return null;
  const xMin=Math.min(...allX), xMax=Math.max(...allX);
  const step=(xMax-xMin)/399 || 1;
  const xs=Array.from({length:400},(_,k)=>xMin+k*step);

  const op=combineState.op;
  const combine=(va,vb)=> op==='+' ? va+vb : op==='-' ? va-vb : va*vb;

  const ys=xs.map(xi=>{
    try{
      const va=a.lastResult.smooth(xi), vb=b.lastResult.smooth(xi);
      const v=combine(va,vb);
      return Number.isFinite(v) ? v : NaN;
    }catch(e){ return NaN; }
  });

  const opSym = op==='+' ? '+' : op==='-' ? '−' : '×';
  return {
    type:'line', label:`${a.name} ${opSym} ${b.name}`,
    data:xs.map((xi,k)=>({x:xi,y:ys[k]})),
    borderColor:'#c83030', borderWidth:2.5, borderDash:[7,4],
    pointRadius:0, fill:false, tension:0, order:1, spanGaps:false,
    _kind:'combine'
  };
}

/* ══════════════════════════════════════════════
   INTEGRÁL
══════════════════════════════════════════════ */
function getIntegrableFunctions(){
  const list=getCombinableDatasets().map(({ds,i})=>({
    key:`ds:${i}`,
    label:combineOptionLabel(ds),
    xMin:Math.min(...ds.x), xMax:Math.max(...ds.x),
    fn:ds.lastResult.smooth,
    ciInfo:{result:ds.lastResult, x:ds.x, y:ds.y}
  }));
  if(combineState.enabled && combineState.dsA!==null && combineState.dsB!==null){
    const a=datasets[combineState.dsA], b=datasets[combineState.dsB];
    if(a && b && a.lastResult && b.lastResult){
      const allX=[...a.x, ...b.x];
      if(allX.length){
        const xMin=Math.min(...allX), xMax=Math.max(...allX);
        const op=combineState.op;
        const combine=(va,vb)=> op==='+' ? va+vb : op==='-' ? va-vb : va*vb;
        const opSym = op==='+' ? '+' : op==='-' ? '−' : '×';
        list.push({
          key:'combine',
          label:`${a.name} ${opSym} ${b.name} (kombinace)`,
          xMin, xMax,
          fn:xi=>combine(a.lastResult.smooth(xi), b.lastResult.smooth(xi)),
          ciInfo:null
        });
      }
    }
  }
  return list;
}

function setDefaultIntegralBounds(entry){
  let range=entry.xMax-entry.xMin;
  if(!Number.isFinite(range) || range<=0) range=2;
  integralState.lo = entry.xMin + range/3;
  integralState.hi = entry.xMin + range*2/3;
}

function simpsonIntegrateArray(xs, ys){
  const n=xs.length-1;
  if(n<1) return 0;
  const h=(xs[n]-xs[0])/n;
  if(n%2===0){
    let sum=ys[0]+ys[n];
    for(let i=1;i<n;i++) sum += (i%2===0?2:4)*ys[i];
    return sum*h/3;
  }
  let sum=0;
  for(let i=0;i<n;i++) sum += (ys[i]+ys[i+1])/2*h;
  return sum;
}

function computeIntegralResult(entry, lo, hi){
  if(!entry || !Number.isFinite(lo) || !Number.isFinite(hi) || lo===hi) return null;
  const sign = lo<=hi ? 1 : -1;
  const a=Math.min(lo,hi), b=Math.max(lo,hi);

  const n=400;
  const xs=Array.from({length:n+1},(_,k)=>a+k*(b-a)/n);
  const ys=xs.map(xi=>{
    try{ const v=entry.fn(xi); return Number.isFinite(v)?v:0; }
    catch(e){ return 0; }
  });
  const value = sign*simpsonIntegrateArray(xs, ys);

  let ciHalfWidth=null;
  if(entry.ciInfo){
    try{
      const band=buildCiBand(entry.ciInfo.result, entry.ciInfo.x, entry.ciInfo.y, xs, ys, true);
      if(band){
        const upperInt=sign*simpsonIntegrateArray(xs, band.upper.map(p=>p.y));
        const lowerInt=sign*simpsonIntegrateArray(xs, band.lower.map(p=>p.y));
        ciHalfWidth=Math.abs(upperInt-lowerInt)/2;
      }
    }catch(e){ ciHalfWidth=null; }
  }
  return {value, ciHalfWidth, lo:a, hi:b};
}

function computeIntegralAreaSeries(entry, lo, hi){
  if(!entry || !Number.isFinite(lo) || !Number.isFinite(hi) || lo===hi) return null;
  const a=Math.min(lo,hi), b=Math.max(lo,hi);
  const n=200;
  const pts=[];
  for(let k=0;k<=n;k++){
    const xi=a+k*(b-a)/n;
    let yi;
    try{ yi=entry.fn(xi); }catch(e){ yi=NaN; }
    pts.push({x:xi, y:Number.isFinite(yi)?yi:0});
  }
  return {
    type:'line', label:'Plocha integrálu',
    data:pts,
    borderColor:'rgba(200,48,48,0.55)', borderWidth:1.5,
    backgroundColor:'rgba(200,48,48,0.18)',
    pointRadius:0, fill:'origin', tension:0, order:6,
    _kind:'integral-area'
  };
}

function toggleIntegralEnabled(){
  if(!integralState.enabled){
    const list=getIntegrableFunctions();
    if(!list.length) return;
    if(!integralState.fnKey || !list.some(e=>e.key===integralState.fnKey)){
      integralState.fnKey=list[0].key;
      setDefaultIntegralBounds(list[0]);
    }
  }
  integralState.enabled=!integralState.enabled;
  renderCombinedChart();
}

function updateIntegralSwitchUI(){
  const track=document.getElementById('integral-enable-track');
  const knob=document.getElementById('integral-enable-knob');
  if(track){
    track.style.background=integralState.enabled?'var(--accent)':'var(--btn)';
    track.style.borderColor=integralState.enabled?'var(--accent)':'var(--border)';
  }
  if(knob) knob.style.left=integralState.enabled?'18px':'1px';
}

function onIntegralFnChange(){
  const sel=document.getElementById('integral-fn');
  if(!sel) return;
  integralState.fnKey=sel.value;
  const entry=getIntegrableFunctions().find(e=>e.key===integralState.fnKey);
  if(entry) setDefaultIntegralBounds(entry);
  renderCombinedChart();
}

function onIntegralBoundsChange(){
  const loEl=document.getElementById('integral-lo');
  const hiEl=document.getElementById('integral-hi');
  if(!loEl||!hiEl) return;
  let lo=parseFloat(loEl.value.replace(',','.'));
  let hi=parseFloat(hiEl.value.replace(',','.'));

  const entry=getIntegrableFunctions().find(e=>e.key===integralState.fnKey);
  if(entry && Number.isFinite(entry.xMin) && Number.isFinite(entry.xMax)){
    if(!isNaN(lo)) lo=Math.min(Math.max(lo, entry.xMin), entry.xMax);
    if(!isNaN(hi)) hi=Math.min(Math.max(hi, entry.xMin), entry.xMax);
  }

  if(!isNaN(lo)) integralState.lo=lo;
  if(!isNaN(hi)) integralState.hi=hi;
  renderCombinedChart();
}

function refreshIntegralPanel(){
  updateIntegralSwitchUI();
  if(!combineState.open) return;

  const msgEl=document.getElementById('integral-msg');
  const fnRow=document.getElementById('integral-fn-row');
  const boundsRow=document.getElementById('integral-bounds-row');
  const resultEl=document.getElementById('integral-result');
  const selEl=document.getElementById('integral-fn');
  const loEl=document.getElementById('integral-lo');
  const hiEl=document.getElementById('integral-hi');

  const list=getIntegrableFunctions();

  if(!list.length){
    if(fnRow) fnRow.style.display='none';
    if(boundsRow) boundsRow.style.display='none';
    if(resultEl) resultEl.style.display='none';
    if(msgEl) msgEl.style.display='block';
    integralState.fnKey=null; integralState.enabled=false;
    updateIntegralSwitchUI();
    return;
  }

  if(msgEl) msgEl.style.display='none';
  if(fnRow) fnRow.style.display='';
  if(boundsRow) boundsRow.style.display='';

  if(!list.some(e=>e.key===integralState.fnKey)){
    integralState.fnKey=list[0].key;
    setDefaultIntegralBounds(list[0]);
  }

  if(selEl){
    selEl.innerHTML=list.map(e=>
      `<option value="${escapeHtmlAttr(e.key)}"${e.key===integralState.fnKey?' selected':''}>${escapeHtmlAttr(e.label)}</option>`).join('');
  }
  const fmt=v=>Number.isFinite(v)?parseFloat(v.toPrecision(6)):'';
  if(loEl && document.activeElement!==loEl) loEl.value=fmt(integralState.lo);
  if(hiEl && document.activeElement!==hiEl) hiEl.value=fmt(integralState.hi);

  const entry=list.find(e=>e.key===integralState.fnKey);

  if(!integralState.enabled || !entry){
    if(resultEl) resultEl.style.display='none';
    return;
  }

  const res=computeIntegralResult(entry, integralState.lo, integralState.hi);
  if(resultEl){
    if(res){
      resultEl.style.display='block';
      let html=`Integrál na ⟨${f6(res.lo)}; ${f6(res.hi)}⟩:<br>`+
               `<b>I ≈ ${f6(res.value)}</b><br>`;
      if(res.ciHalfWidth!==null){
        html+=`95% IS: ${f6(res.value-res.ciHalfWidth)} – ${f6(res.value+res.ciHalfWidth)}`;
      } else {
        html+=`<span style="color:var(--text-muted);">(nejistotu nelze u kombinace spočítat)</span>`;
      }
      resultEl.innerHTML=html;
    } else {
      resultEl.style.display='none';
    }
  }
}

/* ══════════════════════════════════════════════
   DERIVACE (tečna)
══════════════════════════════════════════════ */
function setDefaultDerivativeX0(entry){
  derivativeState.x0=(entry.xMin+entry.xMax)/2;
}

function evalFnSafe(fn, xi){
  try{ const v=fn(xi); return Number.isFinite(v)?v:NaN; }
  catch(e){ return NaN; }
}

function computeDerivativeResult(entry, x0){
  if(!entry || !Number.isFinite(x0)) return null;
  let range=entry.xMax-entry.xMin;
  if(!Number.isFinite(range) || range<=0) range=2;
  const h=Math.max(range*1e-4, 1e-6);

  const y0=evalFnSafe(entry.fn, x0);
  const slope=(evalFnSafe(entry.fn, x0+h)-evalFnSafe(entry.fn, x0-h))/(2*h);
  if(!Number.isFinite(y0) || !Number.isFinite(slope)) return null;

  let slopeHalfWidth=null;
  if(entry.ciInfo){
    try{
      const xs=[x0-h, x0+h];
      const ys=xs.map(xi=>evalFnSafe(entry.fn,xi));
      const band=buildCiBand(entry.ciInfo.result, entry.ciInfo.x, entry.ciInfo.y, xs, ys, true);
      if(band){
        const slopeUpper=(band.upper[1].y-band.upper[0].y)/(2*h);
        const slopeLower=(band.lower[1].y-band.lower[0].y)/(2*h);
        if(Number.isFinite(slopeUpper) && Number.isFinite(slopeLower)){
          slopeHalfWidth=Math.abs(slopeUpper-slopeLower)/2;
        }
      }
    }catch(e){ slopeHalfWidth=null; }
  }
  return {x0, y0, slope, slopeHalfWidth};
}

function computeDatasetsBounds(combinedDatasets){
  let xMin=Infinity, xMax=-Infinity, yMin=Infinity, yMax=-Infinity;
  combinedDatasets.forEach(ds=>{
    if(!ds.data) return;
    ds.data.forEach(p=>{
      if(p && Number.isFinite(p.x)){ if(p.x<xMin) xMin=p.x; if(p.x>xMax) xMax=p.x; }
      if(p && Number.isFinite(p.y)){ if(p.y<yMin) yMin=p.y; if(p.y>yMax) yMax=p.y; }
    });
  });
  if(!Number.isFinite(xMin)||!Number.isFinite(xMax)||!Number.isFinite(yMin)||!Number.isFinite(yMax)) return null;
  return {xMin, xMax, yMin, yMax};
}

function computeDerivativeTangentSeries(entry, x0, dataBounds){
  const res=computeDerivativeResult(entry, x0);
  if(!res) return null;

  // Tečna se kreslí přes celou aktuální oblast grafu (ne jen přes doménu
  // vybrané funkce) — rozsahy os se podle ní ale nikdy nepřepočítávají,
  // protože osa y je při zapnuté derivaci explicitně zamčená (viz renderCombinedChart).
  let a=entry.xMin, b=entry.xMax;
  if(dataBounds && Number.isFinite(dataBounds.xMin) && Number.isFinite(dataBounds.xMax) && dataBounds.xMin<dataBounds.xMax){
    a=dataBounds.xMin; b=dataBounds.xMax;
  }
  if(!Number.isFinite(a) || !Number.isFinite(b) || a===b) return null;

  const y1=res.slope*(a-res.x0)+res.y0;
  const y2=res.slope*(b-res.x0)+res.y0;
  if(!Number.isFinite(y1) || !Number.isFinite(y2)) return null;
  return {
    line:{
      type:'line', label:'Tečna',
      data:[{x:a,y:y1},{x:b,y:y2}],
      borderColor:'#1a8840', borderWidth:2, borderDash:[3,3],
      pointRadius:0, fill:false, tension:0, order:5,
      _kind:'derivative-line'
    },
    point:{
      type:'scatter', label:'Bod dotyku',
      data:[{x:res.x0,y:res.y0}],
      backgroundColor:'#1a8840', borderColor:'#fff', borderWidth:2,
      pointRadius:6, pointStyle:'circle', order:4,
      _kind:'derivative-point'
    }
  };
}

function toggleDerivativeEnabled(){
  if(!derivativeState.enabled){
    const list=getIntegrableFunctions();
    if(!list.length) return;
    if(!derivativeState.fnKey || !list.some(e=>e.key===derivativeState.fnKey)){
      derivativeState.fnKey=list[0].key;
      setDefaultDerivativeX0(list[0]);
    }
  }
  derivativeState.enabled=!derivativeState.enabled;
  renderCombinedChart();
}

function updateDerivativeSwitchUI(){
  const track=document.getElementById('derivative-enable-track');
  const knob=document.getElementById('derivative-enable-knob');
  if(track){
    track.style.background=derivativeState.enabled?'var(--accent)':'var(--btn)';
    track.style.borderColor=derivativeState.enabled?'var(--accent)':'var(--border)';
  }
  if(knob) knob.style.left=derivativeState.enabled?'18px':'1px';
}

function updateDerivativeResultText(entry){
  const resultEl=document.getElementById('derivative-result');
  if(!resultEl) return;
  if(!derivativeState.enabled || !entry){ resultEl.style.display='none'; return; }

  const res=computeDerivativeResult(entry, derivativeState.x0);
  if(!res){ resultEl.style.display='none'; return; }

  resultEl.style.display='block';
  const intercept=res.y0-res.slope*res.x0;
  const sign=intercept>=0?'+':'−';
  let html=`Bod dotyku: (${f6(res.x0)}; ${f6(res.y0)})<br>`+
           `<b>f'(x₀) ≈ ${f6(res.slope)}</b>`;
  if(res.slopeHalfWidth!==null){
    html+=` <span style="color:var(--text-muted);">(95% IS: ${f6(res.slope-res.slopeHalfWidth)} – ${f6(res.slope+res.slopeHalfWidth)})</span>`;
  } else {
    html+=` <span style="color:var(--text-muted);">(nejistotu nelze u kombinace spočítat)</span>`;
  }
  html+=`<br>Tečna: y = ${f6(res.slope)}x ${sign} ${f6(Math.abs(intercept))}`;
  resultEl.innerHTML=html;
}

function syncDerivativeX0Controls(){
  const sliderEl=document.getElementById('derivative-x0-slider');
  const inputEl=document.getElementById('derivative-x0-input');
  const fmt=v=>Number.isFinite(v)?parseFloat(v.toPrecision(6)):'';
  if(sliderEl && document.activeElement!==sliderEl) sliderEl.value=derivativeState.x0;
  if(inputEl && document.activeElement!==inputEl) inputEl.value=fmt(derivativeState.x0);
}

// Rychlá cesta pro tažení posuvníku / psaní do políčka x0 — jen posune
// datasety tečny a bodu v už existujícím grafu (chart.update('none')),
// BEZ zbourání a nového napočítání celého grafu (fity, tabulky, panely...).
function updateDerivativeLive(){
  if(!chartInst || !derivativeState.enabled){ renderCombinedChart(); return; }

  const entry=getIntegrableFunctions().find(e=>e.key===derivativeState.fnKey);
  if(!entry){ renderCombinedChart(); return; }

  const lineDs=chartInst.data.datasets.find(d=>d._kind==='derivative-line');
  const pointDs=chartInst.data.datasets.find(d=>d._kind==='derivative-point');
  if(!lineDs || !pointDs){ renderCombinedChart(); return; }

  const xMinAxis=chartInst.scales?.x?.min, xMaxAxis=chartInst.scales?.x?.max;
  const dataBounds=(Number.isFinite(xMinAxis) && Number.isFinite(xMaxAxis) && xMinAxis<xMaxAxis)
    ? {xMin:xMinAxis, xMax:xMaxAxis} : null;

  const tangent=computeDerivativeTangentSeries(entry, derivativeState.x0, dataBounds);
  if(!tangent){ renderCombinedChart(); return; }

  lineDs.data=tangent.line.data;
  pointDs.data=tangent.point.data;
  chartInst.update('none');

  syncDerivativeX0Controls();
  updateDerivativeResultText(entry);
}

function onDerivativeFnChange(){
  const sel=document.getElementById('derivative-fn');
  if(!sel) return;
  derivativeState.fnKey=sel.value;
  const entry=getIntegrableFunctions().find(e=>e.key===derivativeState.fnKey);
  if(entry) setDefaultDerivativeX0(entry);
  renderCombinedChart();
}

function onDerivativeSliderInput(){
  const slider=document.getElementById('derivative-x0-slider');
  if(!slider) return;
  const v=parseFloat(slider.value);
  if(!isNaN(v)) derivativeState.x0=v;
  updateDerivativeLive();
}

function onDerivativeInputChange(){
  const inputEl=document.getElementById('derivative-x0-input');
  if(!inputEl) return;
  let v=parseFloat(inputEl.value.replace(',','.'));
  if(isNaN(v)) return;
  const entry=getIntegrableFunctions().find(e=>e.key===derivativeState.fnKey);
  if(entry && Number.isFinite(entry.xMin) && Number.isFinite(entry.xMax)){
    v=Math.min(Math.max(v, entry.xMin), entry.xMax);
  }
  derivativeState.x0=v;
  updateDerivativeLive();
}

function refreshDerivativePanel(){
  updateDerivativeSwitchUI();
  if(!combineState.open) return;

  const msgEl=document.getElementById('derivative-msg');
  const fnRow=document.getElementById('derivative-fn-row');
  const x0Row=document.getElementById('derivative-x0-row');
  const resultEl=document.getElementById('derivative-result');
  const selEl=document.getElementById('derivative-fn');
  const sliderEl=document.getElementById('derivative-x0-slider');

  const list=getIntegrableFunctions();

  if(!list.length){
    if(fnRow) fnRow.style.display='none';
    if(x0Row) x0Row.style.display='none';
    if(resultEl) resultEl.style.display='none';
    if(msgEl) msgEl.style.display='block';
    derivativeState.fnKey=null; derivativeState.enabled=false;
    updateDerivativeSwitchUI();
    return;
  }

  if(msgEl) msgEl.style.display='none';
  if(fnRow) fnRow.style.display='';
  if(x0Row) x0Row.style.display='';

  if(!list.some(e=>e.key===derivativeState.fnKey)){
    derivativeState.fnKey=list[0].key;
    setDefaultDerivativeX0(list[0]);
  }

  if(selEl){
    selEl.innerHTML=list.map(e=>
      `<option value="${escapeHtmlAttr(e.key)}"${e.key===derivativeState.fnKey?' selected':''}>${escapeHtmlAttr(e.label)}</option>`).join('');
  }

  const entry=list.find(e=>e.key===derivativeState.fnKey);
  if(entry){
    if(derivativeState.x0===null || !Number.isFinite(derivativeState.x0)) setDefaultDerivativeX0(entry);
    if(sliderEl){
      sliderEl.min=entry.xMin; sliderEl.max=entry.xMax;
      const range=entry.xMax-entry.xMin;
      sliderEl.step = (Number.isFinite(range) && range>0) ? (range/1000) : 0.01;
    }
    syncDerivativeX0Controls();
  }

  updateDerivativeResultText(entry);
}

function renderCombinedChart(){
  renderTabsUI();
  refreshCombinePanelOptions();
  refreshIntegralPanel();
  refreshDerivativePanel();
  if(chartInst){chartInst.destroy();chartInst=null;}

  const activeDatasets=datasets
    .map((ds,i)=>({ds,i}))
    .filter(({ds})=>ds.x.length>0||ds.excl.length>0);

  if(!activeDatasets.length){ clearChart(); return; }
  setChartEmptyState(false);

  const multi=activeDatasets.length>1;
  const combinedDatasets=[];

  activeDatasets.forEach(({ds,i})=>{
    const col=DATASET_COLORS[i%DATASET_COLORS.length];
    const suffix=multi ? ` (${ds.name})` : '';
    const {x,y,excl,lastResult:result}=ds;
    if(!ds.hiddenSeries) ds.hiddenSeries={data:false,excl:false,fit:false,ci:false};

    const ptMeta=getPointStyleMeta(ds.pointStyle);

    if(excl.length>0){
      combinedDatasets.push({
        type:'scatter',label:`Vyloučeno${suffix} (${excl.length})`,
        data:excl.map(p=>({x:p[0],y:p[1]})),
        backgroundColor:'transparent',borderColor:col.excl,
        pointStyle:ptMeta.chart,rotation:ptMeta.rotation,
        pointRadius:6*ptMeta.sizeMult,pointBorderWidth:2,order:3,
        _dsIdx:i,_kind:'excl',hidden:!!ds.hiddenSeries.excl
      });
    }

    if(x.length>0){
      combinedDatasets.push({
        type:'scatter',label:`Data${suffix}`,
        data:x.map((xi,idx)=>({x:xi,y:y[idx]})),
        backgroundColor:col.point,borderColor:'rgba(255,255,255,.7)',
        borderWidth:1.5,pointRadius:6*ptMeta.sizeMult,order:3,
        pointStyle:ptMeta.chart,rotation:ptMeta.rotation,
        _dsIdx:i,_kind:'data',hidden:!!ds.hiddenSeries.data
      });
    }

    if(result && x.length>0){
      const xMin=Math.min(...x), xMax=Math.max(...x);
      const step=(xMax-xMin)/399||1;
      const xSmooth=Array.from({length:400},(_,k)=>xMin+k*step);
      let ySmooth;
      try{ ySmooth=xSmooth.map(result.smooth); }
      catch(e){ ySmooth=xSmooth.map(()=>NaN); }

      combinedDatasets.push({
        type:'line',label:`fit${suffix}`,
        data:xSmooth.map((xi,k)=>({x:xi,y:ySmooth[k]})),
        borderColor:col.fit,borderWidth:2.5,
        pointRadius:0,fill:false,tension:0,order:2,
        _dsIdx:i,_kind:'fit',hidden:!!ds.hiddenSeries.fit
      });

      const dsUseCI = (i===activeDatasetIdx) ? showCI : ds.showCI;
      const ci=buildCiBand(result,x,y,xSmooth,ySmooth,dsUseCI);
      if(ci){
        combinedDatasets.push({
          type:'line',label:`IS 95 %${suffix}`,
          data:ci.upper,
          borderColor:col.ciBorder,backgroundColor:col.ciBg,
          borderWidth:1,borderDash:[4,3],
          pointRadius:0,fill:'+1',tension:0,order:4,
          pointStyle:'rect',_ciPairId:i,_dsIdx:i,_kind:'ci',hidden:!!ds.hiddenSeries.ci
        });
        combinedDatasets.push({
          type:'line',label:`_ciLower${suffix}`,
          data:ci.lower,
          borderColor:col.ciBorder,backgroundColor:col.ciBg,
          borderWidth:1,borderDash:[4,3],
          pointRadius:0,fill:false,tension:0,order:5,
          _ciPairId:i,_dsIdx:i,_kind:'ci',hidden:!!ds.hiddenSeries.ci
        });
      }
    }
  });

  if(combineState.enabled){
    const combinedSeries=computeCombinedSeries();
    if(combinedSeries) combinedDatasets.push(combinedSeries);
  }

  if(integralState.enabled){
    const entry=getIntegrableFunctions().find(e=>e.key===integralState.fnKey);
    if(entry){
      const areaSeries=computeIntegralAreaSeries(entry, integralState.lo, integralState.hi);
      if(areaSeries) combinedDatasets.push(areaSeries);
    }
  }

  let derivativeAxisLock=null;
  if(derivativeState.enabled){
    const entry=getIntegrableFunctions().find(e=>e.key===derivativeState.fnKey);
    if(entry){
      const dataBounds=computeDatasetsBounds(combinedDatasets);
      if(dataBounds && !manualRange.active){
        const span=(dataBounds.yMax-dataBounds.yMin)||1;
        const pad=span*0.08;
        derivativeAxisLock={min:dataBounds.yMin-pad, max:dataBounds.yMax+pad};
      }
      const tangent=computeDerivativeTangentSeries(entry, derivativeState.x0, dataBounds);
      if(tangent){ combinedDatasets.push(tangent.line); combinedDatasets.push(tangent.point); }
    }
  }

  const c=chartColors();
  const activeLabels=datasets[activeDatasetIdx];
  const ctx=document.getElementById('myChart').getContext('2d');
  chartInst=new Chart(ctx,{
    type:'scatter',
    data:{datasets:combinedDatasets},
    options:{
      responsive:true,maintainAspectRatio:false,
      animation:{duration:300},
      scales:{
        x:{type:'linear',...getScaleOpts('x'),
           grid:{color:c.grid},
           ticks:{color:c.tick,font:{family:'Fira Code',size:11}},
           border:{color:c.axis},
           title:{display:true,text:activeLabels.xLabel,color:c.tick,font:{family:'Sora',size:12}}},
        y:{type:'linear',...(derivativeAxisLock||{}),
           grid:{color:c.grid},
           ticks:{color:c.tick,font:{family:'Fira Code',size:11}},
           border:{color:c.axis},
           title:{display:true,text:activeLabels.yLabel,color:c.tick,font:{family:'Sora',size:12}}}
      },
      plugins:{
        legend:{
          labels:{color:c.tick,usePointStyle:true,
                  font:{family:'Sora',size:11},boxWidth:10,padding:14,
                  filter:item=>!item.text.startsWith('_ciLower')},
          onClick(e, legendItem, legend){
            const chart=legend.chart;
            const idx=legendItem.datasetIndex;
            const ds=chart.data.datasets[idx];
            const label=ds?.label||'';
            const targetDs = (ds && ds._dsIdx!==undefined) ? datasets[ds._dsIdx] : null;
            if(targetDs && !targetDs.hiddenSeries) targetDs.hiddenSeries={data:false,excl:false,fit:false,ci:false};
            if(label.startsWith('IS 95 %') && ds._ciPairId!==undefined){
              const pairIdx=chart.data.datasets.findIndex((d,k)=>k!==idx && d._ciPairId===ds._ciPairId);
              const vis=chart.isDatasetVisible(idx);
              if(vis){ chart.hide(idx); if(pairIdx>=0) chart.hide(pairIdx); }
              else   { chart.show(idx); if(pairIdx>=0) chart.show(pairIdx); }
              if(targetDs) targetDs.hiddenSeries.ci = vis;
            } else {
              const vis=chart.isDatasetVisible(idx);
              if(vis) chart.hide(idx); else chart.show(idx);
              if(targetDs && ds._kind) targetDs.hiddenSeries[ds._kind] = vis;
            }
          }
        },
        tooltip:{
          callbacks:{
            label:ctx=>{
              const d=ctx.raw;
              return ` (${d.x}, ${typeof d.y==='number'?d.y.toPrecision(6):d.y})`;
            }
          }
        }
      },
      backgroundColor:c.bg
    },
    plugins:[{
      id:'bgFill',
      beforeDraw(chart){
        const{ctx:c2,chartArea}=chart;
        if(!chartArea) return;
        c2.save();
        c2.fillStyle=isDark?'#1c1c24':'#fafafa';
        c2.fillRect(chartArea.left,chartArea.top,chartArea.width,chartArea.height);
        c2.restore();
      }
    }]
  });
  requestAnimationFrame(updateRangeInputs);
}

/* ══════════════════════════════════════════════
   FILE IMPORT
══════════════════════════════════════════════ */
function loadFile(input){
  const file=input.files[0];
  if(!file) return;
  const lbl=document.getElementById('file-label');
  if(lbl){
    lbl.innerHTML='<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;flex-shrink:0;"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="M14 2v6h6"/></svg> '+escapeHtmlAttr(file.name);
    lbl.style.display='block';
  }
  datasets[activeDatasetIdx].fileLabel=file.name;
  renderTabsUI();
  input.value='';
  const reader=new FileReader();
  reader.onload=e=>{ parseAndFill(e.target.result); };
  reader.readAsText(file);
}

function parseAndFill(text){
  const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(l=>l&&!l.startsWith('#'));
  if(!lines.length) return;

  function splitLine(line){
    if(line.includes('\t'))  return line.split('\t').map(s=>s.trim());
    if(line.includes(';'))   return line.split(';').map(s=>s.trim());
    if(line.includes(','))   return line.split(',').map(s=>s.trim());
    return line.split(/\s+/).filter(s=>s!=='');
  }

  let headerX='x', headerY='y', dataStart=0;
  const firstParts=splitLine(lines[0]);
  if(firstParts.length>=2 && (isNaN(firstParts[0].replace(',','.')) || isNaN(firstParts[1].replace(',','.')))){
    headerX=firstParts[0]||'x';
    headerY=firstParts[1]||'y';
    dataStart=1;
  }
  axisLabels={x:headerX, y:headerY};
  axisLabelsFromFile = (dataStart === 1);
  const lx=document.getElementById('label-x'), ly=document.getElementById('label-y');
  if(lx) lx.value=axisLabels.x;
  if(ly) ly.value=axisLabels.y;

  const rows=[];
  for(let i=dataStart;i<lines.length;i++){
    const parts=splitLine(lines[i]);
    if(parts.length<2) continue;
    const xv=parseFloat(parts[0].replace(',','.'));
    const yv=parseFloat(parts[1].replace(',','.'));
    if(!isNaN(xv)&&!isNaN(yv)) rows.push([xv,yv]);
  }
  if(!rows.length){ alert('Nepodařilo se načíst žádná data.'); return; }

  const tb=document.getElementById('tbody');
  tb.innerHTML='';
  regressionOn=false;
  const _br=document.getElementById('btn-regrese'); if(_br){_br.style.color='var(--text)';_br.style.opacity='.6';_br.title='Spustit analýzu';}
  const _eq=document.getElementById('resEq'); if(_eq) _eq.textContent='—';
  document.getElementById('resParams').textContent='';

  rows.forEach(([xv,yv],i)=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td class="row-num">${i+1}</td>
      <td><input type="checkbox" checked onchange="autoRecompute()"></td>
      <td><input class="cell" type="text" value="${xv}" data-r="${i}" data-c="x"
                 onkeydown="handleKey(event,${i},'x')" oninput="autoRecompute()"></td>
      <td><input class="cell" type="text" value="${yv}" data-r="${i}" data-c="y"
                 onkeydown="handleKey(event,${i},'y')" oninput="autoRecompute()"></td>`;
    tb.appendChild(tr);
  });
  addRow();
  updateMasterCheckbox();
  showPointsOnly();
  document.getElementById('resEq').innerHTML=
    `<span style="color:var(--success)">${okIconSvg()} Načteno ${rows.length} bodů${dataStart?` · osy: ${escapeHtmlAttr(headerX)}, ${escapeHtmlAttr(headerY)}`:''}</span>`;
}

/* ══════════════════════════════════════════════
   RECTANGLE SELECTION
══════════════════════════════════════════════ */
let selectMode=false;
let selStart=null, selRect=null;

function toggleSelectMode(){
  selectMode=!selectMode;
  const btn=document.getElementById('btn-select');
  const overlay=document.getElementById('sel-overlay');
  if(selectMode){
    btn.style.opacity='1';
    btn.style.color='var(--accent)';
    btn.title='Zrušit výběr';
    overlay.classList.add('active');
    const tb=document.getElementById('tbody');
    tb.querySelectorAll('input[type="checkbox"]').forEach(cb=>cb.checked=false);
    updateMasterCheckbox();
    recomputeKeepVis();
  } else {
    exitSelectMode();
  }
}

function exitSelectMode(){
  selectMode=false;
  const btn=document.getElementById('btn-select');
  const overlay=document.getElementById('sel-overlay');
  btn.style.opacity='.6';
  btn.style.color='var(--text)';
  btn.title='Vybrat oblast';
  overlay.classList.remove('active');
  const r=overlay.querySelector('.sel-rect');
  if(r) r.remove();
  selStart=null; selRect=null;
}

function getOverlayPos(e, overlay){
  const rect=overlay.getBoundingClientRect();
  return {x:e.clientX-rect.left, y:e.clientY-rect.top};
}

document.addEventListener('DOMContentLoaded',()=>{
  renderTabsUI();
  loadCustomEquationLibrary();
  renderCustomEquationDropdownItems();
  const overlay=document.getElementById('sel-overlay');

  overlay.addEventListener('mousedown',e=>{
    if(!selectMode) return;
    selStart=getOverlayPos(e,overlay);
    const r=document.createElement('div');
    r.className='sel-rect';
    r.style.left=selStart.x+'px'; r.style.top=selStart.y+'px';
    r.style.width='0'; r.style.height='0';
    overlay.appendChild(r);
    selRect=r;
    e.preventDefault();
  });

  overlay.addEventListener('mousemove',e=>{
    if(!selectMode||!selStart||!selRect) return;
    const pos=getOverlayPos(e,overlay);
    const x=Math.min(pos.x,selStart.x), y=Math.min(pos.y,selStart.y);
    const w=Math.abs(pos.x-selStart.x), h=Math.abs(pos.y-selStart.y);
    selRect.style.left=x+'px'; selRect.style.top=y+'px';
    selRect.style.width=w+'px'; selRect.style.height=h+'px';
    e.preventDefault();
  });

  overlay.addEventListener('mouseup',e=>{
    if(!selectMode||!selStart||!selRect||!chartInst) return;
    const pos=getOverlayPos(e,overlay);
    const px1=Math.min(selStart.x,pos.x), px2=Math.max(selStart.x,pos.x);
    const py1=Math.min(selStart.y,pos.y), py2=Math.max(selStart.y,pos.y);
    const xScale=chartInst.scales.x, yScale=chartInst.scales.y;
    const dxMin=xScale.getValueForPixel(px1), dxMax=xScale.getValueForPixel(px2);
    const dyMin=yScale.getValueForPixel(py2), dyMax=yScale.getValueForPixel(py1);
    const tb=document.getElementById('tbody');
    for(let i=0;i<tb.rows.length;i++){
      const xv=parseFloat(tb.rows[i].cells[2]?.querySelector('input')?.value?.replace(',','.'));
      const yv=parseFloat(tb.rows[i].cells[3]?.querySelector('input')?.value?.replace(',','.'));
      if(!isNaN(xv)&&!isNaN(yv) && xv>=dxMin&&xv<=dxMax && yv>=dyMin&&yv<=dyMax){
        const cb=tb.rows[i].cells[1]?.querySelector('input[type="checkbox"]');
        if(cb) cb.checked=true;
      }
    }
    selRect.remove(); selRect=null; selStart=null;
    exitSelectMode();
    updateMasterCheckbox();
    recomputeKeepVis();
  });
});

/* ══════════════════════════════════════════════
   ACTIONS
══════════════════════════════════════════════ */
function saveData(){
  const tb=document.getElementById('tbody');
  const lx=document.getElementById('label-x')?.value.trim()||'x';
  const ly=document.getElementById('label-y')?.value.trim()||'y';
  const rows=[];
  for(let i=0;i<tb.rows.length;i++){
    const xv=tb.rows[i].cells[2]?.querySelector('input')?.value.trim().replace(',','.');
    const yv=tb.rows[i].cells[3]?.querySelector('input')?.value.trim().replace(',','.');
    if(!xv||!yv) continue;
    const xf=parseFloat(xv), yf=parseFloat(yv);
    if(!isNaN(xf)&&!isNaN(yf)) rows.push(`${xv}\t${yv}`);
  }
  if(!rows.length){ alert('Tabulka neobsahuje žádná data.'); return; }
  const content=`${lx}\t${ly}\n`+rows.join('\n');
  const a=document.createElement('a');
  a.href='data:text/plain;charset=utf-8,'+encodeURIComponent(content);
  a.download='data.txt';
  a.click();
}

function swapXY(){
  const tb=document.getElementById('tbody');
  for(let i=0;i<tb.rows.length;i++){
    const xI=tb.rows[i].cells[2].querySelector('input');
    const yI=tb.rows[i].cells[3].querySelector('input');
    [xI.value,yI.value]=[yI.value,xI.value];
  }
  // Vždy prohodit popisky os
  [axisLabels.x, axisLabels.y]=[axisLabels.y, axisLabels.x];
  axisLabelsFromFile=true;
  const lx=document.getElementById('label-x'), ly=document.getElementById('label-y');
  if(lx) lx.value=axisLabels.x;
  if(ly) ly.value=axisLabels.y;
  // Prohodit rozsahy os
  const rxMin=document.getElementById('range-xmin');
  const rxMax=document.getElementById('range-xmax');
  const ryMin=document.getElementById('range-ymin');
  const ryMax=document.getElementById('range-ymax');
  if(rxMin&&rxMax&&ryMin&&ryMax){
    [rxMin.value,ryMin.value]=[ryMin.value,rxMin.value];
    [rxMax.value,ryMax.value]=[ryMax.value,rxMax.value];
  }
  // Prohodit manualRange
  [manualRange.xMin,manualRange.yMin]=[manualRange.yMin,manualRange.xMin];
  [manualRange.xMax,manualRange.yMax]=[manualRange.yMax,manualRange.xMax];
  recomputeKeepVis();
}

function clearData(){
  if(!confirm('Opravdu smazat všechna data?')) return;
  regressionOn=false;
  axisLabels={x:'x', y:'y'};
  axisLabelsFromFile=false;
  const lx=document.getElementById('label-x'), ly=document.getElementById('label-y');
  if(lx) lx.value='x';
  if(ly) ly.value='y';
  const lbl=document.getElementById('file-label');
  if(lbl){ lbl.textContent=''; lbl.style.display='none'; }
  datasets[activeDatasetIdx].fileLabel=null;
  datasets[activeDatasetIdx].lastResult=null;
  datasets[activeDatasetIdx].x=[]; datasets[activeDatasetIdx].y=[]; datasets[activeDatasetIdx].excl=[];
  renderTabsUI();
  const _br=document.getElementById('btn-regrese'); if(_br){_br.style.color='var(--text)';_br.style.opacity='.6';_br.title='Spustit analýzu';}
  const tb=document.getElementById('tbody');
  tb.innerHTML='';
  for(let i=0;i<6;i++) addRow();
  const _eq=document.getElementById('resEq'); if(_eq) _eq.textContent='—';
  document.getElementById('resParams').textContent='';
  recomputeKeepVis();
}

/* ══════════════════════════════════════════════
   SVG EXPORT
   Export je čistě vektorový (PNG export byl odstraněn).
   Legenda i barvy/tvary bodů se čtou přímo z živého Chart.js
   grafu (chart.options.plugins.legend.labels.generateLabels),
   aby export vždy vypadal přesně jako náhled v appce.
══════════════════════════════════════════════ */
function svgChartPointShape(pointStyle, rotation, cx, cy, r, fill, stroke, strokeWidth){
  rotation = rotation || 0;
  if(pointStyle==='rect' || pointStyle==='rectRounded'){
    const s=r*1.7;
    return `<rect x="${(cx-s/2).toFixed(1)}" y="${(cy-s/2).toFixed(1)}" width="${s.toFixed(1)}" height="${s.toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
  }
  if(pointStyle==='rectRot'){
    const s=r*1.3;
    const pts=[[cx,cy-s],[cx+s,cy],[cx,cy+s],[cx-s,cy]];
    const d=pts.map(p=>`${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    return `<polygon points="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
  }
  if(pointStyle==='triangle'){
    const h=r*1.9, w=r*1.9;
    const pts = Math.abs(rotation-180)<1
      ? [[cx,cy+h*0.55],[cx-w*0.5,cy-h*0.45],[cx+w*0.5,cy-h*0.45]]
      : [[cx,cy-h*0.55],[cx-w*0.5,cy+h*0.45],[cx+w*0.5,cy+h*0.45]];
    const d=pts.map(p=>`${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    return `<polygon points="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
  }
  if(pointStyle==='line' || pointStyle==='dash'){
    return `<line x1="${(cx-r*1.4).toFixed(1)}" y1="${cy.toFixed(1)}" x2="${(cx+r*1.4).toFixed(1)}" y2="${cy.toFixed(1)}" stroke="${stroke||fill}" stroke-width="${strokeWidth||2.5}"/>`;
  }
  // circle a vše ostatní (cross, star…) → kruhová značka
  return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
}

function svgShape(styleKey, cx, cy, rBase, fill, stroke, strokeWidth){
  const meta=getPointStyleMeta(styleKey);
  return svgChartPointShape(meta.chart, meta.rotation, cx, cy, rBase*meta.sizeMult, fill, stroke, strokeWidth);
}

function svgAxesAndGrid(ml, mt, pw, ph, xMin, xMax, yMin, yMax){
  let svg='';
  svg+=`<rect x="${ml}" y="${mt}" width="${pw}" height="${ph}" fill="#fafafa"/>`;
  const xRange=xMax-xMin||1, yRange=yMax-yMin||1;
  for(let i=0;i<=5;i++){
    const gy=mt+i*ph/5;
    const gx=ml+i*pw/5;
    svg+=`<line x1="${ml}" y1="${gy}" x2="${ml+pw}" y2="${gy}" stroke="rgba(0,0,0,0.07)" stroke-width="1"/>`;
    svg+=`<line x1="${gx}" y1="${mt}" x2="${gx}" y2="${mt+ph}" stroke="rgba(0,0,0,0.07)" stroke-width="1"/>`;
    const yVal=(yMin+((5-i)/5)*yRange).toPrecision(4);
    const xVal=(xMin+(i/5)*xRange).toPrecision(4);
    svg+=`<text x="${ml-6}" y="${gy+4}" text-anchor="end" font-size="11" fill="#444456" font-family="'Fira Code',monospace">${yVal}</text>`;
    svg+=`<text x="${gx}" y="${mt+ph+16}" text-anchor="middle" font-size="11" fill="#444456" font-family="'Fira Code',monospace">${xVal}</text>`;
  }
  svg+=`<line x1="${ml}" y1="${mt}" x2="${ml}" y2="${mt+ph}" stroke="#cccccc" stroke-width="1.5"/>`;
  svg+=`<line x1="${ml}" y1="${mt+ph}" x2="${ml+pw}" y2="${mt+ph}" stroke="#cccccc" stroke-width="1.5"/>`;
  return svg;
}

function svgAxisTitles(W, H, ml, mt, pw, ph, xLabel, yLabel){
  let svg='';
  svg+=`<text x="${ml+pw/2}" y="${H-8}" text-anchor="middle" font-size="12" fill="#444456">${escapeXml(xLabel)}</text>`;
  svg+=`<text x="14" y="${mt+ph/2}" text-anchor="middle" font-size="12" fill="#444456" transform="rotate(-90,14,${mt+ph/2})">${escapeXml(yLabel)}</text>`;
  return svg;
}

// Sestaví legendu úplně stejně, jako to dělá živý Chart.js graf
// (generateLabels + jeho vlastní filter), jen omezenou na vybrané datasety
// a jen na aktuálně viditelné položky — zaručuje shodu s náhledem v appce.
function getVisibleLegendItems(dsIdxList){
  if(!chartInst) return [];
  const labelOpts=chartInst.options?.plugins?.legend?.labels;
  if(!labelOpts || typeof labelOpts.generateLabels!=='function') return [];
  let items=labelOpts.generateLabels(chartInst) || [];
  if(typeof labelOpts.filter==='function'){
    items=items.filter(it=>labelOpts.filter(it, chartInst.data));
  }
  const TOOL_KINDS=['combine','integral-area','derivative-line','derivative-point'];
  return items.filter(it=>{
    const dsCfg=chartInst.data.datasets[it.datasetIndex];
    if(!dsCfg) return false;
    if(dsCfg._dsIdx!==undefined){
      if(!dsIdxList.includes(dsCfg._dsIdx)) return false;
    } else if(!TOOL_KINDS.includes(dsCfg._kind)){
      return false;
    }
    return !it.hidden;
  });
}

function layoutLegendRows(items, availW){
  const itemW=it=>String(it.text).length*6.5+40;
  const rows=[]; let curRow=[], curW=0;
  items.forEach(it=>{
    const w=itemW(it);
    if(curRow.length && curW+w>availW){ rows.push(curRow); curRow=[]; curW=0; }
    curRow.push(it); curW+=w;
  });
  if(curRow.length) rows.push(curRow);
  return rows;
}

function svgLegendRows(rows, W){
  const itemW=it=>String(it.text).length*6.5+40;
  const rowH=20;
  let svg='';
  rows.forEach((row,ri)=>{
    const rowWidth=row.reduce((s,it)=>s+itemW(it),0);
    let lx=(W-rowWidth)/2;
    const ly=16+ri*rowH;
    row.forEach(it=>{
      const fill=it.fillStyle || 'transparent';
      const stroke=it.strokeStyle || '#444456';
      const lw=it.lineWidth || 1.5;
      svg+=svgChartPointShape(it.pointStyle, it.rotation, lx+7, ly, 5, fill, stroke, lw);
      svg+=`<text x="${lx+24}" y="${ly+4}" font-size="11" fill="#444456">${escapeXml(it.text)}</text>`;
      lx+=itemW(it);
    });
  });
  return svg;
}

function svgCombinedCurve(px, py){
  if(!combineState.enabled) return '';
  const series=computeCombinedSeries();
  if(!series) return '';
  const pts=series.data.filter(p=>Number.isFinite(p.y)).map(p=>[px(p.x),py(p.y)]);
  if(pts.length<2) return '';
  const d=pts.map((p,j)=>`${j===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return `<path d="${d}" fill="none" stroke="#c83030" stroke-width="2.5" stroke-dasharray="7,4" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function svgIntegralArea(px, py, ml, mt, pw, ph){
  if(!integralState.enabled) return '';
  const entry=getIntegrableFunctions().find(e=>e.key===integralState.fnKey);
  if(!entry) return '';
  const series=computeIntegralAreaSeries(entry, integralState.lo, integralState.hi);
  if(!series || !series.data.length) return '';

  const clip=p=>[Math.max(ml,Math.min(ml+pw,px(p.x))), Math.max(mt,Math.min(mt+ph,py(p.y)))];
  const topPts=series.data.map(clip);
  const baselineY=Math.max(mt,Math.min(mt+ph,py(0)));
  const poly=[...topPts,[topPts[topPts.length-1][0],baselineY],[topPts[0][0],baselineY]]
    .map(p=>`${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const dTop=topPts.map((p,j)=>`${j===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return `<polygon points="${poly}" fill="rgba(200,48,48,0.18)"/>`+
         `<path d="${dTop}" fill="none" stroke="rgba(200,48,48,0.55)" stroke-width="1.5"/>`;
}

function svgDerivativeTangent(px, py){
  if(!derivativeState.enabled) return '';
  const entry=getIntegrableFunctions().find(e=>e.key===derivativeState.fnKey);
  if(!entry) return '';
  const series=computeDerivativeTangentSeries(entry, derivativeState.x0);
  if(!series) return '';
  const p1=series.line.data[0], p2=series.line.data[1];
  if(!Number.isFinite(p1.y) || !Number.isFinite(p2.y)) return '';
  let svg=`<path d="M${px(p1.x).toFixed(1)},${py(p1.y).toFixed(1)} L${px(p2.x).toFixed(1)},${py(p2.y).toFixed(1)}" fill="none" stroke="#1a8840" stroke-width="2" stroke-dasharray="3,3"/>`;
  const pt=series.point.data[0];
  svg+=svgShape('circle', px(pt.x), py(pt.y), 6, '#1a8840', '#fff', 2);
  return svg;
}

function saveGraphSVG(){
  if(!lastResult || !lastData || !chartInst){ alert('Nejprve proveďte regresi.'); return; }
  const {x,y,excl}=lastData, result=lastResult;
  const activeDs=datasets[activeDatasetIdx];
  const col=DATASET_COLORS[activeDatasetIdx%DATASET_COLORS.length];
  const ptMeta=getPointStyleMeta(activeDs.pointStyle);

  // Zjisti viditelnost jednotlivých sérií aktivního datasetu přímo podle
  // metadat v živém grafu (_dsIdx/_kind) — spolehlivé i s více sadami dat,
  // na rozdíl od dřívějšího odhadu podle pozice v poli.
  const findVis=kind=>{
    const idx=chartInst.data.datasets.findIndex(d=>d._dsIdx===activeDatasetIdx && d._kind===kind);
    return idx<0 ? true : chartInst.isDatasetVisible(idx);
  };
  const dataVisible = x.length>0 && findVis('data');
  const exclVisible = excl.length>0 && findVis('excl');
  const fitVisible = findVis('fit');
  const ciItemVisible = findVis('ci');

  // Použij rozsahy přímo z živého grafu — stejné jako co vidí uživatel
  const xMin=chartInst.scales.x.min, xMax=chartInst.scales.x.max;
  const yMin=chartInst.scales.y.min, yMax=chartInst.scales.y.max;
  const xSmoothMin=Math.min(...x), xSmoothMax=Math.max(...x);
  const step=(xSmoothMax-xSmoothMin)/399||1;
  const xSmooth=Array.from({length:400},(_,i)=>xSmoothMin+i*step);
  let ySmooth;
  try{ySmooth=xSmooth.map(result.smooth);}catch(e){ySmooth=xSmooth.map(()=>NaN);}

  const ci=buildCiBand(result, x, y, xSmooth, ySmooth, showCI && ciItemVisible);
  const ciVisible=!!ci;

  // Legenda — přesně ta samá data (barvy/tvary/pořadí), jaká vidí uživatel v appce
  const legendItems=getVisibleLegendItems([activeDatasetIdx]);

  const W=900,H=600,ml=60,mr=30,mb=60;
  const legendRows=layoutLegendRows(legendItems, W-40);
  const legendH=legendRows.length ? 10+legendRows.length*20 : 0;
  const mt=24+legendH;
  const pw=W-ml-mr, ph=H-mt-mb;

  const px=v=>ml+(v-xMin)/(xMax-xMin||1)*pw;
  const py=v=>mt+ph-(v-yMin)/(yMax-yMin||1)*ph;

  let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="'Sora',sans-serif">`;
  svg+=`<rect width="${W}" height="${H}" fill="#ffffff"/>`;
  svg+=svgLegendRows(legendRows, W);
  svg+=svgAxesAndGrid(ml,mt,pw,ph,xMin,xMax,yMin,yMax);
  svg+=svgAxisTitles(W,H,ml,mt,pw,ph,axisLabels.x,axisLabels.y);
  svg+=svgIntegralArea(px,py,ml,mt,pw,ph);

  if(ciVisible){
    const clip=p=>[Math.max(ml,Math.min(ml+pw,px(p.x))), Math.max(mt,Math.min(mt+ph,py(p.y)))];
    const uPts=ci.upper.filter(p=>isFinite(p.y)).map(clip);
    const lPts=ci.lower.filter(p=>isFinite(p.y)).map(clip).reverse();
    if(uPts.length>1){
      const poly=[...uPts,...lPts].map(p=>`${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
      svg+=`<polygon points="${poly}" fill="${col.ciBg}"/>`;
      const du=uPts.map((p,j)=>`${j===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
      const dl=lPts.slice().reverse().map((p,j)=>`${j===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
      svg+=`<path d="${du}" fill="none" stroke="${col.ciBorder}" stroke-width="1" stroke-dasharray="4,3"/>`;
      svg+=`<path d="${dl}" fill="none" stroke="${col.ciBorder}" stroke-width="1" stroke-dasharray="4,3"/>`;
    }
  }

  if(fitVisible){
    const pts=xSmooth.map((xi,i)=>[xi,ySmooth[i]]).filter(p=>isFinite(p[1]));
    if(pts.length){
      const d=pts.map((p,j)=>`${j===0?'M':'L'}${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`).join(' ');
      svg+=`<path d="${d}" fill="none" stroke="${col.fit}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
  }

  if(dataVisible){
    x.forEach((xi,i)=>{ svg+=svgShape(ptMeta.key, px(xi), py(y[i]), 6, col.point, 'rgba(0,0,0,0.25)', 1.5); });
  }
  if(exclVisible){
    excl.forEach(([xi,yi])=>{ svg+=svgShape(ptMeta.key, px(xi), py(yi), 6, 'none', col.excl, 2); });
  }

  svg+=svgCombinedCurve(px,py);
  svg+=svgDerivativeTangent(px,py);

  svg+=`</svg>`;

  const a=document.createElement('a');
  a.href='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  a.download='regrese.svg';
  a.click();
}

function saveGraphAllSVG(){
  const activeDatasetsList=datasets
    .map((ds,i)=>({ds,i}))
    .filter(({ds})=>ds.x.length>0||ds.excl.length>0);
  if(activeDatasetsList.length<2){ alert('Pro export všech dat najednou potřebuješ alespoň 2 sady dat s daty.'); return; }
  if(!chartInst){ alert('Nejprve zobraz graf.'); return; }

  const dsIdxList=activeDatasetsList.map(({i})=>i);
  const xMin=chartInst.scales.x.min, xMax=chartInst.scales.x.max;
  const yMin=chartInst.scales.y.min, yMax=chartInst.scales.y.max;

  const legendItems=getVisibleLegendItems(dsIdxList);

  const W=900,H=600,ml=60,mr=30,mb=60;
  const legendRows=layoutLegendRows(legendItems, W-40);
  const legendH=legendRows.length ? 10+legendRows.length*20 : 0;
  const mt=24+legendH;
  const pw=W-ml-mr, ph=H-mt-mb;

  const px=v=>ml+(v-xMin)/(xMax-xMin||1)*pw;
  const py=v=>mt+ph-(v-yMin)/(yMax-yMin||1)*ph;

  let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="'Sora',sans-serif">`;
  svg+=`<rect width="${W}" height="${H}" fill="#ffffff"/>`;
  svg+=svgLegendRows(legendRows, W);
  svg+=svgAxesAndGrid(ml,mt,pw,ph,xMin,xMax,yMin,yMax);
  const activeLabels=datasets[activeDatasetIdx];
  svg+=svgAxisTitles(W,H,ml,mt,pw,ph,activeLabels.xLabel,activeLabels.yLabel);
  svg+=svgIntegralArea(px,py,ml,mt,pw,ph);

  activeDatasetsList.forEach(({ds,i})=>{
    const col=DATASET_COLORS[i%DATASET_COLORS.length];
    const ptMeta=getPointStyleMeta(ds.pointStyle);
    const {x,y,excl,lastResult:result}=ds;

    const findVis=kind=>{
      const idx=chartInst.data.datasets.findIndex(d=>d._dsIdx===i && d._kind===kind);
      return idx<0 ? true : chartInst.isDatasetVisible(idx);
    };
    const dataVisible=x.length>0 && findVis('data');
    const exclVisible=excl.length>0 && findVis('excl');
    const fitVisible=findVis('fit');
    const ciItemVisible=findVis('ci');

    let xSmooth=null, ySmooth=null, ci=null;
    if(result && x.length>0){
      const xsMin=Math.min(...x), xsMax=Math.max(...x);
      const step=(xsMax-xsMin)/399||1;
      xSmooth=Array.from({length:400},(_,k)=>xsMin+k*step);
      try{ ySmooth=xSmooth.map(result.smooth); }catch(e){ ySmooth=xSmooth.map(()=>NaN); }
      const dsUseCI=(i===activeDatasetIdx)?showCI:ds.showCI;
      ci=buildCiBand(result,x,y,xSmooth,ySmooth, dsUseCI && ciItemVisible);
    }

    if(ci){
      const clip=p=>[Math.max(ml,Math.min(ml+pw,px(p.x))), Math.max(mt,Math.min(mt+ph,py(p.y)))];
      const uPts=ci.upper.filter(p=>isFinite(p.y)).map(clip);
      const lPts=ci.lower.filter(p=>isFinite(p.y)).map(clip).reverse();
      if(uPts.length>1){
        const poly=[...uPts,...lPts].map(p=>`${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
        svg+=`<polygon points="${poly}" fill="${col.ciBg}"/>`;
        const du=uPts.map((p,j)=>`${j===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
        const dl=lPts.slice().reverse().map((p,j)=>`${j===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
        svg+=`<path d="${du}" fill="none" stroke="${col.ciBorder}" stroke-width="1" stroke-dasharray="4,3"/>`;
        svg+=`<path d="${dl}" fill="none" stroke="${col.ciBorder}" stroke-width="1" stroke-dasharray="4,3"/>`;
      }
    }

    if(fitVisible && xSmooth){
      const pts=xSmooth.map((xi,k)=>[xi,ySmooth[k]]).filter(p=>isFinite(p[1]));
      if(pts.length){
        const d=pts.map((p,j)=>`${j===0?'M':'L'}${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`).join(' ');
        svg+=`<path d="${d}" fill="none" stroke="${col.fit}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
      }
    }

    if(dataVisible){
      x.forEach((xi,k)=>{ svg+=svgShape(ptMeta.key, px(xi), py(y[k]), 6, col.point, 'rgba(0,0,0,0.25)', 1.5); });
    }
    if(exclVisible){
      excl.forEach(([xi,yi])=>{ svg+=svgShape(ptMeta.key, px(xi), py(yi), 6, 'none', col.excl, 2); });
    }
  });

  svg+=svgCombinedCurve(px,py);
  svg+=svgDerivativeTangent(px,py);

  svg+=`</svg>`;

  const a=document.createElement('a');
  a.href='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  a.download='regrese_vsechna_data.svg';
  a.click();
}

/* ══════════════════════════════════════════════
   INIT
══════════════════════════════════════════════ */
/* ══════════════════════════════════════════════
   NÁVOD MODAL
══════════════════════════════════════════════ */
const NAVOD_URL = 'https://raw.githubusercontent.com/simons-implant/regrese/main/navod.md';
let navodLoaded = false;

function openNavod() {
  const overlay = document.getElementById('navod-overlay');
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  if (!navodLoaded) loadNavod();
}

function closeNavod() {
  document.getElementById('navod-overlay').style.display = 'none';
  document.body.style.overflow = '';
}

let periodogramChart=null, residualsChart=null;

function openPeriodogram(){
  const overlay=document.getElementById('periodogram-overlay');
  const emptyMsg=document.getElementById('periodogram-empty');
  const canvas=document.getElementById('periodogram-canvas');
  overlay.style.display='flex';
  document.body.style.overflow='hidden';

  const r=lastFourierResult;
  if(periodogramChart){ periodogramChart.destroy(); periodogramChart=null; }

  if(!r || !r.periodogram || !r.periodogram.length){
    canvas.style.display='none';
    emptyMsg.style.display='block';
    return;
  }
  canvas.style.display='block';
  emptyMsg.style.display='none';

  const c=chartColors();
  const bestPeriod=r.period;
  // Najdi bod v periodogramu nejblíž skutečně vybrané periodě (ta může
  // být po LM doladění mírně jiná než testovaný kandidát), ať se bod
  // vykreslí přesně na křivce a se správnou hodnotou R².
  let nearest=r.periodogram[0];
  for(const p of r.periodogram){
    if(Math.abs(p.period-bestPeriod)<Math.abs(nearest.period-bestPeriod)) nearest=p;
  }
  const r2Vals=r.periodogram.map(p=>p.r2);
  const yMin=Math.min(...r2Vals), yMax=Math.max(...r2Vals);

  periodogramChart=new Chart(canvas.getContext('2d'), {
    type:'line',
    data:{
      datasets:[
        {
          label:'R²',
          data:r.periodogram.map(p=>({x:p.period,y:p.r2})),
          borderColor:'#c83030',backgroundColor:'rgba(200,48,48,0.12)',
          borderWidth:2,pointRadius:0,fill:true,tension:.15,order:3
        },
        {
          type:'line',label:`vybráno: T ≈ ${f6(bestPeriod)}`,
          data:[{x:nearest.period,y:yMin},{x:nearest.period,y:yMax}],
          borderColor:'#4a9eff',borderWidth:2,borderDash:[6,4],pointRadius:0,fill:false,order:1
        },
        {
          label:'vybraná perioda',
          type:'scatter',
          data:[{x:nearest.period, y:nearest.r2}],
          backgroundColor:'#c83030',borderColor:'#fff',borderWidth:2,pointRadius:7,pointStyle:'circle',order:0
        }
      ]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      scales:{
        x:{type:'linear',title:{display:true,text:'Perioda',color:c.text},ticks:{color:c.text},grid:{color:c.grid}},
        y:{title:{display:true,text:'R²',color:c.text},ticks:{color:c.text},grid:{color:c.grid}}
      },
      plugins:{legend:{labels:{color:c.text,usePointStyle:true,pointStyle:'circle'}}}
    }
  });
}

function closePeriodogram(){
  document.getElementById('periodogram-overlay').style.display='none';
  document.body.style.overflow='';
}

function openResiduals(){
  const overlay=document.getElementById('residuals-overlay');
  const canvas=document.getElementById('residuals-canvas');
  overlay.style.display='flex';
  document.body.style.overflow='hidden';

  const r=lastFourierResult;
  if(residualsChart){ residualsChart.destroy(); residualsChart=null; }
  if(!r || !r.yp){ return; }

  const {x,y}=getTableData();
  const resid=x.map((xi,i)=>({x:xi,y:y[i]-r.yp[i]}));
  const xMin=Math.min(...x), xMax=Math.max(...x);
  const c=chartColors();

  residualsChart=new Chart(canvas.getContext('2d'), {
    type:'scatter',
    data:{
      datasets:[
        {
          label:'rezidua',
          data:resid,
          backgroundColor:'#4a9eff',borderColor:'rgba(255,255,255,.7)',borderWidth:1.5,pointRadius:5
        },
        {
          type:'line',label:'nula',
          data:[{x:xMin,y:0},{x:xMax,y:0}],
          borderColor:'rgba(200,48,48,.6)',borderWidth:1.5,borderDash:[6,4],pointRadius:0,fill:false
        }
      ]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      scales:{
        x:{type:'linear',title:{display:true,text:axisLabels.x,color:c.text},ticks:{color:c.text},grid:{color:c.grid}},
        y:{title:{display:true,text:'naměřeno − fit',color:c.text},ticks:{color:c.text},grid:{color:c.grid}}
      },
      plugins:{legend:{labels:{color:c.text,usePointStyle:true,pointStyle:'circle'}}}
    }
  });
}

function closeResiduals(){
  document.getElementById('residuals-overlay').style.display='none';
  document.body.style.overflow='';
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeNavod(); });

async function loadNavod() {
  const el = document.getElementById('navod-content');
  try {
    const r = await fetch(NAVOD_URL);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const md = await r.text();
    const renderer = new marked.Renderer();
    renderer.image = (href, title, text) => {
      const src = typeof href === 'object' ? href.href : href;
      return `<img src="${src}" alt="${text||''}" style="max-width:100%;display:block;margin:.5em 0;">`;
    };
    marked.setOptions({ breaks: true, renderer });
    el.innerHTML = marked.parse(md);
    // render KaTeX
    if (window.renderMathInElement) {
      renderMathInElement(el, {
        delimiters: [
          {left:'$$', right:'$$', display:true},
          {left:'$',  right:'$',  display:false}
        ],
        throwOnError: false
      });
    }
    navodLoaded = true;
  } catch(e) {
    el.innerHTML = '<p style="color:var(--text-muted);text-align:center;">Dokumentaci se nepodařilo načíst.<br>Zkontroluj připojení k internetu.</p>';
  }
}

/* ══════════════════════════════════════════════
   PRŮVODCE VLOŽENÍM DAT
══════════════════════════════════════════════ */
let advParsed = null; // { headers: bool, data: string[][] (rows×cols) }
let advSelX = null, advSelY = null; // index vybraného sloupce/řádku
let advFileName = null;

function advLoadFile(input){
  const file = input.files[0];
  if(!file) return;
  advFileName = file.name;
  input.value = '';
  const reader = new FileReader();
  reader.onload = e => {
    advParsed = advParse(e.target.result);
    advSelX = null; advSelY = null;
    advRender();
    const ov = document.getElementById('adv-overlay');
    ov.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  };
  reader.readAsText(file);
}

function closeAdv(){
  document.getElementById('adv-overlay').style.display = 'none';
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e => { if(e.key==='Escape') closeAdv(); });

function advSplitLine(line){
  if(line.includes('\t')) return line.split('\t').map(s=>s.trim());
  if(line.includes(';'))  return line.split(';').map(s=>s.trim());
  if(line.includes(','))  return line.split(',').map(s=>s.trim());
  return line.split(/\s+/).filter(s=>s!=='');
}

function advParse(text){
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(l=>l&&!l.startsWith('#'));
  if(!lines.length) return null;
  const rows = lines.map(l=>advSplitLine(l));
  return { rows };
}

function advHasHeader(rows, orient){
  if(orient === 'cols'){
    // záhlaví = první řádek obsahuje aspoň jednu nenumerickou hodnotu
    return rows[0].some(v => isNaN(v.replace(',','.')));
  } else {
    // záhlaví = první sloupec obsahuje aspoň jednu nenumerickou hodnotu
    return rows.some(r => isNaN((r[0]||'').replace(',','.')));
  }
}

function advGetOrient(){
  return document.querySelector('input[name="adv-orient"]:checked').value;
}

function advIsNum(v){ return !isNaN(v.replace(',','.')); }

function advRender(){
  if(!advParsed) return;
  advSelX = null; advSelY = null;
  updateAdvConfirm();

  const orient = advGetOrient();
  const { rows } = advParsed;
  const hasHeader = advHasHeader(rows, orient);
  const PREVIEW = 20;
  const tbl = document.getElementById('adv-table');
  tbl.innerHTML = '';

  if(orient === 'cols'){
    document.getElementById('adv-hint').innerHTML = 'Klikni na záhlaví sloupce pro výběr jako <b>x</b> nebo <b>y</b>';
    // Sloupce: klikáme na záhlaví (th v prvním řádku)
    const colCount = Math.max(...rows.map(r=>r.length));
    const thead = tbl.createTHead();
    const hrtr = thead.insertRow();

    // rohová buňka
    const corner = document.createElement('th');
    corner.style.cssText = 'padding:5px 8px;border:1px solid var(--border);background:var(--surface2);color:var(--text-muted);font-size:11px;';
    corner.textContent = '#';
    hrtr.appendChild(corner);

    for(let c=0; c<colCount; c++){
      const th = document.createElement('th');
      const label = hasHeader ? (rows[0][c]||'') : `Sloupec ${c+1}`;
      th.textContent = label;
      th.dataset.col = c;
      th.style.cssText = 'padding:6px 10px;border:1px solid var(--border);background:var(--surface2);cursor:pointer;white-space:nowrap;font-size:12.5px;color:var(--text);transition:background .1s;';
      th.title = 'Klikni pro výběr jako x nebo y';
      th.onmouseenter = ()=>{ if(th.dataset.col!=advSelX && th.dataset.col!=advSelY) th.style.background='var(--btn-h)'; };
      th.onmouseleave = ()=>{ advColorCol(parseInt(th.dataset.col)); };
      th.onclick = ()=> advClickCol(parseInt(th.dataset.col));
      hrtr.appendChild(th);
    }

    const tbody = tbl.createTBody();
    const dataRows = hasHeader ? rows.slice(1) : rows;
    const shown = dataRows.slice(0, PREVIEW);
    shown.forEach((row, ri)=>{
      const tr = tbody.insertRow();
      const numTd = tr.insertCell();
      numTd.textContent = ri+1;
      numTd.style.cssText = 'padding:4px 8px;border:1px solid var(--border);color:var(--text-muted);font-size:11px;text-align:right;';
      for(let c=0; c<colCount; c++){
        const td = tr.insertCell();
        td.textContent = row[c]||'';
        td.dataset.col = c;
        td.style.cssText = 'padding:4px 8px;border:1px solid var(--border);color:var(--text);';
      }
    });

    const note = document.getElementById('adv-truncnote');
    if(dataRows.length > PREVIEW){
      note.style.display='block';
      note.textContent = `Zobrazeno prvních ${PREVIEW} z ${dataRows.length} datových řádků.`;
    } else { note.style.display='none'; }

  } else {
    // Řádky: klikáme na první buňku řádku (záhlaví řádku)
    const colCount = Math.max(...rows.map(r=>r.length));
    const startCol = hasHeader ? 1 : 0;
    const warnEl = document.getElementById('adv-hint');
    warnEl.innerHTML = 'Klikni na záhlaví řádku pro výběr jako <b>x</b> nebo <b>y</b>';

    const tbody = tbl.createTBody();
    const shown = rows.slice(0, PREVIEW+1);
    shown.forEach((row, ri)=>{
      const isHeaderRow = (ri===0 && hasHeader);
      const tr = tbody.insertRow();
      tr.dataset.row = ri;

      const th = document.createElement('th');
      const label = hasHeader ? (row[0]||`Řádek ${ri}`) : `Řádek ${ri+1}`;
      th.textContent = isHeaderRow ? '↳ záhlaví' : label;
      th.dataset.row = ri;
      th.style.cssText = `padding:6px 10px;border:1px solid var(--border);background:var(--surface2);
        cursor:${isHeaderRow?'default':'pointer'};white-space:nowrap;font-size:12.5px;color:${isHeaderRow?'var(--text-muted)':'var(--text)'};
        text-align:left;font-weight:600;transition:background .1s;`;
      if(!isHeaderRow){
        th.title = 'Klikni pro výběr jako x nebo y';
        th.onmouseenter = ()=>{ if(ri!=advSelX && ri!=advSelY) th.style.background='var(--btn-h)'; };
        th.onmouseleave = ()=>{ advColorRow(ri); };
        th.onclick = ()=> advClickRow(ri);
      }
      tr.appendChild(th);

      const startCol = hasHeader ? 1 : 0;
      const colsToShow = Math.min(row.length, startCol+20);
      for(let c=startCol; c<colsToShow; c++){
        const td = tr.insertCell();
        td.textContent = row[c]||'';
        td.dataset.row = ri;
        td.style.cssText = `padding:4px 8px;border:1px solid var(--border);color:${isHeaderRow?'var(--text-muted)':'var(--text)'};`;
      }
    });

    const note = document.getElementById('adv-truncnote');
    const total = rows.length - (hasHeader?1:0);
    if(total > PREVIEW){
      note.style.display='block';
      note.textContent = `Zobrazeno prvních ${PREVIEW} z ${total} datových řádků.`;
    } else { note.style.display='none'; }
  }
}

function advClickCol(c){
  if(advSelX === null){ advSelX = c; }
  else if(advSelY === null && c !== advSelX){ advSelY = c; }
  else if(c === advSelX){ advSelX = advSelY; advSelY = null; }
  else if(c === advSelY){ advSelY = null; }
  else { advSelY = c; }
  advColorAllCols();
  updateAdvConfirm();
}

function advColorCol(c){
  const tbl = document.getElementById('adv-table');
  const isX = (c == advSelX), isY = (c == advSelY);
  tbl.querySelectorAll(`[data-col="${c}"]`).forEach(el=>{
    if(el.tagName==='TH'){
      el.style.background = isX ? 'rgba(74,158,255,.25)' : isY ? 'rgba(76,222,140,.25)' : 'var(--surface2)';
      el.style.color = isX ? 'var(--accent)' : isY ? 'var(--success)' : 'var(--text)';
    } else {
      el.style.background = isX ? 'rgba(74,158,255,.08)' : isY ? 'rgba(76,222,140,.08)' : '';
    }
  });
}

function advColorAllCols(){
  if(!advParsed) return;
  const colCount = Math.max(...advParsed.rows.map(r=>r.length));
  for(let c=0; c<colCount; c++) advColorCol(c);
}

function advClickRow(ri){
  if(advSelX === null){ advSelX = ri; }
  else if(advSelY === null && ri !== advSelX){ advSelY = ri; }
  else if(ri === advSelX){ advSelX = advSelY; advSelY = null; }
  else if(ri === advSelY){ advSelY = null; }
  else { advSelY = ri; }
  advColorAllRows();
  updateAdvConfirm();
}

function advColorRow(ri){
  const tbl = document.getElementById('adv-table');
  const isX = (ri == advSelX), isY = (ri == advSelY);
  tbl.querySelectorAll(`[data-row="${ri}"]`).forEach(el=>{
    if(el.tagName==='TH'){
      el.style.background = isX ? 'rgba(74,158,255,.25)' : isY ? 'rgba(76,222,140,.25)' : 'var(--surface2)';
      el.style.color = isX ? 'var(--accent)' : isY ? 'var(--success)' : 'var(--text)';
    } else {
      el.style.background = isX ? 'rgba(74,158,255,.08)' : isY ? 'rgba(76,222,140,.08)' : '';
    }
  });
}

function advColorAllRows(){
  if(!advParsed) return;
  advParsed.rows.forEach((_,ri)=>advColorRow(ri));
}

function updateAdvConfirm(){
  const btn = document.getElementById('adv-confirm');
  const info = document.getElementById('adv-selection-info');
  const ready = advSelX !== null && advSelY !== null;
  btn.disabled = !ready;
  btn.style.opacity = ready ? '.85' : '.4';
  if(advSelX === null && advSelY === null)
    info.innerHTML = '<span style="color:var(--text-muted)">Zatím nevybráno</span>';
  else if(advSelX !== null && advSelY === null)
    info.innerHTML = `<span style="color:var(--accent)">■ x vybráno</span> &nbsp; <span style="color:var(--text-muted)">■ y — klikni na další</span>`;
  else
    info.innerHTML = `<span style="color:var(--accent)">■ x vybráno</span> &nbsp; <span style="color:var(--success)">■ y vybráno</span>`;
}

function advConfirm(){
  if(advSelX === null || advSelY === null) return;
  const orient = advGetOrient();
  const { rows } = advParsed;
  const hasHeader = advHasHeader(rows, orient);

  let xVals=[], yVals=[], labelX='x', labelY='y';

  if(orient === 'cols'){
    if(hasHeader){
      labelX = rows[0][advSelX] || 'x';
      labelY = rows[0][advSelY] || 'y';
    }
    const dataRows = hasHeader ? rows.slice(1) : rows;
    dataRows.forEach(row=>{
      const xv = parseFloat((row[advSelX]||'').replace(',','.'));
      const yv = parseFloat((row[advSelY]||'').replace(',','.'));
      if(!isNaN(xv)&&!isNaN(yv)){ xVals.push(xv); yVals.push(yv); }
    });
  } else {
    const xRow = rows[advSelX], yRow = rows[advSelY];
    const startCol = hasHeader ? 1 : 0;
    if(hasHeader){
      labelX = xRow[0] || 'x';
      labelY = yRow[0] || 'y';
    }
    const len = Math.min(xRow.length, yRow.length);
    for(let c=startCol; c<len; c++){
      const xv = parseFloat((xRow[c]||'').replace(',','.'));
      const yv = parseFloat((yRow[c]||'').replace(',','.'));
      if(!isNaN(xv)&&!isNaN(yv)){ xVals.push(xv); yVals.push(yv); }
    }
  }

  if(!xVals.length){ alert('Nepodařilo se načíst žádná data. Zkontroluj výběr.'); return; }

  // Naplnit tabulku — stejná logika jako parseAndFill
  axisLabels = { x: labelX, y: labelY };
  axisLabelsFromFile = hasHeader;
  const lx=document.getElementById('label-x'), ly=document.getElementById('label-y');
  if(lx) lx.value=labelX;
  if(ly) ly.value=labelY;

  const tb=document.getElementById('tbody');
  tb.innerHTML='';
  regressionOn=false;
  const _br=document.getElementById('btn-regrese');
  if(_br){_br.style.color='var(--text)';_br.style.opacity='.6';_br.title='Spustit analýzu';}
  const _eq=document.getElementById('resEq'); if(_eq) _eq.textContent='—';
  document.getElementById('resParams').textContent='';

  xVals.forEach((xv,i)=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td class="row-num">${i+1}</td>
      <td><input type="checkbox" checked onchange="autoRecompute()"></td>
      <td><input class="cell" type="text" value="${xv}" data-r="${i}" data-c="x"
                 onkeydown="handleKey(event,${i},'x')" oninput="autoRecompute()"></td>
      <td><input class="cell" type="text" value="${yVals[i]}" data-r="${i}" data-c="y"
                 onkeydown="handleKey(event,${i},'y')" oninput="autoRecompute()"></td>`;
    tb.appendChild(tr);
  });
  addRow();
  updateMasterCheckbox();
  if(advFileName){ datasets[activeDatasetIdx].fileLabel=advFileName; renderTabsUI(); }
  showPointsOnly();
  document.getElementById('resEq').innerHTML=
    `<span style="color:var(--success)">${okIconSvg()} Načteno ${xVals.length} bodů · osy: ${escapeHtmlAttr(labelX)}, ${escapeHtmlAttr(labelY)}</span>`;

  closeAdv();
}

applyTheme(false);
initTable();
updateGeneralEq();
