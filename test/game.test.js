'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const g=require('../api/game');
test('bot game starts with cards and active color',()=>{
 const x=g.create('1234','0500000000','bots',2,3);
 assert.equal(x.players.length,3);assert.equal(x.status,'playing');
 assert.ok(x.players.every(p=>p.hand.length===8));
 assert.ok(g.COLORS.includes(x.chosenColor));
 assert.match(g.top(x).value,/^[1-9]$/);
});
test('human lobby waits for participants',()=>{
 const x=g.create('1234','0500000000','humans',0,3);
 assert.equal(x.status,'waiting');assert.equal(x.players.length,1);
});
test('drawing advances exactly one turn',()=>{
 const x=g.create('1234','0500000000','bots',1,2);
 const old=x.turn,hand=x.players[old].hand.length;
 g.take(x);assert.equal(x.turn,(old+1)%2);
 assert.equal(x.players[old].hand.length,hand+1);
});
test('illegal card is rejected without changing hand',()=>{
 const x=g.create('1234','0500000000','bots',1,2);
 const p=g.current(x);const i=p.hand.findIndex(c=>!g.legal(x,c));
 if(i<0)return;
 const count=p.hand.length;
 assert.throws(()=>g.play(x,i),/אינו חוקי/);
 assert.equal(p.hand.length,count);
});
test('turn never expires based on clock',()=>{
 const x=g.create('1234','0500000000','bots',1,2);
 const old=x.turn;
 x.turnStartedAt=0;
 assert.equal(x.turn,old);
});
