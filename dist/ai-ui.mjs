import {aiSummary} from './ai-summary.mjs';
export function installAI({getState,getMonth,cloud}){
 const dialog=document.createElement('dialog');dialog.id='ai-dialog';dialog.setAttribute('aria-labelledby','ai-title');document.body.append(dialog);
 let controller,opener;
 dialog.addEventListener('close',()=>{controller?.abort();dialog.querySelector('.ai-answer')?.replaceChildren();});
 const cancel=()=>{controller?.abort();dialog.close();opener?.focus();};
 document.addEventListener('click',event=>{const button=event.target.closest('[data-action="ask-ai"]');if(!button)return;opener=button;
  dialog.innerHTML='<div class="dialog-inner"><div class="dialog-header"><h2 id="ai-title">Ask Qwen</h2><button type="button" class="icon-button" data-ai-close aria-label="Close AI assistant">×</button></div><p class="muted">Ask about '+getMonth()+'. Answers are suggestions; check them before making decisions.</p><div class="ai-suggestions"><button type="button" class="secondary" data-ai-question="How can I stay within my budget this month?">Help me stay on budget</button><button type="button" class="secondary" data-ai-question="Which spending categories should I focus on reducing?">Review my spending</button></div><form id="ai-form"><label class="field">Your question<textarea name="question" maxlength="1000" required rows="3" placeholder="Can I afford another Rp200.000 expense?"></textarea></label><label class="ai-consent"><input type="checkbox" name="consent" required> Share my question and this month’s totals and category names with OpenRouter and its AI provider. Transaction descriptions and notes are excluded.</label><button class="primary full-width" type="submit">Ask AI</button></form><p class="error-message" data-ai-error role="alert"></p><div class="ai-answer" role="status" aria-live="polite"></div></div>';
  dialog.showModal();dialog.querySelector('textarea').focus();
 });
 dialog.addEventListener('cancel',event=>{event.preventDefault();cancel();});
 dialog.addEventListener('click',event=>{if(event.target.closest('[data-ai-close]'))cancel();const suggestion=event.target.closest('[data-ai-question]');if(suggestion){dialog.querySelector('textarea').value=suggestion.dataset.aiQuestion;dialog.querySelector('textarea').focus();}});
 dialog.addEventListener('submit',async event=>{event.preventDefault();const form=event.target,button=form.querySelector('[type=submit]'),error=dialog.querySelector('[data-ai-error]'),answer=dialog.querySelector('.ai-answer');if(button.disabled)return;
  error.textContent='';answer.textContent='';
  if(!navigator.onLine){error.textContent='Connect to the internet to use Ask AI.';return;}
  if(!cloud.user||!cloud.client){error.textContent='Sign in in Settings to use Ask AI.';return;}
  if(!form.reportValidity())return;
  const snapshot=aiSummary(getState(),getMonth()),account=cloud.user.id;
  controller=new AbortController();const active=controller;button.disabled=true;button.textContent='Thinking…';const timeout=setTimeout(()=>active.abort(),55000);
  try{const {data,error:sessionError}=await cloud.client.auth.getSession();if(sessionError||!data.session?.access_token)throw new Error('Please sign in again in Settings.');
   const response=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},body:JSON.stringify({question:form.elements.question.value,summary:snapshot}),signal:active.signal});
   let result;try{result=await response.json();}catch{throw new Error('AI is not connected yet. Please try again after setup.');}
   if(!response.ok)throw new Error(result.error||'AI is unavailable. Please try later.');
   if(cloud.user?.id===account&&dialog.open)answer.textContent=result.answer;
  }catch(err){if(dialog.open)error.textContent=err.name==='AbortError'?'The request timed out. Please try again.':err.message;}
  finally{clearTimeout(timeout);button.disabled=false;button.textContent='Ask AI';if(controller===active)controller=null;}
 });
}
