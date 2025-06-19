const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const youtubedl = require('youtube-dl-exec');
const sanitize = require('sanitize-filename');
const os = require('os');

// Function to create a temporary cookies file
function createCookiesFile() {
    const cookiesContent = [
        '# Netscape HTTP Cookie File',
        '.youtube.com\tTRUE\t/\tFALSE\t2147483647\tCONSENT\tYES+cb.20240214-14-p0.en+FX+321',
        '.youtube.com\tTRUE\t/\tFALSE\t2147483647\tSOCS\tCAISEwgDEgk0ODE4MjkyMzEaAmVuIAEaBgiA5Li6BQ',
        '.youtube.com\tTRUE\t/\tFALSE\t2147483647\tVISITOR_INFO1_LIVE\t4VsQ1tGe5Hw',
        '.youtube.com\tTRUE\t/\tFALSE\t2147483647\tLOGIN_INFO\ttrue'
    ].join('\n');

    const cookiesPath = path.join(os.tmpdir(), 'youtube-cookies.txt');
    fs.writeFileSync(cookiesPath, cookiesContent);
    return cookiesPath;
}

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

        // Function to attempt video info retrieval with different configurations
        async function attemptVideoInfo(url, retryCount = 0) {
                    try {
                        const options = getYoutubeDLOptions(retryCount);
                        return await youtubedl(url, options);
                    } catch (error) {
                        if (retryCount < 3) {
                            console.log(`Attempt ${retryCount + 1} failed, retrying...`);
                            return attemptVideoInfo(url, retryCount + 1);
                        }
                        throw error;
                    }
                }

        // Function to get different configurations for each retry
        function getYoutubeDLOptions(retryCount) {
            const cookiesPath = createCookiesFile();
            
            const baseOptions = {
                dumpSingleJson: true,
                noCheckCertificates: true,
                noWarnings: true,
                preferFreeFormats: true,
                cookies: cookiesPath,
                addHeader: [
                    'referer:youtube.com',
                    'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'accept-language:en-US,en;q=0.9',
                    'sec-fetch-dest:document',
                    'sec-fetch-mode:navigate',
                    'sec-fetch-site:none',
                    'sec-fetch-user:?1',
                    'accept:text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'upgrade-insecure-requests:1',
                    'x-youtube-client-name:1',
                    'x-youtube-client-version:2.20240214'
                ]
            };

            return baseOptions;
        }

        // Basic YouTube URL validation
        const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)/;
        if (!youtubeRegex.test(url)) {
            console.log('❌ Invalid YouTube URL format:', url);
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }

        // Get video info using youtube-dl-exec
        // Define multiple user agents to rotate
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edge/120.0.0.0'
        ];
        
        const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
        
        const options = {
            dumpSingleJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
            addHeader: [
                'referer:youtube.com',
                `user-agent:${randomUserAgent}`,
                'accept-language:en-US,en;q=0.9',
                'sec-fetch-dest:document',
                'sec-fetch-mode:navigate',
                'sec-fetch-site:none',
                'sec-fetch-user:?1',
                'accept:text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            ]
        };

        const info = await youtubedl(url, options);

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
            preferFreeFormats: true,
            cookiesFromBrowser: 'chrome',
            addHeader: [
                'referer:youtube.com',
                'accept-language:en-US,en;q=0.9',
                'sec-fetch-dest:document',
                'sec-fetch-mode:navigate',
                'sec-fetch-site:none',
                'sec-fetch-user:?1',
                'accept:text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            ]
        });

        const title = sanitize(cleanTitle(info.title));
        const outputPath = path.join(downloadsDir, `${title}.mp3`);
        
        // Log the download details
        console.log('🎯 Starting download for:', title);
        console.log('📁 Output path:', outputPath);

        // Download and convert to MP3 with highest quality
        // Function to attempt download with different configurations
        async function attemptDownload(url, outputPath, retryCount = 0) {
            try {
                const options = getYoutubeDLOptions(retryCount);
                // Add download-specific options
                options.extractAudio = true;
                options.audioFormat = 'mp3';
                options.audioQuality = '0';
                options.output = outputPath;
                options.format = 'bestaudio/best';
                
                await youtubedl(url, options);
            } catch (error) {
                if (retryCount < 3) {
                    console.log(`Download attempt ${retryCount + 1} failed, retrying...`);
                    await attemptDownload(url, outputPath, retryCount + 1);
                } else {
                    throw error;
                }
            }
        }

        // Attempt download with retry mechanism
        await attemptDownload(url, outputPath);

        // Check if file exists
        if (!fs.existsSync(outputPath)) {
            console.log('❌ Failed to create MP3 file for:', title);
            throw new Error('Failed to create MP3 file');
        }

        console.log('✅ MP3 conversion completed successfully for:', title);
        console.log('📊 File size:', Math.round(fs.statSync(outputPath).size / 1024 / 1024 * 100) / 100, 'MB');

        // Get file stats
        const fileStats = fs.statSync(outputPath);
        const fileSize = fileStats.size;

        // Set enhanced headers for better mobile compatibility
        res.setHeader('Content-Disposition', `attachment; filename="${title}.mp3"`);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Length', fileSize);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        // Add mobile-specific headers
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length, Content-Type');

        // Check for range requests (important for mobile browsers)
        const range = req.headers.range;
        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;

            res.status(206);
            res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
            res.setHeader('Content-Length', chunksize);

            const fileStream = fs.createReadStream(outputPath, { start, end });
            fileStream.pipe(res);

            fileStream.on('end', () => {
                console.log('🗑️  Cleaning up temporary file after range request:', title);
                setTimeout(() => {
                    if (fs.existsSync(outputPath)) {
                        fs.unlinkSync(outputPath);
                    }
                }, 1000);
            });
        } else {
            // Normal full file download
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
        }

        // Handle stream errors
        res.on('error', (err) => {
            console.error('Response stream error:', err);
            if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
            }
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