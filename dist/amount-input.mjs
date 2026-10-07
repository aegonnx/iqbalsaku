import {parseAmount} from './model.mjs';

// Entry units never change the full numeric values in storage or backups.
export function amountText(value){
 return value===''||value===undefined||value===null?'':String(value/1000);
}
export function amountFromInput(raw,mode='thousands'){
 const text=String(raw).trim();
 if(mode==='rupiah'||/^rp\s*/i.test(text))return parseAmount(text);
 const compact=text.toLowerCase().replace(/\s/g,'').replace(/k$/,'').replace(',','.');
 const match=/^(\d+)(?:\.(\d{1,3}))?$/.exec(compact);
 if(!match)return NaN;
 // Decimal thousand amounts retain exact rupiah precision (e.g. 8.001).
 const value=Number(BigInt(match[1])*1000n+BigInt((match[2]||'').padEnd(3,'0')));
 return Number.isSafeInteger(value)&&value<=1000000000000?value:NaN;
}
