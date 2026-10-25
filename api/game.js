'use strict';
const crypto=require('node:crypto');
const COLORS=['אדום','כחול','ירוק','צהוב'];
const SPECIAL=['עצור','פלוס','שנה כיוון','פלוס 2','טאקי'];
const id=()=>crypto.randomUUID();
function deck(){const d=[];for(const color of COLORS){for(let n=1;n<=9;n++)for(let i=0;i<2;i++)d.push({id:id(),color,value:String(n)});for(const v of SPECIAL)for(let i=0;i<2;i++)d.push({id:id(),color,value:v});}for(let i=0;i<4;i++){d.push({id:id(),color:null,value:'שנה צבע'});d.push({id:id(),color:null,value:'סופר טאקי'});}return shuffle(d);}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=crypto.randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
function draw(g,p,n=1){for(let i=0;i<n;i++){if(!g.deck.length){if(g.discard.length<2)break;const top=g.discard.pop();g.deck=shuffle(g.discard.splice(0));g.discard=[top];}p.hand.push(g.deck.pop());}}
function create(code,owner,mode,bots,total){const g={code,status:'waiting',mode,capacity:total,players:[{id:'p1',phone:owner,name:'שחקן 1',bot:false,hand:[]}],deck:deck(),discard:[],turn:0,direction:1,chosenColor:null,pendingDraw:0,taki:false,log:[],revision:0,winner:null};if(mode==='bots'){for(let i=1;i<=bots;i++)g.players.push({id:'p'+(i+1),phone:null,name:'בוט '+i,bot:true,hand:[]});g.capacity=g.players.length;start(g);}return g;}
function start(g){g.status='playing';for(const p of g.players)draw(g,p,8);let first;do{first=g.deck.pop();if(!/^\d+$/.test(first.value)){g.deck.unshift(first);shuffle(g.deck);first=null;}}while(!first);g.discard.push(first);g.chosenColor=first.color;g.log.push('המשחק התחיל');}
function current(g){return g.players[g.turn];}
function top(g){return g.discard.at(-1);}
function legal(g,c){if(g.pendingDraw)return c.value==='פלוס 2';if(g.taki)return c.color===g.chosenColor;return !c.color||c.color===g.chosenColor||c.value===top(g).value;}
function next(g,steps=1){g.turn=(g.turn+steps*g.direction%g.players.length+g.players.length)%g.players.length;}
function play(g,idx,color){const p=current(g),c=p.hand[idx];if(!c||!legal(g,c))throw Error('הקלף אינו חוקי');if((c.value==='שנה צבע'||c.value==='סופר טאקי')&&!COLORS.includes(color))throw Error('צריך לבחור צבע');p.hand.splice(idx,1);g.discard.push(c);g.chosenColor=color||c.color||g.chosenColor;g.log.push(p.name+' הניח '+describe(c)+(color?' ובחר '+color:''));if(!p.hand.length){g.status='finished';g.winner=p.name;g.log.push(p.name+' ניצח במשחק');return;}if(c.value==='טאקי'||c.value==='סופר טאקי'){g.taki=true;return;}if(g.taki)return;let steps=1;if(c.value==='שנה כיוון'){g.direction*=-1;if(g.players.length===2)steps=2;}if(c.value==='עצור')steps=2;if(c.value==='פלוס')steps=0;if(c.value==='פלוס 2')g.pendingDraw+=2;next(g,steps);}
function closeTaki(g){if(!g.taki)throw Error('אין טאקי פתוח');g.taki=false;const c=top(g);let steps=1;if(c.value==='עצור')steps=2;if(c.value==='פלוס')steps=0;if(c.value==='שנה כיוון'){g.direction*=-1;if(g.players.length===2)steps=2;}if(c.value==='פלוס 2')g.pendingDraw+=2;next(g,steps);}
function take(g){const p=current(g);if(g.taki)throw Error('יש לסגור את הטאקי');const count=g.pendingDraw||1;draw(g,p,count);g.pendingDraw=0;g.log.push(p.name+' לקח '+count+' קלפים');next(g);}
function describe(c){return c.color?c.value+' '+c.color:c.value;}
function bots(g){let n=0;while(g.status==='playing'&&current(g).bot&&n++<120){const p=current(g);const choices=p.hand.map((c,i)=>({c,i})).filter(x=>legal(g,x.c));if(!choices.length){if(g.taki)closeTaki(g);else take(g);continue;}choices.sort((a,b)=>Number(b.c.value==='פלוס 2')-Number(a.c.value==='פלוס 2'));const pick=choices[0];let color;if(!pick.c.color){const counts=COLORS.map(c=>[c,p.hand.filter(x=>x.color===c).length]).sort((a,b)=>b[1]-a[1]);color=counts[0][0];}play(g,pick.i,color);if(g.taki){const matching=p.hand.findIndex(x=>legal(g,x));if(matching<0)closeTaki(g);}}}
module.exports={COLORS,create,start,current,top,legal,play,closeTaki,take,bots,describe};
