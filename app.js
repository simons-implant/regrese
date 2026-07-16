
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

function makeEmptyDataset(name){
  return {
    name, fileLabel:null,
    tableRows:[],
    xLabel:'x', yLabel:'y',
    regressionType:'linear', regressionOn:false, showCI:false,
    fourierHarmonics:3, fourierAutoHarmonics:true,
    fourierManualPeriodOn:false, fourierManualPeriod:null,
    hiddenSeries:{data:false, excl:false, fit:false, ci:false},
    customFormula:null,
    lastResult:null, x:[], y:[], excl:[]
  };
}

function escapeHtmlAttr(s){
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
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
    html+=`<div class="ds-tab${i===activeDatasetIdx?' active':''}" onclick="switchDataset(${i})" title="${label.replace(/"/g,'&quot;')}">`
        + `<span class="ds-dot" style="background:${col.point};"></span>`
        + `<span class="ds-label">${label}</span>`
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
      customFormula:ds.customFormula||null
    }))
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
    customFormula:d.customFormula||null
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
    if(err){ err.textContent='⚠ '+e.message; err.style.display='block'; }
  }
}

function confirmCustomFormula(){
  const input=document.getElementById('custom-formula-input');
  const raw=(input?.value||'').trim();
  const err=document.getElementById('custom-formula-error');
  if(!raw){ if(err){err.textContent='⚠ Zadej prosím nějakou rovnici.'; err.style.display='block';} return; }
  try{
    const {paramNames}=buildCustomFitter(raw);
    if(paramNames.length===0){
      if(err){ err.textContent='⚠ Rovnice neobsahuje žádný parametr k fitování (jen x).'; err.style.display='block'; }
      return;
    }
  }catch(e){
    if(err){ err.textContent='⚠ '+e.message; err.style.display='block'; }
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
      <button class="eq-remove" onclick="event.stopPropagation(); removeCustomEquation('${eq.id}')" title="Odebrat rovnici">🗑️</button>
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
  if(!raw){ if(err){err.textContent='⚠ Nejdřív napiš rovnici.'; err.style.display='block';} return; }
  try{
    const {paramNames}=buildCustomFitter(raw);
    if(paramNames.length===0){
      if(err){ err.textContent='⚠ Rovnice neobsahuje žádný parametr k fitování (jen x).'; err.style.display='block'; }
      return;
    }
  }catch(e){
    if(err){ err.textContent='⚠ '+e.message; err.style.display='block'; }
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








function computeRegression(){
  const {x,y,excl}=getTableData();
  const eqEl=document.getElementById('resEq');
  const pmEl=document.getElementById('resParams');
  const ds=datasets[activeDatasetIdx];
  ds.x=x; ds.y=y; ds.excl=excl;

  if(x.length<2){
    eqEl.innerHTML='<span class="err">❗ Zadejte alespoň 2 zaškrtnuté body.</span>';
    pmEl.innerHTML='';
    ds.lastResult=null;
    renderCombinedChart();
    return;
  }

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
    eqEl.innerHTML=`<span class="err">❗ ${err.message}</span>`;
    pmEl.innerHTML='';
    ds.lastResult=null;
    renderCombinedChart();
    return;
  }

  displayResults(result, x.length, x.length+excl.length);
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

function clearChart(){
  if(chartInst){chartInst.destroy();chartInst=null;}
  const c=chartColors();
  const canvas=document.getElementById('myChart');
  const ctx=canvas.getContext('2d');
  ctx.fillStyle=c.bg;
  ctx.fillRect(0,0,canvas.width,canvas.height);
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

function renderCombinedChart(){
  renderTabsUI();
  if(chartInst){chartInst.destroy();chartInst=null;}

  const activeDatasets=datasets
    .map((ds,i)=>({ds,i}))
    .filter(({ds})=>ds.x.length>0||ds.excl.length>0);

  if(!activeDatasets.length){ clearChart(); return; }

  const multi=activeDatasets.length>1;
  const combinedDatasets=[];

  activeDatasets.forEach(({ds,i})=>{
    const col=DATASET_COLORS[i%DATASET_COLORS.length];
    const suffix=multi ? ` (${ds.name})` : '';
    const {x,y,excl,lastResult:result}=ds;
    if(!ds.hiddenSeries) ds.hiddenSeries={data:false,excl:false,fit:false,ci:false};

    if(excl.length>0){
      combinedDatasets.push({
        type:'scatter',label:`Vyloučeno${suffix} (${excl.length})`,
        data:excl.map(p=>({x:p[0],y:p[1]})),
        backgroundColor:'transparent',borderColor:col.excl,
        pointStyle:'circle',pointRadius:6,pointBorderWidth:2,order:3,
        _dsIdx:i,_kind:'excl',hidden:!!ds.hiddenSeries.excl
      });
    }

    if(x.length>0){
      combinedDatasets.push({
        type:'scatter',label:`Data${suffix}`,
        data:x.map((xi,idx)=>({x:xi,y:y[idx]})),
        backgroundColor:col.point,borderColor:'rgba(255,255,255,.7)',
        borderWidth:1.5,pointRadius:6,order:3,
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
        y:{type:'linear',
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
  if(lbl){ lbl.textContent='📄 '+file.name; lbl.style.display='block'; }
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
    `<span style="color:var(--success)">✅ Načteno ${rows.length} bodů${dataStart?` · osy: ${headerX}, ${headerY}`:''}</span>`;
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

function saveGraph(){
  if(!lastResult||!lastData){alert('Nejprve proveďte regresi.');return;}
  const {x,y,excl}=lastData, result=lastResult;
  const col=DATASET_COLORS[activeDatasetIdx%DATASET_COLORS.length];

  // Přečti viditelnost datasetů z aktuálního grafu
  const visibility = chartInst
    ? chartInst.data.datasets.map((_,i)=>chartInst.isDatasetVisible(i))
    : [];

  // 2× rozlišení pro ostrost
  const tmp=document.createElement('canvas');
  tmp.width=2700; tmp.height=1800;
  document.body.appendChild(tmp);

  const lc={bg:'#fafafa',grid:'rgba(0,0,0,.07)',tick:'#33334a',axis:'#cccccc'};

  const xMin=Math.min(...x),xMax=Math.max(...x);
  const step=(xMax-xMin)/399||1;
  const xSmooth=Array.from({length:400},(_,i)=>xMin+i*step);
  let ySmooth;
  try{ySmooth=xSmooth.map(result.smooth);}catch(e){ySmooth=xSmooth.map(()=>NaN);}

  // Sestavuj datasety ve stejném pořadí jako v živém grafu
  const allDs=[];
  if(excl.length>0) allDs.push({
    type:'scatter',label:`Vyloučeno (${excl.length})`,
    data:excl.map(p=>({x:p[0],y:p[1]})),
    backgroundColor:'transparent',borderColor:col.excl,
    pointStyle:'circle',pointRadius:18,pointBorderWidth:4,order:1
  });
  allDs.push({
    type:'scatter',label:'Data',
    data:x.map((xi,i)=>({x:xi,y:y[i]})),
    backgroundColor:col.point,borderColor:'rgba(0,0,0,.25)',
    borderWidth:4,pointRadius:18,order:2
  });
  allDs.push({
    type:'line',label:'fit',
    data:xSmooth.map((xi,i)=>({x:xi,y:ySmooth[i]})),
    borderColor:col.fit,borderWidth:7,pointRadius:0,fill:false,tension:0,order:3
  });

  // CI pás — stejný výpočet jako v renderCombinedChart
  if(showCI && result.yp){
    const n=x.length;
    const p = result.type==='polynomial'?3 : result.type==='gaussian'?4 :
              result.type==='gaussian2'?7 : result.type==='gaussian3'?10 :
              result.type==='rational'?3 : 2;
    const rmse=Math.sqrt(result.yp.reduce((s,ypi,i)=>s+(y[i]-ypi)**2,0)/Math.max(n-p,1));
    const tCrit = n>30 ? 1.96 : n>10 ? 2.228 : 2.776;
    let ciUpper, ciLower;
    if(result.type==='linear'){
      const xMean=x.reduce((s,v)=>s+v,0)/n;
      const Sxx=x.reduce((s,v)=>s+(v-xMean)**2,0);
      ciUpper=xSmooth.map((xi,i)=>({x:xi,y:ySmooth[i]+tCrit*rmse*Math.sqrt(1/n+((xi-xMean)**2)/Sxx)}));
      ciLower=xSmooth.map((xi,i)=>({x:xi,y:ySmooth[i]-tCrit*rmse*Math.sqrt(1/n+((xi-xMean)**2)/Sxx)}));
    } else if(result.type==='fourier' && result.covMatrix && result.jacFn){
      const cov=result.covMatrix;
      const seY=xSmooth.map(xi=>{
        const jv=result.jacFn(xi);
        let s2=0;
        for(let i=0;i<jv.length;i++) for(let j=0;j<jv.length;j++) s2+=jv[i]*cov[i][j]*jv[j];
        return Math.sqrt(Math.max(0,s2));
      });
      ciUpper=xSmooth.map((xi,i)=>({x:xi,y:ySmooth[i]+tCrit*seY[i]}));
      ciLower=xSmooth.map((xi,i)=>({x:xi,y:ySmooth[i]-tCrit*seY[i]}));
    } else {
      ciUpper=xSmooth.map((xi,i)=>({x:xi,y:ySmooth[i]+tCrit*rmse}));
      ciLower=xSmooth.map((xi,i)=>({x:xi,y:ySmooth[i]-tCrit*rmse}));
    }
    allDs.push({
      type:'line',label:'IS 95 %',data:ciUpper,
      borderColor:col.ciBorder,backgroundColor:col.ciBg,
      borderWidth:1,borderDash:[4,3],pointRadius:0,fill:'+1',tension:0,order:4,
      pointStyle:'rect'
    });
    allDs.push({
      type:'line',label:'_ciLower',data:ciLower,
      borderColor:col.ciBorder,backgroundColor:col.ciBg,
      borderWidth:1,borderDash:[4,3],pointRadius:0,fill:false,tension:0,order:5
    });
  }

  // Aplikuj viditelnost — skryté datasety úplně vynech
  const ds=allDs.filter((d,i)=>!(visibility.length>i && !visibility[i]));

  const ec=new Chart(tmp,{
    type:'scatter',data:{datasets:ds},
    options:{
      responsive:false,animation:false,
      scales:{
        x:{type:'linear',grid:{color:lc.grid},
           ticks:{color:lc.tick,font:{family:'Fira Code',size:33}},
           border:{color:lc.axis},
           title:{display:true,text:axisLabels.x,color:lc.tick,font:{family:'Sora',size:36}}},
        y:{type:'linear',grid:{color:lc.grid},
           ticks:{color:lc.tick,font:{family:'Fira Code',size:33}},
           border:{color:lc.axis},
           title:{display:true,text:axisLabels.y,color:lc.tick,font:{family:'Sora',size:36}}}
      },
      plugins:{
        legend:{labels:{color:lc.tick,usePointStyle:true,
                        font:{family:'Sora',size:33},boxWidth:30,padding:42,
                        filter:item=>item.text!=='_ciLower'}},
        tooltip:{enabled:false}
      }
    },
    plugins:[{id:'bg',beforeDraw(ch){
      const{ctx:c2,chartArea:ca}=ch;
      if(!ca) return;
      c2.save();c2.fillStyle='#ffffff';
      c2.fillRect(0,0,tmp.width,tmp.height);
      c2.restore();
    }}]
  });

  setTimeout(()=>{
    const a=document.createElement('a');
    a.href=tmp.toDataURL('image/png');
    a.download='regrese.png';
    a.click();
    ec.destroy();
    document.body.removeChild(tmp);
  },120);
}

function saveGraphAll(){
  const activeDatasets=datasets
    .map((ds,i)=>({ds,i}))
    .filter(({ds})=>ds.x.length>0||ds.excl.length>0);
  if(activeDatasets.length<2){ alert('Pro export všech dat najednou potřebuješ alespoň 2 sady dat s daty.'); return; }

  const multi=true;
  const tmp=document.createElement('canvas');
  tmp.width=2700; tmp.height=1800;
  document.body.appendChild(tmp);
  const lc={bg:'#fafafa',grid:'rgba(0,0,0,.07)',tick:'#33334a',axis:'#cccccc'};

  const allDs=[];
  activeDatasets.forEach(({ds,i})=>{
    const col=DATASET_COLORS[i%DATASET_COLORS.length];
    const suffix=` (${ds.name})`;
    const {x,y,excl,lastResult:result}=ds;

    if(excl.length>0) allDs.push({
      type:'scatter',label:`Vyloučeno${suffix} (${excl.length})`,
      data:excl.map(p=>({x:p[0],y:p[1]})),
      backgroundColor:'transparent',borderColor:col.excl,
      pointStyle:'circle',pointRadius:18,pointBorderWidth:4,order:1
    });
    if(x.length>0) allDs.push({
      type:'scatter',label:`Data${suffix}`,
      data:x.map((xi,k)=>({x:xi,y:y[k]})),
      backgroundColor:col.point,borderColor:'rgba(0,0,0,.25)',
      borderWidth:4,pointRadius:18,order:2
    });
    if(result && x.length>0){
      const xMin=Math.min(...x), xMax=Math.max(...x);
      const step=(xMax-xMin)/399||1;
      const xSmooth=Array.from({length:400},(_,k)=>xMin+k*step);
      let ySmooth;
      try{ ySmooth=xSmooth.map(result.smooth); }catch(e){ ySmooth=xSmooth.map(()=>NaN); }
      allDs.push({
        type:'line',label:`fit${suffix}`,
        data:xSmooth.map((xi,k)=>({x:xi,y:ySmooth[k]})),
        borderColor:col.fit,borderWidth:7,pointRadius:0,fill:false,tension:0,order:3
      });
      const dsUseCI=(i===activeDatasetIdx)?showCI:ds.showCI;
      const ci=buildCiBand(result,x,y,xSmooth,ySmooth,dsUseCI);
      if(ci){
        allDs.push({
          type:'line',label:`IS 95 %${suffix}`,data:ci.upper,
          borderColor:col.ciBorder,backgroundColor:col.ciBg,
          borderWidth:1,borderDash:[4,3],pointRadius:0,fill:'+1',tension:0,order:4,
          pointStyle:'rect'
        });
        allDs.push({
          type:'line',label:`_ciLower${suffix}`,data:ci.lower,
          borderColor:col.ciBorder,backgroundColor:col.ciBg,
          borderWidth:1,borderDash:[4,3],pointRadius:0,fill:false,tension:0,order:5
        });
      }
    }
  });

  const activeLabels=datasets[activeDatasetIdx];
  const ec=new Chart(tmp,{
    type:'scatter',data:{datasets:allDs},
    options:{
      responsive:false,animation:false,
      scales:{
        x:{type:'linear',grid:{color:lc.grid},
           ticks:{color:lc.tick,font:{family:'Fira Code',size:33}},
           border:{color:lc.axis},
           title:{display:true,text:activeLabels.xLabel,color:lc.tick,font:{family:'Sora',size:36}}},
        y:{type:'linear',grid:{color:lc.grid},
           ticks:{color:lc.tick,font:{family:'Fira Code',size:33}},
           border:{color:lc.axis},
           title:{display:true,text:activeLabels.yLabel,color:lc.tick,font:{family:'Sora',size:36}}}
      },
      plugins:{
        legend:{labels:{color:lc.tick,usePointStyle:true,
                        font:{family:'Sora',size:30},boxWidth:28,padding:36,
                        filter:item=>!item.text.startsWith('_ciLower')}},
        tooltip:{enabled:false}
      }
    },
    plugins:[{id:'bg',beforeDraw(ch){
      const{ctx:c2,chartArea:ca}=ch;
      if(!ca) return;
      c2.save();c2.fillStyle='#ffffff';
      c2.fillRect(0,0,tmp.width,tmp.height);
      c2.restore();
    }}]
  });

  setTimeout(()=>{
    const a=document.createElement('a');
    a.href=tmp.toDataURL('image/png');
    a.download='regrese_vsechna_data.png';
    a.click();
    ec.destroy();
    document.body.removeChild(tmp);
  },120);
}

/* ══════════════════════════════════════════════
   SVG EXPORT
══════════════════════════════════════════════ */
function saveGraphSVG(){
  const {x,y,excl}=lastData, result=lastResult;
  const visibility=chartInst?chartInst.data.datasets.map((_,i)=>chartInst.isDatasetVisible(i)):[];
  const col=DATASET_COLORS[activeDatasetIdx%DATASET_COLORS.length];

  const W=900,H=600,ml=60,mr=30,mt=20,mb=60;
  const pw=W-ml-mr, ph=H-mt-mb;

  const allXvals=[...x,...excl.map(p=>p[0])];
  const allYvals=[...y,...excl.map(p=>p[1])];
  // Použij rozsahy přímo z živého grafu — stejné jako co vidí uživatel
  const xMin=chartInst.scales.x.min, xMax=chartInst.scales.x.max;
  const yMin=chartInst.scales.y.min, yMax=chartInst.scales.y.max;
  // Křivka jen přes zahrnuté body
  const xSmoothMin=Math.min(...x), xSmoothMax=Math.max(...x);
  const step=(xSmoothMax-xSmoothMin)/399||1;
  const xSmooth=Array.from({length:400},(_,i)=>xSmoothMin+i*step);
  let ySmooth;
  try{ySmooth=xSmooth.map(result.smooth);}catch(e){ySmooth=xSmooth.map(()=>NaN);}
  const yRange=yMax-yMin||1, xRange=xMax-xMin||1;

  const px=v=>ml+(v-xMin)/xRange*pw;
  const py=v=>mt+ph-(v-yMin)/yRange*ph;

  // Build dataset list matching live chart order
  const datasets=[];
  if(excl.length>0) datasets.push({type:'excl',pts:excl});
  datasets.push({type:'data',pts:x.map((xi,i)=>[xi,y[i]])});
  datasets.push({type:'line',pts:xSmooth.map((xi,i)=>[xi,ySmooth[i]])});

  // CI pro SVG — zobraz jen pokud je pro tuto (aktivní) záložku zapnuté IS 95%
  const ciVisible=showCI;
  let ciSVG=null;
  if(ciVisible && result.yp){
    const n=x.length;
    const p=result.type==='polynomial'?3:result.type==='gaussian'?4:result.type==='gaussian2'?7:result.type==='gaussian3'?10:result.type==='rational'?3:2;
    const rmse=Math.sqrt(result.yp.reduce((s,ypi,i)=>s+(y[i]-ypi)**2,0)/Math.max(n-p,1));
    const tCrit=n>30?1.96:n>10?2.228:2.776;
    let upper,lower;
    if(result.type==='linear'){
      const xMean=x.reduce((s,v)=>s+v,0)/n;
      const Sxx=x.reduce((s,v)=>s+(v-xMean)**2,0);
      upper=xSmooth.map((xi,i)=>[xi,ySmooth[i]+tCrit*rmse*Math.sqrt(1/n+((xi-xMean)**2)/Sxx)]);
      lower=xSmooth.map((xi,i)=>[xi,ySmooth[i]-tCrit*rmse*Math.sqrt(1/n+((xi-xMean)**2)/Sxx)]);
    } else if(result.type==='fourier' && result.covMatrix && result.jacFn){
      const cov=result.covMatrix;
      const seY=xSmooth.map(xi=>{
        const jv=result.jacFn(xi);
        let s2=0;
        for(let i=0;i<jv.length;i++) for(let j=0;j<jv.length;j++) s2+=jv[i]*cov[i][j]*jv[j];
        return Math.sqrt(Math.max(0,s2));
      });
      upper=xSmooth.map((xi,i)=>[xi,ySmooth[i]+tCrit*seY[i]]);
      lower=xSmooth.map((xi,i)=>[xi,ySmooth[i]-tCrit*seY[i]]);
    } else {
      upper=xSmooth.map((xi,i)=>[xi,ySmooth[i]+tCrit*rmse]);
      lower=xSmooth.map((xi,i)=>[xi,ySmooth[i]-tCrit*rmse]);
    }
    ciSVG={upper,lower};
  }

  let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="'Sora',sans-serif">`;
  svg+=`<rect width="${W}" height="${H}" fill="#ffffff"/>`;
  svg+=`<rect x="${ml}" y="${mt}" width="${pw}" height="${ph}" fill="#fafafa"/>`;

  // Grid lines (5 each)
  for(let i=0;i<=5;i++){
    const gy=mt+i*ph/5;
    const gx=ml+i*pw/5;
    svg+=`<line x1="${ml}" y1="${gy}" x2="${ml+pw}" y2="${gy}" stroke="rgba(0,0,0,0.07)" stroke-width="1"/>`;
    svg+=`<line x1="${gx}" y1="${mt}" x2="${gx}" y2="${mt+ph}" stroke="rgba(0,0,0,0.07)" stroke-width="1"/>`;
    // Tick labels
    const yVal=(yMin+((5-i)/5)*yRange).toPrecision(4);
    const xVal=(xMin+(i/5)*xRange).toPrecision(4);
    svg+=`<text x="${ml-6}" y="${gy+4}" text-anchor="end" font-size="11" fill="#444456" font-family="'Fira Code',monospace">${yVal}</text>`;
    svg+=`<text x="${gx}" y="${mt+ph+16}" text-anchor="middle" font-size="11" fill="#444456" font-family="'Fira Code',monospace">${xVal}</text>`;
  }

  // Axes
  svg+=`<line x1="${ml}" y1="${mt}" x2="${ml}" y2="${mt+ph}" stroke="#cccccc" stroke-width="1.5"/>`;
  svg+=`<line x1="${ml}" y1="${mt+ph}" x2="${ml+pw}" y2="${mt+ph}" stroke="#cccccc" stroke-width="1.5"/>`;

  // Axis labels
  svg+=`<text x="${ml+pw/2}" y="${H-8}" text-anchor="middle" font-size="12" fill="#444456">${axisLabels.x}</text>`;
  svg+=`<text x="14" y="${mt+ph/2}" text-anchor="middle" font-size="12" fill="#444456" transform="rotate(-90,14,${mt+ph/2})">${axisLabels.y}</text>`;

  // Datasets
  // Nejdřív CI pás (pod křivkou)
  if(ciSVG){
    // Ořízni body na oblast grafu
    const clip=([xi,yi])=>[
      Math.max(ml, Math.min(ml+pw, px(xi))),
      Math.max(mt, Math.min(mt+ph, py(yi)))
    ];
    const uPts=ciSVG.upper.filter(p=>isFinite(p[1])).map(clip);
    const lPts=ciSVG.lower.filter(p=>isFinite(p[1])).map(clip).reverse();
    if(uPts.length>1){
      const poly=[...uPts,...lPts].map(p=>`${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
      svg+=`<polygon points="${poly}" fill="${col.ciBg}"/>`;
      const du=uPts.map((p,j)=>`${j===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
      const dl=lPts.slice().reverse().map((p,j)=>`${j===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
      svg+=`<path d="${du}" fill="none" stroke="${col.ciBorder}" stroke-width="1" stroke-dasharray="4,3"/>`;
      svg+=`<path d="${dl}" fill="none" stroke="${col.ciBorder}" stroke-width="1" stroke-dasharray="4,3"/>`;
    }
  }

  datasets.forEach((ds,i)=>{
    if(visibility.length>i && !visibility[i]) return;
    if(ds.type==='line'){
      const pts=ds.pts.filter(p=>isFinite(p[1]));
      if(!pts.length) return;
      const d=pts.map((p,j)=>`${j===0?'M':'L'}${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`).join(' ');
      svg+=`<path d="${d}" fill="none" stroke="${col.fit}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    } else if(ds.type==='data'){
      ds.pts.forEach(([xi,yi])=>{
        svg+=`<circle cx="${px(xi).toFixed(1)}" cy="${py(yi).toFixed(1)}" r="6" fill="${col.point}" stroke="rgba(0,0,0,0.25)" stroke-width="1.5"/>`;
      });
    } else if(ds.type==='excl'){
      ds.pts.forEach(([xi,yi])=>{
        svg+=`<circle cx="${px(xi).toFixed(1)}" cy="${py(yi).toFixed(1)}" r="6" fill="none" stroke="${col.excl}" stroke-width="2"/>`;
      });
    }
  });

  // Legend — čti přímo z živého grafu pro konzistenci
  const legendItems=[];
  if(chartInst){
    chartInst.data.datasets.forEach((ds,i)=>{
      if(ds.label==='_ciLower') return; // přeskočit
      if(!chartInst.isDatasetVisible(i)) return; // přeskočit skryté
      if(ds.label==='IS 95 %'){
        legendItems.push({label:'IS 95 %', ci:true});
      } else if(ds.type==='line'){
        legendItems.push({label:'fit', color:'#cc3030', line:true});
      } else if(ds.backgroundColor==='transparent'||ds.backgroundColor==='rgba(255,80,80,.5)'){
        legendItems.push({label:ds.label, color:'#2264c0', hollow:true});
      } else {
        legendItems.push({label:ds.label, color:'#2264c0', hollow:false});
      }
    });
  }

  // Vypočítej celkovou šířku legendy a případně rozlož na dva řádky
  const itemW=item=>item.label.length*6.5+40;
  const totalW=legendItems.reduce((s,it)=>s+itemW(it),0);

  // Pokud se vše vejde na jeden řádek, klasicky zleva; jinak IS 95 % vpravo
  const ciItem=legendItems.find(it=>it.ci);
  const mainItems=legendItems.filter(it=>!it.ci);

  const drawLegendItem=(item,lx,ly)=>{
    if(item.ci){
      svg+=`<rect x="${lx}" y="${ly-5}" width="20" height="10" fill="rgba(200,50,50,0.12)" stroke="rgba(200,50,50,0.4)" stroke-width="1" stroke-dasharray="4,2"/>`;
    } else if(item.line){
      svg+=`<line x1="${lx}" y1="${ly}" x2="${lx+20}" y2="${ly}" stroke="${item.color}" stroke-width="2.5"/>`;
    } else if(item.hollow){
      svg+=`<circle cx="${lx+7}" cy="${ly}" r="5" fill="none" stroke="${item.color}" stroke-width="2"/>`;
    } else {
      svg+=`<circle cx="${lx+7}" cy="${ly}" r="5" fill="${item.color}"/>`;
    }
    svg+=`<text x="${lx+24}" y="${ly+4}" font-size="11" fill="#444456">${item.label}</text>`;
  };

  // Hlavní položky zleva
  let lx=ml+10;
  mainItems.forEach(item=>{ drawLegendItem(item,lx,mt+10); lx+=itemW(item); });

  // IS 95 % vpravo (pokud existuje)
  if(ciItem){
    const ciW=itemW(ciItem);
    drawLegendItem(ciItem, ml+pw-ciW+4, mt+10);
  }

  svg+=`</svg>`;

  const a=document.createElement('a');
  a.href='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  a.download='regrese.svg';
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
    `<span style="color:var(--success)">✅ Načteno ${xVals.length} bodů · osy: ${labelX}, ${labelY}</span>`;

  closeAdv();
}

applyTheme(false);
initTable();
updateGeneralEq();
