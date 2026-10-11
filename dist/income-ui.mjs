import {sourceName,validateIncomeRecord,renameIncomeSources,deleteIncomeSource} from './income-model.mjs';
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
    return '<div class="transaction income-row"><span class="category-icon">'+icon('down')+'</span><div class="transaction-info"><div class="transaction-title">'+e(t.title)+'</div><div class="transaction-meta">'+e(sourceName(t.source,this.getState().incomeSources))+(reference?' · Not extra income':' · Money in')+(t.note?' · '+e(t.note):'')+'</div></div><div class="transaction-amount '+(reference?'muted':'money-in')+'" aria-label="'+e((reference?'Salary reference ':'Income ')+format(t.amount))+'">'+(reference?'':'+')+format(t.amount)+'</div><button class="transaction-edit" data-action="edit-income" data-id="'+e(t.id)+'" aria-label="Edit income '+e(t.title)+'">'+icon('edit')+'</button></div>';
  }
  open(existing=null){
    if(this.blocked()||dialogActive(this.dialog))return;
    this.previous=existing?structuredClone(existing):null;
    const t=existing||{amount:0,source:this.getState().incomeSources[0].id,date:localDate(),title:'',note:''},reference=t.source==='salary';
    const {escape:e,format,icon}=this,dialog=this.dialog;
    dialog.classList.remove('details-mode');dialog.setAttribute('aria-labelledby','income-title');
    dialog.innerHTML='<div class="dialog-inner"><div class="dialog-header"><h2 id="income-title">'+(reference?'Saved salary':existing?'Edit income':'Add income')+'</h2><div class="dialog-header-actions"><button type="button" class="text-button" data-expense-details aria-expanded="false" aria-controls="income-options">Details</button><button type="button" class="icon-button" data-close="income" aria-label="Close">'+icon('close')+'</button></div></div><form id="income-form" class="expense-form" novalidate><div class="expense-core"><div class="amount-field"><label for="income-amount">Amount (×1.000)</label><input class="amount-input full-width" id="income-amount" name="amount" inputmode="decimal" autocomplete="off" placeholder="0" value="'+e(t.amount?amountText(t.amount):'')+'" required aria-describedby="income-preview income-error"><p id="income-preview" class="amount-preview">'+(t.amount?format(t.amount):'Type 500 for Rp500.000')+'</p><p class="error-message" id="income-error" role="alert"></p></div><label class="field category-field">Source<select name="source">'+(reference?'<option value="salary">Starting salary reference</option>':this.getState().incomeSources.map(s=>'<option value="'+e(s.id)+'" '+(s.id===t.source?'selected':'')+'>'+e(s.name)+'</option>').join(''))+'</select></label></div><div id="income-options" class="expense-options"><div class="expense-extra"><label class="field">Date received<input name="date" type="date" value="'+e(t.date)+'" min="2000-01-01" max="2100-12-31" required></label><label class="field">Description (optional)<input name="title" maxlength="160" placeholder="e.g. Monthly work bonus" value="'+e(t.title)+'" autocomplete="off"></label><label class="field">Note (optional)<textarea name="note" maxlength="2000" placeholder="Optional">'+e(t.note)+'</textarea></label>'+(reference?'<p class="notice">This saved salary is a reference only. Change your starting budget in Settings to update available money.</p>':'')+'</div><div class="form-actions">'+(existing?'<button class="secondary danger" type="button" data-delete-income aria-label="Delete income">'+icon('trash')+'</button>':'')+'<button class="primary" type="submit">'+(existing?'Save changes':'Save income')+'</button></div></div></form></div>';
    pinDialogActions(dialog,'income-form');openDialog(dialog,{focus:existing?dialog.querySelector('[data-close]'):dialog.querySelector('#income-amount'),select:!existing});
  }
  async save(form){
    if(this.saving())return;
    const button=this.dialog.querySelector('[data-submit-form]');button.disabled=true;const label=button.textContent;button.textContent='Saving…';
    try{
      const data=new FormData(form),previous=this.previous;
      const record=validateIncomeRecord({id:previous?.id||id(),amount:amountFromInput(data.get('amount')),source:previous?.source==='salary'?'salary':data.get('source'),date:data.get('date'),title:String(data.get('title')||'').trim()||sourceName(data.get('source'),this.getState().incomeSources),note:String(data.get('note')||'').trim(),createdAt:previous?.createdAt??Date.now()},this.getState().incomeSources);
      await this.commit(next=>{if(previous){const index=next.income.findIndex(t=>t.id===previous.id);if(index<0||JSON.stringify(next.income[index])!==JSON.stringify(previous))throw new Error('This income changed elsewhere. Close and reopen it to edit the latest copy.');next.income[index]=record;}else next.income.push(record);});
      this.selectDate(record.date);await closeDialog(this.dialog);this.render();this.notify(previous?'Income updated':'Income saved · '+this.format(record.amount));
    }catch(error){this.dialog.querySelector('#income-error').textContent=error.message||'Could not save income. Please retry.';button.disabled=false;button.textContent=label;this.details(false);this.dialog.querySelector('#income-amount').focus();}
  }
  remove(){
    if(this.saving()||!this.previous)return;
    const previous=this.previous;
    this.showConfirm('Delete income?','Delete '+previous.title+' ('+this.format(previous.amount)+')? '+(previous.source==='salary'?'Your starting budget stays as entered in Settings.':'Your remaining money will update immediately.'),'',async()=>{await this.commit(next=>{const record=next.income.find(t=>t.id===previous.id);if(record&&JSON.stringify(record)!==JSON.stringify(previous))throw new Error('This income changed elsewhere. Close and reopen it before deleting.');next.income=next.income.filter(t=>t.id!==previous.id);});await closeDialog(this.dialog,{immediate:true});this.notify('Income deleted');},'Delete income');
  }
  settings(){
    const {escape:e,icon}=this,sources=this.getState().incomeSources;
    return '<section class="card settings-card"><div class="section-head"><h2>Income sources</h2><small>'+sources.length+' sources</small></div><p class="income-help">Customize the categories for money you receive. Starting salary goes in Monthly budgets.</p><form id="income-sources-form">'+sources.map((source,i)=>'<div class="settings-category"><label class="sr-only" for="income-source-'+e(source.id)+'">Name for income source '+e(source.name)+'</label><input id="income-source-'+e(source.id)+'" name="'+e(source.id)+'" data-source-id="'+e(source.id)+'" data-previous-name="'+e(source.name)+'" value="'+e(source.name)+'" maxlength="80" required><div class="controls"><button type="button" class="icon-button" data-action="move-income-source" data-id="'+e(source.id)+'" data-direction="-1" '+(i===0?'disabled':'')+' aria-label="Move income source '+e(source.name)+' up">'+icon('up')+'</button><button type="button" class="icon-button" data-action="move-income-source" data-id="'+e(source.id)+'" data-direction="1" '+(i===sources.length-1?'disabled':'')+' aria-label="Move income source '+e(source.name)+' down">'+icon('down')+'</button><button type="button" class="icon-button danger" data-action="delete-income-source" data-id="'+e(source.id)+'" '+(sources.length===1?'disabled':'')+' aria-label="Delete income source '+e(source.name)+'">'+icon('trash')+'</button></div></div>').join('')+'<button class="primary full-width" type="submit" style="margin-top:16px">Save income sources</button></form><form id="add-income-source-form" class="add-inline"><label class="sr-only" for="new-income-source">New income source name</label><input id="new-income-source" name="name" maxlength="80" placeholder="New income source" required '+(sources.length>=100?'disabled':'')+'><button class="secondary" type="submit" '+(sources.length>=100?'disabled':'')+'>Add</button></form><small>Deleting a source moves its income records to another source you choose.</small></section>';
  }
  sourceChanges(){return [...document.querySelectorAll('#income-sources-form [data-source-id]')].map(input=>({id:input.dataset.sourceId,name:input.value,previousName:input.dataset.previousName}));}
  async saveSources(){const changes=this.sourceChanges();await this.commit(next=>renameIncomeSources(next,changes));}
  async addSource(name){const changes=this.sourceChanges();await this.commit(next=>{renameIncomeSources(next,changes);next.incomeSources.push({id:id(),name:String(name).trim()});});}
  async action(action,key,button){
    if(action==='add-income'){this.open();return true;}
    if(action==='edit-income'){const record=this.getState().income.find(t=>t.id===key);if(record)this.open(record);return true;}
    if(action==='move-income-source'){
      const changes=this.sourceChanges(),direction=Number(button.dataset.direction);
      await this.commit(next=>{renameIncomeSources(next,changes);const index=next.incomeSources.findIndex(s=>s.id===key),target=index+direction;if(index>=0&&target>=0&&target<next.incomeSources.length)[next.incomeSources[index],next.incomeSources[target]]=[next.incomeSources[target],next.incomeSources[index]];});this.render();this.notify('Income source order saved');return true;
    }
    if(action==='delete-income-source'){
      const sources=this.getState().incomeSources,source=sources.find(s=>s.id===key);if(!source||sources.length<=1)return true;
      const e=this.escape;
      this.showConfirm('Delete income source?', 'Remove '+source.name+' and move its income records to another source? Amounts, dates, notes, and remaining money stay the same.','<label class="field">Move income to<select name="destination">'+sources.filter(s=>s.id!==key).map(s=>'<option value="'+e(s.id)+'">'+e(s.name)+'</option>').join('')+'</select></label>',async data=>{await this.commit(next=>deleteIncomeSource(next,key,data.get('destination')));this.notify('Income source removed; records moved');},'Delete source');return true;
    }
    return false;
  }
}
