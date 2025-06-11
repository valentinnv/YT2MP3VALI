const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const youtubedl = require('youtube-dl-exec');
const sanitize = require('sanitize-filename');

// Function to remove emojis and special characters from titles
function cleanTitle(title) {
    if (!title) return '';
    
    // Remove emojis and special Unicode characters
    const cleaned = title
        // Remove emoji characters (various Unicode ranges)
        .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
        .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Miscellaneous Symbols and Pictographs
        .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport and Map Symbols
        .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Flags (iOS)
        .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Miscellaneous symbols
        .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
        .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental Symbols and Pictographs
        .replace(/[\u{1F018}-\u{1F270}]/gu, '') // Various symbols
        .replace(/[\u{238C}-\u{2454}]/gu, '')   // Miscellaneous symbols
        .replace(/[\u{20D0}-\u{20FF}]/gu, '')   // Combining Diacritical Marks for Symbols
        // Remove other weird characters
        .replace(/[^\w\s\-_\.(),!?'"]/g, '')     // Keep only word chars, spaces, and basic punctuation
        // Clean up multiple spaces
        .replace(/\s+/g, ' ')
        // Trim whitespace
        .trim();
    
    return cleaned || 'untitled';
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Create downloads directory if it doesn't exist
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir);
}

// Route to serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to get video info
app.post('/api/video-info', async (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        // Log the entered YouTube URL
        console.log('📺 YouTube URL entered:', url);

        // Basic YouTube URL validation
        const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)/;
        if (!youtubeRegex.test(url)) {
            console.log('❌ Invalid YouTube URL format:', url);
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }

        // Get video info using youtube-dl-exec
        const info = await youtubedl(url, {
            dumpSingleJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
            addHeader: [
                'referer:youtube.com',
                'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            ]
        });

        const cleanedTitle = cleanTitle(info.title);
        
        // Log the video title
        console.log('🎵 Video title:', cleanedTitle);
        console.log('👤 Video author:', info.uploader || info.channel);
        console.log('⏱️  Video duration:', info.duration ? `${Math.floor(info.duration / 60)}:${(info.duration % 60).toString().padStart(2, '0')}` : 'Unknown');

        res.json({
            title: cleanedTitle,
            duration: info.duration,
            thumbnail: info.thumbnail,
            author: info.uploader || info.channel
        });
    } catch (error) {
        console.error('Error getting video info:', error);
        res.status(500).json({ error: 'Failed to get video information' });
    }
});

// API endpoint to download and convert to MP3
app.post('/api/download', async (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        // Log the download request
        console.log('⬇️  Download request for URL:', url);

        // Basic YouTube URL validation
        const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)/;
        if (!youtubeRegex.test(url)) {
            console.log('❌ Invalid YouTube URL format for download:', url);
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }

        // Get video info first to get the title
        const info = await youtubedl(url, {
            dumpSingleJson: true,
            noCheckCertificates: true,
            noWarnings: true,
        });

        const title = sanitize(cleanTitle(info.title));
        const outputPath = path.join(downloadsDir, `${title}.mp3`);
        
        // Log the download details
        console.log('🎯 Starting download for:', title);
        console.log('📁 Output path:', outputPath);

        // Download and convert to MP3 with highest quality
        await youtubedl(url, {
            extractAudio: true,
            audioFormat: 'mp3',
            audioQuality: '0', // Best quality (0 = best, 9 = worst for MP3)
            output: outputPath,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
            format: 'bestaudio/best', // Get the best audio format available
            addHeader: [
                'referer:youtube.com',
                'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            ]
        });

        // Check if file exists
        if (!fs.existsSync(outputPath)) {
            console.log('❌ Failed to create MP3 file for:', title);
            throw new Error('Failed to create MP3 file');
        }

        console.log('✅ MP3 conversion completed successfully for:', title);
        console.log('📊 File size:', Math.round(fs.statSync(outputPath).size / 1024 / 1024 * 100) / 100, 'MB');

        // Set response headers for file download
        res.setHeader('Content-Disposition', `attachment; filename="${title}.mp3"`);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Length', fs.statSync(outputPath).size);

        // Stream the file to response
        const fileStream = fs.createReadStream(outputPath);
        fileStream.pipe(res);

        // Clean up file after streaming
        fileStream.on('end', () => {
            console.log('🗑️  Cleaning up temporary file:', title);
            setTimeout(() => {
                if (fs.existsSync(outputPath)) {
                    fs.unlinkSync(outputPath);
                }
            }, 1000);
        });

    } catch (error) {
        console.error('Error downloading video:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Download failed. Please try again.' });
        }
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Using youtube-dl-exec for reliable YouTube downloads');
});