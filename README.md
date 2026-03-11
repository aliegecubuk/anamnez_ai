# AnamnezAI - Ambient Clinical Scribe

![AnamnezAI](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-blue?style=for-the-badge&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=for-the-badge&logo=tailwind-css)

**AnamnezAI** is an AI-powered ambient scribe application for healthcare professionals. It uses browser-based Speech-to-Text to capture patient-doctor conversations and structures them using OpenAI's GPT models.

## 🎯 Features

### 🦷 Dentistry Mode
- **Structured Schema**: Captures dental consultations with predefined fields
- **Real-time Speech-to-Text**: Uses Web Speech API for Turkish language
- **AI Analysis**: Extracts:
  - Chief Complaint
  - Duration
  - Pain Level
  - Triggers
  - Medical History
  - Medications
  - Allergies
  - Previous Treatments

### 🧠 Psychology/Therapy Mode
- **Question-Answer Extraction**: Identifies therapist questions and patient responses
- **Session Summary**: Auto-generates session overview
- **Structured Output**: Organizes therapy dialogue into readable Q&A format

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- OpenAI API Key ([Get one here](https://platform.openai.com/api-keys))
- Modern browser (Chrome or Edge recommended for best Speech-to-Text support)

### Installation

1. **Clone or navigate to the project directory:**
```bash
cd anamnez_al
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure your OpenAI API Key:**
   - Open `.env.local`
   - Replace `your_openai_api_key_here` with your actual API key:
   ```
   OPENAI_API_KEY=sk-proj-...your-key-here
   ```

4. **Run the development server:**
```bash
npm run dev
```

5. **Open your browser:**
   - Navigate to [http://localhost:3000](http://localhost:3000)
   - Select a mode (Dentistry or Psychology)
   - Click the microphone to start recording
   - Click "Process" to analyze with AI

## 📁 Project Structure

```
anamnez_al/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── analyze/
│   │   │       └── route.ts          # OpenAI API integration
│   │   ├── dentistry/
│   │   │   └── page.tsx              # Dentistry mode page
│   │   ├── psychology/
│   │   │   └── page.tsx              # Psychology mode page
│   │   ├── layout.tsx                # Root layout
│   │   ├── page.tsx                  # Landing page
│   │   └── globals.css               # Global styles
│   └── components/
│       ├── MicrophoneComponent.tsx   # Speech-to-Text handler
│       ├── ResultDisplay.tsx         # Result formatting
│       └── ModeCard.tsx              # Mode selection card
├── .env.local                        # Environment variables
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

## 🛠️ Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **AI**: OpenAI API (GPT-4o)
- **Speech-to-Text**: Web Speech API (browser-native)

## 🎨 Design Features

- **Medical Color Palette**: Trustworthy teal and blue gradients
- **Glassmorphism**: Modern frosted glass effects
- **Responsive**: Mobile-first design
- **Dark Mode**: Automatic dark mode support
- **Animations**: Smooth transitions and micro-interactions

## 🔧 Configuration

### OpenAI Model
The app uses `gpt-4o` by default. To change the model, edit `src/app/api/analyze/route.ts`:

```typescript
const completion = await openai.chat.completions.create({
  model: 'gpt-3.5-turbo', // Change here
  // ...
});
```

### Language Settings
Speech recognition is set to Turkish (`tr-TR`). To change, edit `src/components/MicrophoneComponent.tsx`:

```typescript
recognitionRef.current.lang = 'en-US'; // Change here
```

## 🧪 Testing Without API Key

The app includes mock data for testing. If no API key is configured, it will return sample structured data instead of making real API calls.

## ⚠️ Browser Compatibility

**Speech-to-Text works best in:**
- ✅ Google Chrome
- ✅ Microsoft Edge
- ⚠️ Safari (limited support)
- ❌ Firefox (not supported)

## 📝 Usage Tips

1. **Allow Microphone Access**: Your browser will request microphone permission
2. **Speak Clearly**: Ensure minimal background noise
3. **Wait for Processing**: AI analysis takes 5-10 seconds
4. **Copy Results**: Use the copy button to save structured output

## 🚢 Production Build

```bash
npm run build
npm start
```

## 📄 License

This project is created as a demo application for healthcare documentation.

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

---

Built with ❤️ using Next.js and OpenAI
