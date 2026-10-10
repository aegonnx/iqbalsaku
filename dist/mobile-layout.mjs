export function pinDialogActions(dialog,formId){
 const form=dialog.querySelector('#'+formId),actions=form?.querySelector('.form-actions');
 if(!actions)return;
 for(const button of actions.querySelectorAll('button[type="submit"]')){
  button.type='button';button.setAttribute('form',formId);button.dataset.submitForm=formId;
 }
 dialog.querySelector('.dialog-inner').append(actions);
}

export function installFooterActions(){
 document.addEventListener('pointerdown',event=>{
  // Keep the keyboard and footer stationary through the tap's click event.
  if(event.target.closest('.form-actions button,[data-expense-details]')&&document.activeElement?.matches('input,textarea,select'))event.preventDefault();
 });
 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-submit-form]');
  if(button&&!button.disabled)document.getElementById(button.dataset.submitForm)?.requestSubmit();
 });
}

export function installKeyboardLayout(){
 const viewport=window.visualViewport;
 if(!viewport)return;
 const root=document.documentElement;
 let fullHeight=window.innerHeight,frame=0,lastHeight=-1,lastGap=-1;
 const update=()=>{
  const editing=document.activeElement?.matches('input,textarea,select');
  const wasOpen=root.classList.contains('keyboard-open');
  if(!editing&&!wasOpen)fullHeight=window.innerHeight;
  const keyboardOpen=Boolean((editing||wasOpen)&&viewport.scale===1&&fullHeight-viewport.height>120);
  const gap=keyboardOpen?Math.round(Math.max(0,window.innerHeight-viewport.height-viewport.offsetTop)):0;
  const height=Math.round(viewport.height);
  if(gap!==lastGap){root.style.setProperty('--keyboard-space',gap+'px');lastGap=gap;}
  if(height!==lastHeight){root.style.setProperty('--visible-height',height+'px');lastHeight=height;}
  root.classList.toggle('keyboard-open',keyboardOpen);
 };
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;update();});};
 viewport.addEventListener('resize',schedule);viewport.addEventListener('scroll',schedule);
 window.addEventListener('resize',schedule);
 window.addEventListener('orientationchange',()=>{fullHeight=window.innerHeight;schedule();});
 document.addEventListener('focusin',schedule);
 document.addEventListener('focusout',schedule);
 update();
 return update;
}
