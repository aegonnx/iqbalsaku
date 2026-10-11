import {seedState,upgradeState} from './model.mjs';
const DB_NAME='saku-expenses-v1';
export class ExpenseRepository {
  constructor(){this.db=null;}
  async open(){
    this.db=await new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME,1);request.onupgradeneeded=()=>request.result.createObjectStore('state');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error('Close other mySaku tabs, then try again.'));});
    this.db.onversionchange=()=>this.db.close();
  }
  async load(){
    const state=await this.readRecord('current');
    if(state)return upgradeState(state);
    const initial=seedState();await this.save(initial);return initial;
  }
  async save(state){
    const clean=upgradeState(state);
    await this.writeRecord('current',clean);
  }
  async readRecord(key){
    if(!this.db)await this.open();
    return new Promise((resolve,reject)=>{const req=this.db.transaction('state','readonly').objectStore('state').get(key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  }
  async writeRecord(key,value){
    if(!this.db)await this.open();
    await new Promise((resolve,reject)=>{const tx=this.db.transaction('state','readwrite');tx.objectStore('state').put(value,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Save interrupted. Please try again.'));});
  }
}
