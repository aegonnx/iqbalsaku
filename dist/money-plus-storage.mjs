import {emptyIncome, validateIncome} from './money-plus-model.mjs';
export const INCOME_DB_NAME = 'saku-money-plus-v1';
export class IncomeRepository {
  constructor() { this.opening = null; }
  open() {
    if (!this.opening) {
      this.opening = new Promise((resolve,reject) => {
        const request = indexedDB.open(INCOME_DB_NAME,1);
        request.onupgradeneeded = () => request.result.createObjectStore('state');
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => { db.close(); this.opening = null; };
          resolve(db);
        };
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('Close other Money Plus tabs, then reload.'));
      }).catch(error => { this.opening = null; throw error; });
    }
    return this.opening;
  }
  async load() {
    const db = await this.open();
    return new Promise((resolve,reject) => {
      const request = db.transaction('state','readonly').objectStore('state').get('current');
      request.onsuccess = () => { try { resolve(validateIncome(request.result ?? emptyIncome())); } catch(error) { reject(error); } };
      request.onerror = () => reject(request.error);
    });
  }
  async update(change) {
    const db = await this.open();
    return new Promise((resolve,reject) => {
      // Read and write in one transaction: two tabs cannot overwrite each
      // other's new records. The change callback must be synchronous.
      const tx = db.transaction('state','readwrite'), store = tx.objectStore('state');
      let next, failure;
      const request = store.get('current');
      request.onsuccess = () => {
        try {
          const state = validateIncome(request.result ?? emptyIncome());
          change(state);
          next = validateIncome(state);
          store.put(next,'current');
        } catch(error) { failure = error; tx.abort(); }
      };
      tx.oncomplete = () => resolve(next);
      tx.onerror = tx.onabort = () => reject(failure ?? tx.error ?? new Error('Save interrupted. Please try again.'));
    });
  }
}
