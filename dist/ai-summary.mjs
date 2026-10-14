import {metrics} from './model.mjs';
export function aiSummary(state,month){
 const m=metrics(state,month);
 return {month,currency:state.settings.currency,period:m.range,startingBudget:m.startingBudget,extraIncome:m.extraIncome,expenses:m.spent,emergencyFunds:m.emergencyFunds,remaining:m.remaining,daysLeft:m.daysLeft,categories:state.categories.map(c=>({name:c.name,spent:m.categories[c.id]||0,budget:m.budget.categories[c.id]??null}))};
}
