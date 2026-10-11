import {INCOME_SOURCES,sourceName,validateIncomeRecord} from './income-model.mjs';
import {amountText,amountFromInput} from './amount-input.mjs';
import {id,localDate} from './model.mjs';
import {pinDialogActions} from './mobile-layout.mjs';
import {openDialog,closeDialog,dialogActive,dialogClosing} from './motion.mjs';
export class IncomeController {
  constructor(context){
    Object.assign(this,context);this.dialog=document.getElementById('income-dialog');this.previous=null;
    const dialog=this.dialog;
    dialog.addEventListener('input',event=>{if(event.target.name==='amount'){const amount=amountFromInput(event.target.value);dialog.querySelector('#income-preview').textContent=Number.isFinite(amount)?this.format(amount):'Enter thousands, e.g. 500 for 500.000.';dialog.querySelector('#income-error').textContent='';event.target.removeAttribute('aria-invalid');}});
    dialog.addEventListener('focusin',event=>{if(event.target.matches('input,textarea,select'))this.details(Boolean(event.target.closest('.expense-options')));});
    dialog.addEventListener('click',event=>{
      if(event.target.closest('[data-close]')){if(!this.saving())closeDialog(dialog);return;}
      if(event.target.closest('[data-expense-details]')){const show=!dialog.classList.contains('details-mode');this.details(show);if(show){document.activeElement?.blur();dialog.querySelector('[data-expense-details]').focus({preventScroll:true});}else dialog.querySelector('#income-amount').focus();return;}
      if(event.target.closest('[data-delete-income]'))this.remove();
    });
    dialog.addEventListener('submit',event=>{event.preventDefault();this.save(event.target);});
  }
  saving(){return this.blocked()||this.dialog.querySelector('[data-submit-form]')?.disabled||dialogClosing(this.dialog);}
  details(show){this.dialog.classList.toggle('details-mode',show);const button=this.dialog.querySelector('[data-expense-details]');button.textContent=show?'Amount':'Details';button.setAttribute('aria-expanded',String(show));}
  row(t){
    const {escape:e,format,icon}=this,reference=t.source==='salary';
    return '<div class="transaction income-row"><span class="category-icon">'+icon('down')+'</span><div class="transaction-info"><div class="transaction-title">'+e(t.title)+'</div><div class="transaction-meta">'+e(sourceName(t.source))+(reference?' · Not extra income':' · Money in')+(t.note?' · '+e(t.note):'')+'</div></div><div class="transaction-amount '+(reference?'muted':'money-in')+'" aria-label="'+e((reference?'Salary reference ':'Income ')+format(t.amount))+'">'+(reference?'':'+')+format(t.amount)+'</div><button class="transaction-edit" data-action="edit-income" data-id="'+e(t.id)+'" aria-label="Edit income '+e(t.title)+'">'+icon('edit')+'</button></div>';
  }
  open(existing=null){
    if(this.blocked()||dialogActive(this.dialog))return;
    this.previous=existing?structuredClone(existing):null;
    const t=existing||{amount:0,source:'bonus',date:localDate(),title:'',note:''},reference=t.source==='salary';
    const {escape:e,format,icon}=this,dialog=this.dialog;
    dialog.classList.remove('details-mode');dialog.setAttribute('aria-labelledby','income-title');
    dialog.innerHTML='<div class="dialog-inner"><div class="dialog-header"><h2 id="income-title">'+(reference?'Saved salary':existing?'Edit income':'Add income')+'</h2><div class="dialog-header-actions"><button type="button" class="text-button" data-expense-details aria-expanded="false" aria-controls="income-options">Details</button><button type="button" class="icon-button" data-close="income" aria-label="Close">'+icon('close')+'</button></div></div><form id="income-form" class="expense-form" novalidate><div class="expense-core"><div class="amount-field"><label for="income-amount">Amount (×1.000)</label><input class="amount-input full-width" id="income-amount" name="amount" inputmode="decimal" autocomplete="off" placeholder="0" value="'+e(t.amount?amountText(t.amount):'')+'" required aria-describedby="income-preview income-error"><p id="income-preview" class="amount-preview">'+(t.amount?format(t.amount):'Type 500 for Rp500.000')+'</p><p class="error-message" id="income-error" role="alert"></p></div><label class="field category-field">Source<select name="source">'+(reference?'<option value="salary">Starting salary reference</option>':INCOME_SOURCES.map(s=>'<option value="'+s.id+'" '+(s.id===t.source?'selected':'')+'>'+e(s.name)+'</option>').join(''))+'</select></label></div><div id="income-options" class="expense-options"><div class="expense-extra"><label class="field">Date received<input name="date" type="date" value="'+e(t.date)+'" min="2000-01-01" max="2100-12-31" required></label><label class="field">Description (optional)<input name="title" maxlength="160" placeholder="e.g. Monthly work bonus" value="'+e(t.title)+'" autocomplete="off"></label><label class="field">Note (optional)<textarea name="note" maxlength="2000" placeholder="Optional">'+e(t.note)+'</textarea></label>'+(reference?'<p class="notice">This saved salary is a reference only. Change your starting budget in Settings to update available money.</p>':'')+'</div><div class="form-actions">'+(existing?'<button class="secondary danger" type="button" data-delete-income aria-label="Delete income">'+icon('trash')+'</button>':'')+'<button class="primary" type="submit">'+(existing?'Save changes':'Save income')+'</button></div></div></form></div>';
    pinDialogActions(dialog,'income-form');openDialog(dialog,{focus:existing?dialog.querySelector('[data-close]'):dialog.querySelector('#income-amount'),select:!existing});
  }
  async save(form){
    if(this.saving())return;
    const button=this.dialog.querySelector('[data-submit-form]');button.disabled=true;const label=button.textContent;button.textContent='Saving…';
    try{
      const data=new FormData(form),previous=this.previous;
      const record=validateIncomeRecord({id:previous?.id||id(),amount:amountFromInput(data.get('amount')),source:previous?.source==='salary'?'salary':data.get('source'),date:data.get('date'),title:String(data.get('title')||'').trim()||sourceName(data.get('source')),note:String(data.get('note')||'').trim(),createdAt:previous?.createdAt??Date.now()});
      await this.commit(next=>{if(previous){const index=next.income.findIndex(t=>t.id===previous.id);if(index<0||JSON.stringify(next.income[index])!==JSON.stringify(previous))throw new Error('This income changed elsewhere. Close and reopen it to edit the latest copy.');next.income[index]=record;}else next.income.push(record);});
      this.selectDate(record.date);await closeDialog(this.dialog);this.render();this.notify(previous?'Income updated':'Income saved · '+this.format(record.amount));
    }catch(error){this.dialog.querySelector('#income-error').textContent=error.message||'Could not save income. Please retry.';button.disabled=false;button.textContent=label;this.details(false);this.dialog.querySelector('#income-amount').focus();}
  }
  remove(){
    if(this.saving()||!this.previous)return;
    const previous=this.previous;
    this.showConfirm('Delete income?','Delete '+previous.title+' ('+this.format(previous.amount)+')? '+(previous.source==='salary'?'Your starting budget stays as entered in Settings.':'Your remaining money will update immediately.'),'',async()=>{await this.commit(next=>{const record=next.income.find(t=>t.id===previous.id);if(record&&JSON.stringify(record)!==JSON.stringify(previous))throw new Error('This income changed elsewhere. Close and reopen it before deleting.');next.income=next.income.filter(t=>t.id!==previous.id);});await closeDialog(this.dialog,{immediate:true});this.notify('Income deleted');},'Delete income');
  }
  action(action,key){
    if(action==='add-income'){this.open();return true;}
    if(action==='edit-income'){const record=this.getState().income.find(t=>t.id===key);if(record)this.open(record);return true;}
    return false;
  }
}
