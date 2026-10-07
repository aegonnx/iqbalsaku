const dialogs=new WeakMap(),disclosures=new WeakMap();
const ease='cubic-bezier(.22,1,.36,1)';
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
export const dialogActive=dialog=>dialog.open||dialogs.get(dialog)?.phase==='closing';
export const dialogClosing=dialog=>dialogs.get(dialog)?.phase==='closing';

export function openDialog(dialog,{focus,select=false}={}){
 if(dialogActive(dialog))return false;
 const record={phase:'opening',animation:null,closing:null};dialogs.set(dialog,record);
 // Native dialog autofocus runs once, within the original tap gesture. Delayed
 // focus can lose iOS keyboard permission and trigger a second layout/scroll.
 if(focus)focus.setAttribute('autofocus','');
 dialog.dataset.motion='opening';
 dialog.showModal();
 if(focus&&document.activeElement!==focus)focus.focus({preventScroll:true});
 if(select&&focus?.setSelectionRange)focus.setSelectionRange(0,focus.value.length);
 const done=()=>{if(record.phase==='opening'){record.phase='open';delete dialog.dataset.motion;record.animation?.cancel();record.animation=null;}};
 if(reduced()||!dialog.animate){done();return true;}
 record.animation=dialog.animate([{opacity:0,transform:'translateY(20px)'},{opacity:1,transform:'translateY(0)'}],{duration:240,easing:ease,fill:'both'});
 record.animation.finished.then(done,()=>{});
 return true;
}

export function closeDialog(dialog,{immediate=false}={}){
 const previous=dialogs.get(dialog);
 if(previous?.closing&&!immediate)return previous.closing;
 const style=dialog.open?getComputedStyle(dialog):null;
 const from={opacity:style?.opacity||'1',transform:style?.transform||'none'};
 previous?.animation?.cancel();
 if(!dialog.open){dialogs.delete(dialog);delete dialog.dataset.motion;return Promise.resolve();}
 const record={phase:'closing',animation:null,closing:null};dialogs.set(dialog,record);
 dialog.dataset.motion='closing';
 const finish=()=>{
  if(dialogs.get(dialog)!==record)return;
  dialog.close();record.animation?.cancel();dialogs.delete(dialog);delete dialog.dataset.motion;
 };
 if(immediate||reduced()||!dialog.animate){finish();return Promise.resolve();}
 record.animation=dialog.animate([from,{opacity:0,transform:'translateY(16px)'}],{duration:180,easing:ease,fill:'both'});
 record.closing=record.animation.finished.catch(()=>{}).then(finish);
 return record.closing;
}

export function animatePage(element){
 if(!element||reduced()||!element.animate)return;
 element.animate([{opacity:.25,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:200,easing:ease});
}

export function installDisclosureMotion(root=document){
 root.addEventListener('click',event=>{
  const summary=event.target.closest('summary');
  const details=summary?.parentElement;
  if(!details?.matches('.settings-section,.entry-details'))return;
  event.preventDefault();
  const previous=disclosures.get(details),target=!(previous?.target??details.open);
  const start=details.getBoundingClientRect().height;
  previous?.animation?.cancel();
  if(reduced()||!details.animate){details.open=target;details.style.removeProperty('overflow');disclosures.delete(details);return;}
  details.open=target;const end=details.getBoundingClientRect().height;details.open=true;
  details.style.overflow='hidden';
  const animation=details.animate([{height:start+'px'},{height:end+'px'}],{duration:220,easing:ease,fill:'both'});
  const record={target,animation};disclosures.set(details,record);
  animation.finished.then(()=>{
   if(disclosures.get(details)!==record)return;
   details.open=target;animation.cancel();details.style.removeProperty('overflow');disclosures.delete(details);
  },()=>{});
 });
}
