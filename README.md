# YT2MP3 Converter

A modern, minimalistic YouTube to MP3 converter web application built with Node.js and Express.

## Features

- 🚀 Fast YouTube to MP3 conversion
- 🎵 High-quality 128kbps MP3 output
- 📱 Mobile-friendly responsive design
- 🔒 Safe and secure (no data stored)
- ✨ Modern, minimalistic UI

## Prerequisites

Before running this application, you need to have the following installed:

1. **Node.js** (v14 or higher)
2. **FFmpeg** - Required for audio conversion

### Installing FFmpeg

#### Windows:
1. Download FFmpeg from https://ffmpeg.org/download.html
2. Extract the files to a folder (e.g., `C:\ffmpeg`)
3. Add the `bin` folder to your system PATH
4. Or use Chocolatey: `choco install ffmpeg`
5. Or use Scoop: `scoop install ffmpeg`

#### macOS:
```bash
brew install ffmpeg
```

#### Ubuntu/Debian:
```bash
sudo apt update
sudo apt install ffmpeg
```

## Installation

1. Clone or download this repository
2. Navigate to the project directory
3. Install dependencies:
```bash
npm install
```

## Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The application will be available at `http://localhost:3000`

## Usage

1. Open your browser and go to `http://localhost:3000`
2. Paste a YouTube URL in the input field
3. Click "Analyze" to get video information
4. Click "Download MP3" to convert and download the audio

## Project Structure

```
yt2mp3-converter/
├── public/
│   ├── index.html      # Main HTML file
│   ├── styles.css      # CSS styling
│   └── script.js       # Frontend JavaScript
├── downloads/          # Temporary download directory (auto-created)
├── server.js           # Express server
├── package.json        # Dependencies and scripts
└── README.md          # This file
```

## API Endpoints

- `POST /api/video-info` - Get YouTube video information
- `POST /api/download` - Download and convert video to MP3

## Technologies Used

- **Backend**: Node.js, Express
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Libraries**: 
  - ytdl-core (YouTube downloading)
  - fluent-ffmpeg (Audio conversion)
  - sanitize-filename (File naming)

## Legal Notice

This tool is for educational purposes only. Please respect YouTube's Terms of Service and copyright laws. Only download content you have permission to download.

## License

MIT License - see LICENSE file for details