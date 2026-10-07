export function pinDialogActions(dialog,formId){
 const form=dialog.querySelector('#'+formId),actions=form?.querySelector('.form-actions');
 if(!actions)return;
 for(const button of actions.querySelectorAll('button[type="submit"]'))button.setAttribute('form',formId);
 dialog.querySelector('.dialog-inner').append(actions);
}

export function installKeyboardLayout(){
 const viewport=window.visualViewport;
 if(!viewport)return;
 const root=document.documentElement;
 let fullHeight=window.innerHeight;
 const update=()=>{
  const editing=document.activeElement?.matches('input,textarea,select');
  if(!editing)fullHeight=window.innerHeight;
  const keyboardOpen=Boolean(editing&&viewport.scale===1&&fullHeight-viewport.height>120);
  const gap=keyboardOpen?Math.max(0,window.innerHeight-viewport.height-viewport.offsetTop):0;
  root.style.setProperty('--keyboard-space',gap+'px');
  root.style.setProperty('--visible-height',viewport.height+'px');
  root.classList.toggle('keyboard-open',keyboardOpen);
 };
 viewport.addEventListener('resize',update);viewport.addEventListener('scroll',update);
 window.addEventListener('resize',update);
 document.addEventListener('focusin',update);
 document.addEventListener('focusout',()=>setTimeout(update,0));
 update();
}
