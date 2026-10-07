export function installPullRefresh({refresh,isBlocked=()=>false,window:win=window,document:doc=document}){
 const indicator=doc.createElement('div');
 indicator.className='pull-refresh';indicator.setAttribute('role','status');indicator.setAttribute('aria-live','polite');
 indicator.innerHTML='<span class="refresh-spinner" aria-hidden="true"></span><span class="sr-only"></span>';
 let previousLabel='';
 const label=text=>{if(text===previousLabel)return;previousLabel=text;indicator.setAttribute('aria-label',text);const node=indicator.querySelector?.('.sr-only');if(node)node.textContent=text;};
 doc.body.append(indicator);
 let start=null,distance=0,refreshing=false,timer;
 const clear=()=>{start=null;distance=0;indicator.classList.remove('visible');indicator.classList.remove('dragging');indicator.style?.removeProperty('--pull-offset');};
 const blocked=target=>isBlocked()||Boolean(target?.closest?.('input,textarea,select,button,dialog'));
 const begin=event=>{
  if(refreshing||win.scrollY>0||event.touches.length!==1||blocked(event.target))return;
  clearTimeout(timer);start={x:event.touches[0].clientX,y:event.touches[0].clientY};distance=0;
 };
 const move=event=>{
  if(!start)return;
  if(event.touches.length!==1||isBlocked()||win.scrollY>0){clear();return;}
  const dx=event.touches[0].clientX-start.x,dy=event.touches[0].clientY-start.y;
  if(dy<=0||Math.abs(dx)>Math.abs(dy)){clear();return;}
  if(dy<12)return;
  if(event.cancelable)event.preventDefault();
  distance=Math.min(dy,150);
  indicator.classList.add('dragging');
  indicator.style?.setProperty('--pull-offset',Math.min(0,-48+distance*.5)+'px');
  label(distance>=90?'Release to refresh':'Pull down to refresh');
  indicator.classList.add('visible');
 };
 const end=async()=>{
  if(refreshing)return;
  const ready=start&&distance>=90&&!isBlocked();start=null;distance=0;
  if(!ready){clear();return;}
  indicator.classList.remove('dragging');indicator.style?.removeProperty('--pull-offset');
  refreshing=true;label('Refreshing');indicator.classList.add('visible');
  try{await refresh();label('Updated');}
  catch{label('Could not refresh. Pull down to retry.');}
  finally{refreshing=false;timer=win.setTimeout(clear,300);}
 };
 doc.addEventListener('touchstart',begin,{passive:true});
 doc.addEventListener('touchmove',move,{passive:false});
 doc.addEventListener('touchend',end,{passive:true});
 const cancel=()=>{if(!refreshing)clear();};
 doc.addEventListener('touchcancel',cancel,{passive:true});
 return ()=>{clearTimeout(timer);doc.removeEventListener('touchstart',begin);doc.removeEventListener('touchmove',move);doc.removeEventListener('touchend',end);doc.removeEventListener('touchcancel',cancel);indicator.remove();};
}
