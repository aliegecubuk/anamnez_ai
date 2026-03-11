# 🚀 AnamnezAI - Quick Setup Guide

## Step 1: Restart Your PowerShell Terminal
Node.js was just installed, so you need to restart PowerShell to use npm commands.

1. Close this PowerShell window
2. Open a new PowerShell window
3. Navigate back to the project:
   ```bash
   cd c:\Users\EGE\anamnez_al
   ```

## Step 2: Install Dependencies
```bash
npm install
```

This will install:
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Lucide React (icons)
- OpenAI SDK

## Step 3: Add Your OpenAI API Key (Optional but Recommended)

1. Get an API key from: https://platform.openai.com/api-keys
2. Open `.env.local` in the project root
3. Replace `your_openai_api_key_here` with your actual key:
   ```
   OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
   ```

**Note**: If you skip this step, the app will use mock data for testing.

## Step 4: Start the Development Server
```bash
npm run dev
```

You should see:
```
- Local:        http://localhost:3000
- Network:      http://192.168.x.x:3000
```

## Step 5: Open in Browser
1. Open Chrome or Edge (for best Speech-to-Text support)
2. Navigate to: http://localhost:3000
3. Allow microphone access when prompted

## Step 6: Test the Application

### Test Dentistry Mode:
1. Click "Diş Hekimliği" card
2. Click the microphone button
3. Say: "Hastanın sağ üst dişinde üç gündür ağrı var. Soğuk içeceklerde ağrı artıyor. Diyabet hastası."
4. Click "Yapay Zeka ile Analiz Et"
5. View structured results

### Test Psychology Mode:
1. Go back to home page
2. Click "Psikoloji / Terapi" card
3. Click the microphone button
4. Say: "Terapist: Bu hafta nasılsınız? Hasta: İyiyim ama stresli. Terapist: Ne stres yaratıyor? Hasta: İş yoğunluğu arttı."
5. Click "Yapay Zeka ile Analiz Et"
6. View Q&A extraction

## 🎨 What You'll See

- **Landing Page**: Beautiful cards with teal and blue gradients
- **Recording State**: Pulsing red microphone when active
- **Real-time Transcript**: Your speech converted to text
- **AI Results**: Structured data extraction
- **Dark Mode**: Automatic based on system settings

## 🔧 Troubleshooting

### "npm not recognized"
- Restart your terminal after installing Node.js

### "Microphone not working"
- Use Chrome or Edge browser
- Check browser permissions (camera icon in address bar)
- Ensure no other apps are using the microphone

### "API Error"
- Check if OpenAI API key is correct in `.env.local`
- Verify you have API credits on OpenAI platform
- App will work with mock data if no key is set

### "Module not found"
- Run `npm install` again
- Delete `node_modules` folder and `.next` folder, then `npm install`

## 📚 Next Steps

1. Read [README.md](README.md) for full documentation
2. Explore the code in `src/` folder
3. Customize colors in `tailwind.config.ts`
4. Modify AI prompts in `src/app/api/analyze/route.ts`
5. Deploy to Vercel when ready

---

**Need Help?** Check the README.md or the comprehensive walkthrough documentation!

Happy coding! 🎉
