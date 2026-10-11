export const PALETTES=[{id:'jade',name:'Jade'},{id:'blue',name:'Ocean blue'}];
export function applyPalette(value,{persist=true}={}){
 const palette=PALETTES.some(item=>item.id===value)?value:'jade';
 document.documentElement.dataset.palette=palette;
 if(persist)try{localStorage.setItem('iqbal-saku-palette',palette);}catch{}
 return palette;
}
