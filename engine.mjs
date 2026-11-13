// Pure, testable reading and text helpers. Browser speech is best-effort recognition,
// not a phoneme-level pronunciation assessment.
export function normalize(word) {
  return String(word ?? '').toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function tokenize(text) {
  return String(text || '').match(/[A-Za-z0-9]+(?:[’'-][A-Za-z0-9]+)*|[^A-Za-z0-9]+/g) || [];
}

export function getWords(text) {
  return tokenize(text).filter(part => normalize(part)).map(part => ({ display: part, norm: normalize(part) }));
}

export function cleanPageText(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/[^\S\n]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function wordCount(text) { return getWords(text).length; }

function editDistance(a, b) {
  if(a===b) return 0;
  let previous=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++) {
    const current=[i];
    for(let j=1;j<=b.length;j++) {
      current[j]=Math.min(previous[j]+1,current[j-1]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));
    }
    previous=current;
  }
  return previous[b.length];
}

export function roughlySame(a, b) {
  const x=normalize(a), y=normalize(b);
  if(x===y && x) return true;
  if(Math.min(x.length,y.length)<5) return false;
  return editDistance(x,y) <= (Math.max(x.length,y.length)>8 ? 2 : 1);
}

// Deliberately conservative: don't declare failure for every browser mishearing.
// Returns the cursor, matched indices, and the first suspected skipped/substituted word.
export function alignRecognized(expected, from, transcript) {
  const spoken=getWords(transcript).map(t=>t.norm).filter(t=>!['um','uh','erm','hmm'].includes(t));
  let cursor=from, missed=null;
  const matched=[];
  let inserted=0;
  for(const word of spoken) {
    if(cursor>=expected.length) break;
    if(roughlySame(word, expected[cursor].norm)) {
      matched.push(cursor++); inserted=0; continue;
    }
    if(cursor+1<expected.length && roughlySame(word, expected[cursor+1].norm)) {
      missed ??= cursor;
      matched.push(cursor+1);
      cursor+=2; inserted=0; continue;
    }
    // Unexpected speech may be a filler or recognizer mistake; never skip the page ahead.
    inserted++;
    if(inserted>1) { missed ??= cursor; break; }
  }
  return {cursor, matched, missed, heard:spoken.length};
}

export const STORIES=[
  {id:'sunny',level:1,emoji:'☀️',tag:'Easy • 1 min',title:'A Sunny Day',color:'peach',text:'The sun is up. I see a red ball. A little cat runs to me. We play in the warm sun. What a happy day!'},
  {id:'milo',level:1,emoji:'🐻',tag:'Easy • 1 min',title:'Milo the Bear',color:'lavender',text:'Milo is a small bear. He has a blue hat. He likes to jump and sing. One day, Milo finds a big yellow flower. He gives it to his mum. She smiles.'},
  {id:'kite',level:2,emoji:'🪁',tag:'Fun • 2 min',title:'The Little Kite',color:'mint',text:'A little blue kite lived in a bright shop. Every day, the kite dreamed of flying above the trees. One windy morning, a girl named Tara took it to the park. The wind lifted the kite into the sky. Tara laughed as it danced with the clouds.'},
  {id:'garden',level:2,emoji:'🌼',tag:'Fun • 2 min',title:'The Secret Garden',color:'peach',text:'Ravi planted a tiny seed in his garden. Each morning, he watered the soil and watched for a change. After seven days, a green leaf appeared. Soon, a beautiful flower opened its petals. A butterfly visited the flower, and Ravi knew his little garden was becoming a home for new friends.'},
  {id:'moon',level:3,emoji:'🚀',tag:'Adventure • 3 min',title:'A Trip to the Moon',color:'lavender',text:'Anaya looked at the silver moon through her bedroom window. She imagined climbing into a spaceship and travelling past the twinkling stars. In her dream, she landed on the dusty moon, where every jump felt like flying. She collected a sparkling rock to remember her journey. When she woke up, Anaya decided to learn everything she could about space.'},
  {id:'library',level:3,emoji:'📚',tag:'Adventure • 3 min',title:'The Mystery Book',color:'mint',text:'At the back of the school library, Kabir noticed an old book covered in golden stars. Inside, he discovered a map with a trail leading to the playground. He followed the clues carefully, counting seven steps from the tallest tree. Beneath a smooth stone, he found a note that read: The greatest treasure is a curious mind. Kabir smiled and returned to the library for another adventure.'}
];

export function suggestedStories(age=8, classGrade=3) {
  const level= age<=7 || classGrade<=2 ? 1 : age<=10 || classGrade<=5 ? 2 : 3;
  return [...STORIES].sort((a,b)=>Math.abs(a.level-level)-Math.abs(b.level-level));
}

export function safeProfile(raw={}) {
  return { name:String(raw.name||'Buddy').replace(/[<>]/g,'').trim().slice(0,22)||'Buddy', age:Math.max(5,Math.min(15,Number(raw.age)||8)), classGrade:Math.max(1,Math.min(10,Number(raw.classGrade)||3)) };
}

// Keep exactly the words on the photographed page; no generated additions.
export function readingLimit(text,maxWords=450){
 const chunks=tokenize(cleanPageText(text));let words=0;const out=[];
 for(const chunk of chunks){if(normalize(chunk)){if(words>=maxWords)break;words++;}out.push(chunk);}
 return out.join('').trim();
}

// Ignore a recognizer repeating a recently completed phrase after restarting.
export function isLikelyRepeat(expected, cursor, transcript){
 if(cursor<=0)return false;
 const spoken=getWords(transcript).map(w=>w.norm);
 if(!spoken.length || spoken.length>10)return false;
 const beginning=Math.max(0,cursor-spoken.length-3);
 const done=expected.slice(beginning,cursor).map(w=>w.norm);
 for(let i=0;i<=done.length-spoken.length;i++){
  if(spoken.every((word,j)=>roughlySame(word,done[i+j])))return true;
 }
 return false;
}
