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
  if(event.target.closest('.form-actions button')&&document.activeElement?.matches('input,textarea,select'))event.preventDefault();
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
 let fullHeight=window.innerHeight;
 const update=()=>{
  const editing=document.activeElement?.matches('input,textarea,select');
  const wasOpen=root.classList.contains('keyboard-open');
  if(!editing&&!wasOpen)fullHeight=window.innerHeight;
  const keyboardOpen=Boolean((editing||wasOpen)&&viewport.scale===1&&fullHeight-viewport.height>120);
  const gap=keyboardOpen?Math.max(0,window.innerHeight-viewport.height-viewport.offsetTop):0;
  root.style.setProperty('--keyboard-space',gap+'px');
  root.style.setProperty('--visible-height',viewport.height+'px');
  root.classList.toggle('keyboard-open',keyboardOpen);
 };
 viewport.addEventListener('resize',update);viewport.addEventListener('scroll',update);
 window.addEventListener('resize',update);
 window.addEventListener('orientationchange',()=>{fullHeight=window.innerHeight;update();});
 document.addEventListener('focusin',update);
 document.addEventListener('focusout',()=>setTimeout(update,0));
 update();
}
