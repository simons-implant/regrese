const sum  = a => a.reduce((s,v)=>s+v,0);

const mean = a => sum(a)/a.length;

function calcR2(y, yp) {
  const ym = mean(y);
  const tot = sum(y.map(v=>(v-ym)**2));
  const res = sum(y.map((v,i)=>(v-yp[i])**2));
  return tot < 1e-14 ? 1 : 1 - res/tot;
}

function matT(A) {
  return A[0].map((_,j)=>A.map(r=>r[j]));
}

function matMul(A,B) {
  return A.map(row=>B[0].map((_,j)=>row.reduce((s,v,k)=>s+v*B[k][j],0)));
}

function inv2(M) {
  const det = M[0][0]*M[1][1] - M[0][1]*M[1][0];
  if(Math.abs(det)<1e-14) throw new Error("Singulární matice – body leží na přímce?");
  return [[ M[1][1]/det,-M[0][1]/det],
          [-M[1][0]/det, M[0][0]/det]];
}

function inv3(M) {
  const [a,b,c]=M[0],[d,e,f]=M[1],[g,h,k]=M[2];
  const det = a*(e*k-f*h) - b*(d*k-f*g) + c*(d*h-e*g);
  if(Math.abs(det)<1e-14) throw new Error("Singulární matice – zkuste jiný typ regrese.");
  return [[(e*k-f*h)/det,(c*h-b*k)/det,(b*f-c*e)/det],
          [(f*g-d*k)/det,(a*k-c*g)/det,(c*d-a*f)/det],
          [(d*h-e*g)/det,(b*g-a*h)/det,(a*e-b*d)/det]];
}

function calcSE(Xd, y, yp, p) {
  const n = y.length;
  const s2 = sum(y.map((v,i)=>(v-yp[i])**2)) / Math.max(n-p, 1);
  const Xt = matT(Xd);
  const XtX = matMul(Xt, Xd);
  const inv = p===2 ? inv2(XtX) : inv3(XtX);
  return inv.map((_,i) => Math.sqrt(Math.max(0, inv[i][i]*s2)));
}

function linRaw(x, y) {
  const Xd = x.map(xi=>[xi,1]);
  const Xt = matT(Xd);
  const XtX = matMul(Xt,Xd);
  const XtY = Xt.map(r=>sum(r.map((v,j)=>v*y[j])));
  const inv = inv2(XtX);
  const p = inv.map(r=>sum(r.map((v,j)=>v*XtY[j])));
  return {a:p[0], b:p[1]};
}

function f6(v){return v>=0?v.toFixed(6):String(v.toFixed(6));}

function doLinear(x,y){
  const {a,b}=linRaw(x,y);
  const yp=x.map(xi=>a*xi+b);
  const r2=calcR2(y,yp);
  const Xd=x.map(xi=>[xi,1]);
  const [seA,seB]=calcSE(Xd,y,yp,2);
  return{type:'linear',a,b,seA,seB,r2,yp,
         eq:`y = ${f6(a)}x + ${f6(b)}`,
         smooth:xi=>a*xi+b};
}

function doExponential(x,y){
  if(y.some(v=>v<=0)) throw new Error("Exponenciální regrese vyžaduje všechny y > 0");
  const lnY=y.map(Math.log);
  const {a:bP, b:lnA}=linRaw(x,lnY);
  const a=Math.exp(lnA), b=bP;
  const yp=x.map(xi=>a*Math.exp(b*xi));
  const r2=calcR2(y,yp);
  const Xd=x.map(xi=>[xi,1]);
  const [seA,seB]=calcSE(Xd,y,yp,2);
  return{type:'exponential',a,b,seA,seB,r2,yp,
         eq:`y = ${f6(a)}·e^(${f6(b)}x)`,
         smooth:xi=>a*Math.exp(b*xi)};
}

function doPolynomial(x,y){
  if(x.length<3) throw new Error("Polynomiální regrese 2° vyžaduje alespoň 3 body.");
  const Xd=x.map(xi=>[xi*xi,xi,1]);
  const Xt=matT(Xd);
  const XtX=matMul(Xt,Xd);
  const XtY=Xt.map(r=>sum(r.map((v,j)=>v*y[j])));
  const inv=inv3(XtX);
  const [a,b,c]=inv.map(r=>sum(r.map((v,j)=>v*XtY[j])));
  const yp=x.map(xi=>a*xi*xi+b*xi+c);
  const r2=calcR2(y,yp);
  const [seA,seB,seC]=calcSE(Xd,y,yp,3);
  return{type:'polynomial',a,b,c,seA,seB,seC,r2,yp,
         eq:`y = ${f6(a)}x² + ${f6(b)}x + ${f6(c)}`,
         smooth:xi=>a*xi*xi+b*xi+c};
}

function doLogarithmic(x,y){
  if(x.some(v=>v<=0)) throw new Error("Logaritmická regrese vyžaduje všechny x > 0");
  const lnX=x.map(Math.log);
  const {a,b}=linRaw(lnX,y);
  const yp=x.map(xi=>a*Math.log(Math.max(xi,1e-10))+b);
  const r2=calcR2(y,yp);
  const Xd=x.map(xi=>[Math.log(Math.max(xi,1e-10)),1]);
  const [seA,seB]=calcSE(Xd,y,yp,2);
  return{type:'logarithmic',a,b,seA,seB,r2,yp,
         eq:`y = ${f6(a)}·ln(x) + ${f6(b)}`,
         smooth:xi=>a*Math.log(Math.max(xi,1e-10))+b};
}

function doRational(x,y){
  if(x.length<3) throw new Error("Lomenná funkce vyžaduje alespoň 3 body.");
  // y = (ax+b)/(cx+1) — 3 parametry, identifikovatelná forma (d=1 fixováno)
  const {a:la,b:lb}=linRaw(x,y);
  const p0=[la,lb,0];
  const fn=(xi,[a,b,c])=>{
    const denom=c*xi+1;
    return Math.abs(denom)<1e-12 ? 1e12 : (a*xi+b)/denom;
  };
  const jac=(xi,[a,b,c])=>{
    const denom=c*xi+1;
    if(Math.abs(denom)<1e-12) return[0,0,0];
    const num=a*xi+b;
    const d2=denom*denom;
    return[xi/denom, 1/denom, -num*xi/d2];
  };
  const pOpt=lmFit(x,y,p0,fn,jac,600,1e-10);
  const [a,b,c]=pOpt;
  if(x.some(xi=>Math.abs(c*xi+1)<1e-6))
    throw new Error("Lomenná funkce má pól v oblasti dat — zkus jiný typ regrese.");
  const yp=x.map(xi=>fn(xi,pOpt));
  const r2=calcR2(y,yp);
  const Xd=x.map(xi=>jac(xi,pOpt));
  const [seA,seB,seC]=calcSE(Xd,y,yp,3);
  return{type:'rational',a,b,c,seA,seB,seC,r2,yp,
         eq:`y = (${f6(a)}x + ${f6(b)}) / (${f6(c)}x + 1)`,
         smooth:xi=>fn(xi,pOpt)};
}

function solveGE(A,b){
  const n=b.length;
  const M=A.map((row,i)=>[...row,b[i]]);
  for(let col=0;col<n;col++){
    let maxRow=col;
    for(let row=col+1;row<n;row++) if(Math.abs(M[row][col])>Math.abs(M[maxRow][col])) maxRow=row;
    [M[col],M[maxRow]]=[M[maxRow],M[col]];
    if(Math.abs(M[col][col])<1e-14) continue;
    for(let row=0;row<n;row++){
      if(row===col) continue;
      const f=M[row][col]/M[col][col];
      for(let k=col;k<=n;k++) M[row][k]-=f*M[col][k];
    }
  }
  return M.map((row,i)=>row[n]/row[i]);
}

function lmFit(xd,yd,p0,fn,jac,maxIter=400,tol=1e-10){
  let p=[...p0], lam=0.01;
  const res=p=>xd.map((xi,i)=>yd[i]-fn(xi,p));
  const sse=p=>res(p).reduce((s,r)=>s+r*r,0);
  for(let iter=0;iter<maxIter;iter++){
    const r=res(p);
    const J=xd.map(xi=>jac(xi,p));
    const m=p.length;
    const JtJ=Array.from({length:m},(_,a)=>Array.from({length:m},(_,b)=>J.reduce((s,j)=>s+j[a]*j[b],0)));
    const Jtr=Array.from({length:m},(_,a)=>J.reduce((s,j,i)=>s+j[a]*r[i],0));
    const Alam=JtJ.map((row,i)=>row.map((v,j)=>i===j?v*(1+lam):v));
    let dp; try{dp=solveGE(Alam,Jtr);}catch(e){break;}
    const pNew=p.map((v,i)=>v+dp[i]);
    if(sse(pNew)<sse(p)){
      p=pNew; lam=Math.max(lam/10,1e-8);
      if(Math.sqrt(dp.reduce((s,v)=>s+v*v,0))<tol) break;
    } else { lam=Math.min(lam*10,1e8); }
  }
  return p;
}

function inv4(A){
  const n=4;
  const M=A.map((row,i)=>[...row,...Array.from({length:n},(_,j)=>i===j?1:0)]);
  for(let col=0;col<n;col++){
    let maxRow=col;
    for(let row=col+1;row<n;row++) if(Math.abs(M[row][col])>Math.abs(M[maxRow][col])) maxRow=row;
    [M[col],M[maxRow]]=[M[maxRow],M[col]];
    if(Math.abs(M[col][col])<1e-14) return null;
    const sc=M[col][col];
    for(let k=0;k<2*n;k++) M[col][k]/=sc;
    for(let row=0;row<n;row++){
      if(row===col) continue;
      const f=M[row][col];
      for(let k=0;k<2*n;k++) M[row][k]-=f*M[col][k];
    }
  }
  return M.map(row=>row.slice(n));
}

function doGaussian(x,y){
  if(x.length<5) throw new Error("Gaussovský fit vyžaduje alespoň 5 bodů.");
  const ymax=Math.max(...y), ymin=Math.min(...y);
  const A0=ymax-ymin;
  const mu0=x[y.indexOf(ymax)];
  const c0=ymin;
  const half=c0+A0/2;
  const above=x.filter((_,i)=>y[i]>=half);
  const sig0=above.length>1?(Math.max(...above)-Math.min(...above))/2.355 : (Math.max(...x)-Math.min(...x))/6;

  const fn=(xi,[A,mu,sig,c])=>A*Math.exp(-((xi-mu)**2)/(2*sig**2))+c;
  const jac=(xi,[A,mu,sig,c])=>{
    const e=Math.exp(-((xi-mu)**2)/(2*sig**2));
    return[e, A*e*(xi-mu)/sig**2, A*e*(xi-mu)**2/sig**3, 1];
  };

  let [A,mu,sig,c]=lmFit(x,y,[A0,mu0,Math.abs(sig0),c0],fn,jac);
  sig=Math.abs(sig);
  const yp=x.map(xi=>fn(xi,[A,mu,sig,c]));
  const r2=calcR2(y,yp);

  const Jac=x.map(xi=>jac(xi,[A,mu,sig,c]));
  const m=4, n=x.length;
  const JtJ=Array.from({length:m},(_,a)=>Array.from({length:m},(_,b)=>Jac.reduce((s,j)=>s+j[a]*j[b],0)));
  const s2=yp.reduce((s,ypi,i)=>s+(y[i]-ypi)**2,0)/Math.max(n-m,1);
  const Cinv=inv4(JtJ);
  const se=Cinv?Cinv.map((row,i)=>Math.sqrt(Math.max(0,row[i]*s2))):[0,0,0,0];

  const FWHM=2*Math.sqrt(2*Math.log(2))*sig;
  const seFWHM=2*Math.sqrt(2*Math.log(2))*se[2];

  return{
    type:'gaussian', a:A, b:mu, c:sig, d:c,
    seA:se[0], seB:se[1], seC:se[2], seD:se[3],
    FWHM, seFWHM, r2, yp,
    eq:`y = ${f6(A)}·exp(-(x-${f6(mu)})²/(2·${f6(sig)}²)) + ${f6(c)}`,
    smooth:xi=>fn(xi,[A,mu,sig,c])
  };
}

function fourierRow(xi, w, nH){
  const row=[1];
  for(let k=1;k<=nH;k++){ row.push(Math.cos(k*w*xi), Math.sin(k*w*xi)); }
  return row;
}

function linearFourierFit(x,y,w,nH){
  const Xd = x.map(xi=>fourierRow(xi,w,nH));
  const Xt = matT(Xd);
  const XtX = matMul(Xt,Xd);
  const XtY = Xt.map(row=>sum(row.map((v,j)=>v*y[j])));
  return solveGE(XtX, XtY); // [a0,a1,b1,a2,b2,a3,b3]
}

function invertMatrixGJ(M){
  const m=M.length;
  const Minv=Array.from({length:m},(_,i)=>Array.from({length:m},(_,j)=>i===j?1:0));
  const Mcopy=M.map(r=>[...r]);
  for(let col=0;col<m;col++){
    let maxRow=col;
    for(let row=col+1;row<m;row++) if(Math.abs(Mcopy[row][col])>Math.abs(Mcopy[maxRow][col])) maxRow=row;
    [Mcopy[col],Mcopy[maxRow]]=[Mcopy[maxRow],Mcopy[col]];
    [Minv[col],Minv[maxRow]]=[Minv[maxRow],Minv[col]];
    if(Math.abs(Mcopy[col][col])<1e-14) continue;
    const sc=Mcopy[col][col];
    for(let k=0;k<m;k++){Mcopy[col][k]/=sc; Minv[col][k]/=sc;}
    for(let row=0;row<m;row++){
      if(row===col) continue;
      const f=Mcopy[row][col];
      for(let k=0;k<m;k++){Mcopy[row][k]-=f*Mcopy[col][k]; Minv[row][k]-=f*Minv[col][k];}
    }
  }
  return Minv;
}

function fourierHarmonicsInfo(nH, coefOrP, seArr){
  // coefOrP: [a0, a1,b1, a2,b2, ...]; seArr: matching SE array (stejná délka jako coefOrP, bez ω na konci)
  const out=[];
  for(let k=1;k<=nH;k++){
    const ak=coefOrP[1+2*(k-1)], bk=coefOrP[2+2*(k-1)];
    const seAk=seArr[1+2*(k-1)], seBk=seArr[2+2*(k-1)];
    const Rk=Math.sqrt(ak*ak+bk*bk);
    const phik=Math.atan2(bk,ak);
    let seRk=0, sePhik=0;
    if(Rk>1e-12){
      seRk=Math.sqrt((ak*ak*seAk*seAk + bk*bk*seBk*seBk))/Rk;
      sePhik=Math.sqrt((bk*bk*seAk*seAk + ak*ak*seBk*seBk))/(Rk*Rk);
    }
    out.push({k,ak,bk,seAk,seBk,Rk,seRk,phik,sePhik});
  }
  return out;
}

function doFourier(x,y,nH=3,fixedPeriod=null){
  if(x.length<2*nH+3) throw new Error(`Fourierova řada (${nH} harm.) vyžaduje alespoň ${2*nH+3} bodů.`);
  const xSpan = Math.max(...x) - Math.min(...x);
  if(xSpan<=0) throw new Error("Fourierova řada vyžaduje rozptýlené x-hodnoty.");

  // ── Varianta s ručně zadanou periodou: ω je pevné, fituje se pouze
  //    lineárně (amplitudy), žádné hledání frekvence ani LM optimalizace ──
  if(fixedPeriod && isFinite(fixedPeriod) && fixedPeriod>0){
    const omega=2*Math.PI/fixedPeriod;
    const coef=linearFourierFit(x,y,omega,nH);
    if(coef.some(v=>!isFinite(v))) throw new Error("Fourierova řada se s touto periodou nedá spolehlivě fitovat — zkus jinou hodnotu.");
    const yp=x.map(xi=>{
      const row=fourierRow(xi,omega,nH);
      return sum(row.map((v,j)=>v*coef[j]));
    });
    const r2=calcR2(y,yp);
    const n=x.length, m=coef.length;
    const Xd=x.map(xi=>fourierRow(xi,omega,nH));
    const XtX=matMul(matT(Xd),Xd);
    const s2=sum(y.map((v,i)=>(v-yp[i])**2))/Math.max(n-m,1);
    const XtXinv=invertMatrixGJ(XtX);
    const se=XtXinv.map((row,i)=>Math.sqrt(Math.max(0,row[i]*s2)));
    const covMatrix=XtXinv.map(row=>row.map(v=>v*s2));

    const eqParts=[];
    for(let k=1;k<=nH;k++){
      const ak=coef[1+2*(k-1)], bk=coef[2+2*(k-1)];
      eqParts.push(`${f6(ak)}·cos(${k}ωx) + ${f6(bk)}·sin(${k}ωx)`);
    }

    return{
      type:'fourier', nH, params:[...coef, omega], se:[...se, 0],
      omega, seOmega:0, period:fixedPeriod, sePeriod:0, r2, yp, periodFixed:true,
      harmonics:fourierHarmonicsInfo(nH, coef, se),
      covMatrix, jacFn:xi=>fourierRow(xi,omega,nH),
      periodogram:null,
      eq:`y = ${f6(coef[0])} + ${eqParts.join(' + ')}, ω = ${f6(omega)} (perioda zadána ručně)`,
      smooth:xi=>{
        const row=fourierRow(xi,omega,nH);
        return sum(row.map((v,j)=>v*coef[j]));
      }
    };
  }

  // Hledání dobrého počátečního odhadu ω: zkus kandidátní periody
  // (celý rozsah dat / m) a pro každou udělej lineární fit amplitud
  // při pevném ω; vyber tu s nejnižší reziduální sumou čtverců.
  // Horní mez m je omezena hustotou dat (Nyquist pro 3. harmonickou —
  // potřebujeme aspoň ~2 body na nejrychlejší kmit), aby šlo najít
  // správnou frekvenci i u dat s mnoha periodami.
  const mMax=Math.max(10, Math.min(60, Math.floor(x.length/(2*nH))));
  let bestW=2*Math.PI/xSpan, bestCoef=null, bestSSE=Infinity;
  const periodogram=[];
  const SStot=sum(y.map(v=>(v-mean(y))**2))||1e-12;
  for(let m=1;m<=mMax;m++){
    const w = 2*Math.PI*m/xSpan;
    let coef;
    try{ coef=linearFourierFit(x,y,w,nH); }catch(e){ continue; }
    if(coef.some(v=>!isFinite(v))) continue;
    const ypTest=x.map(xi=>{
      const row=fourierRow(xi,w,nH);
      return sum(row.map((v,j)=>v*coef[j]));
    });
    const sseTest=sum(y.map((v,i)=>(v-ypTest[i])**2));
    const r2Test=1-sseTest/SStot;
    periodogram.push({period:2*Math.PI/w, r2:r2Test});
    if(sseTest<bestSSE){ bestSSE=sseTest; bestW=w; bestCoef=coef; }
  }
  if(!bestCoef) bestCoef=[mean(y), ...Array(2*nH).fill(0)];
  periodogram.sort((a,b)=>a.period-b.period);

  // p = [a0, a1,b1, a2,b2, a3,b3, omega]
  const p0=[...bestCoef, bestW];

  const fn=(xi,p)=>{
    const w=p[p.length-1];
    let s=p[0];
    for(let k=1;k<=nH;k++){
      const ak=p[1+2*(k-1)], bk=p[2+2*(k-1)];
      s += ak*Math.cos(k*w*xi) + bk*Math.sin(k*w*xi);
    }
    return s;
  };
  const jac=(xi,p)=>{
    const w=p[p.length-1];
    const grad=new Array(p.length).fill(0);
    grad[0]=1;
    let dOmega=0;
    for(let k=1;k<=nH;k++){
      const ak=p[1+2*(k-1)], bk=p[2+2*(k-1)];
      const c=Math.cos(k*w*xi), s=Math.sin(k*w*xi);
      grad[1+2*(k-1)]=c;
      grad[2+2*(k-1)]=s;
      dOmega += -ak*k*xi*s + bk*k*xi*c;
    }
    grad[grad.length-1]=dOmega;
    return grad;
  };

  const pOpt=lmFit(x,y,p0,fn,jac,800,1e-12);
  const omega=pOpt[pOpt.length-1];
  const yp=x.map(xi=>fn(xi,pOpt));
  const r2=calcR2(y,yp);

  const m=p0.length, n=x.length;
  const Jac=x.map(xi=>jac(xi,pOpt));
  const JtJ=Array.from({length:m},(_,a)=>Array.from({length:m},(_,b)=>Jac.reduce((s,j)=>s+j[a]*j[b],0)));
  const s2=yp.reduce((s,ypi,i)=>s+(y[i]-ypi)**2,0)/Math.max(n-m,1);
  const Minv=invertMatrixGJ(JtJ);
  const se=Minv.map((row,i)=>Math.sqrt(Math.max(0,row[i]*s2)));
  const covMatrix=Minv.map(row=>row.map(v=>v*s2));

  const period=2*Math.PI/omega;
  const sePeriod=Math.abs(2*Math.PI/(omega*omega))*se[se.length-1];

  const eqParts=[];
  for(let k=1;k<=nH;k++){
    const ak=pOpt[1+2*(k-1)], bk=pOpt[2+2*(k-1)];
    eqParts.push(`${f6(ak)}·cos(${k}ωx) + ${f6(bk)}·sin(${k}ωx)`);
  }

  return{
    type:'fourier', nH, params:pOpt, se, omega, seOmega:se[se.length-1], period, sePeriod, r2, yp,
    harmonics:fourierHarmonicsInfo(nH, pOpt, se),
    covMatrix, jacFn:xi=>jac(xi,pOpt),
    periodogram, bestPeriod:period,
    eq:`y = ${f6(pOpt[0])} + ${eqParts.join(' + ')}, ω = ${f6(omega)}`,
    smooth:xi=>fn(xi,pOpt)
  };
}

function doFourierAuto(x,y,fixedPeriod=null){
  const n=x.length;
  const maxAllowed=Math.max(1, Math.min(8, Math.floor((n-3)/2)));
  let best=null, bestBIC=Infinity;
  for(let nH=1; nH<=maxAllowed; nH++){
    let res;
    try{ res=doFourier(x,y,nH,fixedPeriod); }catch(e){ continue; }
    const k = fixedPeriod ? (1+2*nH) : (1+2*nH+1); // počet odhadovaných parametrů
    const rss = sum(y.map((v,i)=>(v-res.yp[i])**2));
    const bic = n*Math.log(Math.max(rss/n, 1e-12)) + k*Math.log(n);
    if(bic<bestBIC){ bestBIC=bic; best=res; }
  }
  if(!best) throw new Error("Automatický výběr počtu harmonických selhal — zkus to ručně.");
  return best;
}

function doMultiGaussian(x, y, nPeaks){
  if(x.length < 5*nPeaks) throw new Error(`Fit ${nPeaks}× Gauss vyžaduje alespoň ${5*nPeaks} bodů.`);

  // Automatický odhad počátečních parametrů — najdi nPeaks lokálních maxim
  const ymin=Math.min(...y), ymax=Math.max(...y);
  const c0=ymin;

  // Najdi lokální maxima jako kandidáty peaků
  const peaks=[];
  for(let i=1;i<x.length-1;i++){
    if(y[i]>y[i-1]&&y[i]>y[i+1]) peaks.push({x:x[i],y:y[i],i});
  }
  // Seřaď sestupně podle výšky, vezmi top nPeaks
  peaks.sort((a,b)=>b.y-a.y);
  const topPeaks=peaks.slice(0,nPeaks);
  // Pokud nemáme dost lokálních maxim, rovnoměrně rozmístíme
  while(topPeaks.length<nPeaks){
    const idx=Math.floor(x.length/(nPeaks+1))*(topPeaks.length+1);
    topPeaks.push({x:x[Math.min(idx,x.length-1)],y:y[Math.min(idx,x.length-1)]});
  }
  topPeaks.sort((a,b)=>a.x-b.x);

  const sigEst=(Math.max(...x)-Math.min(...x))/(nPeaks*3);

  // Počáteční parametry: [A1, mu1, sig1, A2, mu2, sig2, ..., c]
  const p0=[...topPeaks.flatMap(p=>[Math.max(p.y-c0,1), p.x, sigEst]), c0];

  const fn=(xi,p)=>{
    let s=p[p.length-1]; // c
    for(let k=0;k<nPeaks;k++){
      const A=p[k*3], mu=p[k*3+1], sig=p[k*3+2];
      s+=A*Math.exp(-((xi-mu)**2)/(2*sig**2));
    }
    return s;
  };

  const jac=(xi,p)=>{
    const grad=new Array(p.length).fill(0);
    for(let k=0;k<nPeaks;k++){
      const A=p[k*3], mu=p[k*3+1], sig=p[k*3+2];
      const e=Math.exp(-((xi-mu)**2)/(2*sig**2));
      grad[k*3]  = e;
      grad[k*3+1]= A*e*(xi-mu)/sig**2;
      grad[k*3+2]= A*e*(xi-mu)**2/sig**3;
    }
    grad[p.length-1]=1; // dc
    return grad;
  };

  let pOpt=lmFit(x,y,p0,fn,jac,600,1e-10);
  // Zajisti kladná sigma
  for(let k=0;k<nPeaks;k++) pOpt[k*3+2]=Math.abs(pOpt[k*3+2]);
  // Seřaď peaky podle polohy mu
  const peakParams=[];
  for(let k=0;k<nPeaks;k++) peakParams.push([pOpt[k*3],pOpt[k*3+1],pOpt[k*3+2]]);
  peakParams.sort((a,b)=>a[1]-b[1]);
  pOpt=[...peakParams.flat(), pOpt[pOpt.length-1]];

  const yp=x.map(xi=>fn(xi,pOpt));
  const r2=calcR2(y,yp);

  // Standardní chyby — numerický Jacobián pro obecnou velikost
  const m=p0.length, n=x.length;
  const Jac=x.map(xi=>jac(xi,pOpt));
  const JtJ=Array.from({length:m},(_,a)=>Array.from({length:m},(_,b)=>Jac.reduce((s,j)=>s+j[a]*j[b],0)));
  const s2=yp.reduce((s,ypi,i)=>s+(y[i]-ypi)**2,0)/Math.max(n-m,1);
  // Obecná inverze (Gauss-Jordan)
  const Minv=Array.from({length:m},(_,i)=>Array.from({length:m},(_,j)=>i===j?1:0));
  const Mcopy=JtJ.map(r=>[...r]);
  for(let col=0;col<m;col++){
    let maxRow=col;
    for(let row=col+1;row<m;row++) if(Math.abs(Mcopy[row][col])>Math.abs(Mcopy[maxRow][col])) maxRow=row;
    [Mcopy[col],Mcopy[maxRow]]=[Mcopy[maxRow],Mcopy[col]];
    [Minv[col],Minv[maxRow]]=[Minv[maxRow],Minv[col]];
    if(Math.abs(Mcopy[col][col])<1e-14) continue;
    const sc=Mcopy[col][col];
    for(let k=0;k<m;k++){Mcopy[col][k]/=sc; Minv[col][k]/=sc;}
    for(let row=0;row<m;row++){
      if(row===col) continue;
      const f=Mcopy[row][col];
      for(let k=0;k<m;k++){Mcopy[row][k]-=f*Mcopy[col][k]; Minv[row][k]-=f*Minv[col][k];}
    }
  }
  const se=Minv.map((row,i)=>Math.sqrt(Math.max(0,row[i]*s2)));

  const FWHMs=peakParams.map((_,k)=>({
    FWHM: 2*Math.sqrt(2*Math.log(2))*pOpt[k*3+2],
    seFWHM: 2*Math.sqrt(2*Math.log(2))*se[k*3+2]
  }));

  const eqParts=peakParams.map((_,k)=>`${f6(pOpt[k*3])}·e^(-(x-${f6(pOpt[k*3+1])})²/(2·${f6(pOpt[k*3+2])}²))`).join(' + ');

  return{
    type:`gaussian${nPeaks}`, nPeaks, params:pOpt, se, FWHMs, r2, yp,
    eq:`y = ${eqParts} + ${f6(pOpt[pOpt.length-1])}`,
    eqShort:'fit',
    smooth:xi=>fn(xi,pOpt)
  };
}

function buildCustomFitter(formula){
  const node=math.parse(formula);
  // Jména volaná jako funkce (sin(x), exp(x)...) jsou rezervovaná.
  // Ostatní symboly (i kdyby náhodou kolidovaly se jménem konstanty jako
  // "tau" nebo "e") se berou jako fitovací parametry.
  const funcNames=new Set(node.filter(n=>n.type==='FunctionNode').map(n=>n.fn.name));
  const allSymbols=[...new Set(node.filter(n=>n.isSymbolNode).map(n=>n.name))];
  const paramNames=allSymbols.filter(s=>s!=='x' && !funcNames.has(s));
  const compiled=node.compile();
  const fn=(xi,p)=>{
    const scope={x:xi};
    paramNames.forEach((name,i)=>scope[name]=p[i]);
    const v=compiled.evaluate(scope);
    return (typeof v==='number' && isFinite(v)) ? v : NaN;
  };
  const jac=(xi,p)=>p.map((v,i)=>{
    const h=1e-6*(Math.abs(v)||1);
    const pPlus=[...p]; pPlus[i]=v+h;
    const pMinus=[...p]; pMinus[i]=v-h;
    return (fn(xi,pPlus)-fn(xi,pMinus))/(2*h);
  });
  return {paramNames,fn,jac,node};
}

function safeSSE(x,y,fn,p){
  let s=0;
  for(let i=0;i<x.length;i++){
    const yp=fn(x[i],p);
    if(!isFinite(yp)) return Infinity;
    const r=y[i]-yp;
    s+=r*r;
  }
  return s;
}

function doCustomFit(x,y,formula,nStarts=15){
  const {paramNames,fn,jac}=buildCustomFitter(formula);
  const m=paramNames.length;
  if(x.length<m+1) throw new Error(`Rovnice s ${m} parametry vyžaduje alespoň ${m+1} bodů.`);
  const p0=Array(m).fill(1);
  let best=null,bestSSE=Infinity;
  let seed=Date.now()%100000;
  function rnd(){ seed=(seed*9301+49297)%233280; return seed/233280; }
  for(let attempt=0;attempt<nStarts;attempt++){
    const pStart=p0.map(v=>attempt===0?v:v*(0.4+rnd()*1.8)*(rnd()<0.15?-1:1));
    let pOpt;
    try{ pOpt=lmFit(x,y,pStart,fn,jac,800,1e-12); }catch(e){ continue; }
    if(pOpt.some(v=>!isFinite(v))) continue;
    const sse=safeSSE(x,y,fn,pOpt);
    if(sse<bestSSE){ bestSSE=sse; best=pOpt; }
  }
  if(!best) throw new Error('Fit se nepodařilo najít — zkus jednodušší rovnici nebo zkontroluj syntaxi.');

  const yp=x.map(xi=>fn(xi,best));
  const r2=calcR2(y,yp);
  const n=x.length;
  const Jac=x.map(xi=>jac(xi,best));
  const JtJ=Array.from({length:m},(_,a)=>Array.from({length:m},(_,b)=>Jac.reduce((s,j)=>s+j[a]*j[b],0)));
  const s2=sum(y.map((v,i)=>(v-yp[i])**2))/Math.max(n-m,1);
  const Minv=invertMatrixGJ(JtJ);
  const se=Minv.map((row,i)=>Math.sqrt(Math.max(0,row[i]*s2)));

  return {
    type:'custom', formula, paramNames, params:best, se, r2, yp,
    eq:`y = ${formula}`,
    smooth:xi=>fn(xi,best)
  };
}

function computeFitForType(x, y, type, ds){
  if(type==='linear')           return doLinear(x,y);
  if(type==='exponential')      return doExponential(x,y);
  if(type==='polynomial')       return doPolynomial(x,y);
  if(type==='logarithmic')      return doLogarithmic(x,y);
  if(type==='gaussian')         return doGaussian(x,y);
  if(type==='gaussian2')        return doMultiGaussian(x,y,2);
  if(type==='gaussian3')        return doMultiGaussian(x,y,3);
  if(type==='rational')         return doRational(x,y);
  if(type==='fourier'){
    if(fourierAutoHarmonics){
      const r=doFourierAuto(x,y,fourierManualPeriod);
      fourierHarmonics=r.nH;
      return r;
    }
    return doFourier(x,y,fourierHarmonics, fourierManualPeriod);
  }
  if(type==='custom'){
    if(!ds || !ds.customFormula) throw new Error('Nejdřív zadej vlastní rovnici (klikni na "Vlastní rovnice" v nabídce typu regrese).');
    return doCustomFit(x,y,ds.customFormula);
  }
  throw new Error('Neznámý typ regrese.');
}