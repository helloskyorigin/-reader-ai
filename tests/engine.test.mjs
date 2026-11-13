import test from 'node:test';
import assert from 'node:assert/strict';
import {normalize,tokenize,getWords,cleanPageText,wordCount,roughlySame,alignRecognized,suggestedStories,safeProfile} from '../engine.mjs';

test('normalizes punctuation and apostrophes',()=>{
 assert.equal(normalize("Don't!"),'dont');assert.equal(normalize('Beautiful,'),'beautiful');assert.equal(normalize(''), '');
});
test('keeps page punctuation and whitespace while extracting readable words',()=>{
 const text="The little boy.\nIt's blue!";
 assert.deepEqual(getWords(text).map(x=>x.norm),['the','little','boy','its','blue']);
 assert.equal(tokenize(text).join(''),text);
 assert.equal(wordCount(text),5);
});
test('cleans image text without changing printed newlines',()=>{
 assert.equal(cleanPageText('  The  boy\r\n runs.   '),'The boy\n runs.');
});
test('speech alignment advances only along supplied page',()=>{
 const e=getWords('the little boy opened the window');
 assert.deepEqual(alignRecognized(e,0,'the little boy').matched,[0,1,2]);
 assert.equal(alignRecognized(e,0,'the little boy').cursor,3);
 assert.equal(alignRecognized(e,0,'elephant bear').cursor,0);
 assert.equal(alignRecognized(e,0,'little boy').missed,0);
 assert.equal(alignRecognized(e,5,'window and more words').cursor,6);
});
test('near-matches favor mild recognizer variation',()=>{
 assert.equal(roughlySame('beautiful','beautful'),true);
 assert.equal(roughlySame('cat','car'),false);
 assert.equal(roughlySame('the','there'),false);
});
test('recommends beginner stories for younger child and advanced for older',()=>{
 assert.equal(suggestedStories(6,1)[0].level,1);
 assert.equal(suggestedStories(12,7)[0].level,3);
});
test('profile input is bounded and sanitized',()=>{
 const p=safeProfile({name:'<Buddy>',age:1,classGrade:99});
 assert.equal(p.name,'Buddy');assert.equal(p.age,5);assert.equal(p.classGrade,10);
});

test('photo-reading word limit keeps original punctuation and nothing extra',async()=>{
 const {readingLimit}=await import('../engine.mjs');
 assert.equal(readingLimit('One, two! Three. Four?',3),'One, two! Three.');
 assert.equal(wordCount(readingLimit(Array(600).fill('hello').join(' '),450)),450);
});
test('repeat detection filters recycled transcript after recognition restarts',async()=>{
 const {isLikelyRepeat}=await import('../engine.mjs');
 const page=getWords('I see the red ball and a cat');
 assert.equal(isLikelyRepeat(page,4,'see the red'),true);
 assert.equal(isLikelyRepeat(page,4,'ball'),false);
 assert.equal(isLikelyRepeat(page,0,'I'),false);
});
test('reading alignment safely handles a page ending',()=>{
 const e=getWords('The cat sleeps');
 const r=alignRecognized(e,2,'sleeps and then jumped away');
 assert.equal(r.cursor,3);
 assert.deepEqual(r.matched,[2]);
});
test('recognition never advances when it hears unrelated words',()=>{
 const e=getWords('The little boy reads aloud');
 for(const transcript of ['elephant desk','what is your name','please turn left']){
  assert.equal(alignRecognized(e,0,transcript).cursor,0);
 }
});
