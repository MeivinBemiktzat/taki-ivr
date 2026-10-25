'use strict';
const crypto=require('node:crypto');
const store=require('./storage'),engine=require('./game');
const clean=s=>String(s??'').replace(/[.=&\r\n-]/g,' ').slice(0,2000);
const phone=q=>String(q.ApiPhone||q.apiPhone||'').replace(/\D/g,'');
const call=q=>String(q.ApiCallId||q.apiCallId||q.ApiPhone||'').slice(0,160);
const sessionKey=q=>'session-'+crypto.createHash('sha256').update(call(q)).digest('hex');
const gameKey=code=>'game-'+code;
const params=q=>Object.assign({},q);
const output=(res,text)=>res.status(200).setHeader('Content-Type','text/plain; charset=utf-8').send(text);
const speak=t=>'id_list_message=t-'+clean(t);
function ask(s,t,step,{max=1,min=1,timeout=20}={}){
 s.step=step;s.seq=(s.seq||0)+1;s.param='P'+s.seq;
 const fields=[s.param,'',max,min,timeout,'Number','no','no','','',1,'Ok','','','no'].join(',');
 return 'read=t-'+clean(t)+'='+fields;
}
function last(g){return g.log.slice(-2).join('. ');}
function state(g,p){if(g.status==='finished')return 'המשחק הסתיים. המנצח הוא '+g.winner;
 if(g.status==='waiting')return 'ממתינים להצטרפות. קוד המשחק '+g.code+'. יש '+g.players.length+' שחקנים מתוך '+g.capacity;
 return last(g)+'. הקלף העליון '+engine.describe(engine.top(g))+'. הצבע הפעיל '+g.chosenColor+'. '+(engine.current(g).phone===p.phone?'עכשיו התור שלך':'כעת התור של '+engine.current(g).name);
}
function cards(g,p,all){const a=p.hand.map((c,i)=>({c,i})).filter(x=>all||engine.legal(g,x.c));return a.length?a.map(x=>'מספר '+(x.i+1)+' '+engine.describe(x.c)).join('. '):'אין קלפים חוקיים';}
function prompt(s,g,p){
 if(g.status==='finished')return ask(s,state(g,p)+'. להמשך הקישו 1','finished');
 if(g.status==='waiting')return ask(s,state(g,p)+'. לרענון הקישו 1','wait',{timeout:5});
 if(engine.current(g).phone!==p.phone)return ask(s,state(g,p)+'. לרענון הקישו 1. לשמיעת הקלפים שלך הקישו 2','wait',{timeout:5});
 return ask(s,state(g,p)+'. '+(g.pendingDraw?'יש לקחת '+g.pendingDraw+' קלפים או להניח פלוס שתיים. ':'')+
 'קלפים חוקיים: '+cards(g,p,false)+'. להנחת קלף הקישו 1. לקחת קלף הקישו 2. לכל הקלפים הקישו 3. '+(g.taki?'לסגירת טאקי הקישו 4. ':'')+'לרענון הקישו 5','action');
}
function person(g,p){return g.players.find(x=>x.phone===p);}
async function updateGame(code,mutator){
 for(let attempt=0;attempt<6;attempt++){
  try{return await store.run(async()=>{const g=await store.get(gameKey(code));if(!g)return {missing:true};
   const result=mutator(g)||{};if(result.changed){engine.bots(g);g.revision++;await store.put(gameKey(code),g);}
   return {g,result};
  });}catch(e){if(e.code!=='CONFLICT'||attempt===5)throw e;}
 }
}
async function newGame(p,mode,count){
 for(let i=0;i<20;i++){const code=String(crypto.randomInt(1000,10000));
  try{const g=await store.run(async()=>{if(await store.get(gameKey(code)))return null;
   const x=engine.create(code,p,mode,mode==='bots'?count-1:0,count);await store.put(gameKey(code),x);return x;});
   if(g)return g;
  }catch(e){if(e.code!=='CONFLICT')throw e;}
 }throw Error('Unable to allocate room');
}
async function handle(s,answer,p){
 if(s.step==='home'){
  if(answer==='1')return ask(s,'למשחק מול בוטים הקישו 1. למשחק עם שחקנים אחרים הקישו 2','mode');
  if(answer==='2')return ask(s,'הקישו קוד משחק בן ארבע ספרות','join',{min:4,max:4});
  return ask(s,'ברוכים הבאים לטאקי הטלפוני. לפתיחת משחק הקישו 1. להצטרפות או חזרה הקישו 2','home');
 }
 if(s.step==='mode'){
  if(!['1','2'].includes(answer))return ask(s,'בחירה לא תקינה. לבוטים 1. לשחקנים אחרים 2','mode');
  s.mode=answer==='1'?'bots':'humans';return ask(s,'כמה שחקנים כולל אותך? הקישו בין 2 ל 6','count');
 }
 if(s.step==='count'){
  const count=Number(answer);
  if(!Number.isInteger(count)||count<2||count>6)return ask(s,'הקישו מספר שחקנים בין 2 ל 6','count');
  const g=await newGame(p,s.mode,count);s.code=g.code;
  const me=person(g,p);
  return ask(s,'נוצר חדר. קוד המשחק הוא '+g.code+'. '+state(g,me)+'. להמשך הקישו 1','wait',{timeout:5});
 }
 if(s.step==='join'){
  if(!/^\d{4}$/.test(answer))return ask(s,'הקישו קוד בן ארבע ספרות','join',{min:4,max:4});
  const result=await updateGame(answer,g=>{
   if(person(g,p))return {};
   if(g.status!=='waiting'||g.players.length>=g.capacity)return {denied:true};
   g.players.push({id:'p'+(g.players.length+1),phone:p,name:'שחקן '+(g.players.length+1),bot:false,hand:[]});
   if(g.players.length===g.capacity)engine.start(g);
   return {changed:true};
  });
  if(result.missing||result.result?.denied)return ask(s,'החדר אינו זמין. הקישו קוד חדר אחר','join',{min:4,max:4});
  s.code=answer;return prompt(s,result.g,person(result.g,p));
 }
 if(!s.code){s.step='home';return handle(s,'',p);}
 const action=answer;
 const actionId=crypto.createHash('sha256').update(p+':'+call(s.request||{})+':'+s.param).digest('hex').slice(0,24);
 const result=await updateGame(s.code,g=>{
  g.applied ||= {};
  if(g.applied[actionId])return {duplicate:true};
  const me=person(g,p);
  if(!me)return {denied:true};
  if(g.status!=='playing'||engine.current(g).phone!==p)return {};
  if(s.step==='action'){
   if(action==='2'){if(g.taki)return {error:'יש לסגור את הטאקי לפני לקיחת קלף'};engine.take(g);g.applied[actionId]=true;return {changed:true};}
   if(action==='4'&&g.taki){engine.closeTaki(g);g.applied[actionId]=true;return {changed:true};}
  }
  if(s.step==='card'){
   const i=Number(action)-1;
   if(!Number.isInteger(i)||i<0||i>=me.hand.length||!engine.legal(g,me.hand[i]))return {error:'קלף לא חוקי'};
   if(!me.hand[i].color)return {choose:i};
   engine.play(g,i,null);g.applied[actionId]=true;return {changed:true};
  }
  if(s.step==='color'){
   const color=engine.COLORS[Number(action)-1];
   if(!color)return {error:'בחירת צבע לא חוקית'};
   const i=s.cardIndex;
   if(!Number.isInteger(i)||!me.hand[i]||me.hand[i].id!==s.cardId||me.hand[i].color||!engine.legal(g,me.hand[i]))return {error:'הקלף השתנה. בחרו שוב'};
   engine.play(g,i,color);g.applied[actionId]=true;return {changed:true};
  }
  return {};
 });
 if(result.missing){s.code=null;return ask(s,'המשחק לא נמצא. לפתיחת משחק הקישו 1. להצטרפות הקישו 2','home');}
 if(result.result?.denied){s.code=null;return ask(s,'אינך רשום למשחק. לפתיחת משחק הקישו 1. להצטרפות הקישו 2','home');}
 const g=result.g,me=person(g,p);
 if(result.result?.duplicate)return prompt(s,g,me);
 if(result.result?.error)return ask(s,result.result.error+'. הקישו 1 להמשך','refresh');
 if(result.result?.choose!==undefined){s.cardIndex=result.result.choose;s.cardId=me.hand[s.cardIndex].id;return ask(s,'בחרו צבע. לאדום 1. לכחול 2. לירוק 3. לצהוב 4','color');}
 if(s.step==='action'&&action==='1'&&g.status==='playing'&&engine.current(g).phone===p)return ask(s,'הקישו את מספר הקלף. '+cards(g,me,true),'card',{max:2});
 if(s.step==='action'&&action==='3')return ask(s,'כל הקלפים שלך: '+cards(g,me,true)+'. להמשך הקישו 1','refresh');
 if(s.step==='wait'&&action==='2')return ask(s,'הקלפים שלך: '+cards(g,me,true)+'. להמשך הקישו 1','refresh');
 return prompt(s,g,me);
}
module.exports=async function handler(req,res){
 if(!['GET','POST'].includes(req.method))return output(res,'');
 const q=params({...req.query,...req.body}),p=phone(q);
 if(!p)return output(res,speak('לא התקבל מספר טלפון מזוהה'));
 try{
  for(let attempt=0;attempt<5;attempt++){
   try{const body=await store.run(async()=>{
    const k=sessionKey(q),old=await store.get(k);
    const s=old||{step:'home',seq:0,param:null,code:null,mode:null,cardIndex:null,lastResponse:null,lastValue:null};
    const val=s.param?String(q['api_'+s.param]??q[s.param]??''):'';
    if(old&&s.lastResponse!==null&&val===s.lastValue&&s.lastHandledParam===s.param)return s.lastResponse;
    const previous=s.param;
    s.request={ApiCallId:call(q)};
    const response=await handle(s,val,p);
    delete s.request;
    s.lastHandledParam=previous;s.lastValue=val;s.lastResponse=response;
    await store.put(k,s);
    return response;
   });return output(res,body);
   }catch(e){if(e.code!=='CONFLICT'||attempt===4)throw e;}
  }
 }catch(e){console.error(JSON.stringify({service:'taki-ivr',event:'error',code:e.code||e.name,message:e.message}));return output(res,speak('אירעה תקלה זמנית. נסו שוב'));}
};
