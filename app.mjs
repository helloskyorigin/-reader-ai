import { normalize, tokenize, getWords, cleanPageText, wordCount, alignRecognized, STORIES, suggestedStories, safeProfile, isLikelyRepeat, readingLimit } from './engine.mjs';

const $=(sel,root=document)=>root.querySelector(sel);
const main=$('#main');
const APP_KEY='buddy-reads-v2';
const LEGACY_APP_KEY='buddy-reads-v1';
const MAX_PAGE_WORDS=450;
const speechClass=window.SpeechRecognition||window.webkitSpeechRecognition;
const ICONS={
 arrow:'<svg viewBox="0 0 24 24"><path d="m5 12 14 0m-6-6 6 6-6 6"/></svg>',
 back:'<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>',
 camera:'<svg viewBox="0 0 24 24"><path d="M4 7h4l2-3h4l2 3h4v12H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
 mic:'<svg viewBox="0 0 24 24"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0m-7 7v4m-4 0h8"/></svg>',
 pause:'<svg viewBox="0 0 24 24"><path d="M8 5v14m8-14v14"/></svg>',
 play:'<svg viewBox="0 0 24 24"><path d="m8 5 11 7-11 7z"/></svg>',
 volume:'<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4V5Zm4 4a5 5 0 0 1 0 6m2-9a9 9 0 0 1 0 12"/></svg>',
 stop:'<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
 check:'<svg viewBox="0 0 24 24"><path d="m5 12 5 5L20 7"/></svg>'
};

function getSaved() {
 try {return JSON.parse(localStorage.getItem(APP_KEY)||localStorage.getItem(LEGACY_APP_KEY)||'{}')||{};}catch{return {};}
}
const saved=getSaved();
const state={
 screen:'home', profile:safeProfile(saved.profile), language:saved.language==='en-US'?'en-US':'en-IN',
 history:Array.isArray(saved.history)?saved.history.slice(-50):[],
 text:'',title:'',source:'',cursor:0,words:[],wrong:new Set(),skipped:new Set(),matched:new Set(),
 strikes:0,lastSuspect:-1,heardPreview:0,recognition:null,shouldListen:false,recognitionOn:false,
 speaking:false,helpWord:null,helpMessage:'',sessionDone:false,ocrBusy:false,ocrText:'',ocrStatus:'',ocrPercent:0,
 toastTimer:null,speechSerial:0,photoUrl:null,ocrTaskId:0,ocrWorker:null,autoResumeTimer:null,restartAttempts:0,recognizedText:[],spokenCount:0
};

function persist() {
 try{localStorage.setItem(APP_KEY,JSON.stringify({profile:state.profile,language:state.language,history:state.history.slice(-50)}));}catch{}
}
function escapeHtml(x){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function toast(msg){const el=$('#toast');clearTimeout(state.toastTimer);el.textContent=msg;el.hidden=false;state.toastTimer=setTimeout(()=>el.hidden=true,3900);}
function render(){main.innerHTML=state.screen==='home'?homeHtml():state.screen==='scan'?scanHtml():state.screen==='reading'?readingHtml():resultsHtml();bindScreen();}
function homeHtml(){
 const name=escapeHtml(state.profile.name);
 const storyCards=suggestedStories(state.profile.age,state.profile.classGrade).slice(0,3)
 .map(story=>`<button type="button" class="story-card card-bg-${story.color}" data-story="${story.id}" aria-label="Read ${story.title}"><span class="story-emoji" aria-hidden="true">${story.emoji}</span><strong>${story.title}</strong><small>${story.tag}</small><span class="go">Read this story →</span></button>`).join('');
 const total=state.history.filter(h=>h.completed).length;
 return `<div class="screen">
  <section class="hero" aria-label="Welcome to Reader AI"><div class="hero-copy"><span class="eyebrow">✦ YOUR HAPPY READING PLACE</span><h1>Hey, ${name}!<br/>Let's <em>read & grow.</em> 🌱</h1><p>Pick a book, read out loud, and I’ll help with tricky words!</p><div class="hero-meta"><span class="tiny-stars" aria-label="three stars">★ ★ ★</span><span class="meta-text">One little page at a time!</span></div></div>
  <div class="mascot-area" aria-hidden="true"><span class="sparkle one">✦</span><span class="sparkle two">✧</span><span class="sparkle three">★</span><div class="mascot"><div class="ear left"></div><div class="ear right"></div><div class="body"></div><div class="face"><div class="eye left"></div><div class="eye right"></div><div class="nose"></div><div class="cheek left"></div><div class="cheek right"></div></div><div class="book"><div class="page left"></div><div class="page right"></div></div><div class="hand left"></div><div class="hand right"></div></div></div></section>
  <section aria-labelledby="choose-title"><div class="section-heading"><div><h2 id="choose-title">What do you want to read? ✨</h2><p>Pick your own little adventure!</p></div></div><div class="choose-grid">
   <button type="button" class="big-choice peach" id="photo-choice"><div><h3>My own book</h3><p>Take a picture. Read your own page!</p><span class="choice-arrow" aria-hidden="true">${ICONS.arrow}</span></div><span class="choice-icon" aria-hidden="true">📸</span></button>
   <button type="button" class="big-choice mint" id="story-choice"><div><h3>Fun stories</h3><p>Pick a story and read it out loud!</p><span class="choice-arrow" aria-hidden="true">${ICONS.arrow}</span></div><span class="choice-icon" aria-hidden="true">📚</span></button>
  </div></section><section id="story-section" aria-labelledby="story-title"><div class="section-heading"><div><h2 id="story-title">Stories just for you 🪄</h2><p>Made for your age and class</p></div><button id="more-stories" class="helper-link" type="button">See all stories</button></div><div class="story-grid" id="story-grid">${storyCards}</div></section>
  <div class="stat-line"><span class="progress-chip">🏅 <strong>${total}</strong> pages & stories finished</span><span class="progress-chip">📘 Class ${state.profile.classGrade} · <button type="button" id="change-profile" class="helper-link">Change</button></span></div></div>`;
}
function scanHtml(){
 return `<div class="screen"><button type="button" class="back-btn" id="back-home">${ICONS.back} Back home</button><div class="center-head"><div class="eyebrow" style="margin-bottom:10px">YOUR BOOK, YOUR ADVENTURE</div><h1>Show me your book! 📸</h1><p>Take one clear photo of an English page. We'll read it together.</p></div><div class="scan-panel"><div class="drop-area" id="drop-area"><div class="drop-emoji" aria-hidden="true">📸</div><strong>Let's find a page to read!</strong><p>Use your camera or choose a photo</p><label class="btn btn-primary btn-small" for="page-file">${ICONS.camera} Choose photo</label><input id="page-file" type="file" accept="image/*" capture="environment" class="sr-only" aria-label="Choose book page photo" /></div>
 <div class="scan-photo" id="scan-photo" hidden><img id="scan-photo-img" alt="Your chosen page photo" /><div class="scan-photo-label">Your photo — check the words below before reading 🌟</div></div>
 <div class="scan-info" id="scan-status" role="status" aria-live="polite">💡 Tip: Good light + a straight photo makes reading easier. You can also type the page below.</div>
 <div class="ocr-progress" id="ocr-progress" hidden><div id="ocr-bar" style="width:0%"></div></div>
 <div class="page-preview"><label for="page-text" class="field-title">✏️ Words from your book <span class="muted" style="font-weight:700">(you can fix any mistakes)</span></label><textarea class="page-editor" id="page-text" placeholder="Your book words will show here after the photo... or type your own English passage!" maxlength="12000" spellcheck="true">${escapeHtml(state.ocrText)}</textarea><div class="editor-meta"><span id="word-count">${wordCount(state.ocrText)} words</span><span>Only this page · max 450 words</span></div></div>
 <div class="actions"><button type="button" class="btn btn-primary" id="start-page" ${wordCount(state.ocrText)<3||wordCount(state.ocrText)>MAX_PAGE_WORDS?'disabled':''}>Let's read! ${ICONS.arrow}</button></div></div></div>`;
}
function readingHtml(){
 const total=state.words.length;
 const pct=total?Math.round(state.cursor*100/total):0;
 const pieces=tokenize(state.text);
 let i=0;
 const rendered=pieces.map(part=>{
  if(!normalize(part))return `<span class="read-space">${escapeHtml(part)}</span>`;
  const idx=i++;
  const type=state.matched.has(idx)?'done':state.skipped.has(idx)||state.wrong.has(idx)&&idx<state.cursor?'missed':idx===state.cursor?'current':'';
  return `<span class="read-word ${type}" data-index="${idx}" ${idx===state.cursor?'id="current-word"':''}>${escapeHtml(part)}</span>`;
 }).join('');
 const canListen=Boolean(speechClass);
 return `<div class="screen"><button type="button" class="back-btn" id="back-from-reading">${ICONS.back} Back home</button><div class="reading-panel"><div class="reader-header"><div><h2 class="reader-title">${escapeHtml(state.title)} 📖</h2><p class="reader-sub"><span id="progress-label">${state.cursor}</span> / ${total} words</p></div><div class="reader-status pause" id="reader-status"><span class="dot"></span><span id="reader-status-label">Ready to read</span></div></div>
 <div class="progress-track" role="progressbar" aria-label="Reading progress" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${state.cursor}" id="progress-track"><div class="progress-fill" id="progress-fill" style="width:${pct}%"></div></div>
 <div class="reading-text" id="reading-text" aria-label="Reading text">${rendered}</div>
 <div class="hint-bar" id="hint-bar" role="status" aria-live="polite"><span class="hint-icon" aria-hidden="true">💜</span><div><strong id="hint-title">${canListen?'Ready, superstar?':'We need a listening browser'}</strong><p id="hint-text">${canListen?'Tap Start Reading, then read the purple word aloud.':'Open this page in Chrome or Edge with a microphone.'}</p></div><div class="hint-actions" id="hint-actions"></div></div>
 <div class="reader-controls"><button class="btn btn-primary" id="listen-toggle" ${!canListen?'disabled':''}>${ICONS.mic} <span id="listen-label">Start Reading</span></button><button class="btn btn-soft" id="hear-word">${ICONS.volume} Hear word</button><button class="btn btn-white" id="skip-word">Next word →</button></div>
 <p class="small-note" style="text-align:center;margin-top:18px">Read in your own voice. This app does not save your audio. If you are not heard correctly, try again or use Next word. Listening needs browser support and internet.</p>
 </div></div>`;
}
function resultsHtml(){
 const total=state.words.length;
 const practiced=[...new Set(Array.from(state.wrong).map(i=>state.words[i]?.display).filter(Boolean))].slice(0,12);
 const done=state.cursor;
 return `<div class="screen results"><button type="button" class="back-btn" id="back-results">${ICONS.back} Back home</button><div class="result-panel"><div class="result-emoji" aria-hidden="true">${state.sessionDone?'🏆':'🌟'}</div><h1>${state.sessionDone?'You did it!':'Great reading!'}</h1><p>Every word you try makes you a stronger reader. Keep shining! ✨</p><div class="result-stars" aria-label="Good job">⭐ ⭐ ⭐</div><div class="result-stats"><div class="result-stat"><strong>${done} / ${total}</strong><small>Words completed</small></div><div class="result-stat"><strong>${state.matched.size}</strong><small>Words heard</small></div></div>
 ${practiced.length?`<div class="practice"><h3>Let's practise these words 🔊</h3><div class="practice-words">${practiced.map(w=>`<button class="practice-word" type="button" data-say="${escapeHtml(w)}">${escapeHtml(w)} 🔊</button>`).join('')}</div></div>`:''}
 <div class="result-actions"><button class="btn btn-primary" id="read-again">Read again ${ICONS.arrow}</button><button class="btn btn-soft" id="finish-home">Back home 🏡</button></div></div></div>`;
}
function bindScreen(){
 if(state.screen==='home'){
  $('#photo-choice').addEventListener('click',openScan);
  $('#story-choice').addEventListener('click',()=>$('#story-section').scrollIntoView({behavior:'smooth'}));
  $('#more-stories').addEventListener('click',showAllStories);
  $('#change-profile').addEventListener('click',openSettings);
  bindStoryCards();
 } else if(state.screen==='scan'){
  $('#back-home').addEventListener('click',goHome);
  const input=$('#page-file');
  input.addEventListener('change',e=>{if(e.target.files?.[0])processImage(e.target.files[0]);});
  const drop=$('#drop-area');
  drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('is-over');});
  drop.addEventListener('dragleave',()=>drop.classList.remove('is-over'));
  drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('is-over');const file=Array.from(e.dataTransfer?.files||[]).find(f=>f.type.startsWith('image/'));if(file)processImage(file);else toast('Please choose a photo.');});
  $('#page-text').addEventListener('input',e=>{state.ocrText=e.target.value;const count=wordCount(e.target.value);$('#word-count').textContent=`${count} words`;$('#word-count').classList.toggle('too-long',count>MAX_PAGE_WORDS);$('#start-page').disabled=count<3||count>MAX_PAGE_WORDS||state.ocrBusy;});
  $('#start-page').addEventListener('click',()=>{
   const cleaned=cleanPageText($('#page-text').value);
   if(wordCount(cleaned)<3){toast('Add at least three English words first.');return;}
   if(wordCount(cleaned)>MAX_PAGE_WORDS){toast('This is a long page. Choose just a short part (up to 450 words).');return;}
   startSession(cleaned,'My book page','photo');
  });
 } else if(state.screen==='reading'){
  $('#back-from-reading').addEventListener('click',()=>{stopSession();goHome();});
  $('#listen-toggle').addEventListener('click',toggleListen);
  $('#hear-word').addEventListener('click',()=>playWord(state.cursor));
  $('#skip-word').addEventListener('click',skipWord);
  $('#reading-text').addEventListener('click',e=>{const word=e.target.closest('.read-word');if(word)playWord(Number(word.dataset.index));});
  updateReaderUI();
 } else {
  $('#back-results').addEventListener('click',goHome);
  $('#finish-home').addEventListener('click',goHome);
  $('#read-again').addEventListener('click',()=>startSession(state.text,state.title,state.source));
  main.querySelectorAll('[data-say]').forEach(btn=>btn.addEventListener('click',()=>say(btn.dataset.say)));
 }
}
function bindStoryCards(){main.querySelectorAll('[data-story]').forEach(btn=>btn.addEventListener('click',()=>{const s=STORIES.find(s=>s.id===btn.dataset.story);if(s)startSession(s.text,s.title,s.id);}));}
function showAllStories(){const grid=$('#story-grid');grid.innerHTML=suggestedStories(state.profile.age,state.profile.classGrade).map(s=>`<button type="button" class="story-card card-bg-${s.color}" data-story="${s.id}"><span class="story-emoji">${s.emoji}</span><strong>${s.title}</strong><small>${s.tag}</small><span class="go">Read this story →</span></button>`).join('');$('#more-stories').hidden=true;bindStoryCards();}
function openScan(){stopSession();cancelOCR();state.ocrText='';state.screen='scan';render();window.scrollTo(0,0);}
function goHome(){stopSession();cancelOCR();cleanupPhoto();state.screen='home';render();window.scrollTo(0,0);}
function startSession(text,title,source){
 stopSession();cancelOCR();cleanupPhoto();state.text=cleanPageText(text);state.title=title;state.source=source;state.words=getWords(state.text);state.cursor=0;state.matched=new Set();state.wrong=new Set();state.skipped=new Set();state.strikes=0;state.lastSuspect=-1;state.helpWord=null;state.helpMessage='';state.sessionDone=false;state.recognizedText=[];state.spokenCount=0;state.restartAttempts=0;state.screen='reading';render();window.scrollTo(0,0);
}
function stopSession(){
 state.shouldListen=false;state.speaking=false;state.speechSerial++;clearTimeout(state.autoResumeTimer);
 if(state.recognition){const r=state.recognition;state.recognition=null;r.onend=null;r.onerror=null;r.onresult=null;try{r.abort();}catch{}}
 state.recognitionOn=false;
 if('speechSynthesis' in window)try{speechSynthesis.cancel();}catch{}
}
function updateReaderUI(){
 if(state.screen!=='reading')return;
 $('#progress-label').textContent=state.cursor;
 $('#progress-track').setAttribute('aria-valuenow',state.cursor);
 $('#progress-fill').style.width=(state.words.length?(state.cursor*100/state.words.length):0)+'%';
 main.querySelectorAll('.read-word').forEach(el=>{
  const i=Number(el.dataset.index);el.classList.toggle('done',state.matched.has(i));el.classList.toggle('missed',state.skipped.has(i)||state.wrong.has(i)&&i<state.cursor);el.classList.toggle('current',i===state.cursor);el.classList.remove('preview');
 });
 const status=$('#reader-status'),label=$('#reader-status-label'),btn=$('#listen-toggle'),btnText=$('#listen-label');
 const listening=state.shouldListen&&state.recognitionOn&&!state.speaking;
 status.className='reader-status '+(state.speaking?'help':listening?'':'pause');
 label.textContent=state.speaking?'Helping you...':listening?'Listening...':state.shouldListen?'Getting ready...':'Ready to read';
 btn.innerHTML=(state.shouldListen?ICONS.pause:ICONS.mic)+` <span id="listen-label">${state.shouldListen?'Pause':'Start Reading'}</span>`;
 const hintTitle=$('#hint-title'),hintText=$('#hint-text'),hintActions=$('#hint-actions');
 if(state.helpWord){hintTitle.textContent='Good try! Try this word 💜';hintText.textContent=state.helpWord;hintActions.innerHTML=`<button class="btn btn-white" id="repeat-help">${ICONS.volume} Listen</button>`;$('#repeat-help').addEventListener('click',()=>playWord(state.cursor));}
 else if(state.helpMessage){hintTitle.textContent='You are doing great!';hintText.textContent=state.helpMessage;hintActions.innerHTML='';}
 else if(listening){hintTitle.textContent='I am listening! 👂';hintText.textContent='Read the highlighted word and keep going.';hintActions.innerHTML='<div class="mic-visual" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>';}
 else {hintTitle.textContent='Ready, superstar? 🌟';hintText.textContent='Tap Start Reading, then read the purple word aloud.';hintActions.innerHTML='';}
 const current=$('.read-word.current');if(current){const parent=$('#reading-text');if(current.offsetTop-parent.offsetTop>parent.scrollTop+parent.clientHeight-120||current.offsetTop-parent.offsetTop<parent.scrollTop+20){current.scrollIntoView({block:'center',behavior:'smooth'});}}
}
function toggleListen(){if(state.shouldListen){state.shouldListen=false;stopRecognitionOnly();state.helpMessage='Take your time. Tap Start Reading when you are ready.';updateReaderUI();}else{state.helpWord=null;state.helpMessage='';state.shouldListen=true;startRecognition();updateReaderUI();}}
function stopRecognitionOnly(){const rec=state.recognition;state.recognition=null;state.recognitionOn=false;if(rec){rec.onend=null;rec.onerror=null;rec.onresult=null;try{rec.abort();}catch{}}}
function startRecognition(){
 if(state.screen!=='reading'||!state.shouldListen||state.speaking||state.sessionDone||state.recognition)return;
 if(!speechClass){state.shouldListen=false;state.helpMessage='Try Chrome or Edge with microphone support.';updateReaderUI();return;}
 let rec;try{rec=new speechClass();}catch{state.shouldListen=false;toast('This browser cannot start the microphone.');return;}
 rec.lang=state.language;rec.continuous=true;rec.interimResults=true;rec.maxAlternatives=1;
 state.recognition=rec;let seenFinal=new Set();
 rec.onstart=()=>{if(state.recognition===rec){state.recognitionOn=true;updateReaderUI();}};
 rec.onresult=e=>{
  if(state.recognition!==rec||!state.shouldListen)return;
  let interim='';
  for(let i=0;i<e.results.length;i++){
    const r=e.results[i],transcript=r?.[0]?.transcript||'';
    if(r.isFinal){if(!seenFinal.has(i)){seenFinal.add(i);consumeSpeech(transcript,r[0].confidence);if(state.recognition!==rec)return;}}
    else interim+=' '+transcript;
  }
  paintPreview(interim);
 };
 rec.onerror=e=>{
  if(state.recognition!==rec)return;
  const error=e.error||'unknown';
  if(error==='aborted')return;
  if(error==='no-speech'){state.helpMessage='I am here! Read the purple word when you are ready.';updateReaderUI();return;}
  if(error==='not-allowed'||error==='service-not-allowed'){state.shouldListen=false;state.helpMessage='Microphone permission is off. Allow mic access in your browser and try again.';toast('Microphone is blocked. Please allow access.');}
  else if(error==='audio-capture'){state.shouldListen=false;state.helpMessage='I cannot find a microphone on this device.';}
  else if(error==='network'){state.shouldListen=false;state.helpMessage='The speech service needs internet. Please check your connection.';}
  else {state.shouldListen=false;state.helpMessage='Listening stopped. Tap Start Reading to try again.';}
  updateReaderUI();
 };
 rec.onend=()=>{
  if(state.recognition!==rec)return;
  state.recognition=null;state.recognitionOn=false;
  if(state.shouldListen&&!state.speaking&&!state.sessionDone){
    state.restartAttempts++;
    if(state.restartAttempts>8){state.shouldListen=false;state.helpMessage='Listening has stopped several times. Please restart or try Chrome.';}
    else {clearTimeout(state.autoResumeTimer);state.autoResumeTimer=setTimeout(()=>{if(state.shouldListen&&!state.recognition)startRecognition();},Math.min(1300,300+state.restartAttempts*120));}
   }
  updateReaderUI();
 };
 try{rec.start();}catch{state.recognition=null;state.recognitionOn=false;state.shouldListen=false;state.helpMessage='Could not start listening. Please try again.';updateReaderUI();}
}
function paintPreview(transcript){
 if(state.screen!=='reading')return;
 main.querySelectorAll('.read-word.preview').forEach(e=>e.classList.remove('preview'));
 const a=alignRecognized(state.words,state.cursor,transcript);
 for(const idx of a.matched){const el=main.querySelector(`.read-word[data-index="${idx}"]`);if(el)el.classList.add('preview');}
}
function consumeSpeech(transcript,confidence){
 if(state.screen!=='reading'||state.sessionDone||!transcript.trim())return;
 const a=alignRecognized(state.words,state.cursor,transcript);
 state.restartAttempts=0;
 const before=state.cursor;
 if(a.missed!==null){
  // Do not flag an accent or recognizer substitution as a definite error on one pass.
  const suspect=a.missed;
  if(state.lastSuspect===suspect)state.strikes++;else {state.lastSuspect=suspect;state.strikes=1;}
  state.helpWord=null;
  if(state.strikes>=2){correctWord(suspect);return;}
  state.helpMessage=`Let's try ${state.words[suspect].display} once more!`;
  updateReaderUI();return;
 }
 if(a.matched.length){for(const i of a.matched)state.matched.add(i);state.cursor=a.cursor;state.strikes=0;state.lastSuspect=-1;state.helpWord=null;state.helpMessage='';
  if(state.cursor>=state.words.length){finishSession();return;}
  updateReaderUI();return;
 }
 if(a.heard){
  if(isLikelyRepeat(state.words, state.cursor, transcript))return;
  // Low-confidence hypotheses are unreliable; prompt gently without calling them wrong.
  if(typeof confidence==='number' && confidence>0 && confidence<.62){state.helpMessage="I didn't quite catch that. Can you say the purple word again?";updateReaderUI();return;}
  state.strikes=state.lastSuspect===before?state.strikes+1:1;state.lastSuspect=before;
  if(state.strikes>=2){correctWord(before);return;}
  state.helpMessage='I heard something else. Can you read the purple word again?';updateReaderUI();
 }
}
function correctWord(index){
 if(index>=state.words.length)return;
 state.wrong.add(index);state.helpWord=state.words[index].display;state.strikes=0;state.lastSuspect=-1;
 state.shouldListen=false;stopRecognitionOnly();updateReaderUI();
 playWord(index,true);
}
function playWord(index,resume=false){
 const w=state.words[index];if(!w)return;
 const wasListening=state.shouldListen||resume;
 state.shouldListen=false;stopRecognitionOnly();
 say(w.display,()=>{
  if(state.screen!=='reading'||state.sessionDone)return;
  if(wasListening){state.shouldListen=true;startRecognition();}
  updateReaderUI();
 });
 updateReaderUI();
}
function say(text,onDone){
 if(!('speechSynthesis' in window)){toast('Audio playback is not available here.');onDone?.();return;}
 const id=++state.speechSerial;
 try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang=state.language;u.rate=.78;u.pitch=1.08;u.volume=1;
  state.speaking=true;let done=false;const finish=()=>{if(done||state.speechSerial!==id)return;done=true;state.speaking=false;onDone?.();};
  u.onend=finish;u.onerror=finish;speechSynthesis.speak(u);
  // Some browsers never dispatch onend; don't strand the reading controls.
  setTimeout(finish,Math.max(3000,Math.min(12000,text.length*210)));
 }catch{state.speaking=false;toast('I could not play that word.');onDone?.();}
}
function skipWord(){
 if(state.cursor>=state.words.length)return;
 state.skipped.add(state.cursor);state.wrong.add(state.cursor);state.cursor++;
 // Flush pending recognition so audio from the previous word cannot score the next.
 if(state.shouldListen){stopRecognitionOnly();clearTimeout(state.autoResumeTimer);state.autoResumeTimer=setTimeout(()=>{if(state.shouldListen&&!state.recognition)startRecognition();},260);}
 state.helpWord=null;state.helpMessage='No problem! Let\'s read the next word.';state.strikes=0;
 if(state.cursor>=state.words.length){finishSession();return;}
 updateReaderUI();
}
function finishSession(){
 if(state.sessionDone)return;
 state.sessionDone=true;const completed=state.cursor>=state.words.length;
 stopSession();state.history.push({at:new Date().toISOString(),source:state.source,title:state.title,completed,words:state.cursor,heard:state.matched.size,practice:state.wrong.size});persist();
 state.screen='results';render();window.scrollTo(0,0);
}
function openSettings(){
 if($('#profile-modal'))return;
 const p=state.profile;
 const ages=[5,6,7,8,9,10,11,12,13,14,15].map(n=>`<button class="pick" type="button" data-age="${n}" aria-pressed="${p.age===n}">${n}</button>`).join('');
 const modal=document.createElement('div');modal.className='modal-backdrop';modal.id='profile-modal';
 modal.innerHTML=`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="settings-heading"><div class="modal-top"><h2 id="settings-heading">My little reader 🌟</h2><button class="modal-close" id="close-settings" type="button" aria-label="Close settings">✕</button></div><p>Grown-up setup. Just choose the basics — no account needed!</p><div class="field"><label for="reader-name">What's your name?</label><input id="reader-name" type="text" maxlength="22" placeholder="Buddy" value="${escapeHtml(p.name)}" autocomplete="off" /></div><div class="field"><label>How old are you?</label><div class="age-group">${ages}</div></div><div class="field"><label for="reader-class">Your school class</label><select id="reader-class">${Array.from({length:10},(_,i)=>`<option value="${i+1}" ${p.classGrade===i+1?'selected':''}>Class ${i+1}</option>`).join('')}</select></div><div class="field"><label for="speech-accent">Listening language</label><select id="speech-accent"><option value="en-IN" ${state.language==='en-IN'?'selected':''}>English (India)</option><option value="en-US" ${state.language==='en-US'?'selected':''}>English (United States)</option></select></div><div class="settings-note">🔒 No login. Your profile and reading counts stay in this browser. Speech recognition may use your browser provider's online service.</div><div class="modal-actions"><button type="button" class="btn btn-white" id="clear-history">Clear progress</button><button type="button" class="btn btn-primary" id="save-settings">Save ✓</button></div></div>`;
 document.body.appendChild(modal);
 const prevFocus=document.activeElement;
 const close=()=>{modal.remove();prevFocus?.focus?.();};
 $('#close-settings').addEventListener('click',close);
 modal.addEventListener('click',e=>{if(e.target===modal)close();});
 modal.addEventListener('keydown',e=>{if(e.key==='Escape')close();if(e.key==='Tab'){const focusables=[...modal.querySelectorAll('button,input,select')].filter(el=>!el.disabled);if(e.shiftKey&&document.activeElement===focusables[0]){e.preventDefault();focusables.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===focusables.at(-1)){e.preventDefault();focusables[0].focus();}}});
 modal.querySelectorAll('[data-age]').forEach(b=>b.addEventListener('click',()=>{modal.querySelectorAll('[data-age]').forEach(n=>n.setAttribute('aria-pressed','false'));b.setAttribute('aria-pressed','true');}));
 $('#save-settings').addEventListener('click',()=>{
  const picked=modal.querySelector('[data-age][aria-pressed="true"]');state.profile=safeProfile({name:$('#reader-name').value,age:Number(picked?.dataset.age)||8,classGrade:Number($('#reader-class').value)});state.language=$('#speech-accent').value;persist();close();if(state.screen==='home')render();toast('All set! Happy reading! 🌟');
 });
 $('#clear-history').addEventListener('click',()=>{if(window.confirm('Clear saved reading progress on this device?')){state.history=[];persist();close();if(state.screen==='home')render();toast('Reading history cleared.');}});
 $('#reader-name').focus();
}
function cancelOCR(){state.ocrTaskId++;state.ocrBusy=false;const worker=state.ocrWorker;state.ocrWorker=null;if(worker)Promise.resolve(worker.terminate()).catch(()=>{});}
function cleanupPhoto(){if(state.photoUrl){URL.revokeObjectURL(state.photoUrl);state.photoUrl=null;}}
function showPhoto(file){cleanupPhoto();state.photoUrl=URL.createObjectURL(file);const img=$('#scan-photo-img');if(img){img.src=state.photoUrl;$('#scan-photo').hidden=false;}}
function loadTesseract(){
 if(window.Tesseract)return Promise.resolve(window.Tesseract);
 if(window.__tesseractPromise)return window.__tesseractPromise;
 const loadScript=url=>new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src=url;script.async=true;script.crossOrigin='anonymous';
  const timer=setTimeout(()=>{script.remove();reject(new Error('Photo reader download timed out.'));},16000);
  script.onload=()=>{clearTimeout(timer);window.Tesseract?resolve(window.Tesseract):reject(new Error('Photo reader could not start.'));};
  script.onerror=()=>{clearTimeout(timer);script.remove();reject(new Error('Photo reader could not load.'));};
  document.head.appendChild(script);
 });
 window.__tesseractPromise=loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js')
  .catch(()=>loadScript('https://unpkg.com/tesseract.js@5.1.1/dist/tesseract.min.js'))
  .catch(()=>{window.__tesseractPromise=null;throw new Error('Photo reader needs internet the first time. Please try again later, or type the page below.');});
 return window.__tesseractPromise;
}
function setScanStatus(message,percentage=null){if(state.screen!=='scan')return;$('#scan-status').textContent=message;const el=$('#ocr-progress');el.hidden=percentage===null;if(percentage!==null)$('#ocr-bar').style.width=Math.round(percentage)+'%';}
function scaledImage(file){
 return new Promise((resolve,reject)=>{
  const img=new Image();const url=URL.createObjectURL(file);
  img.onload=()=>{try{const max=2000;const ratio=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));const can=document.createElement('canvas');can.width=Math.max(1,Math.round(img.naturalWidth*ratio));can.height=Math.max(1,Math.round(img.naturalHeight*ratio));const cx=can.getContext('2d');cx.drawImage(img,0,0,can.width,can.height);can.toBlob(blob=>{URL.revokeObjectURL(url);blob?resolve(blob):reject(new Error('Could not prepare your photo.'));},'image/jpeg',.88);}catch(err){URL.revokeObjectURL(url);reject(err);}};
  img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('This photo format could not be opened. Try JPEG or PNG.'));};img.src=url;
 });
}
async function processImage(file){
 if(state.ocrBusy)return;
 if(!file.type.startsWith('image/')){toast('Please choose a photo, not a document.');return;}
 if(file.size>20*1024*1024){toast('Please choose a photo smaller than 20 MB.');return;}
 showPhoto(file);
 const taskId=++state.ocrTaskId;
 state.ocrBusy=true;$('#start-page').disabled=true;$('#page-file').disabled=true;setScanStatus('📸 Preparing your picture...',5);
 let worker=null;
 try{
  const [Tesseract,image]=await Promise.all([loadTesseract(),scaledImage(file)]);
  if(state.screen!=='scan'||taskId!==state.ocrTaskId)return;
  setScanStatus('📖 Finding the English words. This may take a little while...',12);
  worker=await Tesseract.createWorker('eng',1,{logger: m=>{
   if(taskId===state.ocrTaskId && m.status==='recognizing text')setScanStatus('✨ Finding the words on your page...',15+Math.round(m.progress*83));
  }});
  if(taskId!==state.ocrTaskId)return;
  state.ocrWorker=worker;
  const result=await worker.recognize(image);
  if(state.screen!=='scan'||taskId!==state.ocrTaskId)return;
  const text=cleanPageText(result?.data?.text||'');
  if(wordCount(text)<3)throw new Error("I couldn't read enough words. Try a brighter, straighter photo, or type the words below.");
  state.ocrText=readingLimit(text,MAX_PAGE_WORDS);$('#page-text').value=state.ocrText;$('#word-count').textContent=`${wordCount(state.ocrText)} words`;
  setScanStatus(wordCount(text)>MAX_PAGE_WORDS?'🌟 I found a long page! I kept the first 450 words. Check them, then tap Let’s read!':'🎉 Yay! I found the words. Check them, then tap Let’s read!');
  $('#page-text').focus();
 }catch(err){if(taskId===state.ocrTaskId)setScanStatus('💜 '+(err?.message||'Photo reading did not work. You can type the passage below.'));}
 finally{try{await worker?.terminate();}catch{}if(taskId===state.ocrTaskId){state.ocrWorker=null;state.ocrBusy=false;}if(taskId===state.ocrTaskId&&state.screen==='scan'){$('#page-file').disabled=false;$('#start-page').disabled=wordCount($('#page-text').value)<3||wordCount($('#page-text').value)>MAX_PAGE_WORDS;}}
}
$('#brand-home').addEventListener('click',goHome);
$('#settings-btn').addEventListener('click',openSettings);
render();

if('serviceWorker' in navigator && location.protocol==='https:'){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}
