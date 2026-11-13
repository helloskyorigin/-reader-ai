# Reader AI 🧸 — personal AI-assisted reading buddy for children

Reader AI is a no-login, no-payment, mobile-first reading app. Built as a private family learning tool.

## What works

- Six original, age/class-sorted stories: available even offline after the app has loaded once and installed its service worker.
- Photo of an English page → on-device image resize → Tesseract.js OCR → editable text review → read aloud. The photo is processed by the browser, not sent to our server. OCR library and English model require internet for their first download, and the result MUST be reviewed for OCR errors.
- Chrome/Edge's Web Speech Recognition: interim word highlights and finalized word tracking against the chosen text only.
- Gentle help on repeated likely mismatches; tap a word to hear it read; skip/next word if recognition is struggling.
- Browser speech synthesis for spoken examples.
- Kid-friendly results and local-only progress history, parent settings. No analytics, accounts or database.
- PWA shell for home and built-in stories on repeat visits; mic listening commonly needs internet.

## Important limits (do not misrepresent)

Browser speech-to-text **is not** a dedicated phoneme-level pronunciation assessment. Recognition can confuse child speech, Indian English accents, background noise, and pronunciation mistakes. Any reported errors are learning hints, not reliable phoneme-level scores.

No compatible SpeechRecognition browser? The app can still display and read out words; its Start Reading button tells the user to try supported Chrome/Edge. Mic permission requires HTTPS or localhost. Photos must have legible printed English text for OCR. Handwriting and tilted/complex pages may fail. The image reader downloads third-party open-source Tesseract.js at pinned version 5.1.1 via a CDN and processes the image locally; on CDN failure, the child can type/paste text.

**Privacy:** no login, database, audio recording storage, analytics or page uploads to a Reader AI server. The browser vendor's speech recognition service MAY transmit speech audio for recognition, so a parent should supervise first use. Progress stays in localStorage on that device; clearing browser data clears it. Avoid entering personal information or photographing private documents.

## Run and test

```bash
python3 -m http.server 8765
# visit http://localhost:8765
npm test
npm run check
```

The app is static; no bundler or keys needed. Deploy the entire folder to Vercel as a static project. Production URL must be HTTPS. The included tests verify reading/text logic, and `tests/browser_audit.py` can run additional Playwright browser simulations locally.
