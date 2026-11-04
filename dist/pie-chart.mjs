// Accurate SVG sectors. Keep the full circle inside a padded 240-unit viewBox.
export function pieSlices(values){
 if(!Array.isArray(values)||values.some(n=>!Number.isFinite(n)||n<=0))throw new Error('Pie values must be positive numbers.');
 const total=values.reduce((sum,n)=>sum+n,0);if(!total)return [];
 let angle=-Math.PI/2;
 return values.map((value,i)=>{
  const share=value/total,start=angle,end=i===values.length-1?Math.PI*1.5:start+share*Math.PI*2,mid=(start+end)/2;
  const point=a=>[120+100*Math.cos(a),120+100*Math.sin(a)];
  const from=point(start),to=point(end);
  const path=values.length===1?'M120 20 A100 100 0 1 1 120 220 A100 100 0 1 1 120 20 Z':`M120 120 L${from[0]} ${from[1]} A100 100 0 ${share>.5?1:0} 1 ${to[0]} ${to[1]} Z`;
  angle=end;
  return {path,share,labelX:values.length===1?120:120+62*Math.cos(mid),labelY:values.length===1?120:120+62*Math.sin(mid),offsetX:Math.cos(mid)*3,offsetY:Math.sin(mid)*3};
 });
}
export function piePercentage(value,total){
 const percentage=total>0?value/total*100:0;
 return percentage>0&&percentage<.1?'<0.1%':percentage.toFixed(1)+'%';
}
