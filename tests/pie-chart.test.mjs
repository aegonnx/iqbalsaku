import test from 'node:test';
import assert from 'node:assert/strict';
import {pieSlices,piePercentage} from '../dist/pie-chart.mjs';

test('pie proportions represent all categories, including tiny values, without mutation',()=>{
 const values=[500,300,199,1],before=[...values],slices=pieSlices(values);
 assert.deepEqual(slices.map(s=>s.share),[.5,.3,.199,.001]);assert.deepEqual(values,before);
 assert.ok(Math.abs(slices.reduce((sum,s)=>sum+s.share,0)-1)<1e-12);
 for(const slice of slices){assert.ok(!/NaN|Infinity/.test(slice.path));assert.ok(slice.labelX>=20&&slice.labelX<=220);assert.ok(slice.labelY>=20&&slice.labelY<=220);}
});
test('single-category pie draws a complete circle and empty months draw nothing',()=>{
 const [slice]=pieSlices([1]);assert.equal(slice.share,1);assert.equal((slice.path.match(/A100/g)||[]).length,2);assert.equal(slice.labelX,120);assert.equal(slice.labelY,120);assert.deepEqual(pieSlices([]),[]);
 assert.throws(()=>pieSlices([0]));assert.throws(()=>pieSlices([-1]));assert.throws(()=>pieSlices([Infinity]));
 assert.equal(piePercentage(1,1000000),'<0.1%');assert.equal(piePercentage(100,100),'100.0%');assert.equal(piePercentage(0,0),'0.0%');
});
