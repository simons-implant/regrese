
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
// Když je zapnuto, název osy zadaný v poli "Názvy os" se propíše do VŠECH
// datasetů (i nově vytvořených tlačítkem "+"), ne jen do právě aktivního —
// ať uživatel nemusí stejný název opisovat do každé záložky zvlášť.
let axisLabelsApplyAll = false;
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

// Vrátí barvu (hex nebo už existující rgba řetězec) se zadanou průhledností —
// používá se k "zesvětlení" sad dat v grafu, které nejsou právě zvýrazněné
// (viz highlightedDsIdx). Funguje jednotně pro hex i rgba vstupy.
function colorWithAlpha(color, alpha){
  if(typeof color!=='string') return color;
  if(color==='transparent'||color==='none') return color;
  if(color.startsWith('#')){
    const hex=color.slice(1);
    const full=hex.length===3 ? hex.split('').map(c=>c+c).join('') : hex;
    const r=parseInt(full.slice(0,2),16), g=parseInt(full.slice(2,4),16), b=parseInt(full.slice(4,6),16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  const m=color.match(/rgba?\(([^)]+)\)/);
  if(m){
    const parts=m[1].split(',').map(s=>s.trim());
    const origA=parts.length>3 ? parseFloat(parts[3]) : 1;
    return `rgba(${parts[0]},${parts[1]},${parts[2]},${(origA*alpha).toFixed(3)})`;
  }
  return color;
}

/* ── Typy bodů pro jednotlivé datasety ── */
const POINT_STYLES = [
  {key:'circle',       label:'Kruh',                   icon:'●', chart:'circle',   rotation:0,   sizeMult:1},
  {key:'triangle',     label:'Trojúhelník',             icon:'▲', chart:'triangle', rotation:0,   sizeMult:1.35},
  {key:'triangleDown',label:'Obrácený trojúhelník',    icon:'▼', chart:'triangle', rotation:180, sizeMult:1.35},
  {key:'rect',          label:'Čtverec',                 icon:'■', chart:'rect',     rotation:0,   sizeMult:1.15},
  {key:'diamond',      label:'Kosočtverec',             icon:'◆', chart:'rectRot',  rotation:0,   sizeMult:1.15}
];
const POINT_STYLE_ICON = Object.fromEntries(POINT_STYLES.map(o=>[o.key,o.icon]));
const POINT_SIZE_DEFAULT = 6;

function getPointStyleMeta(key){
  return POINT_STYLES.find(o=>o.key===key) || POINT_STYLES[0];
}

// Efektivní velikost/barva bodu daného datasetu — buď to, co si uživatel
// ručně nastavil (ds.pointSize/ds.pointColor), nebo výchozí hodnoty appky
// (základní poloměr POINT_SIZE_DEFAULT, barva podle pořadí v DATASET_COLORS).
function effPointSize(ds){
  return (ds && Number.isFinite(ds.pointSize)) ? ds.pointSize : POINT_SIZE_DEFAULT;
}
function effPointColor(ds, dsIdx){
  if(ds && ds.pointColor) return ds.pointColor;
  return DATASET_COLORS[dsIdx%DATASET_COLORS.length].point;
}

// Vlastní styl bodu (tvar/velikost/barva) nastavený u kteréhokoli datasetu se
// ukládá do cache prohlížeče a použije se jako výchozí i pro NOVĚ vytvořené
// datasety (viz applyPointStylePrefsToNewDataset) — dokud uživatel nezmáčkne
// tlačítko "výchozí", které cache i aktuální dataset vrátí do původního stavu
// appky (jeden jednotný tvar bodu, barvy datasetů podle pořadí).
const POINT_STYLE_PREFS_KEY='regrese_pointStylePrefs';
function savePointStylePrefs(ds){
  try{
    localStorage.setItem(POINT_STYLE_PREFS_KEY, JSON.stringify({
      pointStyle:ds.pointStyle||'circle', pointSize:ds.pointSize, pointColor:ds.pointColor
    }));
  }catch(e){ /* např. soukromý režim — nevadí, jen se to neuloží mezi sezeními */ }
}
function loadPointStylePrefs(){
  try{
    const raw=localStorage.getItem(POINT_STYLE_PREFS_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch(e){ return null; }
}
function clearPointStylePrefs(){
  try{ localStorage.removeItem(POINT_STYLE_PREFS_KEY); }catch(e){ /* nevadí */ }
}
function applyPointStylePrefsToNewDataset(ds){
  const p=loadPointStylePrefs();
  if(!p) return;
  if(p.pointStyle) ds.pointStyle=p.pointStyle;
  if(Number.isFinite(p.pointSize)) ds.pointSize=p.pointSize;
  if(p.pointColor) ds.pointColor=p.pointColor;
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
    customFormula:null, pointStyle:'circle', pointSize:null, pointColor:null,
    // Nejistoty jednotlivých bodů (sigma_y) — pro vážený fit (WLS) a χ²/dof.
    // Sloupec σy v tabulce (a ovládání abs/% + hromadné vyplnění) se zobrazí
    // až po zapnutí přepínače sigmaYOn — v základním stavu je tabulka stejná
    // jako předtím. sigmaYMode: 'abs' (absolutní, ve stejné jednotce jako y)
    // nebo 'pct' (procento z |y| daného bodu — odpovídá datasheetům přístrojů).
    sigmaYOn:false, sigmaYMode:'abs',
    lastResult:null, x:[], y:[], excl:[], sy:[]
  };
}

function escapeHtmlAttr(s){
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
}

function escapeXml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Stažení SVG přes Blob místo data: URI — data URI má v prohlížečích limit
// na délku (a s vloženými base64 fonty se k němu export snadno přiblíží),
// Blob funguje pro libovolnou velikost.
function downloadSvgFile(svg, filename){
  const blob=new Blob([svg], {type:'image/svg+xml;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=filename;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 5000);
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
    const syInput=row.cells[4]?row.cells[4].querySelector('input'):null;
    rows.push({x:xInput?xInput.value:'', y:yInput?yInput.value:'', checked:cb?cb.checked:true, sy:syInput?syInput.value:''});
  }
  return rows;
}

// Sloupec σy se do tabulky přidává/ubírá jako SKUTEČNÝ sloupec (ne jen
// schovaný přes CSS display:none) — ukázalo se, že skrývání celého <td>
// v kombinaci s automatickým rozvržením sloupců tabulky je v reálných
// prohlížečích nespolehlivé (buňka pak nereaguje na klik/psaní). Proto
// renderTableHead() i restoreTableRows()/addRow() vždy vygenerují přesně
// tolik sloupců, kolik jich má aktivní sada dat skutečně mít.
function sigmaYActive(){
  const ds=datasets[activeDatasetIdx];
  return !!(ds && ds.sigmaYOn);
}

function renderTableHead(){
  const thead=document.getElementById('thead');
  if(!thead) return;
  const withSigma=sigmaYActive();
  thead.innerHTML = '<tr><th>#</th>'
    + '<th><input type="checkbox" id="cb-all" checked onchange="toggleAll(this.checked)" title="Zaškrtnout/odškrtnout vše"></th>'
    + '<th>x</th><th>y</th>'
    + (withSigma ? '<th title="Nejistota (směrodatná odchylka) hodnoty y — nepovinné">σy</th>' : '')
    + '</tr>';
}

function sigmaTdHtml(i, syVal){
  if(!sigmaYActive()) return '';
  return `<td><input class="cell" type="text" placeholder="±" value="${escapeHtmlAttr(syVal||'')}" data-r="${i}" data-c="sy"
             onkeydown="handleKey(event,${i},'sy')" oninput="autoRecompute()"></td>`;
}

function restoreTableRows(rows){
  const tb=document.getElementById('tbody');
  if(!tb) return;
  renderTableHead();
  tb.innerHTML='';
  rows.forEach((r,i)=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td class="row-num">${i+1}</td>
      <td><input type="checkbox" ${r.checked?'checked':''} onchange="autoRecompute()"></td>
      <td><input class="cell" type="text" value="${escapeHtmlAttr(r.x)}" data-r="${i}" data-c="x"
                 onkeydown="handleKey(event,${i},'x')" oninput="autoRecompute()"></td>
      <td><input class="cell" type="text" value="${escapeHtmlAttr(r.y)}" data-r="${i}" data-c="y"
                 onkeydown="handleKey(event,${i},'y')" oninput="autoRecompute()"></td>
      ${sigmaTdHtml(i, r.sy)}`;
    tb.appendChild(tr);
  });
}

let datasets = [makeEmptyDataset('Data 1')];
applyPointStylePrefsToNewDataset(datasets[0]);
let activeDatasetIdx = 0;
// Klik na záložku sady dat ji "zvýrazní" v grafu (ostatní sady potemní) —
// null = žádné zvýraznění (všechny sady stejně výrazné). Nastavuje
// onDatasetTabClick, ruší klik mimo záložky (viz listener u rtype-wrap).
let highlightedDsIdx = null;

function renderTabsUI(){
  const wrap=document.getElementById('dataset-tabs');
  if(!wrap) return;
  let html='';
  datasets.forEach((ds,i)=>{
    const label=ds.fileLabel ? `${ds.name}: ${ds.fileLabel}` : ds.name;
    const pStyle=ds.pointStyle||'circle';
    const size=effPointSize(ds);
    const color=effPointColor(ds,i);
    html+=`<div class="ds-row">`
        + `<div class="ds-tab${i===activeDatasetIdx?' active':''}${i===highlightedDsIdx?' highlighted':''}" onclick="onDatasetTabClick(${i})" title="${label.replace(/"/g,'&quot;')}">`
        +   `<span class="ds-dot" id="ds-dot-${i}" style="background:${color};"></span>`
        +   `<span class="ds-label">${label}</span>`
        + `</div>`
        + `<div class="ds-point-wrap">`
        +   `<button class="ds-point-btn" onclick="event.stopPropagation(); toggleDsPointDropdown(${i})" title="Typ, velikost a barva bodu grafu">${POINT_STYLE_ICON[pStyle]||'●'}</button>`
        +   `<div class="ds-point-dropdown" id="ds-point-dropdown-${i}">`
        +     POINT_STYLES.map(o=>`<button class="ds-point-option${pStyle===o.key?' selected':''}" onclick="event.stopPropagation(); selectDsPointStyle(${i},'${o.key}')">${o.icon}&nbsp;&nbsp;${o.label}</button>`).join('')
        +     `<div class="ds-point-sep"></div>`
        +     `<div class="ds-point-row" onclick="event.stopPropagation()">`
        +       `<label>Velikost</label>`
        +       `<input type="range" min="3" max="14" step="1" value="${size}" oninput="setDsPointSize(${i},this.value)">`
        +       `<span class="ds-point-size-val" id="ds-point-size-val-${i}">${size}</span>`
        +     `</div>`
        +     `<div class="ds-point-row" onclick="event.stopPropagation()">`
        +       `<label>Barva</label>`
        +       `<input type="color" value="${color}" oninput="setDsPointColor(${i},this.value)">`
        +     `</div>`
        +     `<button class="ds-point-reset" onclick="event.stopPropagation(); resetDsPointStyle(${i})">Výchozí (tvar, velikost, barva)</button>`
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
  const ds=datasets[idx];
  ds.pointStyle=style;
  savePointStylePrefs(ds);
  document.querySelectorAll('.ds-point-dropdown.open').forEach(d=>d.classList.remove('open'));
  renderTabsUI();
  renderCombinedChart();
}

// Velikost a barva bodu se mění přes range/color input přímo uvnitř otevřeného
// dropdownu — NESMÍ se proto volat renderCombinedChart() (ta si na začátku
// vždy zavolá renderTabsUI(), což přestaví celé innerHTML záložek i s otevřeným
// dropdownem — posuvník/color input by se za jízdy zničil a menu by "zmizelo").
// Místo toho jen upravíme vlastnosti už existujících datasetů v živém grafu
// a zavoláme chart.update('none') — beze zbytečné animace a bez zásahu do DOM
// mimo samotné plátno grafu.
function updateDsPointVisualsInChart(idx){
  if(!chartInst) return;
  const ds=datasets[idx];
  const ptMeta=getPointStyleMeta(ds.pointStyle);
  const ptSize=effPointSize(ds), ptColor=effPointColor(ds,idx);
  const dim = highlightedDsIdx!==null && highlightedDsIdx!==idx;
  const a = dim ? 0.15 : 1;
  chartInst.data.datasets.forEach(d=>{
    if(d._dsIdx!==idx) return;
    if(d._kind==='data'){
      d.backgroundColor=colorWithAlpha(ptColor,a);
      d.pointRadius=ptSize*ptMeta.sizeMult;
      d.pointStyle=ptMeta.chart; d.rotation=ptMeta.rotation;
      // Barva fitu (proložené křivky) a chybových úseček jde s barvou bodů —
      // ať dataset vždy vypadá jako jedna barevná sada, ne dvě různé.
      d._errColor=colorWithAlpha(ptColor,a);
    } else if(d._kind==='excl'){
      d.borderColor=colorWithAlpha(ptColor,a);
      d.pointRadius=ptSize*ptMeta.sizeMult;
      d.pointStyle=ptMeta.chart; d.rotation=ptMeta.rotation;
    } else if(d._kind==='fit'){
      d.borderColor=colorWithAlpha(ptColor,a);
    } else if(d._kind==='ci'){
      d.borderColor=colorWithAlpha(ptColor,0.4*a);
      d.backgroundColor=colorWithAlpha(ptColor,0.16*a);
    }
  });
  chartInst.update('none');
  // Barva ohraničení panelu "Názvy os" (viz syncAxisLabelsPanelBorder) sleduje
  // barvu bodů AKTIVNÍHO datasetu v režimu "aktuální" — pokud se teď měnila
  // barva zrovna jeho bodů, ať se panel hned přebarví taky.
  if(idx===activeDatasetIdx && !axisLabelsApplyAll) syncAxisLabelsPanelBorder();
}

function setDsPointSize(idx, val){
  const v=parseInt(val,10);
  const ds=datasets[idx];
  ds.pointSize=Number.isFinite(v)?v:null;
  savePointStylePrefs(ds);
  const lbl=document.getElementById('ds-point-size-val-'+idx);
  if(lbl) lbl.textContent=effPointSize(ds);
  updateDsPointVisualsInChart(idx);
}

function setDsPointColor(idx, val){
  const ds=datasets[idx];
  ds.pointColor=val||null;
  savePointStylePrefs(ds);
  const dot=document.getElementById('ds-dot-'+idx);
  if(dot) dot.style.background=effPointColor(ds,idx);
  updateDsPointVisualsInChart(idx);
}

function resetDsPointStyle(idx){
  const ds=datasets[idx];
  ds.pointStyle='circle'; ds.pointSize=null; ds.pointColor=null;
  clearPointStylePrefs();
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
  if(autoTrack){ autoTrack.style.background='var(--btn)'; autoTrack.style.borderColor='var(--border)'; }
  if(autoKnob) autoKnob.style.left=ds.fourierAutoHarmonics?'18px':'1px';
  const pTrack=document.getElementById('fourier-period-track');
  const pKnob=document.getElementById('fourier-period-knob');
  const pRow=document.getElementById('fourier-period-row');
  const pInput=document.getElementById('fourier-period-input');
  if(pTrack){ pTrack.style.background='var(--btn)'; pTrack.style.borderColor='var(--border)'; }
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
  syncAxisLabelsPanelBorder();
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
  syncSigmaYUI(ds);
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

// Klik na záložku sady dat: přepne ji jako aktivní (jako dřív) a navíc ji
// zvýrazní v grafu — ostatní sady potemní, ať je hned jasné, které body/
// křivka/pásmo IS patří dané sadě. switchDataset má "no-op" návrat, když je
// sada už aktivní, proto se graf v tom případě musí překreslit ručně.
function onDatasetTabClick(i){
  if(i<0 || i>=datasets.length) return;
  const alreadyActive=(i===activeDatasetIdx);
  highlightedDsIdx=i;
  if(alreadyActive){ renderTabsUI(); renderCombinedChart(); }
  else switchDataset(i);
}

function addDataset(){
  if(datasets.length>=5) return;
  saveActiveDatasetSnapshot();
  const newDs=makeEmptyDataset('Data '+(datasets.length+1));
  applyPointStylePrefsToNewDataset(newDs);
  if(axisLabelsApplyAll){ newDs.xLabel=axisLabels.x; newDs.yLabel=axisLabels.y; }
  datasets.push(newDs);
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
  if(thumb) thumb.style.left = isDark ? '21px' : '3px';
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

// Sdílený toTex handler pro sazbu mathjs výrazů (eq-bar, náhled vlastní
// rovnice, popisky v Pokročilém průvodci exportem): symboly s podtržítkem
// se sázejí jako skutečný dolní index — U_0 → U₀, x_max → x s upright
// indexem "max", omega_0 → ω₀ — místo výchozího mathjs chování, které
// podtržítko jen escapuje a vypíše doslova (U\_0).
const GREEK_TEX_NAMES=new Set([
  'alpha','beta','gamma','delta','epsilon','zeta','eta','theta','iota','kappa',
  'lambda','mu','nu','xi','omicron','pi','rho','sigma','tau','upsilon','phi',
  'chi','psi','omega','Gamma','Delta','Theta','Lambda','Xi','Pi','Sigma',
  'Upsilon','Phi','Psi','Omega','varepsilon','vartheta','varpi','varrho',
  'varsigma','varphi'
]);

function texSubscriptPart(part){
  if(GREEK_TEX_NAMES.has(part)) return '\\'+part;
  // víceznakový textový index (max, min, ef, krit…) upright dle konvence;
  // jednopísmenné indexy (i, j, k…) zůstávají kurzívou jako běžné proměnné
  if(/^[A-Za-z]{2,}$/.test(part)) return '\\mathrm{'+part+'}';
  return part;
}

function texSymbolHandler(node){
  if(node.isSymbolNode && node.name.includes('_')){
    const parts=node.name.split('_').filter(p=>p!=='');
    if(parts.length>=2){
      const base=GREEK_TEX_NAMES.has(parts[0]) ? '\\'+parts[0] : parts[0];
      return base+'_{'+parts.slice(1).map(texSubscriptPart).join(',')+'}';
    }
  }
  return undefined;
}

















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
               onkeydown="handleKey(event,${row},'y')" oninput="autoRecompute()"></td>
    ${sigmaTdHtml(row, '')}`;
  tb.appendChild(tr);
}

function handleKey(e,row,col){
  if(e.key!=='Enter') return;
  e.preventDefault();
  if(col==='x'){
    focusCell(row,'y');
  } else if(col==='y'){
    const ds=datasets[activeDatasetIdx];
    if(ds && ds.sigmaYOn){ focusCell(row,'sy'); return; }
    const tb=document.getElementById('tbody');
    if(row===tb.rows.length-1) addRow();
    focusCell(row+1,'x');
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
  renderTableHead();
  for(let i=0;i<30;i++) addRow();
}

function getTableData(){
  const tb=document.getElementById('tbody');
  const x=[],y=[],excl=[],sy=[];
  for(let i=0;i<tb.rows.length;i++){
    const row=tb.rows[i];
    const cb=row.cells[1].querySelector('input[type="checkbox"]');
    const xv=row.cells[2].querySelector('input').value.trim().replace(',','.');
    const yv=row.cells[3].querySelector('input').value.trim().replace(',','.');
    const syInput=row.cells[4]?row.cells[4].querySelector('input'):null;
    const syv=syInput?syInput.value.trim().replace(',','.'):'';
    if(!xv||!yv) continue;
    const xf=parseFloat(xv), yf=parseFloat(yv);
    if(isNaN(xf)||isNaN(yf)) continue;
    if(cb&&cb.checked){ x.push(xf); y.push(yf); sy.push(syv===''?NaN:parseFloat(syv)); }
    else excl.push([xf,yf]);
  }
  return{x,y,excl,sy};
}

/* ══════════════════════════════════════════════
   ULOŽENÍ / NAČTENÍ CELÉHO PROJEKTU (.json)
   Ukládá všechny sady dat (tabulky + nastavení regrese),
   ne jen aktivní záložku.
══════════════════════════════════════════════ */
function extractXYFromRows(rows){
  const x=[], y=[], excl=[], sy=[];
  (rows||[]).forEach(r=>{
    const xv=String(r.x||'').trim().replace(',','.');
    const yv=String(r.y||'').trim().replace(',','.');
    if(!xv||!yv) return;
    const xf=parseFloat(xv), yf=parseFloat(yv);
    if(isNaN(xf)||isNaN(yf)) return;
    if(r.checked){
      x.push(xf); y.push(yf);
      const syv=String(r.sy||'').trim().replace(',','.');
      sy.push(syv===''?NaN:parseFloat(syv));
    }
    else excl.push([xf,yf]);
  });
  return {x,y,excl,sy};
}

// Sestaví pole vah (1/sigma_y^2) z hodnot zadaných v tabulce, nebo null.
// Nejistoty se použijí jen když je zapnutý přepínač sigmaYOn (jinak beze
// změny chování, jako by σy neexistovaly). Vážení se aktivuje, jakmile má
// KAŽDÝ zahrnutý bod platnou (kladnou) hodnotu σy. Pokud je vyplněná jen
// ČÁST bodů, nedomýšlí se nic — fit proběhne bez váhování a uživatel je
// o tom informován (viz volání v computeRegression).
function computeWeights(x, y, sy, sigmaYOn, sigmaYMode){
  if(!sigmaYOn || !Array.isArray(sy) || sy.length!==y.length || !sy.length) return {w:null, incomplete:false};
  if(sy.some(v=>!Number.isFinite(v))) return {w:null, incomplete:true};
  const sigmaAbs = sigmaYMode==='pct'
    ? sy.map((p,i)=>Math.abs(y[i])*p/100)
    : sy.slice();
  if(sigmaAbs.some(v=>!(v>0))) return {w:null, incomplete:true};
  return {w:sigmaAbs.map(s=>1/(s*s)), incomplete:false};
}

/* ── Nejistoty σy: hlavní přepínač zobrazí sloupec + ovládání abs/% + hromadné vyplnění ── */
function syncSigmaYUI(ds){
  renderTableHead();
  const onTrack=document.getElementById('sigmay-on-track');
  const onKnob=document.getElementById('sigmay-on-knob');
  if(onTrack){ onTrack.style.background=ds.sigmaYOn?'#c83030':'var(--btn)'; onTrack.style.borderColor=ds.sigmaYOn?'#c83030':'var(--border)'; }
  if(onKnob) onKnob.style.left=ds.sigmaYOn?'18px':'1px';
  const modeRow=document.getElementById('sigmay-mode-row');
  if(modeRow) modeRow.style.display=ds.sigmaYOn?'flex':'none';

  const modeTrack=document.getElementById('sigmay-mode-track');
  const modeKnob=document.getElementById('sigmay-mode-knob');
  const isPct=ds.sigmaYMode==='pct';
  if(modeTrack){ modeTrack.style.background='var(--btn)'; modeTrack.style.borderColor='var(--border)'; }
  if(modeKnob) modeKnob.style.left=isPct?'18px':'1px';
  const absLbl=document.getElementById('sigmay-mode-abs-lbl');
  const pctLbl=document.getElementById('sigmay-mode-pct-lbl');
  if(absLbl){ absLbl.style.color=isPct?'var(--text-muted)':'var(--accent)'; absLbl.style.fontWeight=isPct?'400':'700'; }
  if(pctLbl){ pctLbl.style.color=isPct?'var(--accent)':'var(--text-muted)'; pctLbl.style.fontWeight=isPct?'700':'400'; }
}

// Přepnutí σy fyzicky přidá/ubere celý sloupec (viz sigmaTdHtml) — proto se
// tabulka po přepnutí musí znovu vykreslit (zachovávajíc už zadané hodnoty),
// nestačí jen přepnout CSS třídu na už existujících řádcích.
function toggleSigmaY(){
  const ds=datasets[activeDatasetIdx];
  const rows=captureTableRows();
  ds.sigmaYOn=!ds.sigmaYOn;
  restoreTableRows(rows);
  syncSigmaYUI(ds);
  recomputeKeepVis();
}

function toggleSigmaYMode(){
  const ds=datasets[activeDatasetIdx];
  setSigmaYMode(ds.sigmaYMode==='pct' ? 'abs' : 'pct');
}

function setSigmaYMode(mode){
  const ds=datasets[activeDatasetIdx];
  if(ds.sigmaYMode===mode) return;
  ds.sigmaYMode = mode==='pct' ? 'pct' : 'abs';
  syncSigmaYUI(ds);
  recomputeKeepVis();
}

// Přepínač "aktuální dataset / všechny datasety" u polí Názvy os (viz komentář
// u axisLabelsApplyAll výše) — čistě UI stav, neukládá se do projektu ani cache.
function syncAxisLabelsModeUI(){
  const knob=document.getElementById('axis-labels-mode-knob');
  if(knob) knob.style.left=axisLabelsApplyAll?'16px':'1px';
  const curLbl=document.getElementById('axis-labels-mode-cur-lbl');
  const allLbl=document.getElementById('axis-labels-mode-all-lbl');
  if(curLbl){ curLbl.style.color=axisLabelsApplyAll?'var(--text-muted)':'var(--accent)'; curLbl.style.fontWeight=axisLabelsApplyAll?'400':'700'; }
  if(allLbl){ allLbl.style.color=axisLabelsApplyAll?'var(--accent)':'var(--text-muted)'; allLbl.style.fontWeight=axisLabelsApplyAll?'700':'400'; }
}

// Ohraničení celého panelu "Názvy os" (viz .axis-labels-panel) barevně
// sleduje aktivní dataset — v režimu "aktuální" barvou jeho bodů (stejně
// jako fit/CI, viz effPointColor), v režimu "všechny" jednou neutrální
// barvou appky (žádný konkrétní dataset totiž není "ten" relevantní).
function syncAxisLabelsPanelBorder(){
  const panel=document.getElementById('axis-labels-panel');
  const ds=datasets[activeDatasetIdx];
  if(panel) panel.style.borderColor = axisLabelsApplyAll ? 'var(--border)' : effPointColor(ds, activeDatasetIdx);
  // Rámeček panelu s regresními parametry i jméno aktivní sady dat vedle
  // nadpisu sledují barvu bodů aktivní sady stejným způsobem — na rozdíl od
  // popisků os to není podmíněné volbou aktuální/všechny (parametry vždy
  // patří právě jedné konkrétní sadě, takže "všechny" tu nedává smysl).
  const resultsPanel=document.getElementById('resultsPanel');
  if(resultsPanel && ds){
    const col=effPointColor(ds, activeDatasetIdx);
    resultsPanel.style.borderColor=col;
    const nameEl=document.getElementById('results-panel-dsname');
    if(nameEl){ nameEl.textContent=ds.name||''; nameEl.style.color=col; }
  }
}

function setAxisLabelsApplyAll(applyAll){
  applyAll=!!applyAll;
  const wasApplyAll=axisLabelsApplyAll;
  if(applyAll===wasApplyAll){ syncAxisLabelsModeUI(); syncAxisLabelsPanelBorder(); return; }
  axisLabelsApplyAll=applyAll;
  if(axisLabelsApplyAll){
    // Přepnutí NA "všechny" hned zpětně dorovná i datasety, které už existují —
    // ať nemusí uživatel po přepnutí ještě jednou přepsat pole, aby se to projevilo.
    datasets.forEach(ds=>{ ds.xLabel=axisLabels.x; ds.yLabel=axisLabels.y; });
  } else {
    // Přepnutí ZPĚT na "aktuální" vrátí VŠEM datasetům výchozí "x"/"y" —
    // sdílený název byl jen dočasná věc pro režim "všechny", ne trvalá
    // hodnota, kterou by si měl každý dataset dál nést samostatně.
    datasets.forEach(ds=>{ ds.xLabel='x'; ds.yLabel='y'; });
    axisLabels.x='x'; axisLabels.y='y';
    const lx=document.getElementById('label-x'), ly=document.getElementById('label-y');
    if(lx) lx.value='x';
    if(ly) ly.value='y';
  }
  syncAxisLabelsModeUI();
  syncAxisLabelsPanelBorder();
  if(chartInst){ if(regressionOn) computeRegression(); else showPointsOnly(); }
}

function toggleAxisLabelsApplyAll(){
  setAxisLabelsApplyAll(!axisLabelsApplyAll);
}

// Hromadně vyplní sloupec σy pro všechny neprázdné (x i y zadané) řádky
// tabulky stejnou hodnotou — pohodlné, když má přístroj jednu udávanou
// přesnost pro celý rozsah měření. Čte se z vlastního inline pole přímo
// v appce (ne z prohlížečového prompt() dialogu), ať je jasné, že jde
// o hodnotu pro VŠECHNY body najednou — jednotlivé řádky v tabulce jde
// kdykoli po tomto hromadném vyplnění přepsat ručně na jinou hodnotu;
// tabulka je vždy ten skutečný zdroj dat, které se použijí ve fitu.
function applyBulkSigmaY(){
  const input=document.getElementById('sigmay-bulk-input');
  if(!input) return;
  const raw=input.value.trim();
  if(raw===''){ input.focus(); return; }
  const v=raw.replace(',','.');
  if(isNaN(parseFloat(v))){ alert('Zadej platné číslo.'); input.focus(); return; }
  const tb=document.getElementById('tbody');
  if(!tb) return;
  let filled=0;
  for(let i=0;i<tb.rows.length;i++){
    const row=tb.rows[i];
    const xv=row.cells[2].querySelector('input').value.trim();
    const yv=row.cells[3].querySelector('input').value.trim();
    if(!xv||!yv) continue;
    const syInput=row.cells[4]?row.cells[4].querySelector('input'):null;
    if(syInput){ syInput.value=v; filled++; }
  }
  if(!filled){ alert('V tabulce zatím nejsou žádná úplná data (x i y), není co vyplnit.'); return; }
  recomputeKeepVis();
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
      pointStyle:ds.pointStyle||'circle', pointSize:ds.pointSize||null, pointColor:ds.pointColor||null,
      sigmaYOn:!!ds.sigmaYOn, sigmaYMode:ds.sigmaYMode||'abs'
    })),
    tools:{
      combine:{enabled:combineState.enabled, op:combineState.op, dsA:combineState.dsA, dsB:combineState.dsB},
      integral:{enabled:integralState.enabled, fnKey:integralState.fnKey, lo:integralState.lo, hi:integralState.hi},
      derivative:{enabled:derivativeState.enabled, fnKey:derivativeState.fnKey, x0:derivativeState.x0}
    },
    // Nastavení Pokročilého průvodce exportem (fonty, barvy, TeX texty, pozice,
    // styl bodů/čar, legenda) — ať cestuje s projektem, ne jen v cache prohlížeče.
    advExportPrefs: loadAdvExportPrefs()
  };
}

// Vrací true, pokud k uložení skutečně došlo (nebo aspoň bylo spuštěno
// stažení) — false jen když uživatel nativní dialog "Uložit jako" zrušil.
// Potřeba pro drag&drop vkládání projektu: tam se má nový projekt vložit
// TEPRVE PO úspěšném uložení rozpracované práce, ne bezpodmínečně.
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
      return true;
    }catch(err){
      if(err && err.name==='AbortError') return false; // uživatel dialog zrušil
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
  return true;
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
  // Nastavení Pokročilého průvodce exportem uložené v projektu se propíše do
  // cache prohlížeče, aby ho průvodce použil hned při příštím otevření.
  if(state.advExportPrefs){
    try{ localStorage.setItem(ADV_EXPORT_PREFS_KEY, JSON.stringify(state.advExportPrefs)); }catch(e){ /* nevadí */ }
  }
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

  highlightedDsIdx=null;
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
    pointStyle:d.pointStyle||'circle',
    pointSize:Number.isFinite(d.pointSize)?d.pointSize:null,
    pointColor:d.pointColor||null,
    sigmaYOn:!!d.sigmaYOn, sigmaYMode:d.sigmaYMode==='pct'?'pct':'abs'
  }));
  activeDatasetIdx=Math.min(Math.max(state.activeDatasetIdx||0,0), datasets.length-1);

  // Přepočítej x/y/excl a případný fit pro VŠECHNY sady (ne jen aktivní),
  // ať se v kombinovaném grafu hned po načtení zobrazí úplně všechno.
  const prevH=fourierHarmonics, prevAuto=fourierAutoHarmonics, prevPeriod=fourierManualPeriod;
  datasets.forEach(ds=>{
    const {x,y,excl,sy}=extractXYFromRows(ds.tableRows);
    ds.x=x; ds.y=y; ds.excl=excl; ds.sy=sy;
    ds.lastResult=null;
    if(ds.regressionOn && x.length>=2){
      fourierHarmonics=ds.fourierHarmonics;
      fourierAutoHarmonics=ds.fourierAutoHarmonics;
      fourierManualPeriod=ds.fourierManualPeriod;
      try{
        const {w}=computeWeights(x,y,sy,ds.sigmaYOn,ds.sigmaYMode);
        ds.lastResult=computeFitForType(x,y,ds.regressionType,ds,w,!!w);
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

function toggleExportDropdown(which){
  const id='export-dropdown-'+which;
  const dd=document.getElementById(id);
  const wasOpen=dd.classList.contains('open');
  closeExportDropdowns();
  if(!wasOpen) dd.classList.add('open');
}
function closeExportDropdowns(){
  document.querySelectorAll('.export-wrap .rtype-dropdown.open').forEach(d=>d.classList.remove('open'));
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
    track.style.background='var(--btn)';
    track.style.borderColor='var(--border)';
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
  if(track) track.style.background='var(--btn)';
  if(track) track.style.borderColor='var(--border)';
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
  const panel=document.getElementById('fourier-settings');
  if(panel) panel.style.display=isFourier?'flex':'none';
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
    const tex='y = '+node.toTex({handler:texSymbolHandler});
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

// Je barva pozadí (z getComputedStyle) fakticky průhledná? Pokrývá 'rgba(0,
// 0, 0, 0)' (výchozí nenastavené pozadí) i 'transparent' i libovolnou barvu
// s alfa kanálem 0.
function isBgTransparent(colorStr){
  if(!colorStr || colorStr==='transparent') return true;
  const m=colorStr.match(/rgba?\(([^)]+)\)/);
  if(m){
    const parts=m[1].split(',').map(s=>parseFloat(s.trim()));
    return parts.length===4 && parts[3]===0;
  }
  return false;
}
// Zjistí, jestli klik dopadl do "prázdného prostoru" appky mimo jakékoli
// okno/panel/kartu i mimo jakýkoli ovládací prvek — prochází předky od cíle
// kliku směrem k <body> a hledá buď vlastní (neprůhledné) pozadí, nebo
// interaktivní prvek (tlačítko, vstup, odkaz, cokoli s onclick…). Layoutové
// obaly (.app/.main/.left a podobné bezbarvé kontejnery) nemají ani jedno,
// takže klik do jejich okrajů/mezer "propadne" až sem jako prázdný prostor.
// Bez druhé podmínky (interaktivní prvek) by se zvýraznění zrušilo i kliknutím
// na tlačítka, která jsou sice funkční (uložit/načíst projekt…), ale sedí
// přímo v levém sloupci bez vlastního pozadí panelu.
function clickIsInEmptyGutter(target){
  let el=target;
  while(el && el!==document.body && el!==document.documentElement){
    if(!isBgTransparent(getComputedStyle(el).backgroundColor)) return false;
    if(el.matches && el.matches('button,a,input,select,textarea,[onclick],[role="button"]')) return false;
    el=el.parentElement;
  }
  return true;
}

// Zvýraznění sady se ruší kliknutím kamkoli MIMO jakékoli okno/panel appky
// (viz clickIsInEmptyGutter) — v grafu, tabulce, nastavení či přepínačích
// režimů (to všechno jsou "okna" s vlastním pozadím) zůstává zachované.
// POZOR: musí to být CAPTURE listener (třetí argument true), vyhodnocený
// DŘÍV, než se stihne provést vlastní onclick zvolené záložky — klik na
// záložku sady totiž synchronně přestaví celé #dataset-tabs (renderTabsUI
// dělá wrap.innerHTML=...), čímž se původní kliknutý uzel odpojí ze stromu
// (parentElement=null). V bublající fázi by pak clickIsInEmptyGutter na už
// odpojeném uzlu vždy vrátilo "prázdný prostor" a zvýraznění by se vzápětí
// samo zrušilo — proto se to musí stihnout vyhodnotit ještě před přestavbou.
document.addEventListener('click',e=>{
  if(highlightedDsIdx!==null && clickIsInEmptyGutter(e.target)){
    highlightedDsIdx=null;
    renderTabsUI();
    renderCombinedChart();
  }
}, true);

// Close dropdown when clicking outside
document.addEventListener('click',e=>{
  const wrap=document.getElementById('rtype-wrap');
  if(wrap && !wrap.contains(e.target)){
    document.getElementById('rtype-dropdown')?.classList.remove('open');
  }
  if(!e.target.closest('.ds-point-wrap')){
    document.querySelectorAll('.ds-point-dropdown.open').forEach(d=>d.classList.remove('open'));
  }
  if(!e.target.closest('.export-wrap')){
    closeExportDropdowns();
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
      try{ tex='y = '+math.parse(ds.customFormula).toTex({handler:texSymbolHandler}); }
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
  const {x,y,excl,sy}=getTableData();
  const ds=datasets[activeDatasetIdx];
  ds.x=x; ds.y=y; ds.excl=excl; ds.sy=sy; ds.lastResult=null;
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
  const {x,y,excl,sy}=getTableData();
  const eqEl=document.getElementById('resEq');
  const pmEl=document.getElementById('resParams');
  const ds=datasets[activeDatasetIdx];
  ds.x=x; ds.y=y; ds.excl=excl; ds.sy=sy;

  if(x.length<2){
    eqEl.innerHTML='<span class="err">'+errIconSvg()+' Zadejte alespoň 2 zaškrtnuté body.</span>';
    pmEl.innerHTML='';
    ds.lastResult=null;
    renderCombinedChart();
    return;
  }

  pulseRegressionButton();

  const {w,incomplete}=computeWeights(x,y,sy,ds.sigmaYOn,ds.sigmaYMode);
  const absoluteSigma = !!w;

  const type=document.getElementById('rType').value;
  let result;
  try{
    result=computeFitForType(x,y,type,ds,w,absoluteSigma);
    // Numericky singulární data (např. všechny x stejné) můžou z fitů vyjít
    // jako NaN/Infinity — radši srozumitelná hláška než "NaN" v parametrech.
    if(result && Array.isArray(result.yp) && result.yp.length && !result.yp.some(Number.isFinite)){
      throw new Error('Regresi se z těchto dat nepodařilo spočítat (data jsou numericky singulární — zkontroluj, že hodnoty x nejsou všechny stejné).');
    }
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

  displayResults(result, x.length, x.length+excl.length, incomplete);
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
        // ostatní symboly (x, případné konstanty s podtržítkem) — indexy
        return texSymbolHandler(node2);
      };
      return 'y = '+node.toTex({handler});
    }catch(e){
      return r.eq;
    }
  }
  return r.eq;
}

function displayResults(r, used, total, sigmaIncomplete){
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
  html+=`• R² = <span class="r2">${r.r2.toFixed(6)}</span><br>`;
  if(r.chi2Info){
    html+=`• χ²/dof = <span class="r2">${f6(r.chi2Info.chi2red)}</span> `
         +`<span style="color:var(--text-muted);font-size:11px;">(dof = ${r.chi2Info.dof})</span><br>`;
  } else if(sigmaIncomplete){
    html+=`<span class="err" style="display:block;margin:2px 0;">${errIconSvg()} Nejistoty σy nejsou vyplněné (platně) pro všechny body — regrese proběhla bez vážení.</span>`;
  }
  html+=`• Použito bodů: ${used} / ${total}`;
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

// Interval spolehlivosti (IS pásmo kolem proložené křivky) — obecný
// delta-method vzorec Var(ŷ(x)) = jacFn(x)ᵀ·cov·jacFn(x), kde cov je
// kovarianční matice parametrů fitu (viz calcCov/covMatrix u každého typu
// regrese v regression-core.js). Funguje STEJNĚ pro lineární-v-parametrech
// (přímka, polynom, log, exponenciála po zpětné transformaci) i nelineární
// (LM) fity (lomenná, Gauss, multi-Gauss, Fourier, vlastní rovnice) — jacFn
// vždy vrací lokální gradient predikce ŷ podle parametrů v bodě x.
//
// DŮLEŽITÉ: cov už sama o sobě správně zohledňuje váhy/absoluteSigma (viz
// calcCov), takže u váženého fitu (reálné σy) vyjde IS pásmo užší tam, kde
// jsou body přesně změřené (malé σy), a širší tam, kde jsou nejistoty velké
// — na rozdíl od dřívějšího řešení, které u všech typů kromě Fourierovy řady
// počítalo pásmo z NEVÁŽENÉHO rmse (statisticky nekonzistentní s váženým
// fitem samotným).
function buildCiBand(result, x, y, xSmooth, ySmooth, useCI){
  if(!(useCI && result && result.yp)) return null;
  const n=x.length;
  const tCrit = n>30 ? 1.96 : n>10 ? 2.228 : 2.776;

  if(result.covMatrix && result.jacFn){
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

  // Záložní odhad (konstantní šířka pásma z celkového rozptylu reziduí) —
  // jen pro případný budoucí typ regrese bez covMatrix/jacFn. Se všemi
  // současnými typy k tomuto nikdy nedojde.
  const p = result.type==='polynomial'?3 : result.type==='gaussian'?4 :
            result.type==='gaussian2'?7 : result.type==='gaussian3'?10 :
            result.type==='rational'?3 : 2;
  const rmse=Math.sqrt(result.yp.reduce((s,ypi,i)=>s+(y[i]-ypi)**2,0)/Math.max(n-p,1));
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
      try{ return math.parse(ds.customFormula).toTex({handler:texSymbolHandler}); }
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
    ds.data.forEach((p,i)=>{
      if(p && Number.isFinite(p.x)){ if(p.x<xMin) xMin=p.x; if(p.x>xMax) xMax=p.x; }
      if(p && Number.isFinite(p.y)){
        // Chybové úsečky (σy) kreslí vlastní plugin mimo Chart.js datové body,
        // takže je potřeba jejich rozsah zahrnout ručně, jinak by se osa y
        // automaticky neroztáhla a úsečky by se ořízly o okraj grafu.
        let sigma=0;
        if(ds._errSy){
          const sigRaw=ds._errSy[i];
          if(Number.isFinite(sigRaw)){
            sigma = ds._errMode==='pct' ? Math.abs(p.y)*sigRaw/100 : sigRaw;
            if(!(sigma>0)) sigma=0;
          }
        }
        const yLo=p.y-sigma, yHi=p.y+sigma;
        if(yLo<yMin) yMin=yLo; if(yHi>yMax) yMax=yHi;
      }
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

// Chart.js plugin kreslící chybové úsečky (σy) přes datové body — vlastní
// implementace místo externí knihovny (chart.min.js je vendorovaná knihovna,
// neupravuje se). Čte _errSy/_errMode/_errColor uložené na "Data" datasetu
// v renderCombinedChart. Kreslí jen pro body s platnou (kladnou) σy.
const errorBarsPlugin = {
  id:'errorBars',
  afterDatasetsDraw(chart){
    const {ctx, chartArea} = chart;
    if(!chartArea) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(chartArea.left, chartArea.top, chartArea.width, chartArea.height);
    ctx.clip();
    const capHalf=5;
    chart.data.datasets.forEach((ds, idx)=>{
      if(ds._kind!=='data' || !ds._errSy || !chart.isDatasetVisible(idx)) return;
      const xScale=chart.scales.x, yScale=chart.scales.y;
      if(!xScale||!yScale) return;
      ctx.strokeStyle=ds._errColor||ds.borderColor||'#000';
      ctx.lineWidth=1.5;
      ds.data.forEach((pt,i)=>{
        const sigRaw=ds._errSy[i];
        if(!Number.isFinite(sigRaw)) return;
        const sigma = ds._errMode==='pct' ? Math.abs(pt.y)*sigRaw/100 : sigRaw;
        if(!(sigma>0)) return;
        const xPix=xScale.getPixelForValue(pt.x);
        const yTopPix=yScale.getPixelForValue(pt.y+sigma);
        const yBotPix=yScale.getPixelForValue(pt.y-sigma);
        ctx.beginPath();
        ctx.moveTo(xPix, yTopPix); ctx.lineTo(xPix, yBotPix);
        ctx.moveTo(xPix-capHalf, yTopPix); ctx.lineTo(xPix+capHalf, yTopPix);
        ctx.moveTo(xPix-capHalf, yBotPix); ctx.lineTo(xPix+capHalf, yBotPix);
        ctx.stroke();
      });
    });
    ctx.restore();
  }
};

function renderCombinedChart(){
  renderTabsUI();
  refreshCombinePanelOptions();
  refreshIntegralPanel();
  refreshDerivativePanel();
  syncAxisLabelsPanelBorder();
  if(chartInst){chartInst.destroy();chartInst=null;}

  const activeDatasets=datasets
    .map((ds,i)=>({ds,i}))
    .filter(({ds})=>ds.x.length>0||ds.excl.length>0);

  if(!activeDatasets.length){ clearChart(); return; }
  setChartEmptyState(false);

  const multi=activeDatasets.length>1;
  const combinedDatasets=[];

  activeDatasets.forEach(({ds,i})=>{
    const suffix=multi ? ` (${ds.name})` : '';
    const {x,y,excl,lastResult:result}=ds;
    if(!ds.hiddenSeries) ds.hiddenSeries={data:false,excl:false,fit:false,ci:false};

    const ptMeta=getPointStyleMeta(ds.pointStyle);
    const ptSize=effPointSize(ds);
    const ptColor=effPointColor(ds,i);

    // Klik na záložku sady (highlightedDsIdx) zesvětlí ostatní sady v grafu,
    // aby vynikla ta zvýrazněná — barvy se jen "naředí" nižší průhledností,
    // funguje to stejně v obou motivech (viz colorWithAlpha).
    const dim = highlightedDsIdx!==null && highlightedDsIdx!==i;
    const a = dim ? 0.15 : 1;

    if(excl.length>0){
      combinedDatasets.push({
        type:'scatter',label:`Vyloučeno${suffix} (${excl.length})`,
        data:excl.map(p=>({x:p[0],y:p[1]})),
        backgroundColor:'transparent',borderColor:colorWithAlpha(ptColor,a),
        pointStyle:ptMeta.chart,rotation:ptMeta.rotation,
        pointRadius:ptSize*ptMeta.sizeMult,pointBorderWidth:2,order:3,
        _dsIdx:i,_kind:'excl',hidden:!!ds.hiddenSeries.excl
      });
    }

    if(x.length>0){
      combinedDatasets.push({
        type:'scatter',label:`Data${suffix}`,
        data:x.map((xi,idx)=>({x:xi,y:y[idx]})),
        backgroundColor:colorWithAlpha(ptColor,a),borderColor:colorWithAlpha('rgba(255,255,255,.7)',a),
        borderWidth:1.5,pointRadius:ptSize*ptMeta.sizeMult,order:3,
        pointStyle:ptMeta.chart,rotation:ptMeta.rotation,
        _dsIdx:i,_kind:'data',hidden:!!ds.hiddenSeries.data,
        // Chybové úsečky (σy) — kreslí je vlastní Chart.js plugin errorBarsPlugin
        // (viz níže), aby fungovaly i bez externí knihovny pro error bary.
        _errSy:ds.sy, _errMode:ds.sigmaYMode, _errColor:colorWithAlpha(ptColor,a)
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
        borderColor:colorWithAlpha(ptColor,a),borderWidth:2.5,
        pointRadius:0,fill:false,tension:0,order:2,
        _dsIdx:i,_kind:'fit',hidden:!!ds.hiddenSeries.fit
      });

      const dsUseCI = (i===activeDatasetIdx) ? showCI : ds.showCI;
      const ci=buildCiBand(result,x,y,xSmooth,ySmooth,dsUseCI);
      if(ci){
        combinedDatasets.push({
          type:'line',label:`IS 95 %${suffix}`,
          data:ci.upper,
          borderColor:colorWithAlpha(ptColor,0.4*a),backgroundColor:colorWithAlpha(ptColor,0.16*a),
          borderWidth:1,borderDash:[4,3],
          pointRadius:0,fill:'+1',tension:0,order:4,
          pointStyle:'rect',_ciPairId:i,_dsIdx:i,_kind:'ci',hidden:!!ds.hiddenSeries.ci
        });
        combinedDatasets.push({
          type:'line',label:`_ciLower${suffix}`,
          data:ci.lower,
          borderColor:colorWithAlpha(ptColor,0.4*a),backgroundColor:colorWithAlpha(ptColor,0.16*a),
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

  // Chart.js by osu y automaticky roztáhl jen podle datových bodů — chybové
  // úsečky (σy) ale kreslí samostatný plugin mimo tato data, takže bez
  // tohoto zámku by se úsečky u krajních bodů ořízly o okraj grafu.
  // Neaplikuje se, pokud má uživatel rozsah os nastavený ručně nebo běží
  // zamčená osa kvůli derivaci (ta má přednost).
  let errorBarAxisLock=null;
  if(!derivativeAxisLock && !manualRange.active){
    const hasErrorBars=combinedDatasets.some(d=>d._kind==='data' && Array.isArray(d._errSy) && d._errSy.some(Number.isFinite));
    if(hasErrorBars){
      const dataBounds=computeDatasetsBounds(combinedDatasets);
      if(dataBounds){
        const span=(dataBounds.yMax-dataBounds.yMin)||1;
        const pad=span*0.08;
        errorBarAxisLock={min:dataBounds.yMin-pad, max:dataBounds.yMax+pad};
      }
    }
  }

  const c=chartColors();
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
           title:{display:true,text:axisLabels.x,color:c.tick,font:{family:'Sora',size:12}}},
        y:{type:'linear',...getScaleOpts('y'),...(errorBarAxisLock||{}),...(derivativeAxisLock||{}),
           grid:{color:c.grid},
           ticks:{color:c.tick,font:{family:'Fira Code',size:11}},
           border:{color:c.axis},
           title:{display:true,text:axisLabels.y,color:c.tick,font:{family:'Sora',size:12}}}
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
    }, errorBarsPlugin]
  });
  requestAnimationFrame(updateRangeInputs);
}

/* ══════════════════════════════════════════════
   FILE IMPORT
══════════════════════════════════════════════ */
// Jednotné a jednoduché pravidlo pro oba způsoby načtení (tlačítko i
// drag&drop): přesně 2 sloupce se vloží rovnou, JAKÝKOLI vícesloupcový
// soubor vždy otevře Průvodce vložením dat — uživatel si tam sloupce
// (včetně případného σy) vybere sám. Žádná automatická detekce, žádné
// hádání, co který sloupec znamená.
function loadFile(input){
  const file=input.files[0];
  if(!file) return;
  input.value='';
  const reader=new FileReader();
  reader.onload=e=>{
    const text=e.target.result;
    const parsed=advParse(text);
    const needsWizard=parsed && parsed.rows.length && Math.max(...parsed.rows.map(r=>r.length))>2;
    if(needsWizard){
      openAdvWizardWithText(text, file.name);
      return;
    }
    const lbl=document.getElementById('file-label');
    if(lbl){
      lbl.innerHTML='<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;flex-shrink:0;"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="M14 2v6h6"/></svg> '+escapeHtmlAttr(file.name);
      lbl.style.display='block';
    }
    datasets[activeDatasetIdx].fileLabel=file.name;
    renderTabsUI();
    parseAndFill(text);
  };
  reader.readAsText(file);
}

function parseAndFill(text, fileName){
  const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(l=>l&&!l.startsWith('#'));
  if(!lines.length) return false;

  // Dělení řádku na sloupce sdílí advSplitLine s Průvodcem vložením dat
  // i drag&drop importem — jedna jediná implementace, aby se detekce
  // oddělovačů (tab/středník/mezera/čárka, česká desetinná čárka) nikdy
  // nemohla mezi jednotlivými cestami načítání rozjet.
  let headerX='x', headerY='y', dataStart=0;
  const firstParts=advSplitLine(lines[0]);
  if(firstParts.length>=2 && (isNaN(firstParts[0].replace(',','.')) || isNaN(firstParts[1].replace(',','.')))){
    headerX=firstParts[0]||'x';
    headerY=firstParts[1]||'y';
    dataStart=1;
  }
  axisLabels={x:headerX, y:headerY};
  axisLabelsFromFile = (dataStart === 1);
  if(axisLabelsApplyAll) datasets.forEach(ds=>{ ds.xLabel=axisLabels.x; ds.yLabel=axisLabels.y; });
  const lx=document.getElementById('label-x'), ly=document.getElementById('label-y');
  if(lx) lx.value=axisLabels.x;
  if(ly) ly.value=axisLabels.y;

  const rows=[];
  for(let i=dataStart;i<lines.length;i++){
    const parts=advSplitLine(lines[i]);
    if(parts.length<2) continue;
    const xv=parseFloat(parts[0].replace(',','.'));
    const yv=parseFloat(parts[1].replace(',','.'));
    if(!isNaN(xv)&&!isNaN(yv)) rows.push([xv,yv]);
  }
  if(!rows.length){ alert('Nepodařilo se načíst žádná data.'); return false; }

  const tb=document.getElementById('tbody');
  tb.innerHTML='';
  regressionOn=false;
  const _br=document.getElementById('btn-regrese'); if(_br){_br.style.color='var(--text)';_br.style.opacity='.6';_br.title='Spustit analýzu';}
  const _eq=document.getElementById('resEq'); if(_eq) _eq.textContent='—';
  document.getElementById('resParams').textContent='';

  rows.forEach(([xv,yv],i)=>{
    const tr=document.createElement('tr');
    // sigmaTdHtml: když je zapnutý sloupec σy, musí ho dostat i řádky
    // z načteného souboru — jinak by tabulka měla nestejný počet buněk
    // (hlavička 5 sloupců, data 4) a σy by u nich nešlo vůbec zadat.
    tr.innerHTML=`
      <td class="row-num">${i+1}</td>
      <td><input type="checkbox" checked onchange="autoRecompute()"></td>
      <td><input class="cell" type="text" value="${xv}" data-r="${i}" data-c="x"
                 onkeydown="handleKey(event,${i},'x')" oninput="autoRecompute()"></td>
      <td><input class="cell" type="text" value="${yv}" data-r="${i}" data-c="y"
                 onkeydown="handleKey(event,${i},'y')" oninput="autoRecompute()"></td>
      ${sigmaTdHtml(i, '')}`;
    tb.appendChild(tr);
  });
  addRow();
  updateMasterCheckbox();
  showPointsOnly();
  document.getElementById('resEq').innerHTML=
    `<span style="color:var(--success)">${okIconSvg()} Načteno ${rows.length} bodů${dataStart?` · osy: ${escapeHtmlAttr(headerX)}, ${escapeHtmlAttr(headerY)}`:''}</span>`;
  if(fileName){ datasets[activeDatasetIdx].fileLabel=fileName; renderTabsUI(); }
  return true;
}

/* ══════════════════════════════════════════════
   PŘETAŽENÍ SOUBORŮ NA GRAF (DRAG & DROP)
   Umožňuje pustit jeden nebo víc datových souborů přímo na plochu grafu.
   Jednoduchá dvousloupcová data se vloží rovnou, složitější (víc sloupců)
   automaticky otevřou Průvodce vložením dat — postupně pro každý soubor,
   který to potřebuje (viz processNextDropImport). Používá stejné parsování
   (advParse/advSplitLine) jako už existující Průvodce, aby detekce sloupců
   byla naprosto konzistentní s tím, jak se soubor pak zobrazí uvnitř něj.
══════════════════════════════════════════════ */
const DROP_FILE_RE=/\.(txt|csv|tsv|dat)$/i;
let dropImportQueue=null;      // fronta {name,text,dsIdx,isNewTab} čekajících na vložení
let dropPendingSingleFile=null; // {name,text} čekající na volbu nová sada/přepsat

// Je zadaná sada dat prázdná (žádná zapsaná/vypočtená data)? Funguje jak pro
// právě aktivní záložku (čte živou tabulku v DOMu), tak pro neaktivní (čte
// jejich poslední uložený snapshot) — potřeba, protože x/y/tableRows se pro
// neaktivní záložku aktualizují až při přepnutí pryč z ní.
function datasetIsEmpty(idx){
  const ds=datasets[idx];
  if(!ds) return true;
  if(idx===activeDatasetIdx){
    return captureTableRows().every(r=>!String(r.x||'').trim() && !String(r.y||'').trim());
  }
  const rowsEmpty=!ds.tableRows || !ds.tableRows.length || ds.tableRows.every(r=>!String(r.x||'').trim() && !String(r.y||'').trim());
  return rowsEmpty && ds.x.length===0 && ds.excl.length===0;
}

// Potřebuje soubor Pokročilého průvodce (víc než 2 sloupce), nebo jde o
// obyčejná dvousloupcová data, která lze vložit rovnou?
function dropDataNeedsWizard(rows){
  if(!rows.length) return false;
  return Math.max(...rows.map(r=>r.length))>2;
}

function readFilesAsText(files){
  return Promise.all(files.map(f=>new Promise(resolve=>{
    const r=new FileReader();
    r.onload=e=>resolve({name:f.name, text:e.target.result});
    r.onerror=()=>resolve({name:f.name, text:''});
    r.readAsText(f);
  })));
}

let chartDragDepth=0;
function handleChartDragEnter(e){
  e.preventDefault();
  chartDragDepth++;
  document.getElementById('chartBox')?.classList.add('drag-over');
}
function handleChartDragOver(e){
  e.preventDefault(); // nutné, jinak prohlížeč drop rovnou odmítne
  if(e.dataTransfer) e.dataTransfer.dropEffect='copy';
}
function handleChartDragLeave(e){
  chartDragDepth=Math.max(0,chartDragDepth-1);
  if(chartDragDepth===0) document.getElementById('chartBox')?.classList.remove('drag-over');
}
function handleChartDrop(e){
  e.preventDefault();
  chartDragDepth=0;
  document.getElementById('chartBox')?.classList.remove('drag-over');
  const allFiles=[...(e.dataTransfer?.files||[])];

  // Přetažený .json = celý uložený projekt, ne datový soubor — jde jinou,
  // samostatnou cestou (viz startDropProjectImport), protože nahrazuje úplně
  // všechno (všechny sady, nástroje, průvodce exportem…), ne jen jednu záložku.
  const jsonFile=allFiles.find(f=>/\.json$/i.test(f.name));
  if(jsonFile){
    readFilesAsText([jsonFile]).then(([item])=>startDropProjectImport(item));
    return;
  }

  const files=allFiles.filter(f=>DROP_FILE_RE.test(f.name));
  if(!files.length){
    if(allFiles.length) alert('Přetažený soubor není podporovaný formát dat (.txt, .csv, .tsv, .dat) ani uložený projekt (.json).');
    return;
  }
  readFilesAsText(files).then(startDropImport);
}

// Jsou úplně všechny sady dat prázdné? (nic zapsáno v žádné záložce) —
// rozhoduje, jestli je při přetažení projektu vůbec co ztratit / je potřeba
// se ptát, co s tím.
function allDatasetsEmpty(){
  return datasets.every((_,i)=>datasetIsEmpty(i));
}

function parseProjectJsonText(text){
  let state;
  try{ state=JSON.parse(text); }
  catch(err){ return {ok:false, error:'Soubor se nepodařilo přečíst — není to platný JSON projekt.'}; }
  if(!state||!Array.isArray(state.datasets)||!state.datasets.length){
    return {ok:false, error:'Tenhle soubor neobsahuje platný projekt appky.'};
  }
  return {ok:true, state};
}

// item: {name, text} přetaženého .json souboru.
function startDropProjectImport(item){
  const parsed=parseProjectJsonText(item.text);
  if(!parsed.ok){ alert(parsed.error); return; }
  if(allDatasetsEmpty()){
    applySessionState(parsed.state);
    return;
  }
  openDropProjectChoice(item, parsed.state);
}

let dropPendingProject=null; // {item, state} čekající na volbu smazat/uložit/zrušit
function openDropProjectChoice(item, state){
  dropPendingProject={item, state};
  const fnEl=document.getElementById('drop-project-filename');
  if(fnEl) fnEl.textContent='Soubor: '+item.name;
  const ov=document.getElementById('drop-project-overlay');
  if(ov) ov.style.display='flex';
  document.body.style.overflow='hidden';
}
function closeDropProjectChoice(){
  const ov=document.getElementById('drop-project-overlay');
  if(ov) ov.style.display='none';
  document.body.style.overflow='';
}
function cancelDropProjectChoice(){
  dropPendingProject=null;
  closeDropProjectChoice();
}
async function resolveDropProjectChoice(mode){
  const pending=dropPendingProject;
  dropPendingProject=null;
  closeDropProjectChoice();
  if(!pending) return;
  if(mode==='save-then-replace'){
    const saved=await saveSession();
    if(!saved) return; // uživatel uložení zrušil — přetažený projekt se raději nevloží
  }
  applySessionState(pending.state);
}
document.addEventListener('keydown', e=>{
  if(e.key!=='Escape') return;
  const ov=document.getElementById('drop-project-overlay');
  if(ov && ov.style.display==='flex') cancelDropProjectChoice();
});

// fileTexts: [{name, text}] — jeden nebo víc přetažených souborů najednou.
function startDropImport(fileTexts){
  if(!fileTexts.length) return;
  const activeEmpty=datasetIsEmpty(activeDatasetIdx);

  // Jediný soubor a aktivní záložka už má data → zeptat se uživatele, jestli
  // chce novou sadu, nebo přepsat to, co v aktivní záložce je.
  if(fileTexts.length===1 && !activeEmpty){
    openDropOverwriteChoice(fileTexts[0]);
    return;
  }

  const plan=[];
  let skipped=0;
  fileTexts.forEach((item,k)=>{
    if(k===0 && activeEmpty){
      plan.push({...item, dsIdx:activeDatasetIdx, isNewTab:false});
      return;
    }
    if(datasets.length>=5){ skipped++; return; }
    datasets.push(makeEmptyDataset('Data '+(datasets.length+1)));
    plan.push({...item, dsIdx:datasets.length-1, isNewTab:true});
  });
  renderTabsUI();
  if(skipped) alert(`Dosažen limit 5 sad dat — ${skipped} ${skipped===1?'soubor se nepodařilo načíst':'soubory/souborů se nepodařilo načíst'}.`);
  runDropImportPlan(plan);
}

function runDropImportPlan(plan){
  if(!plan.length) return;
  dropImportQueue=plan;
  processNextDropImport();
}

function processNextDropImport(){
  if(!dropImportQueue || !dropImportQueue.length){ dropImportQueue=null; return; }
  const item=dropImportQueue.shift();
  switchDataset(item.dsIdx);
  const parsed=advParse(item.text);
  if(!parsed || !parsed.rows.length){
    processNextDropImport();
    return;
  }
  if(dropDataNeedsWizard(parsed.rows)){
    openAdvWizardWithText(item.text, item.name); // pokračování fronty viz closeAdv()
  } else {
    parseAndFill(item.text, item.name);
    processNextDropImport();
  }
}

function openDropOverwriteChoice(fileItem){
  dropPendingSingleFile=fileItem;
  const fnEl=document.getElementById('drop-overwrite-filename');
  if(fnEl) fnEl.textContent='Soubor: '+fileItem.name;
  const dsnameEl=document.getElementById('drop-overwrite-dsname');
  if(dsnameEl) dsnameEl.textContent=datasets[activeDatasetIdx].name;
  const ov=document.getElementById('drop-overwrite-overlay');
  if(ov) ov.style.display='flex';
  document.body.style.overflow='hidden';
}
function closeDropOverwriteChoice(){
  const ov=document.getElementById('drop-overwrite-overlay');
  if(ov) ov.style.display='none';
  document.body.style.overflow='';
}
function cancelDropOverwriteChoice(){
  dropPendingSingleFile=null;
  closeDropOverwriteChoice();
}
function resolveDropOverwriteChoice(mode){
  const item=dropPendingSingleFile;
  dropPendingSingleFile=null;
  closeDropOverwriteChoice();
  if(!item) return;
  let dsIdx=activeDatasetIdx;
  if(mode==='new'){
    if(datasets.length>=5){ alert('Dosažen limit 5 sad dat — novou sadu už nelze přidat.'); return; }
    datasets.push(makeEmptyDataset('Data '+(datasets.length+1)));
    dsIdx=datasets.length-1;
    renderTabsUI();
  }
  runDropImportPlan([{name:item.name, text:item.text, dsIdx, isNewTab:mode==='new'}]);
}
document.addEventListener('keydown', e=>{
  if(e.key!=='Escape') return;
  const ov=document.getElementById('drop-overwrite-overlay');
  if(ov && ov.style.display==='flex') cancelDropOverwriteChoice();
});

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
  // Se zapnutým sloupcem σy se nejistoty ukládají jako třetí sloupec —
  // jinak by se zadané σy při uložení dat do TXT potichu ztratily.
  const withSigma=sigmaYActive();
  const rows=[];
  for(let i=0;i<tb.rows.length;i++){
    const xv=tb.rows[i].cells[2]?.querySelector('input')?.value.trim().replace(',','.');
    const yv=tb.rows[i].cells[3]?.querySelector('input')?.value.trim().replace(',','.');
    if(!xv||!yv) continue;
    const xf=parseFloat(xv), yf=parseFloat(yv);
    if(isNaN(xf)||isNaN(yf)) continue;
    if(withSigma){
      const sv=tb.rows[i].cells[4]?.querySelector('input')?.value.trim().replace(',','.')||'';
      rows.push(sv!=='' && !isNaN(parseFloat(sv)) ? `${xv}\t${yv}\t${sv}` : `${xv}\t${yv}`);
    } else {
      rows.push(`${xv}\t${yv}`);
    }
  }
  if(!rows.length){ alert('Tabulka neobsahuje žádná data.'); return; }
  const content=`${lx}\t${ly}${withSigma?'\tsigma_y':''}\n`+rows.join('\n');
  const a=document.createElement('a');
  a.href='data:text/plain;charset=utf-8,'+encodeURIComponent(content);
  a.download='data.txt';
  a.click();
}

// Vlastní prohození dat (a volitelně i názvů os) — společné jádro pro
// všechny cesty z swapXY() níže.
function doSwapXY(swapLabels){
  const tb=document.getElementById('tbody');
  for(let i=0;i<tb.rows.length;i++){
    const xI=tb.rows[i].cells[2].querySelector('input');
    const yI=tb.rows[i].cells[3].querySelector('input');
    [xI.value,yI.value]=[yI.value,xI.value];
  }
  if(swapLabels){
    [axisLabels.x, axisLabels.y]=[axisLabels.y, axisLabels.x];
    axisLabelsFromFile=true;
    const lx=document.getElementById('label-x'), ly=document.getElementById('label-y');
    if(lx) lx.value=axisLabels.x;
    if(ly) ly.value=axisLabels.y;
  }
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

// Prohodit x↔y: v režimu "aktuální" rovnou prohodí data i názvy os (jako
// vždycky). V režimu "všechny" jsou ale názvy os sdílené všemi datasety —
// tichým prohozením by se změnily i ostatním. Proto se místo toho zobrazí
// dialog (viz #swapxy-labels-overlay) a uživatel si vybere, co přesně chce.
function swapXY(){
  if(axisLabelsApplyAll){
    const ov=document.getElementById('swapxy-labels-overlay');
    if(ov){ ov.style.display='flex'; document.body.style.overflow='hidden'; return; }
    // fallback (overlay chybí, např. ve starém HTML): chovej se jako dřív
  }
  doSwapXY(true);
}

function cancelSwapXYChoice(){
  const ov=document.getElementById('swapxy-labels-overlay');
  if(ov) ov.style.display='none';
  document.body.style.overflow='';
}

function resolveSwapXYChoice(choice){
  cancelSwapXYChoice();
  if(choice==='detach-and-swap'){
    // VÝJIMKA z běžného chování setAxisLabelsApplyAll(false): názvy os se
    // NEresetují na výchozí "x"/"y" — každý dataset si ponechá názvy, které
    // měl z režimu "všechny" (ostatní beze změny, aktivní je vzápětí prohodí).
    axisLabelsApplyAll=false;
    syncAxisLabelsModeUI();
    syncAxisLabelsPanelBorder();
    doSwapXY(true);
  } else if(choice==='swap-data-only'){
    // Režim "všechny" zůstává zapnutý, názvy os se nemění — prohodí se jen data.
    doSwapXY(false);
  }
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
  datasets[activeDatasetIdx].x=[]; datasets[activeDatasetIdx].y=[]; datasets[activeDatasetIdx].excl=[]; datasets[activeDatasetIdx].sy=[];
  datasets[activeDatasetIdx].sigmaYOn=false; datasets[activeDatasetIdx].sigmaYMode='abs';
  syncSigmaYUI(datasets[activeDatasetIdx]);
  renderTabsUI();
  const _br=document.getElementById('btn-regrese'); if(_br){_br.style.color='var(--text)';_br.style.opacity='.6';_br.title='Spustit analýzu';}
  const tb=document.getElementById('tbody');
  tb.innerHTML='';
  for(let i=0;i<30;i++) addRow();
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

// Vrátí sigma_y v absolutních jednotkách pro daný bod, nebo null když
// nejistota není platně zadaná — sdíleno mezi živým grafem i oběma cestami
// SVG exportu, ať se všude počítá stejně (abs vs. % z |y|).
function pointSigmaAbs(sy, mode, yVal){
  if(!Number.isFinite(sy)) return null;
  const sigma = mode==='pct' ? Math.abs(yVal)*sy/100 : sy;
  return sigma>0 ? sigma : null;
}

// Chybová úsečka (±σy) v SVG — svislá čára s "vousy" nahoře/dole, oříznutá
// na hranice vykreslovací oblasti grafu (stejně jako IS pásmo), aby
// nepřesahovala mimo graf.
function svgErrorBar(px, py, xi, yi, sigma, color, mt, ph, capHalf){
  capHalf = capHalf||5;
  const xPix=px(xi);
  const yA=py(yi+sigma), yB=py(yi-sigma);
  const top=mt, bot=mt+ph;
  const yTop=Math.max(top, Math.min(bot, Math.min(yA,yB)));
  const yBot=Math.max(top, Math.min(bot, Math.max(yA,yB)));
  let svg=`<line x1="${xPix.toFixed(1)}" y1="${yTop.toFixed(1)}" x2="${xPix.toFixed(1)}" y2="${yBot.toFixed(1)}" stroke="${color}" stroke-width="1.5"/>`;
  svg+=`<line x1="${(xPix-capHalf).toFixed(1)}" y1="${yTop.toFixed(1)}" x2="${(xPix+capHalf).toFixed(1)}" y2="${yTop.toFixed(1)}" stroke="${color}" stroke-width="1.5"/>`;
  svg+=`<line x1="${(xPix-capHalf).toFixed(1)}" y1="${yBot.toFixed(1)}" x2="${(xPix+capHalf).toFixed(1)}" y2="${yBot.toFixed(1)}" stroke="${color}" stroke-width="1.5"/>`;
  return svg;
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
function getVisibleLegendItems(dsIdxList, includeTools){
  if(includeTools===undefined) includeTools=true;
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
    } else if(!includeTools || !TOOL_KINDS.includes(dsCfg._kind)){
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
  const ptMeta=getPointStyleMeta(activeDs.pointStyle);
  const ptSize=effPointSize(activeDs), ptColor=effPointColor(activeDs,activeDatasetIdx);

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
  const legendItems=getVisibleLegendItems([activeDatasetIdx], false);

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

  if(ciVisible){
    const clip=p=>[Math.max(ml,Math.min(ml+pw,px(p.x))), Math.max(mt,Math.min(mt+ph,py(p.y)))];
    const uPts=ci.upper.filter(p=>isFinite(p.y)).map(clip);
    const lPts=ci.lower.filter(p=>isFinite(p.y)).map(clip).reverse();
    if(uPts.length>1){
      const poly=[...uPts,...lPts].map(p=>`${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
      svg+=`<polygon points="${poly}" fill="${colorWithAlpha(ptColor,0.16)}"/>`;
      const du=uPts.map((p,j)=>`${j===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
      const dl=lPts.slice().reverse().map((p,j)=>`${j===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
      svg+=`<path d="${du}" fill="none" stroke="${colorWithAlpha(ptColor,0.4)}" stroke-width="1" stroke-dasharray="4,3"/>`;
      svg+=`<path d="${dl}" fill="none" stroke="${colorWithAlpha(ptColor,0.4)}" stroke-width="1" stroke-dasharray="4,3"/>`;
    }
  }

  if(fitVisible){
    const pts=xSmooth.map((xi,i)=>[xi,ySmooth[i]]).filter(p=>isFinite(p[1]));
    if(pts.length){
      const d=pts.map((p,j)=>`${j===0?'M':'L'}${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`).join(' ');
      svg+=`<path d="${d}" fill="none" stroke="${ptColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
  }

  if(dataVisible){
    const sy=activeDs.sy||[], sigmaYMode=activeDs.sigmaYMode;
    x.forEach((xi,i)=>{ svg+=svgShape(ptMeta.key, px(xi), py(y[i]), ptSize, ptColor, 'rgba(0,0,0,0.25)', 1.5); });
    x.forEach((xi,i)=>{
      const sigma=pointSigmaAbs(sy[i], sigmaYMode, y[i]);
      if(sigma!=null) svg+=svgErrorBar(px, py, xi, y[i], sigma, ptColor, mt, ph);
    });
  }
  if(exclVisible){
    excl.forEach(([xi,yi])=>{ svg+=svgShape(ptMeta.key, px(xi), py(yi), ptSize, 'none', ptColor, 2); });
  }

  svg+=`</svg>`;

  downloadSvgFile(svg, 'regrese.svg');
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
    const ptMeta=getPointStyleMeta(ds.pointStyle);
    const ptSize=effPointSize(ds), ptColor=effPointColor(ds,i);
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
        svg+=`<polygon points="${poly}" fill="${colorWithAlpha(ptColor,0.16)}"/>`;
        const du=uPts.map((p,j)=>`${j===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
        const dl=lPts.slice().reverse().map((p,j)=>`${j===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
        svg+=`<path d="${du}" fill="none" stroke="${colorWithAlpha(ptColor,0.4)}" stroke-width="1" stroke-dasharray="4,3"/>`;
        svg+=`<path d="${dl}" fill="none" stroke="${colorWithAlpha(ptColor,0.4)}" stroke-width="1" stroke-dasharray="4,3"/>`;
      }
    }

    if(fitVisible && xSmooth){
      const pts=xSmooth.map((xi,k)=>[xi,ySmooth[k]]).filter(p=>isFinite(p[1]));
      if(pts.length){
        const d=pts.map((p,j)=>`${j===0?'M':'L'}${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`).join(' ');
        svg+=`<path d="${d}" fill="none" stroke="${ptColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
      }
    }

    if(dataVisible){
      const sy=ds.sy||[], sigmaYMode=ds.sigmaYMode;
      x.forEach((xi,k)=>{ svg+=svgShape(ptMeta.key, px(xi), py(y[k]), ptSize, ptColor, 'rgba(0,0,0,0.25)', 1.5); });
      x.forEach((xi,k)=>{
        const sigma=pointSigmaAbs(sy[k], sigmaYMode, y[k]);
        if(sigma!=null) svg+=svgErrorBar(px, py, xi, y[k], sigma, ptColor, mt, ph);
      });
    }
    if(exclVisible){
      excl.forEach(([xi,yi])=>{ svg+=svgShape(ptMeta.key, px(xi), py(yi), ptSize, 'none', ptColor, 2); });
    }
  });

  svg+=svgCombinedCurve(px,py);
  svg+=svgDerivativeTangent(px,py);

  svg+=`</svg>`;

  downloadSvgFile(svg, 'regrese_vsechna_data.svg');
}

/* ══════════════════════════════════════════════
   POKROČILÝ PRŮVODCE EXPORTEM
   Samostatná, plně parametrizovaná verze SVG exportu s živým
   náhledem — nemění chování rychlého uložení výše.
══════════════════════════════════════════════ */
let advExportState=null;
let advDragCtx=null;

function defaultAdvDatasetCfg(i, ds){
  const col=DATASET_COLORS[i%DATASET_COLORS.length];
  return {pointColor:col.point, pointStyle:ds.pointStyle, pointSize:6, lineColor:col.fit, lineWidth:2.5, dashed:false};
}

// Postaví čistě výchozí stav (bez ohledu na cokoliv uložené) — používá ho jak
// první otevření průvodce (spolu s uloženými preferencemi, viz níže), tak
// tlačítko "Obnovit výchozí".
function buildDefaultAdvExportState(mode, activeDatasetsList){
  const dsCfg={};
  activeDatasetsList.forEach(({ds,i})=>{ dsCfg[i]=defaultAdvDatasetCfg(i,ds); });
  const firstDs=activeDatasetsList[0].ds;
  return {
    mode,
    dsIdxList: activeDatasetsList.map(({i})=>i),
    bgColor:'#ffffff',
    title:{show:false, text:'Regresní analýza', tex:false, fontSize:20, dx:0, dy:0},
    // align: 'center' (vystředěno podél osy, výchozí) nebo 'edge' (u konce osy) —
    // dx/dy z přetažení myší se k té zvolené základní pozici jen připočítávají.
    xLabel:{text: mode==='all' ? firstDs.xLabel : axisLabels.x, tex:false, fontSize:12, align:'center', dx:0, dy:0},
    yLabel:{text: mode==='all' ? firstDs.yLabel : axisLabels.y, tex:false, fontSize:12, align:'center', dx:0, dy:0},
    tickFontSize:11, legendFontSize:11,
    // min/max === null znamená "automaticky podle aktuálního zobrazení grafu";
    // jakmile je vyplněné číslo, použije se místo toho.
    xRange:{min:null, max:null}, yRange:{min:null, max:null},
    datasets:dsCfg,
    legend:{} // klíč = datasetIndex položky legendy → {text, tex, hidden}
  };
}

// Vrátí skutečný rozsah osy, který se má vykreslit — buď ručně zadaný
// (advExportState.xRange/yRange), nebo (když není platný) aktuální rozsah
// živého grafu. axis je 'x' nebo 'y'.
function advResolveAxisRange(axis){
  const scale=chartInst && chartInst.scales && chartInst.scales[axis];
  const chartMin=scale ? scale.min : 0, chartMax=scale ? scale.max : 1;
  const r=advExportState ? advExportState[axis+'Range'] : null;
  let min=(r && r.min!=null && isFinite(r.min)) ? r.min : chartMin;
  let max=(r && r.max!=null && isFinite(r.max)) ? r.max : chartMax;
  if(!(max>min)){ min=chartMin; max=chartMax; } // neplatný rozsah (max<=min) — spadni na automatický
  return {min, max};
}
function advSetRangeField(axis, key, value){
  if(!advExportState) return;
  const r=advExportState[axis+'Range'];
  const trimmed=String(value||'').trim();
  const num=parseFloat(trimmed);
  r[key]=(trimmed!=='' && isFinite(num)) ? num : null;
  renderAdvExportPreview();
  // Jen cílený update upozornění (ne celý renderAdvExportPanel), ať psaní do
  // čísel neztrácí focus.
  const warnEl=document.getElementById('adv-range-warning');
  if(warnEl) warnEl.innerHTML=advRangeWarningHtml();
}

// Zjistí, jestli nějaká VYKRESLOVANÁ data (jen datasety z aktuálního
// dsIdxList — u "uložit graf" tedy jen aktivní sada, u "uložit vše" všechny)
// leží mimo aktuálně nastavený rozsah os.
function advDataOutOfRangeInfo(){
  if(!advExportState) return {xOut:false, yOut:false, anyOut:false};
  const {min:xMin,max:xMax}=advResolveAxisRange('x');
  const {min:yMin,max:yMax}=advResolveAxisRange('y');
  let xOut=false, yOut=false;
  advExportState.dsIdxList.forEach(i=>{
    const ds=datasets[i];
    if(!ds) return;
    const check=(xi,yi)=>{
      if(isFinite(xi) && (xi<xMin || xi>xMax)) xOut=true;
      if(isFinite(yi) && (yi<yMin || yi>yMax)) yOut=true;
    };
    (ds.x||[]).forEach((xi,k)=>check(xi, ds.y[k]));
    (ds.excl||[]).forEach(pt=>check(pt[0], pt[1]));
  });
  return {xOut, yOut, anyOut:xOut||yOut};
}
function advRangeWarningHtml(){
  const info=advDataOutOfRangeInfo();
  if(!info.anyOut) return '';
  const which = info.xOut && info.yOut ? 'osa X i Y' : (info.xOut ? 'osa X' : 'osa Y');
  return `<div class="adv-hint" style="color:#c83030;font-style:normal;margin-top:6px;">⚠ Část dat leží mimo nastavený rozsah (${which}) a v grafu se vykreslí mimo osy.</div>`;
}
function advResetRanges(){
  if(!advExportState) return;
  advExportState.xRange={min:null, max:null};
  advExportState.yRange={min:null, max:null};
  renderAdvExportPanel();
  renderAdvExportPreview();
}

const ADV_EXPORT_PREFS_KEY='regrese_advExportPrefs';

// Uloží "preferenční" část stavu (vše, co si uživatel v průvodci nastavil,
// kromě mode/dsIdxList, které jsou dané aktuálním grafem) do cache prohlížeče,
// aby se při dalším otevření průvodce (i po restartu appky) použila stejná.
function persistAdvExportPrefs(){
  if(!advExportState) return;
  const st=advExportState;
  const prefs={
    bgColor:st.bgColor,
    title:{show:st.title.show, text:st.title.text, tex:st.title.tex, fontSize:st.title.fontSize, dx:st.title.dx, dy:st.title.dy},
    xLabel:{text:st.xLabel.text, tex:st.xLabel.tex, fontSize:st.xLabel.fontSize, align:st.xLabel.align, dx:st.xLabel.dx, dy:st.xLabel.dy},
    yLabel:{text:st.yLabel.text, tex:st.yLabel.tex, fontSize:st.yLabel.fontSize, align:st.yLabel.align, dx:st.yLabel.dx, dy:st.yLabel.dy},
    tickFontSize:st.tickFontSize, legendFontSize:st.legendFontSize,
    xRange:st.xRange, yRange:st.yRange,
    datasets:st.datasets, legend:st.legend
  };
  try{ localStorage.setItem(ADV_EXPORT_PREFS_KEY, JSON.stringify(prefs)); }catch(e){ /* např. soukromý režim — nevadí */ }
}
function loadAdvExportPrefs(){
  try{
    const raw=localStorage.getItem(ADV_EXPORT_PREFS_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch(e){ return null; }
}
function clearAdvExportPrefs(){
  try{ localStorage.removeItem(ADV_EXPORT_PREFS_KEY); }catch(e){ /* nevadí */ }
}
// Aplikuje uložené preference na čerstvě postavený výchozí stav (v místě).
function applyAdvExportPrefs(state, prefs){
  if(!prefs) return;
  if(prefs.bgColor) state.bgColor=prefs.bgColor;
  if(prefs.title) Object.assign(state.title, prefs.title);
  if(prefs.xLabel) Object.assign(state.xLabel, prefs.xLabel);
  if(prefs.yLabel) Object.assign(state.yLabel, prefs.yLabel);
  if(prefs.tickFontSize) state.tickFontSize=prefs.tickFontSize;
  if(prefs.legendFontSize) state.legendFontSize=prefs.legendFontSize;
  if(prefs.xRange) state.xRange=Object.assign({min:null,max:null}, prefs.xRange);
  if(prefs.yRange) state.yRange=Object.assign({min:null,max:null}, prefs.yRange);
  if(prefs.datasets){
    Object.keys(state.datasets).forEach(idx=>{
      if(prefs.datasets[idx]) Object.assign(state.datasets[idx], prefs.datasets[idx]);
    });
  }
  if(prefs.legend) state.legend=JSON.parse(JSON.stringify(prefs.legend));
}

function openAdvancedExportWizard(mode){
  if(mode==='single' && (!lastResult || !lastData || !chartInst)){ alert('Nejprve proveďte regresi.'); return; }
  if(mode==='all'){
    const nWithData=datasets.filter(ds=>ds.x.length>0||ds.excl.length>0).length;
    if(nWithData<2){ alert('Pro export všech dat najednou potřebuješ alespoň 2 sady dat s daty.'); return; }
  }
  if(!chartInst){ alert('Nejprve zobraz graf.'); return; }

  const activeDatasetsList = mode==='all'
    ? datasets.map((ds,i)=>({ds,i})).filter(({ds})=>ds.x.length>0||ds.excl.length>0)
    : [{ds:datasets[activeDatasetIdx], i:activeDatasetIdx}];

  advExportState=buildDefaultAdvExportState(mode, activeDatasetsList);
  // Poškozené/zastaralé uložené preference nesmí průvodce trvale rozbít —
  // při jakékoli chybě se zahodí a jede se z čistých výchozích hodnot.
  try{ applyAdvExportPrefs(advExportState, loadAdvExportPrefs()); }
  catch(e){
    clearAdvExportPrefs();
    advExportState=buildDefaultAdvExportState(mode, activeDatasetsList);
  }
  advPreviewZoom=1;
  // Zahodit vyrovnávací paměť vytažených CSS stylů (fonty/KaTeX) při každém
  // otevření průvodce — kdyby se jednou při startu appky vytáhla neúplně
  // (např. kvůli načasování), zůstala by špatná hodnota nacachovaná napořád.
  _katexFullCssCache=null;
  for(const k in _inlineCssCache) delete _inlineCssCache[k];

  document.getElementById('adv-export-overlay').style.display='flex';
  document.body.style.overflow='hidden';
  renderAdvExportPanel();
  renderAdvExportPreview();
  initAdvExportDragHandlers();
}

function resetAdvancedExportWizard(){
  if(!advExportState) return;
  if(!confirm('Opravdu obnovit veškeré nastavení pokročilého exportu (i to uložené v prohlížeči) na výchozí hodnoty?')) return;
  clearAdvExportPrefs();
  const activeDatasetsList=advExportState.dsIdxList.map(i=>({ds:datasets[i], i}));
  advExportState=buildDefaultAdvExportState(advExportState.mode, activeDatasetsList);
  renderAdvExportPanel();
  renderAdvExportPreview();
}

function closeAdvancedExportWizard(){
  document.getElementById('adv-export-overlay').style.display='none';
  document.body.style.overflow='';
  advExportState=null;
  advDragCtx=null;
}

// Vrátí referenci na konkrétní objekt se stavem popisku pro dané "group":
// 'title'/'xLabel'/'yLabel' jsou top-level pole, 'legend:<key>' je položka
// legendy (líně založená, pokud ještě neexistuje) — díky tomu fungují
// advSetField/advToggleTex/TeX editor generiky pro všechny popisky stejně.
function advResolveFieldGroup(group){
  if(!advExportState || !group) return null;
  if(group.startsWith('legend:')){
    const key=group.slice(7);
    if(!advExportState.legend) advExportState.legend={};
    if(!advExportState.legend[key]) advExportState.legend[key]={text:'', tex:false, hidden:false};
    return advExportState.legend[key];
  }
  return advExportState[group] || null;
}

function advSetField(group,key,value){
  const obj=advResolveFieldGroup(group);
  if(!obj) return;
  obj[key]=value;
  renderAdvExportPreview();
}

// Přepínač "vysázet jako rovnici": pole zůstává obyčejný textový input,
// jen se jeho obsah interpretuje jako matematický výraz ve stejné syntaxi
// jako vlastní regresní rovnice a v náhledu/exportu se vysází KaTeXem
// (viz buildLabelHtml). Žádný oddělený editor se neotvírá.
function advToggleTex(group,checked){
  const obj=advResolveFieldGroup(group);
  if(!obj) return;
  obj.tex=checked;
  renderAdvExportPanel();
  renderAdvExportPreview();
}
function advSetTop(key,value){
  if(!advExportState) return;
  advExportState[key]=value;
  renderAdvExportPreview();
}
function advSetDsField(i,key,value){
  if(!advExportState) return;
  advExportState.datasets[i][key]=value;
  renderAdvExportPreview();
}

// Tlačítka "Zarovnat na střed" / "Zarovnat na okraj" u popisků os X/Y —
// nastaví základní pozici a zruší jakékoliv předchozí ruční přetažení myší,
// ať se popisek rovnou umístí na to správné místo.
function advAlignLabel(group, align){
  const obj=advResolveFieldGroup(group);
  if(!obj) return;
  obj.align=align; obj.dx=0; obj.dy=0;
  renderAdvExportPanel();
  renderAdvExportPreview();
}

// Dvojice tlačítek "Zarovnat na střed" / "Zarovnat na okraj" pro popisky os —
// zvýrazní tu možnost, která je právě aktivní.
function advAlignButtonsHtml(group, cfg){
  const align=cfg.align||'center';
  const btn=(val,label)=>{
    const active=align===val;
    return `<button type="button" onclick="advAlignLabel('${group}','${val}')"
      style="flex:1;background:${active?'#7c3aed':'var(--btn)'};color:${active?'#fff':'var(--text)'};border:1px solid ${active?'#7c3aed':'var(--border)'};
             border-radius:6px;padding:5px 6px;cursor:pointer;font-family:'Sora',sans-serif;font-size:11px;">${label}</button>`;
  };
  return `<div style="display:flex;gap:6px;margin-top:6px;">${btn('center','Zarovnat na střed')}${btn('edge','Zarovnat na okraj')}</div>`;
}

// Textové pole popisku — v režimu "vysázet jako rovnici" se jen přepne
// vzhled (monospace + nápovědný placeholder se syntaxí vlastní rovnice),
// pořád je to ale obyčejný input; sazbu ukazuje živý náhled vlevo.
function advTextFieldControl(group, cfg, placeholder){
  if(cfg.tex){
    return `<input type="text" placeholder="např. U_0*sin(2*pi*x/T)" value="${escapeHtmlAttr(cfg.text)}"
      style="font-family:'Fira Code',monospace;"
      oninput="advSetField('${group}','text',this.value)">`;
  }
  return `<input type="text" placeholder="${placeholder||''}" value="${escapeHtmlAttr(cfg.text)}" oninput="advSetField('${group}','text',this.value)">`;
}

function renderAdvExportPanel(){
  const st=advExportState;
  const panel=document.getElementById('adv-export-panel');
  if(!panel || !st) return;

  const dsRowsHtml=st.dsIdxList.map(i=>{
    const ds=datasets[i];
    const cfg=st.datasets[i];
    const ptOptions=POINT_STYLES.map(p=>`<option value="${p.key}" ${cfg.pointStyle===p.key?'selected':''}>${p.icon} ${escapeXml(p.label)}</option>`).join('');
    return `
    <div class="adv-ds-row">
      <div class="adv-ds-name">${escapeXml(ds.name||('Sada '+(i+1)))}</div>
      <div class="adv-ds-grid">
        <label>Barva bodů<input type="color" value="${cfg.pointColor}" oninput="advSetDsField(${i},'pointColor',this.value)"></label>
        <label>Barva křivky<input type="color" value="${cfg.lineColor}" oninput="advSetDsField(${i},'lineColor',this.value)"></label>
        <label>Tvar bodu<select onchange="advSetDsField(${i},'pointStyle',this.value)">${ptOptions}</select></label>
        <label>Velikost bodu<input type="range" min="2" max="14" step="0.5" value="${cfg.pointSize}" oninput="advSetDsField(${i},'pointSize',parseFloat(this.value))"></label>
        <label>Tloušťka čáry<input type="range" min="0.5" max="6" step="0.25" value="${cfg.lineWidth}" oninput="advSetDsField(${i},'lineWidth',parseFloat(this.value))"></label>
        <label class="adv-checkbox"><input type="checkbox" ${cfg.dashed?'checked':''} onchange="advSetDsField(${i},'dashed',this.checked)" style="margin-right:6px;"> Čárkovaná čára</label>
      </div>
    </div>`;
  }).join('');

  const rawLegendItems=getVisibleLegendItems(st.dsIdxList, st.mode==='all');
  if(!st.legend) st.legend={};
  const legendRowsHtml=rawLegendItems.map(it=>{
    const key=String(it.datasetIndex);
    if(!st.legend[key]) st.legend[key]={text:it.text, tex:false, hidden:false};
    const cfg=st.legend[key];
    return `
    <div class="adv-ds-row">
      <div class="adv-ds-name" style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
        <span style="opacity:.6;font-weight:400;font-size:11px;">${escapeXml(it.text)}</span>
        <label class="adv-checkbox" style="margin:0;flex-shrink:0;"><input type="checkbox" ${cfg.hidden?'checked':''} onchange="advSetField('legend:${key}','hidden',this.checked)" style="margin-right:4px;"> skrýt</label>
      </div>
      <div class="adv-ds-grid">
        ${advTextFieldControl('legend:'+key, cfg, 'Text položky')}
        <label class="adv-checkbox"><input type="checkbox" ${cfg.tex?'checked':''} onchange="advToggleTex('legend:${key}',this.checked)" style="margin-right:6px;"> vysázet jako rovnici <span style="opacity:.6;font-size:10.5px;">(zápis jako u vlastní rovnice)</span></label>
      </div>
    </div>`;
  }).join('') || '<div class="adv-hint">V grafu nejsou žádné viditelné položky legendy.</div>';

  panel.innerHTML=`
    <div class="adv-section">
      <div class="adv-section-title">Záhlaví</div>
      <label class="adv-checkbox"><input type="checkbox" ${st.title.show?'checked':''} onchange="advSetField('title','show',this.checked)" style="margin-right:6px;"> Zobrazit záhlaví</label>
      ${advTextFieldControl('title', st.title, 'Text záhlaví')}
      <label>Velikost písma<input type="range" min="10" max="40" value="${st.title.fontSize}" oninput="advSetField('title','fontSize',parseFloat(this.value))"></label>
      <label class="adv-checkbox"><input type="checkbox" ${st.title.tex?'checked':''} onchange="advToggleTex('title',this.checked)" style="margin-right:6px;"> vysázet jako rovnici <span style="opacity:.6;font-size:10.5px;">(zápis jako u vlastní rovnice)</span></label>
    </div>
    <div class="adv-section">
      <div class="adv-section-title">Popisek osy X</div>
      ${advTextFieldControl('xLabel', st.xLabel, 'Text osy X')}
      <label>Velikost písma<input type="range" min="8" max="26" value="${st.xLabel.fontSize}" oninput="advSetField('xLabel','fontSize',parseFloat(this.value))"></label>
      <label class="adv-checkbox"><input type="checkbox" ${st.xLabel.tex?'checked':''} onchange="advToggleTex('xLabel',this.checked)" style="margin-right:6px;"> vysázet jako rovnici <span style="opacity:.6;font-size:10.5px;">(zápis jako u vlastní rovnice)</span></label>
      ${advAlignButtonsHtml('xLabel', st.xLabel)}
    </div>
    <div class="adv-section">
      <div class="adv-section-title">Popisek osy Y</div>
      ${advTextFieldControl('yLabel', st.yLabel, 'Text osy Y')}
      <label>Velikost písma<input type="range" min="8" max="26" value="${st.yLabel.fontSize}" oninput="advSetField('yLabel','fontSize',parseFloat(this.value))"></label>
      <label class="adv-checkbox"><input type="checkbox" ${st.yLabel.tex?'checked':''} onchange="advToggleTex('yLabel',this.checked)" style="margin-right:6px;"> vysázet jako rovnici <span style="opacity:.6;font-size:10.5px;">(zápis jako u vlastní rovnice)</span></label>
      ${advAlignButtonsHtml('yLabel', st.yLabel)}
    </div>
    <div class="adv-section">
      <div class="adv-section-title">Osy a legenda</div>
      <label>Čísla na osách<input type="range" min="8" max="18" value="${st.tickFontSize}" oninput="advSetTop('tickFontSize',parseFloat(this.value))"></label>
      <label>Písmo legendy<input type="range" min="8" max="18" value="${st.legendFontSize}" oninput="advSetTop('legendFontSize',parseFloat(this.value))"></label>
      <label>Barva pozadí<input type="color" value="${st.bgColor}" oninput="advSetTop('bgColor',this.value)"></label>
      ${(()=>{
        const xr=advResolveAxisRange('x'), yr=advResolveAxisRange('y');
        const fmt=v=>Number(v.toPrecision(6));
        return `
        <div class="adv-hint" style="margin-top:8px;margin-bottom:2px;">Rozsah os (prázdné = automaticky podle grafu)</div>
        <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px;">
          <label style="font-size:11px;">X od<input type="number" step="any" value="${fmt(xr.min)}" oninput="advSetRangeField('x','min',this.value)"></label>
          <label style="font-size:11px;">X do<input type="number" step="any" value="${fmt(xr.max)}" oninput="advSetRangeField('x','max',this.value)"></label>
          <label style="font-size:11px;">Y od<input type="number" step="any" value="${fmt(yr.min)}" oninput="advSetRangeField('y','min',this.value)"></label>
          <label style="font-size:11px;">Y do<input type="number" step="any" value="${fmt(yr.max)}" oninput="advSetRangeField('y','max',this.value)"></label>
        </div>
        <button type="button" onclick="advResetRanges()"
          style="width:100%;margin-top:6px;background:transparent;border:1px dashed var(--border);color:var(--text-muted);
                 border-radius:6px;padding:5px 8px;cursor:pointer;font-family:'Sora',sans-serif;font-size:11px;">
          ↺ Resetovat rozsah os
        </button>
        <div id="adv-range-warning">${advRangeWarningHtml()}</div>`;
      })()}
    </div>
    <div class="adv-section">
      <div class="adv-section-title">Položky legendy</div>
      ${legendRowsHtml}
    </div>
    <div class="adv-section">
      <div class="adv-section-title">Sady dat</div>
      ${dsRowsHtml}
    </div>
    <div class="adv-hint">Tip: text záhlaví a popisky os lze v náhledu vlevo přetáhnout přímo myší.</div>
  `;
}


// Zmeri skutecnou sirku textu pres skryty SVG <text> - spolehlivejsi nez
// odhad podle poctu znaku, funguje pro libovolny font-style/font-weight.
let _advTextMeasureSvg=null;
function advMeasureTextWidth(text, fontSizePx, italic, bold){
  if(!text) return 0;
  const svgNS='http://www.w3.org/2000/svg';
  if(!_advTextMeasureSvg){
    _advTextMeasureSvg=document.createElementNS(svgNS,'svg');
    _advTextMeasureSvg.style.cssText='position:absolute;visibility:hidden;width:0;height:0;overflow:hidden;';
    document.body.appendChild(_advTextMeasureSvg);
  }
  const t=document.createElementNS(svgNS,'text');
  t.setAttribute('font-size', fontSizePx);
  t.setAttribute('font-family',"'Sora',sans-serif");
  if(italic) t.setAttribute('font-style','italic');
  if(bold) t.setAttribute('font-weight','700');
  t.textContent=text;
  _advTextMeasureSvg.appendChild(t);
  let w=0;
  try{ w=t.getComputedTextLength(); }catch(e){ w=text.length*fontSizePx*0.55; }
  _advTextMeasureSvg.removeChild(t);
  return w;
}

// Vytáhne z načtených stylesheetů veškerá pravidla odpovídající danému
// regexu (třídy i vložené @font-face s base64 fonty) — potřeba jen pro
// samostatně stažené SVG, které nemá přístup ke stylesheetu stránky.
// Výsledky se cachují podle vzoru, protože stylesheet se za běhu nemění.
const _inlineCssCache={};
function getInlineCssMatching(cacheKey, testRe){
  if(_inlineCssCache[cacheKey]!==undefined) return _inlineCssCache[cacheKey];
  let css='';
  try{
    for(const sheet of document.styleSheets){
      let rules;
      try{ rules=sheet.cssRules||sheet.rules; }catch(e){ continue; }
      if(!rules) continue;
      for(const rule of rules){
        const txt=rule.cssText||'';
        if(testRe.test(txt)) css+=txt+'\n';
      }
    }
  }catch(e){ /* i bez toho se zbytek SVG vykresli spravne */ }
  _inlineCssCache[cacheKey]=css;
  return css;
}
// SKUTEČNÁ příčina dřívějšího "ošklivého fontu" v exportu: CSS pro export se
// tahalo za běhu z document.styleSheets, jenže když je appka otevřená přímo
// ze souboru (file://), prohlížeč přístup k pravidlům style.css zablokuje
// (SecurityError) — tichý catch pak vrátil prázdný řetězec a stažené SVG
// zůstalo úplně bez KaTeX tříd i bez fontů (Sora, Fira Code, KaTeX_*).
// Náhled přitom vypadal správně, protože ten je součástí stránky a styly na
// něj dopadají normálně. Proto teď primární zdroj CSS je window.__STYLE_CSS_TEXT__
// (kopie style.css nesená v style-embed.js jako <script> — ta se načte vždy,
// file:// i web) a document.styleSheets zůstává jen jako záloha.
let _katexFullCssCache=null;
function getKatexInlineCss(){
  if(typeof window.__STYLE_CSS_TEXT__==='string' && window.__STYLE_CSS_TEXT__.includes('.katex')){
    return window.__STYLE_CSS_TEXT__;
  }
  if(_katexFullCssCache!==null) return _katexFullCssCache;
  let css='';
  try{
    for(const sheet of document.styleSheets){
      let rules;
      try{ rules=sheet.cssRules||sheet.rules; }catch(e){ continue; }
      if(!rules) continue;
      for(const rule of rules){ css+=(rule.cssText||'')+'\n'; }
    }
  }catch(e){ /* i bez toho se zbytek SVG vykresli spravne */ }
  if(!css.includes('.katex')) console.warn('Export SVG: KaTeX CSS se nepodařilo získat — TeX popisky budou ve staženém souboru vypadat jinak než v náhledu.');
  _katexFullCssCache=css;
  return css;
}
// Sora + Fira Code jsou self-hostované přímo ve style.css (base64 @font-face) —
// export vytáhne příslušná @font-face pravidla z window.__STYLE_CSS_TEXT__
// (spolehlivé i na file://, viz komentář u getKatexInlineCss), případně
// záložně z document.styleSheets.
function getAppFontsInlineCss(){
  const src=window.__STYLE_CSS_TEXT__;
  if(typeof src==='string' && src.length){
    const faces=(src.match(/@font-face\{[^}]*\}/g)||[])
      .filter(f=>/font-family:\s*['"]?(Sora|Fira Code)/i.test(f));
    if(faces.length) return faces.join('\n');
  }
  return getInlineCssMatching('appfonts', /@font-face[^}]*font-family:\s*['"]?(Sora|Fira Code)/i);
}

// Zmeri skutecnou vykreslenou velikost kusu HTML (pouzivano pro foreignObject
// box v exportovanem SVG) pres skryty DOM element.
let _advHtmlMeasureDiv=null;
function advMeasureHtmlBox(html, fontSizePx){
  if(!_advHtmlMeasureDiv){
    _advHtmlMeasureDiv=document.createElement('div');
    _advHtmlMeasureDiv.style.cssText='position:absolute;visibility:hidden;left:-99999px;top:-99999px;white-space:nowrap;pointer-events:none;';
    document.body.appendChild(_advHtmlMeasureDiv);
  }
  _advHtmlMeasureDiv.style.fontSize=fontSizePx+'px';
  _advHtmlMeasureDiv.style.fontFamily="'Sora',sans-serif";
  _advHtmlMeasureDiv.style.lineHeight='1.25';
  _advHtmlMeasureDiv.innerHTML=html || '&nbsp;';
  const r=_advHtmlMeasureDiv.getBoundingClientRect();
  return {width:r.width, height:r.height};
}

// Vrátí vysázené HTML pro popisek v "režimu rovnice": vstup je matematický
// výraz ve STEJNÉ syntaxi jako vlastní regresní rovnice (mathjs — např.
// U_0*sin(2*pi*x/T) nebo a*x^2+b) a vysází se stejně, jako se sází rovnice
// v pruhu pod grafem (math.parse(...).toTex() → KaTeX, output:'html').
// Neplatný výraz vyhodí výjimku — volající spadnou na obyčejný text.
function buildLabelHtml(rawText){
  const raw=(rawText||'').trim();
  if(!raw) return '';
  const tex=math.parse(raw).toTex({handler:texSymbolHandler});
  return katex.renderToString(tex, {throwOnError:true, displayMode:false, strict:false, output:'html'});
}

// Vykresli popisek bud jako obycejny <text>, nebo (je-li zapnuty TeX mod)
// jako <foreignObject> se skutecnym HTML/KaTeX obsahem z buildLabelHtml -
// obojí obalene v <g data-adv-key> kvuli pretahovani mysi v nahledu.
function advTextEl(cfg, x, y, anchor, color, extraStyle, keyId){
  extraStyle=extraStyle||'';
  if(cfg.tex && (cfg.text||'').trim()){
    try{
      const html=buildLabelHtml(cfg.text);
      const box=advMeasureHtmlBox(html, cfg.fontSize);
      // Rezerva navíc jen na šířku (jiný prohlížeč/nástroj může mít nepatrně
      // jiné metriky fontu) — výšku NEnafukujeme, box je nahoře zarovnaný,
      // takže by to jen posunulo text nahoru mimo zamýšlenou pozici.
      const w=Math.max(1,Math.ceil(box.width*1.08))+8, h=Math.max(1,Math.ceil(box.height))+4;
      let fx=x;
      if(anchor==='middle') fx=x-w/2;
      else if(anchor==='end') fx=x-w;
      const fy=y-h*0.78;
      const fo=`<foreignObject x="${fx.toFixed(1)}" y="${fy.toFixed(1)}" width="${w}" height="${h}" overflow="visible" requiredExtensions="http://www.w3.org/1999/xhtml"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:'Sora',sans-serif;font-size:${cfg.fontSize}px;line-height:1.25;color:${color};white-space:nowrap;overflow:visible;${extraStyle}">${html}</div></foreignObject>`;
      // <switch> — nástroje/prohlížeče bez podpory foreignObject (Word,
      // PowerPoint, některé náhledy souborů…) automaticky spadnou na obyčejný
      // <text> s nevykresleným TeX zdrojem, místo aby popisek úplně zmizel.
      const fallback=`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" font-size="${cfg.fontSize}" fill="${color}" style="${extraStyle}">${escapeXml(cfg.text||'')}</text>`;
      return `<g data-adv-key="${keyId}"><switch>${fo}${fallback}</switch></g>`;
    }catch(e){ /* spadni na obycejny text */ }
  }
  return `<g data-adv-key="${keyId}"><text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" font-size="${cfg.fontSize}" fill="${color}" style="${extraStyle}">${escapeXml(cfg.text||'')}</text></g>`;
}

function advAxesAndGrid(ml, mt, pw, ph, xMin, xMax, yMin, yMax, tickFontSize, plotBg){
  let svg='';
  svg+=`<rect x="${ml}" y="${mt}" width="${pw}" height="${ph}" fill="${plotBg}"/>`;
  const xRange=xMax-xMin||1, yRange=yMax-yMin||1;
  for(let i=0;i<=5;i++){
    const gy=mt+i*ph/5, gx=ml+i*pw/5;
    svg+=`<line x1="${ml}" y1="${gy}" x2="${ml+pw}" y2="${gy}" stroke="rgba(0,0,0,0.07)" stroke-width="1"/>`;
    svg+=`<line x1="${gx}" y1="${mt}" x2="${gx}" y2="${mt+ph}" stroke="rgba(0,0,0,0.07)" stroke-width="1"/>`;
    const yVal=(yMin+((5-i)/5)*yRange).toPrecision(4);
    const xVal=(xMin+(i/5)*xRange).toPrecision(4);
    svg+=`<text x="${ml-6}" y="${gy+4}" text-anchor="end" font-size="${tickFontSize}" fill="#444456" font-family="'Fira Code',monospace">${yVal}</text>`;
    svg+=`<text x="${gx}" y="${mt+ph+16}" text-anchor="middle" font-size="${tickFontSize}" fill="#444456" font-family="'Fira Code',monospace">${xVal}</text>`;
  }
  svg+=`<line x1="${ml}" y1="${mt}" x2="${ml}" y2="${mt+ph}" stroke="#cccccc" stroke-width="1.5"/>`;
  svg+=`<line x1="${ml}" y1="${mt+ph}" x2="${ml+pw}" y2="${mt+ph}" stroke="#cccccc" stroke-width="1.5"/>`;
  return svg;
}

// Vezme surové položky z getVisibleLegendItems a aplikuje na ně uživatelské
// úpravy z advExportState.legend (přepsaný text, TeX režim, skrytí) — klíčuje
// se podle datasetIndex z živého grafu, což je v rámci otevřeného průvodce stálé.
function advResolveLegendItems(rawItems){
  if(!advExportState) return [];
  if(!advExportState.legend) advExportState.legend={};
  const st=advExportState;
  return rawItems.map(it=>{
    const key=String(it.datasetIndex);
    if(!st.legend[key]) st.legend[key]={text:it.text, tex:false, hidden:false};
    const cfg=st.legend[key];
    if(cfg.hidden) return null;

    // Značka v legendě musí vypadat PŘESNĚ jako to, co se skutečně kreslí do
    // grafu (viz buildAdvExportSvg) — ne jako živý graf, jehož barvy/styl bodů
    // uživatel v panelu "Sady dat" mohl v průvodci přepsat.
    let fillStyle=it.fillStyle, strokeStyle=it.strokeStyle, lineWidth=it.lineWidth,
        pointStyle=it.pointStyle, rotation=it.rotation;
    const chartDs=chartInst && chartInst.data.datasets[it.datasetIndex];
    const dsIdx=chartDs ? chartDs._dsIdx : undefined;
    const kind=chartDs ? chartDs._kind : undefined;
    const dcfg=(dsIdx!==undefined && st.datasets) ? st.datasets[dsIdx] : null;
    if(dcfg){
      if(kind==='data'){
        const meta=getPointStyleMeta(dcfg.pointStyle);
        fillStyle=dcfg.pointColor; strokeStyle='rgba(0,0,0,0.25)'; lineWidth=1.5;
        pointStyle=meta.chart; rotation=meta.rotation;
      } else if(kind==='excl'){
        const meta=getPointStyleMeta(dcfg.pointStyle);
        fillStyle='none'; strokeStyle=dcfg.pointColor; lineWidth=2;
        pointStyle=meta.chart; rotation=meta.rotation;
      } else if(kind==='fit'){
        strokeStyle=dcfg.lineColor; lineWidth=dcfg.lineWidth;
      }
    }
    return {key, text:cfg.text, tex:cfg.tex, fillStyle, strokeStyle, lineWidth, pointStyle, rotation};
  }).filter(Boolean);
}

// Vrátí vykreslenou "značku" položky legendy (obyčejný text nebo TeX SVG)
// a její skutečnou šířku — díky tomu se řádky legendy lámou správně i s TeXem.
function advLegendItemGlyph(item, fontSize){
  if(item.tex && (item.text||'').trim()){
    try{
      const html=buildLabelHtml(item.text);
      const box=advMeasureHtmlBox(html, fontSize);
      if(box.width>0){
        const w=Math.ceil(box.width*1.08)+8, h=Math.ceil(box.height*1.1)+6;
        // display:flex;align-items:center — díky tomu box vertikálně centrovaný
        // na y (tj. na stejné výšce jako značka) zůstane přesně vystředěný i s
        // rezervou navíc na výšku (jinak by top-aligned obsah vizuálně "vyjel" nahoru).
        // POZOR: obsah (html) musí být zabalený v JEDNOM vnitřním <span>, ne
        // vložený přímo jako děti flex kontejneru — flexbox dělá z KAŽDÉHO
        // přímého potomka (i anonymního boxu kolem "Data 3 " textového uzlu)
        // samostatnou flex položku a mezera na konci takového odděleného
        // textového uzlu se před sousední <span> (KaTeX) ořízne jako "konec
        // řádku" → proto mizela mezera mezi textem a matematikou v legendě.
        // <switch> — nástroje bez podpory foreignObject spadnou na prostý text.
        return {width:w, render:(x,y)=>{
          const fo=`<foreignObject x="${x.toFixed(1)}" y="${(y-h/2).toFixed(1)}" width="${w}" height="${h}" overflow="visible" requiredExtensions="http://www.w3.org/1999/xhtml"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:'Sora',sans-serif;font-size:${fontSize}px;line-height:1.25;color:#444456;white-space:nowrap;overflow:visible;display:flex;align-items:center;height:100%;"><span>${html}</span></div></foreignObject>`;
          const fallback=`<text x="${x.toFixed(1)}" y="${(y+4).toFixed(1)}" font-size="${fontSize}" fill="#444456">${escapeXml(item.text)}</text>`;
          return `<switch>${fo}${fallback}</switch>`;
        }};
      }
    }catch(e){ /* spadni na obyčejný text */ }
  }
  const width=advMeasureTextWidth(item.text, fontSize, false, false);
  return {width, render:(x,y)=>`<text x="${x.toFixed(1)}" y="${(y+4).toFixed(1)}" font-size="${fontSize}" fill="#444456">${escapeXml(item.text)}</text>`};
}

function advLayoutLegendRows(items, availW, legendFontSize){
  const rows=[]; let curRow=[], curW=0;
  items.forEach(item=>{
    const glyph=advLegendItemGlyph(item, legendFontSize);
    const w=24+glyph.width+16;
    if(curRow.length && curW+w>availW){ rows.push(curRow); curRow=[]; curW=0; }
    curRow.push({item, glyph, w}); curW+=w;
  });
  if(curRow.length) rows.push(curRow);
  return rows;
}
function advLegendRows(rows, W, legendFontSize){
  const rowH=legendFontSize+9;
  let svg='';
  rows.forEach((row,ri)=>{
    const rowWidth=row.reduce((s,r)=>s+r.w,0);
    let lx=(W-rowWidth)/2;
    const ly=16+ri*rowH;
    row.forEach(r=>{
      const it=r.item;
      const fill=it.fillStyle||'transparent', stroke=it.strokeStyle||'#444456', lw=it.lineWidth||1.5;
      svg+=svgChartPointShape(it.pointStyle, it.rotation, lx+7, ly, 5, fill, stroke, lw);
      svg+=r.glyph.render(lx+24, ly);
      lx+=r.w;
    });
  });
  return svg;
}

function buildAdvExportSvg(forExport){
  const st=advExportState;
  if(!st || !chartInst) return '';
  const activeDatasetsList=st.dsIdxList.map(i=>({ds:datasets[i], i}));
  const {min:xMin,max:xMax}=advResolveAxisRange('x');
  const {min:yMin,max:yMax}=advResolveAxisRange('y');
  const rawLegendItems=getVisibleLegendItems(st.dsIdxList, st.mode==='all');
  const legendItems=advResolveLegendItems(rawLegendItems);

  const W=900, H=600, ml=70, mr=30, mb=70;
  const legendRows=advLayoutLegendRows(legendItems, W-40, st.legendFontSize);
  const legendH=legendRows.length ? 10+legendRows.length*(st.legendFontSize+9) : 0;
  const titleH=st.title.show ? st.title.fontSize+16 : 0;
  const mt=16+titleH+legendH+8;
  const pw=W-ml-mr, ph=H-mt-mb;

  const px=v=>ml+(v-xMin)/(xMax-xMin||1)*pw;
  const py=v=>mt+ph-(v-yMin)/(yMax-yMin||1)*ph;

  // Kolem "těsného" grafu (W×H) je při editaci velkorysý pracovní okraj PAD,
  // aby šlo nadpis/popisky odtáhnout myší i mimo původní hranice grafu bez
  // toho, aby se rovnou oříznuly. Při skutečném uložení (forExport) se pak
  // podle toho, kam uživatel věci reálně umístil, automaticky domaže zpět
  // (viz advAutoCropSvg) — takže výsledný soubor těsně obepíná jen to, co je
  // v něm doopravdy vidět, žádný zbytečně velký prázdný okraj.
  const PAD=150;
  const outerW=W+2*PAD, outerH=H+2*PAD;

  let inner='';
  if(st.title.show){
    inner+=advTextEl(st.title, W/2+st.title.dx, 14+st.title.fontSize*0.78+st.title.dy, 'middle', '#222222', 'font-weight:700;', 'title');
  }
  inner+=`<g transform="translate(0,${titleH})">${advLegendRows(legendRows, W, st.legendFontSize)}</g>`;
  inner+=advAxesAndGrid(ml,mt,pw,ph,xMin,xMax,yMin,yMax, st.tickFontSize, st.bgColor==='#ffffff' ? '#fafafa' : st.bgColor);

  // "Zarovnat na okraj" posune základní pozici k pravému/hornímu konci osy
  // místo vystředění podél celé osy — dx/dy z přetažení myší se počítá navíc.
  const xLabelBaseX = st.xLabel.align==='edge' ? (ml+pw-40) : (ml+pw/2);
  inner+=advTextEl(st.xLabel, xLabelBaseX+st.xLabel.dx, H-12+st.xLabel.dy, 'middle', '#444456', '', 'xlabel');
  const ylCx=16+st.yLabel.dx, ylCyBase = st.yLabel.align==='edge' ? (mt+30) : (mt+ph/2);
  const ylCy=ylCyBase+st.yLabel.dy;
  inner+=`<g transform="rotate(-90,${ylCx.toFixed(1)},${ylCy.toFixed(1)})">${advTextEl(st.yLabel, ylCx, ylCy, 'middle', '#444456', '', 'ylabel')}</g>`;

  // Přesahy z panelu Nástroje (kombinace/integrál/derivace) patří jen do
  // exportu "uložit vše" — u samostatného grafu má zůstat jen jeho vlastní funkce.
  if(st.mode==='all') inner+=svgIntegralArea(px,py,ml,mt,pw,ph);

  activeDatasetsList.forEach(({ds,i})=>{
    const cfg=st.datasets[i];
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

    const baseCol=DATASET_COLORS[i%DATASET_COLORS.length];
    const col={point:cfg.pointColor, fit:cfg.lineColor, ciBorder:baseCol.ciBorder, ciBg:baseCol.ciBg, excl:cfg.pointColor};

    if(ci){
      const clip=p=>[Math.max(ml,Math.min(ml+pw,px(p.x))), Math.max(mt,Math.min(mt+ph,py(p.y)))];
      const uPts=ci.upper.filter(p=>isFinite(p.y)).map(clip);
      const lPts=ci.lower.filter(p=>isFinite(p.y)).map(clip).reverse();
      if(uPts.length>1){
        const poly=[...uPts,...lPts].map(p=>`${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
        inner+=`<polygon points="${poly}" fill="${col.ciBg}"/>`;
        const du=uPts.map((p,j)=>`${j===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
        const dl=lPts.slice().reverse().map((p,j)=>`${j===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
        inner+=`<path d="${du}" fill="none" stroke="${col.ciBorder}" stroke-width="1" stroke-dasharray="4,3"/>`;
        inner+=`<path d="${dl}" fill="none" stroke="${col.ciBorder}" stroke-width="1" stroke-dasharray="4,3"/>`;
      }
    }
    if(fitVisible && xSmooth){
      const pts=xSmooth.map((xi,k)=>[xi,ySmooth[k]]).filter(p=>isFinite(p[1]));
      if(pts.length){
        const d=pts.map((p,j)=>`${j===0?'M':'L'}${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`).join(' ');
        const dash=cfg.dashed?' stroke-dasharray="7,4"':'';
        inner+=`<path d="${d}" fill="none" stroke="${col.fit}" stroke-width="${cfg.lineWidth}" stroke-linecap="round" stroke-linejoin="round"${dash}/>`;
      }
    }
    if(dataVisible){
      const sy=ds.sy||[], sigmaYMode=ds.sigmaYMode;
      x.forEach((xi,k)=>{ inner+=svgShape(cfg.pointStyle, px(xi), py(y[k]), cfg.pointSize, col.point, 'rgba(0,0,0,0.25)', 1.5); });
      x.forEach((xi,k)=>{
        const sigma=pointSigmaAbs(sy[k], sigmaYMode, y[k]);
        if(sigma!=null) inner+=svgErrorBar(px, py, xi, y[k], sigma, col.fit, mt, ph);
      });
    }
    if(exclVisible){
      excl.forEach(([xi,yi])=>{ inner+=svgShape(cfg.pointStyle, px(xi), py(yi), cfg.pointSize, 'none', col.excl, 2); });
    }
  });

  if(st.mode==='all'){
    inner+=svgCombinedCurve(px,py);
    inner+=svgDerivativeTangent(px,py);
  }

  // Samostatně stažené SVG (forExport) nemá přístup ke stylesheetu stránky,
  // takže si musí Sora/Fira Code (vč. base64 fontů) nést rovnou v sobě, jinak
  // by se po otevření mimo appku zobrazily jiným (fallback) písmem. KaTeX CSS
  // se přidává navíc jen tehdy, když je někde skutečně zapnutý TeX režim.
  const anyTex=(st.title.show && st.title.tex) || st.xLabel.tex || st.yLabel.tex || legendItems.some(it=>it.tex);
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${outerW}" height="${outerH}" viewBox="0 0 ${outerW} ${outerH}" font-family="'Sora',sans-serif">`;
  if(forExport){
    // <style> je přímo pod <svg> (ne zabalený v <defs>) a obsah je v CDATA —
    // CSS tak nemůže rozbít XML validitu souboru, ať obsahuje cokoliv.
    // Při zapnutém TeXu se vkládá celý style.css (obsahuje i Sora/Fira Code
    // fonty), takže samostatný blok s fonty by byl jen duplicitně.
    const wrapCss=css=>`<style><![CDATA[\n${css.replace(/\]\]>/g,'')}\n]]></style>`;
    if(anyTex){
      const katexCss=getKatexInlineCss();
      if(katexCss) svg+=wrapCss(katexCss);
      else { const f=getAppFontsInlineCss(); if(f) svg+=wrapCss(f); }
    } else {
      const fontsCss=getAppFontsInlineCss();
      if(fontsCss) svg+=wrapCss(fontsCss);
    }
  }
  // Pozadí kryje CELOU pracovní plochu (vč. okraje pro přetahování) hned od
  // začátku, ať po ořezu na skutečně použitou oblast nikde nechybí barva.
  svg+=`<rect width="${outerW}" height="${outerH}" fill="${st.bgColor}"/>`;
  svg+=`<g data-adv-content="1" transform="translate(${PAD},${PAD})">${inner}</g>`;
  svg+='</svg>';

  if(forExport){
    svg=svg.replace(/\s*data-adv-key="[^"]*"/g,'');
    svg=advAutoCropSvg(svg, PAD);
  }
  return svg;
}

// Po vygenerování exportního SVG (forExport=true) změří skutečný rozsah
// vykresleného obsahu (přes getBBox živého náhledu v DOMu — je vždy aktuální,
// protože se překresluje po každé změně) a přepíše viewBox/width/height tak,
// aby těsně obepínal jen to, co je doopravdy vidět (title/popisky mohly být
// odtažené mimo původní "těsné" hranice grafu) — plus malý finální okraj.
// Při jakémkoli selhání se radši vrátí neořízlé SVG, než aby export spadl.
function advAutoCropSvg(svgString, pad){
  try{
    const previewSvg=document.querySelector('#adv-export-preview svg');
    const contentG=previewSvg && previewSvg.querySelector('g[data-adv-content]');
    if(!contentG || typeof contentG.getBBox!=='function') return svgString;
    const bbox=contentG.getBBox();
    if(!bbox || !isFinite(bbox.width) || !isFinite(bbox.height) || bbox.width<=0 || bbox.height<=0) return svgString;
    const FINAL_PAD=14;
    const vx=Math.floor(bbox.x+pad-FINAL_PAD), vy=Math.floor(bbox.y+pad-FINAL_PAD);
    const vw=Math.ceil(bbox.width+2*FINAL_PAD), vh=Math.ceil(bbox.height+2*FINAL_PAD);
    return svgString.replace(/width="[^"]*" height="[^"]*" viewBox="[^"]*"/, `width="${vw}" height="${vh}" viewBox="${vx} ${vy} ${vw} ${vh}"`);
  }catch(e){ return svgString; }
}

function renderAdvExportPreview(){
  const container=document.getElementById('adv-export-preview');
  if(!container || !advExportState) return;
  container.innerHTML=buildAdvExportSvg(false);
  advApplyPreviewZoom();
  persistAdvExportPrefs();
}

// Zoom náhledu v Pokročilém průvodci exportem — čistě zobrazovací věc (jak
// moc velký je náhled na obrazovce), vůbec neovlivňuje uložený soubor. Náhled
// má okolo grafu velkorysý pracovní okraj pro přetahování (viz PAD v
// buildAdvExportSvg), takže na 100 % je logicky o něco "oddálenější" než graf
// samotný — přiblížením si můžeš při přetahování popisků pomoct na přesnost.
let advPreviewZoom=1;
function advApplyPreviewZoom(){
  const svgEl=document.querySelector('#adv-export-preview svg');
  if(!svgEl) return;
  const baseWidth=900; // stejná výchozí šířka náhledu jako dřív (bez pracovního okraje)
  svgEl.style.width=Math.round(baseWidth*advPreviewZoom)+'px';
  svgEl.style.height='auto';
  svgEl.style.maxWidth='none';
  svgEl.style.display='block';
  const label=document.getElementById('adv-preview-zoom-label');
  if(label) label.textContent=Math.round(advPreviewZoom*100)+'%';
}
function advSetPreviewZoom(newZoom){
  advPreviewZoom=Math.max(0.4, Math.min(3, newZoom));
  advApplyPreviewZoom();
}
function advZoomPreviewBy(factor){
  advSetPreviewZoom(advPreviewZoom*factor);
}
function advResetPreviewZoom(){
  advSetPreviewZoom(1);
}

function svgPointFromEvent(svgEl, evt){
  const pt=svgEl.createSVGPoint();
  pt.x=evt.clientX; pt.y=evt.clientY;
  const ctm=svgEl.getScreenCTM();
  if(!ctm) return {x:0,y:0};
  const loc=pt.matrixTransform(ctm.inverse());
  return {x:loc.x, y:loc.y};
}
function advKeyToStateField(key){
  if(!advExportState) return null;
  if(key==='title') return advExportState.title;
  if(key==='xlabel') return advExportState.xLabel;
  if(key==='ylabel') return advExportState.yLabel;
  return null;
}
function advExportOnPointerDown(e){
  const container=document.getElementById('adv-export-preview');
  const el=e.target.closest('[data-adv-key]');
  if(!el || !advExportState || !container) return;
  const field=advKeyToStateField(el.getAttribute('data-adv-key'));
  if(!field) return;
  const svgEl=container.querySelector('svg');
  if(!svgEl) return;
  e.preventDefault();
  const start=svgPointFromEvent(svgEl, e);
  advDragCtx={field, startX:start.x, startY:start.y, startDx:field.dx, startDy:field.dy};
  window.addEventListener('pointermove', advExportOnPointerMove);
  window.addEventListener('pointerup', advExportOnPointerUp);
}
function advExportOnPointerMove(e){
  if(!advDragCtx) return;
  const container=document.getElementById('adv-export-preview');
  const svgEl=container && container.querySelector('svg');
  if(!svgEl) return;
  const cur=svgPointFromEvent(svgEl, e);
  advDragCtx.field.dx=advDragCtx.startDx+(cur.x-advDragCtx.startX);
  advDragCtx.field.dy=advDragCtx.startDy+(cur.y-advDragCtx.startY);
  renderAdvExportPreview();
}
function advExportOnPointerUp(){
  advDragCtx=null;
  window.removeEventListener('pointermove', advExportOnPointerMove);
  window.removeEventListener('pointerup', advExportOnPointerUp);
}
let advDragHandlersInit=false;
function initAdvExportDragHandlers(){
  if(advDragHandlersInit) return;
  advDragHandlersInit=true;
  const container=document.getElementById('adv-export-preview');
  if(container) container.addEventListener('pointerdown', advExportOnPointerDown);
}

function saveAdvancedExportSvg(){
  if(!advExportState) return;
  const svg=buildAdvExportSvg(true);
  downloadSvgFile(svg, advExportState.mode==='all' ? 'regrese_vsechna_data_pokrocile.svg' : 'regrese_pokrocile.svg');
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

// Rezidua se dají zobrazit absolutně (naměřeno − fit, jednotky y), nebo —
// když jsou u aktivního datasetu zadané nejistoty σy — normovaně jako
// (naměřeno − fit)/σy v jednotkách σ. Normovaný pohled je standardní
// diagnostika váženého fitu: body mimo ±2σ jsou podezřelé, |rezidua| by
// zhruba ze 2/3 měla ležet do ±1σ (proto vodicí čáry ±1σ a ±2σ).
let residualsNormalized=false;

function residualsSigmaAvailable(ds){
  if(!ds || !ds.sigmaYOn || !Array.isArray(ds.sy)) return false;
  // aspoň jeden bod s platnou σy>0 — jen pro ty jde normované reziduum spočítat
  return ds.x.some((xi,i)=>pointSigmaAbs(ds.sy[i], ds.sigmaYMode, ds.y[i])!=null);
}

function setResidualsNormalized(norm){
  residualsNormalized=!!norm;
  renderResidualsChart();
}
function toggleResidualsNormalized(){
  setResidualsNormalized(!residualsNormalized);
}

function openResiduals(){
  const overlay=document.getElementById('residuals-overlay');
  overlay.style.display='flex';
  document.body.style.overflow='hidden';
  renderResidualsChart();
}

function renderResidualsChart(){
  const canvas=document.getElementById('residuals-canvas');
  const ds=datasets[activeDatasetIdx];
  const r=ds ? ds.lastResult : null;
  if(residualsChart){ residualsChart.destroy(); residualsChart=null; }

  const hasSigma=residualsSigmaAvailable(ds);
  if(!hasSigma) residualsNormalized=false;
  const norm=residualsNormalized;

  // Přepínač absolutní / v jednotkách σ se ukazuje jen, když σy dává smysl
  const modeRow=document.getElementById('residuals-mode-row');
  if(modeRow) modeRow.style.display=hasSigma?'flex':'none';
  const knob=document.getElementById('residuals-mode-knob');
  if(knob) knob.style.left=norm?'16px':'1px';
  const absLbl=document.getElementById('residuals-mode-abs-lbl');
  const normLbl=document.getElementById('residuals-mode-norm-lbl');
  if(absLbl){ absLbl.style.color=norm?'var(--text-muted)':'var(--accent)'; absLbl.style.fontWeight=norm?'400':'700'; }
  if(normLbl){ normLbl.style.color=norm?'var(--accent)':'var(--text-muted)'; normLbl.style.fontWeight=norm?'700':'400'; }
  const desc=document.getElementById('residuals-desc');
  if(desc) desc.textContent = norm
    ? 'Rezidua normovaná na nejistotu: (naměřeno − fit)/σy. Zhruba 2/3 bodů by měly ležet v pásu ±1σ, body mimo ±2σ jsou podezřelé.'
    : 'Rozdíly (naměřeno − fit) pro každý bod. Náhodný rozptyl kolem nuly bez vzoru značí dobrý fit.';

  if(!r || !r.yp){ return; }

  const x=ds.x, y=ds.y, sy=ds.sy||[];
  const resid=[];
  x.forEach((xi,i)=>{
    if(i>=r.yp.length) return;
    const d=y[i]-r.yp[i];
    if(norm){
      const sigma=pointSigmaAbs(sy[i], ds.sigmaYMode, y[i]);
      if(sigma!=null) resid.push({x:xi, y:d/sigma});
    } else {
      resid.push({x:xi, y:d});
    }
  });
  if(!resid.length) return;

  const xMin=Math.min(...x), xMax=Math.max(...x);
  const c=chartColors();
  const ptColor=effPointColor(ds, activeDatasetIdx);

  const chartDatasets=[
    {
      label:norm?'rezidua / σy':'rezidua',
      data:resid,
      backgroundColor:ptColor,borderColor:'rgba(255,255,255,.7)',borderWidth:1.5,pointRadius:5
    },
    {
      type:'line',label:'nula',
      data:[{x:xMin,y:0},{x:xMax,y:0}],
      borderColor:'rgba(200,48,48,.6)',borderWidth:1.5,borderDash:[6,4],pointRadius:0,fill:false
    }
  ];
  if(norm){
    // Vodicí čáry ±1σ a ±2σ — jen orientační, bez položky v legendě by ale
    // nebylo jasné, co jsou zač, proto σ pásy dostávají popisky.
    [[1,'±1σ','rgba(120,120,140,.55)'],[2,'±2σ','rgba(120,120,140,.3)']].forEach(([k,label,color])=>{
      chartDatasets.push({
        type:'line',label:label,
        data:[{x:xMin,y:k},{x:xMax,y:k}],
        borderColor:color,borderWidth:1,borderDash:[3,4],pointRadius:0,fill:false
      });
      chartDatasets.push({
        type:'line',label:'_'+label+'dolni',
        data:[{x:xMin,y:-k},{x:xMax,y:-k}],
        borderColor:color,borderWidth:1,borderDash:[3,4],pointRadius:0,fill:false
      });
    });
  }

  residualsChart=new Chart(canvas.getContext('2d'), {
    type:'scatter',
    data:{ datasets:chartDatasets },
    options:{
      responsive:true,maintainAspectRatio:false,
      scales:{
        x:{type:'linear',title:{display:true,text:axisLabels.x,color:c.text},ticks:{color:c.text},grid:{color:c.grid}},
        y:{title:{display:true,text:norm?'(naměřeno − fit) / σy':'naměřeno − fit',color:c.text},ticks:{color:c.text},grid:{color:c.grid}}
      },
      plugins:{legend:{labels:{color:c.text,usePointStyle:true,pointStyle:'circle',
        filter:item=>!String(item.text).startsWith('_')}}}
    }
  });
}

function closeResiduals(){
  document.getElementById('residuals-overlay').style.display='none';
  document.body.style.overflow='';
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeNavod(); });
document.addEventListener('keydown', e => {
  if(e.key==='Escape'){
    const ov=document.getElementById('swapxy-labels-overlay');
    if(ov && ov.style.display==='flex') cancelSwapXYChoice();
  }
});

// Escape zavírá i Pokročilý průvodce exportem — stejné chování jako klik mimo okno.
document.addEventListener('keydown', e => {
  if(e.key!=='Escape') return;
  const expOv=document.getElementById('adv-export-overlay');
  if(expOv && expOv.style.display==='flex') closeAdvancedExportWizard();
});

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
let advSelX = null, advSelY = null, advSelSy = null; // index vybraného sloupce/řádku
let advWantSigma = false; // "chci vybrat i σy" — volitelné, nikdy neblokuje potvrzení
let advFileName = null;

// Otevře Průvodce vložením dat pro daný text — sdíleno mezi ručním tlačítkem
// "načíst pokročilé" (advLoadFile) a automatickým vkládáním přetažením
// souborů na graf (viz processNextDropImport níže). Jméno souboru se vždy
// zobrazí v hlavičce průvodce (updateAdvFileNameDisplay), ať uživatel vždy
// vidí, o jaká data jde.
function openAdvWizardWithText(text, fileName){
  advFileName = fileName;
  advParsed = advParse(text);
  advSelX = null; advSelY = null;
  advRender();
  updateAdvFileNameDisplay();
  const ov = document.getElementById('adv-overlay');
  ov.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function updateAdvFileNameDisplay(){
  const el=document.getElementById('adv-filename-display');
  if(!el) return;
  if(!advFileName){ el.style.display='none'; return; }
  el.style.display='block';
  let txt='Soubor: '+advFileName;
  if(dropImportQueue && dropImportQueue.length){
    txt+=` — zbývá načíst ještě: ${dropImportQueue.length}`;
  }
  el.textContent=txt;
}

function advLoadFile(input){
  const file = input.files[0];
  if(!file) return;
  input.value = '';
  const reader = new FileReader();
  reader.onload = e => { openAdvWizardWithText(e.target.result, file.name); };
  reader.readAsText(file);
}

function closeAdv(){
  document.getElementById('adv-overlay').style.display = 'none';
  document.body.style.overflow = '';
  // Zavření/zrušení průvodce (křížek, Esc, klik mimo) uprostřed dávkového
  // vkládání víc souborů přetažením neruší celou frontu — jen přeskočí tenhle
  // soubor a pokračuje dalším (viz processNextDropImport).
  advanceDropImportQueueIfAny();
}

function advanceDropImportQueueIfAny(){
  if(dropImportQueue && dropImportQueue.length) processNextDropImport();
  else dropImportQueue=null;
}

document.addEventListener('keydown', e => { if(e.key==='Escape') closeAdv(); });

function advSplitLine(line){
  if(line.includes('\t')) return line.split('\t').map(s=>s.trim());
  if(line.includes(';'))  return line.split(';').map(s=>s.trim());
  // Stejná logika jako splitLine v parseAndFill: u řádku s mezerami je čárka
  // s největší pravděpodobností desetinný oddělovač, ne oddělovač sloupců.
  if(/\s/.test(line))     return line.split(/\s+/).filter(s=>s!=='');
  if(line.includes(','))  return line.split(',').map(s=>s.trim());
  return [line];
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
  advSelX = null; advSelY = null; advSelSy = null;
  updateAdvConfirm();

  const orient = advGetOrient();
  const { rows } = advParsed;
  const hasHeader = advHasHeader(rows, orient);
  const PREVIEW = 20;
  const tbl = document.getElementById('adv-table');
  tbl.innerHTML = '';

  if(orient === 'cols'){
    document.getElementById('adv-hint').innerHTML = 'Klikni na záhlaví sloupce pro výběr jako <b>x</b> nebo <b>y</b>' + (advWantSigma ? ' (volitelně i <b>σy</b>)' : '');
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
    // Řádky: klikáme na první buňku řádku (záhlaví řádku). POZOR: "hasHeader"
    // tady znamená jen "sloupec 0 obsahuje textový popisek řádku" (např. "L
    // (m)"/"T (s)") — NEznamená, že řádek 0 samotný není platná data. Dřív se
    // tyhle dva pojmy pletly a řádek 0 byl kvůli tomu natvrdo neklikatelný
    // ("↳ záhlaví"), takže u souboru jen se dvěma řádky (typicky x-řádek a
    // y-řádek) nešlo vybrat jako x/y vůbec nic z toho horního — právě tenhle
    // bug. Teď je klikatelný a vybratelný úplně každý řádek.
    const colCount = Math.max(...rows.map(r=>r.length));
    const startCol = hasHeader ? 1 : 0;
    const warnEl = document.getElementById('adv-hint');
    warnEl.innerHTML = 'Klikni na záhlaví řádku pro výběr jako <b>x</b> nebo <b>y</b>' + (advWantSigma ? ' (volitelně i <b>σy</b>)' : '');

    const tbody = tbl.createTBody();
    const shown = rows.slice(0, PREVIEW+1);
    shown.forEach((row, ri)=>{
      const tr = tbody.insertRow();
      tr.dataset.row = ri;

      const th = document.createElement('th');
      const label = hasHeader ? (row[0]||`Řádek ${ri+1}`) : `Řádek ${ri+1}`;
      th.textContent = label;
      th.dataset.row = ri;
      th.style.cssText = `padding:6px 10px;border:1px solid var(--border);background:var(--surface2);
        cursor:pointer;white-space:nowrap;font-size:12.5px;color:var(--text);
        text-align:left;font-weight:600;transition:background .1s;`;
      th.title = 'Klikni pro výběr jako x nebo y';
      th.onmouseenter = ()=>{ if(ri!=advSelX && ri!=advSelY) th.style.background='var(--btn-h)'; };
      th.onmouseleave = ()=>{ advColorRow(ri); };
      th.onclick = ()=> advClickRow(ri);
      tr.appendChild(th);

      const colsToShow = Math.min(row.length, startCol+20);
      for(let c=startCol; c<colsToShow; c++){
        const td = tr.insertCell();
        td.textContent = row[c]||'';
        td.dataset.row = ri;
        td.style.cssText = `padding:4px 8px;border:1px solid var(--border);color:var(--text);`;
      }
    });

    const note = document.getElementById('adv-truncnote');
    const total = rows.length;
    if(total > PREVIEW){
      note.style.display='block';
      note.textContent = `Zobrazeno prvních ${PREVIEW} z ${total} řádků.`;
    } else { note.style.display='none'; }
  }
}

// Obecný click-cyklus pro výběr rolí (x, y, volitelně σy) na sloupci/řádku
// v Průvodci vložením dat. Bez zapnutého "chci vybrat i σy" (advWantSigma=false,
// roles.length===2) se chová ÚPLNĚ STEJNĚ jako původní ruční 2-rolová logika
// (ověřeno rozborem všech větví) — σy rozšíření tedy nemůže rozbít existující
// výběr x/y, jen přidává třetí, čistě volitelnou roli na konec cyklu.
function advClickGeneric(idx){
  const roles = advWantSigma ? ['selX','selY','selSy'] : ['selX','selY'];
  const sel = {selX:advSelX, selY:advSelY, selSy:advSelSy};

  let assignedRole = null;
  for(const r of roles) if(sel[r] === idx){ assignedRole = r; break; }

  if(assignedRole){
    // klik na už vybranou položku: uvolní ji, následující role se posunou o jednu dopředu
    const i = roles.indexOf(assignedRole);
    for(let k=i; k<roles.length-1; k++) sel[roles[k]] = sel[roles[k+1]];
    sel[roles[roles.length-1]] = null;
  } else {
    let placed = false;
    for(const r of roles){
      if(sel[r] === null){ sel[r] = idx; placed = true; break; }
    }
    if(!placed) sel[roles[roles.length-1]] = idx; // všechny role obsazené → nahradí poslední
  }

  advSelX = sel.selX; advSelY = sel.selY; advSelSy = sel.selSy;
}

function advClickCol(c){
  advClickGeneric(c);
  advColorAllCols();
  updateAdvConfirm();
}

function advColorCol(c){
  const tbl = document.getElementById('adv-table');
  const isX = (c == advSelX), isY = (c == advSelY), isSy = advWantSigma && (c == advSelSy);
  tbl.querySelectorAll(`[data-col="${c}"]`).forEach(el=>{
    if(el.tagName==='TH'){
      el.style.background = isX ? 'rgba(74,158,255,.25)' : isY ? 'rgba(76,222,140,.25)' : isSy ? 'rgba(224,123,0,.25)' : 'var(--surface2)';
      el.style.color = isX ? 'var(--accent)' : isY ? 'var(--success)' : isSy ? '#e07b00' : 'var(--text)';
    } else {
      el.style.background = isX ? 'rgba(74,158,255,.08)' : isY ? 'rgba(76,222,140,.08)' : isSy ? 'rgba(224,123,0,.08)' : '';
    }
  });
}

function advColorAllCols(){
  if(!advParsed) return;
  const colCount = Math.max(...advParsed.rows.map(r=>r.length));
  for(let c=0; c<colCount; c++) advColorCol(c);
}

function advClickRow(ri){
  advClickGeneric(ri);
  advColorAllRows();
  updateAdvConfirm();
}

function advColorRow(ri){
  const tbl = document.getElementById('adv-table');
  const isX = (ri == advSelX), isY = (ri == advSelY), isSy = advWantSigma && (ri == advSelSy);
  tbl.querySelectorAll(`[data-row="${ri}"]`).forEach(el=>{
    if(el.tagName==='TH'){
      el.style.background = isX ? 'rgba(74,158,255,.25)' : isY ? 'rgba(76,222,140,.25)' : isSy ? 'rgba(224,123,0,.25)' : 'var(--surface2)';
      el.style.color = isX ? 'var(--accent)' : isY ? 'var(--success)' : isSy ? '#e07b00' : 'var(--text)';
    } else {
      el.style.background = isX ? 'rgba(74,158,255,.08)' : isY ? 'rgba(76,222,140,.08)' : isSy ? 'rgba(224,123,0,.08)' : '';
    }
  });
}

function advColorAllRows(){
  if(!advParsed) return;
  advParsed.rows.forEach((_,ri)=>advColorRow(ri));
}

// Zapnutí/vypnutí volitelného výběru σy (checkbox v kroku 1). Nikdy nemaže
// výběr x/y a nikdy neblokuje potvrzení — je to čistě doplňkový výběr navíc.
function advToggleWantSigma(checked){
  advWantSigma = checked;
  if(!checked) advSelSy = null;
  const orient = advGetOrient();
  if(orient === 'cols') advColorAllCols(); else advColorAllRows();
  updateAdvConfirm();
}

function updateAdvConfirm(){
  const btn = document.getElementById('adv-confirm');
  const info = document.getElementById('adv-selection-info');
  const ready = advSelX !== null && advSelY !== null;
  btn.disabled = !ready;
  btn.style.opacity = ready ? '.85' : '.4';
  let html;
  if(advSelX === null && advSelY === null)
    html = '<span style="color:var(--text-muted)">Zatím nevybráno</span>';
  else if(advSelX !== null && advSelY === null)
    html = `<span style="color:var(--accent)">■ x vybráno</span> &nbsp; <span style="color:var(--text-muted)">■ y — klikni na další</span>`;
  else
    html = `<span style="color:var(--accent)">■ x vybráno</span> &nbsp; <span style="color:var(--success)">■ y vybráno</span>`;
  if(advWantSigma){
    html += ' &nbsp; ' + (advSelSy !== null
      ? `<span style="color:#e07b00">■ σy vybráno</span>`
      : `<span style="color:var(--text-muted)">■ σy — volitelné, klikni pro výběr</span>`);
  }
  info.innerHTML = html;
}

function advConfirm(){
  if(advSelX === null || advSelY === null) return;
  const orient = advGetOrient();
  const { rows } = advParsed;
  const hasHeader = advHasHeader(rows, orient);
  // σy je čistě volitelný — potvrzení nikdy nezávisí na tom, jestli je vybraný.
  const wantSy = advWantSigma && advSelSy !== null;

  let xVals=[], yVals=[], syVals=[], labelX='x', labelY='y';

  if(orient === 'cols'){
    if(hasHeader){
      labelX = rows[0][advSelX] || 'x';
      labelY = rows[0][advSelY] || 'y';
    }
    const dataRows = hasHeader ? rows.slice(1) : rows;
    dataRows.forEach(row=>{
      const xv = parseFloat((row[advSelX]||'').replace(',','.'));
      const yv = parseFloat((row[advSelY]||'').replace(',','.'));
      if(!isNaN(xv)&&!isNaN(yv)){
        xVals.push(xv); yVals.push(yv);
        if(wantSy){
          const sv = parseFloat((row[advSelSy]||'').replace(',','.'));
          syVals.push(isNaN(sv) ? '' : sv);
        }
      }
    });
  } else {
    const xRow = rows[advSelX], yRow = rows[advSelY];
    const syRow = wantSy ? rows[advSelSy] : null;
    const startCol = hasHeader ? 1 : 0;
    if(hasHeader){
      labelX = xRow[0] || 'x';
      labelY = yRow[0] || 'y';
    }
    const len = Math.min(xRow.length, yRow.length);
    for(let c=startCol; c<len; c++){
      const xv = parseFloat((xRow[c]||'').replace(',','.'));
      const yv = parseFloat((yRow[c]||'').replace(',','.'));
      if(!isNaN(xv)&&!isNaN(yv)){
        xVals.push(xv); yVals.push(yv);
        if(wantSy){
          const sv = syRow ? parseFloat((syRow[c]||'').replace(',','.')) : NaN;
          syVals.push(isNaN(sv) ? '' : sv);
        }
      }
    }
  }

  if(!xVals.length){ alert('Nepodařilo se načíst žádná data. Zkontroluj výběr.'); return; }

  // Naplnit tabulku — stejná logika jako parseAndFill
  axisLabels = { x: labelX, y: labelY };
  axisLabelsFromFile = hasHeader;
  const lx=document.getElementById('label-x'), ly=document.getElementById('label-y');
  if(lx) lx.value=labelX;
  if(ly) ly.value=labelY;

  regressionOn=false;
  const _br=document.getElementById('btn-regrese');
  if(_br){_br.style.color='var(--text)';_br.style.opacity='.6';_br.title='Spustit analýzu';}
  const _eq=document.getElementById('resEq'); if(_eq) _eq.textContent='—';
  document.getElementById('resParams').textContent='';

  const ds = datasets[activeDatasetIdx];
  if(wantSy) ds.sigmaYOn = true; // vynutí zobrazení sloupce σy hned po importu

  const importRows = xVals.map((xv,i)=>({
    x:String(xv), y:String(yVals[i]), checked:true,
    sy: wantSy && syVals[i]!=='' ? String(syVals[i]) : ''
  }));
  restoreTableRows(importRows); // regeneruje thead i tbody se správným počtem sloupců
  syncSigmaYUI(ds);

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
syncAxisLabelsModeUI();
syncAxisLabelsPanelBorder();
