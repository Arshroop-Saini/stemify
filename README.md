# 🎵 Stemify - AI-Powered Music Stem Separation

Stemify is a modern web application that uses advanced AI technology to separate music tracks into individual components (vocals, drums, bass, guitar, piano). Built with Next.js, Supabase, and powered by HT-Demucs AI models.

## ✨ Features

- **AI-Powered Separation**: Extract vocals, drums, bass, guitar, and piano from any audio track
- **Multiple Quality Levels**: Standard and Pro quality separation options
- **Flexible Pricing**: Free tier, Creator ($9/mo), and Studio ($19/mo) plans
- **Real-time Processing**: Live progress updates during separation
- **Dark/Light Mode**: Beautiful UI with theme switching
- **Secure Storage**: Automatic file cleanup based on subscription tier
- **Payment Integration**: Stripe-powered credit system

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **UI Components**: shadcn/ui, Radix UI
- **Backend**: Supabase (Database, Auth, Storage)
- **AI Processing**: HT-Demucs via Sieve API
- **Payments**: Stripe
- **Deployment**: Vercel

## 🚀 Getting Started

### Prerequisites

Before running Stemify, you need to have the following installed:

### Required Dependencies

1. **Node.js 18+** - [Download from nodejs.org](https://nodejs.org/)
2. **FFmpeg** - Required for accurate audio metadata extraction

#### Installing FFmpeg

**macOS (using Homebrew):**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install ffmpeg
```

**Windows:**
1. Download from [ffmpeg.org](https://ffmpeg.org/download.html)
2. Add ffmpeg to your system PATH
3. Verify installation: `ffmpeg -version`

**Verify Installation:**
```bash
ffprobe -version
```

### Environment Setup

- npm or yarn
- Supabase account
- Stripe account
- Sieve account (free credits available)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd stemify
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment variables**
   ```bash
   cp env.template .env.local
   ```
   Fill in your actual API keys and configuration values.

4. **Run the development server**
```bash
npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
stemify/
├── app/                    # Next.js App Router
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Homepage
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── theme-provider.tsx
│   └── theme-toggle.tsx
├── lib/                   # Utilities and configurations
│   ├── constants.ts      # App constants
│   ├── types.ts          # TypeScript types
│   └── utils.ts          # Utility functions
├── public/               # Static assets
└── env.template          # Environment variables template
```

## 🎨 Design System

- **Colors**: Emerald accent (#22C55E) with dark/light mode support
- **Typography**: Inter (body), Sora (headings), Roboto Mono (code)
- **Components**: Consistent shadcn/ui component library
- **Responsive**: Mobile-first design approach

## 🔧 Environment Variables

See `env.template` for all required environment variables:

- **Supabase**: Database and authentication
- **Sieve**: AI model processing (free credits for development)
- **Stripe**: Payment processing
- **App Configuration**: URLs and settings

## 📊 Pricing Plans

### **Monthly Subscriptions**
- **Free**: 5 min/month, 4 stems (vocals, drums, bass, other), 320kbps MP3, watermark
- **Creator**: $9/month, 60 min/month, 6 stems (+ guitar, piano), WAV + MP3, fine-tuned model option
- **Studio**: $19/month, 200 min/month, 6 stems (+ guitar, piano), WAV + MP3, fine-tuned model option

### **Pay-as-you-go Credits**
- **Small**: 30 minutes for $5
- **Medium**: 120 minutes for $15  
- **Large**: 500 minutes for $40

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support, email support@stemify.com or join our Discord community.
