# Deploy Reader AI to Vercel

1. Unzip the folder and push its source files to a GitHub repository or upload the folder to Vercel's web dashboard.
2. In Vercel, **Add New → Project**, import the repo; set **Framework Preset: Other**, **Build Command: none**, **Output Directory: .** (the root). Deploy.
3. Use the HTTPS URL on Android Chrome or desktop Chrome/Edge. Approve the microphone permission to use speech recognition.
4. Open a story and test speech recognition on the real device. Open **My own book**, choose a clear page photo, wait for OCR, correct any extracted text, and tap **Let's read!**

This app is static and requires no payment processor, API key or authentication. As of the most recent authorized deployment attempt, Vercel's connected account returned `403 forbidden` to project creation, so the project may require access changes in the Vercel dashboard. No unverified live URL should be used as a deployment result.
