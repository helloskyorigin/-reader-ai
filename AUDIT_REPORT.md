# Reader AI — build and QA report

## Release features
- Working responsive application (no login / no payment / no tracking).
- Six original age/class-sorted stories; browser storage for profile and progress.
- Camera/photo selection; resized locally; Tesseract.js English OCR loaded only when needed; editable OCR text; photo comparison view; 450-word limit, on-device image preview.
- SpeechRecognition listening and finalized-text word tracking with conservative handling of repeats and potential misrecognition; pause/resume/retry/next word.
- Read-aloud word hints via speech synthesis, gentle correction and results with practise words.
- Offline-cached app shell and stories via service worker once installed on HTTPS; microphone and first OCR load can need online services.
- Safer async cancellation, microphone denied/absent/network error paths, large-photo and long-page handling, local image URL cleanup.

## Verification completed
- 11/11 deterministic reading-engine tests PASS.
- 9/9 browser-driven simulations PASS (including 320, 390, 768 and 1440 px layout checks).
- Tested flows: story completion, correction prompt, pause/resume, photo-to-OCR-to-edit-to-read (with mocked OCR worker), manual input fallback, age/class settings, long-page guard and mic permission errors.
- JavaScript syntax checks PASS; Python static HTTP server served index and app files over localhost.

## What still requires real-device release verification
1. Actual microphone and live speech accuracy for a child's English on Chrome for Android. Browser SpeechRecognition is general speech-to-text; this is not certified phoneme-level correction. It sometimes needs network access and can produce inaccurate word hypotheses.
2. Actual OCR worker download and recognition on a real, well-lit schoolbook photo. The automated browser flow used a test OCR mock because network access to third-party CDNs was blocked in the testing environment.
3. A real HTTPS Vercel deployment, which has not succeeded because the connected Vercel project-creation API returned 403 Forbidden.
4. Full offline/PWA install on a phone. Built-in stories are cached after first load; speech and initial OCR download are not promised offline.
5. Parent supervision and privacy review of browser-vendor speech processing before child use.

**Status:** deploy-ready, automated tests passed; not certified production/live-tested until the real-device and deployment checks above are completed. No fake OCR/speech results are presented to users in the actual app.
