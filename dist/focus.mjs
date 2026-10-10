export function rememberFocus(root){
 const active=document.activeElement;if(!root.contains(active))return null;
 return {id:active.id,tag:active.tagName,form:active.closest('form')?.id,name:active.getAttribute('name'),text:active.textContent.trim(),data:{...active.dataset},selection:typeof active.selectionStart==='number'?[active.selectionStart,active.selectionEnd]:null};
}
export function restoreFocus(root,snapshot){
 if(!snapshot)return false;
 const candidates=[...root.querySelectorAll('button,input,select,textarea,summary,[tabindex]')];
 const element=candidates.find(el=>snapshot.id?el.id===snapshot.id:el.tagName===snapshot.tag&&
  (snapshot.name?el.getAttribute('name')===snapshot.name&&el.closest('form')?.id===snapshot.form:
   Object.keys(snapshot.data).length?Object.entries(snapshot.data).every(([key,value])=>el.dataset[key]===value):
   el.closest('form')?.id===snapshot.form&&el.textContent.trim()===snapshot.text));
 if(!element||element.disabled||!element.getClientRects().length)return false;
 element.focus({preventScroll:true});
 if(snapshot.selection&&element.setSelectionRange){try{element.setSelectionRange(...snapshot.selection);}catch{}}
 return true;
}
