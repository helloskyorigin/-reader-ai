"""Browser UI regression tests, including simulated speech events and OCR.
Run: python tests/browser_audit.py
The test substitutes recognition/OCR services; it does not certify microphone accuracy.
"""
from playwright.sync_api import sync_playwright
from pathlib import Path
import re
import base64, json

ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'index.html').read_text()
CSS=(ROOT/'styles.css').read_text()
ENGINE=(ROOT/'engine.mjs').read_text().replace('export function ','function ').replace('export const ','const ')
APP=re.sub(r'^import .*?;\s*', '', (ROOT/'app.mjs').read_text(),count=1)
EMBED=ENGINE+'\n'+APP

PNG=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+B4RwAAAAASUVORK5CYII=')
MOCK='''
window.__recs=[];
class FakeRecognition {
 constructor(){this.results=[];this.continuous=false;this.interimResults=false;this.lang='en-IN';window.__recs.push(this)}
 start(){this.onstart?.({});}
 abort(){this.onend?.({});}
 send(t,confidence=.95){const r={0:{transcript:t,confidence:confidence},isFinal:true,length:1};this.results.push(r);this.onresult?.({results:this.results,resultIndex:this.results.length-1});}
 error(t){this.onerror?.({error:t});}
}
Object.defineProperty(window,'SpeechRecognition',{configurable:true,writable:true,value:FakeRecognition});
Object.defineProperty(window,'webkitSpeechRecognition',{configurable:true,writable:true,value:FakeRecognition});
window.__spoken=[];
window.SpeechSynthesisUtterance=class {constructor(t){this.text=t;}};
Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{cancel(){},speak(u){window.__spoken.push(u.text);setTimeout(()=>u.onend?.(),8)}}});
window.__send=(t,c)=>window.__recs.at(-1).send(t,c);
window.__error=(t)=>window.__recs.at(-1).error(t);
'''

def fresh(browser, width=390, height=844, mock=True):
 ctx=browser.new_context(viewport={'width':width,'height':height}, device_scale_factor=1)
 
 page=ctx.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(re.sub(r'<link rel="stylesheet"[^>]*>', '', re.sub(r'<script type="module"[^>]*></script>', '', HTML)))
 page.add_style_tag(content=CSS)
 if mock:page.add_script_tag(content=MOCK)
 page.add_script_tag(content=EMBED)
 return ctx,page,errors

def check(name,action):
 try:action();print('PASS',name)
 except Exception as e:print('FAIL',name,str(e)[:800]);raise

with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 def test_responsive():
  for w,h in [(320,720),(390,844),(768,1024),(1440,900)]:
   ctx,page,errors=fresh(b,w,h)
   page.get_by_role('button',name='My own book').wait_for()
   assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth+1'), f'horizontal overflow at {w}'
   page.wait_for_timeout(520)
   page.screenshot(path=f'/mnt/data/my-reading-buddy/audit-v2-{w}.png',full_page=True)
   assert not errors,errors
   ctx.close()
 check('Responsive home 320/390/768/1440',test_responsive)

 def test_story_end_to_end():
  ctx,page,errors=fresh(b)
  page.locator('[data-story="sunny"]').click()
  page.locator('#listen-toggle').click()
  assert page.locator('#reader-status-label').inner_text()=='Listening...'
  for phrase in ['The sun is up','I see a red ball','A little cat runs to me','We play in the warm sun','What a happy day']:
   page.evaluate('(s)=>window.__send(s)',phrase)
  page.locator('#read-again').wait_for(timeout=5000)
  assert 'You did it!' in page.locator('h1').last.inner_text()
  assert '25 / 25' in page.locator('.result-stat').first.inner_text(),page.locator('.result-stat').first.inner_text()
  assert not errors,errors
  page.locator('#finish-home').click()
  assert page.locator('.stat-line').inner_text().find('1 pages')>=0
  ctx.close()
 check('Story mic events → word tracking → results → saved progress',test_story_end_to_end)

 def test_correction_pause_next():
  ctx,page,errors=fresh(b)
  page.locator('[data-story="sunny"]').click();page.locator('#listen-toggle').click()
  page.evaluate('window.__send("elephant")');assert 'purple word again' in page.locator('#hint-text').inner_text()
  page.evaluate('window.__send("elephant")');page.wait_for_timeout(90)
  assert 'the' in ' '.join(page.evaluate('window.__spoken')).lower(),page.evaluate('window.__spoken')
  assert 'Good try' in page.locator('#hint-title').inner_text()
  page.locator('#skip-word').click()
  assert page.locator('#progress-label').inner_text()=='1'
  assert page.locator('#listen-label').inner_text()=='Pause'
  page.locator('#listen-toggle').click()
  assert page.locator('#listen-label').inner_text()=='Start Reading'
  page.locator('#listen-toggle').click()
  assert page.locator('#listen-label').inner_text()=='Pause'
  assert not errors,errors
  ctx.close()
 check('Repeated mismatch, gentle spoken correction, skip, pause/resume',test_correction_pause_next)

 def test_photo_and_edit():
  ctx,page,errors=fresh(b)
  page.evaluate('''window.Tesseract={createWorker:async()=>({recognize:async()=>({data:{text:'The little dog runs to the green tree.'}}),terminate:async()=>{}})}''')
  page.locator('#photo-choice').click()
  page.locator('#page-file').set_input_files({'name':'book.png','mimeType':'image/png','buffer':PNG})
  page.locator('#page-text').wait_for()
  page.wait_for_function("document.querySelector('#page-text').value.includes('little dog')",timeout=8000)
  assert page.locator('#scan-photo').is_visible()
  assert 'The little dog' in page.locator('#page-text').input_value()
  page.locator('#page-text').fill('The blue bird can sing!')
  page.locator('#start-page').click()
  assert page.locator('.reader-title').inner_text().startswith('My book page')
  assert page.locator('.read-word').count()==5
  assert not errors,errors
  ctx.close()
 check('Photo upload → browser OCR → editable text → exact page tracking',test_photo_and_edit)

 def test_profile():
  ctx,page,errors=fresh(b)
  page.locator('#settings-btn').click()
  page.locator('#reader-name').fill('Aanya')
  page.locator('[data-age="6"]').click()
  page.locator('#reader-class').select_option('1')
  page.locator('#save-settings').click()
  assert 'Aanya' in page.locator('.hero h1').inner_text()
  assert 'Class 1' in page.locator('.stat-line').inner_text()
  assert not errors,errors
  ctx.close()
 check('No-login personalization changes home and class',test_profile)

 def test_long_page():
  ctx,page,errors=fresh(b)
  page.locator('#photo-choice').click()
  page.locator('#page-text').fill('word '*451)
  assert page.locator('#start-page').is_disabled()
  page.locator('#page-text').fill('word '*100)
  assert page.locator('#start-page').is_enabled()
  assert not errors,errors
  ctx.close()
 check('Long pages safely blocked, valid pages enabled',test_long_page)

 def test_mic_error():
  ctx,page,errors=fresh(b)
  page.locator('[data-story="sunny"]').click();page.locator('#listen-toggle').click()
  page.evaluate('window.__error("not-allowed")')
  assert 'Microphone permission is off' in page.locator('#hint-text').inner_text()
  assert page.locator('#listen-label').inner_text()=='Start Reading'
  assert not errors,errors
  ctx.close()
 check('Microphone permission denied → clear recoverable state',test_mic_error)

 def test_photo_without_ocr():
  ctx,page,errors=fresh(b)
  page.locator('#photo-choice').click()
  page.locator('#page-text').fill('The dog is happy.')
  page.locator('#start-page').click()
  assert page.locator('.read-word').count()==4
  ctx.close()
 check('Manual book text works without OCR CDN',test_photo_without_ocr)

 def test_no_overflow_reading():
  ctx,page,errors=fresh(b,320,700)
  page.locator('[data-story="garden"]').click()
  assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth+1')
  page.wait_for_timeout(520)
  page.screenshot(path='/mnt/data/my-reading-buddy/audit-v2-reading.png',full_page=True)
  ctx.close()
 check('320px reading view fits without horizontal overflow',test_no_overflow_reading)
 b.close()
