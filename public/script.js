class YT2MP3Converter {
    constructor() {
        this.initializeElements();
        this.bindEvents();
    }

    initializeElements() {
        this.urlInput = document.getElementById('urlInput');
        this.analyzeBtn = document.getElementById('analyzeBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.videoInfo = document.getElementById('videoInfo');
        this.loading = document.getElementById('loading');
        this.error = document.getElementById('error');
        this.errorMessage = document.getElementById('errorMessage');
        this.thumbnail = document.getElementById('thumbnail');
        this.videoTitle = document.getElementById('videoTitle');
        this.videoAuthor = document.getElementById('videoAuthor');
        this.videoDuration = document.getElementById('videoDuration');
    }

    bindEvents() {
        this.analyzeBtn.addEventListener('click', () => this.analyzeVideo());
        this.downloadBtn.addEventListener('click', () => this.downloadMP3());
        this.urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.analyzeVideo();
            }
        });
        this.urlInput.addEventListener('input', () => this.hideError());
    }

    showLoading() {
        this.loading.classList.remove('hidden');
        this.videoInfo.classList.add('hidden');
        this.hideError();
    }

    hideLoading() {
        this.loading.classList.add('hidden');
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.error.classList.remove('hidden');
        this.hideLoading();
    }

    hideError() {
        this.error.classList.add('hidden');
    }

    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    isValidYouTubeURL(url) {
        const regex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)/;
        return regex.test(url);
    }

    async analyzeVideo() {
        const url = this.urlInput.value.trim();

        if (!url) {
            this.showError('Please enter a YouTube URL');
            return;
        }

        if (!this.isValidYouTubeURL(url)) {
            this.showError('Please enter a valid YouTube URL');
            return;
        }

        // Log the URL being analyzed (client-side)
        console.log('🔍 [CLIENT] Analyzing YouTube URL:', url);

        this.showLoading();
        this.analyzeBtn.disabled = true;

        try {
            const response = await fetch('/api/video-info', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to analyze video');
            }

            // Log the video info received (client-side)
            console.log('📋 [CLIENT] Video info received:', {
                title: data.title,
                author: data.author,
                duration: data.duration ? this.formatDuration(data.duration) : 'Unknown'
            });

            this.displayVideoInfo(data);
        } catch (error) {
            console.error('Error analyzing video:', error);
            this.showError(error.message || 'Failed to analyze video. Please try again.');
        } finally {
            this.hideLoading();
            this.analyzeBtn.disabled = false;
        }
    }

    displayVideoInfo(videoData) {
        this.thumbnail.src = videoData.thumbnail;
        this.videoTitle.textContent = videoData.title;
        this.videoAuthor.textContent = `By ${videoData.author}`;
        this.videoDuration.textContent = `Duration: ${this.formatDuration(videoData.duration)}`;
        
        this.videoInfo.classList.remove('hidden');
        this.hideError();
    }

    async downloadMP3() {
        const url = this.urlInput.value.trim();

        if (!url) {
            this.showError('Please enter a YouTube URL');
            return;
        }

        // Log the download initiation (client-side)
        console.log('💾 [CLIENT] Initiating MP3 download for URL:', url);

        this.downloadBtn.disabled = true;
        this.downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Converting...';

        try {
            const response = await fetch('/api/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Download failed');
            }

            // Get filename from Content-Disposition header
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = 'audio.mp3';
            if (contentDisposition) {
                const matches = contentDisposition.match(/filename="(.+)"/);
                if (matches) {
                    filename = matches[1];
                }
            }

            // Log successful download (client-side)
            console.log('✅ [CLIENT] Download completed successfully. Filename:', filename);

            // Mobile-friendly download implementation
            if (this.isMobile()) {
                await this.handleMobileDownload(response, filename);
            } else {
                await this.handleDesktopDownload(response, filename);
            }

            this.showSuccessMessage();
        } catch (error) {
            console.error('Error downloading MP3:', error);
            this.showError(error.message || 'Download failed. Please try again.');
        } finally {
            this.downloadBtn.disabled = false;
            this.downloadBtn.innerHTML = '<i class="fas fa-download"></i> Download MP3';
        }
    }

    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
    }

    async handleMobileDownload(response, filename) {
        // For mobile devices, use direct navigation to trigger download
        const blob = await response.blob();
        
        try {
            // Method 1: Try the native file system access API (for modern browsers)
            if ('showSaveFilePicker' in window) {
                const fileHandle = await window.showSaveFilePicker({
                    suggestedName: filename,
                    types: [{
                        description: 'MP3 Audio files',
                        accept: { 'audio/mpeg': ['.mp3'] }
                    }]
                });
                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();
                return;
            }
        } catch (e) {
            console.log('File System Access API not available or cancelled');
        }

        try {
            // Method 2: Try Web Share API for mobile sharing
            if (navigator.share && navigator.canShare) {
                const file = new File([blob], filename, { type: 'audio/mpeg' });
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        files: [file],
                        title: 'Download MP3',
                        text: 'Your converted MP3 file'
                    });
                    return;
                }
            }
        } catch (e) {
            console.log('Web Share API not available or cancelled');
        }

        // Method 3: Fallback - create download link with user interaction
        const downloadUrl = window.URL.createObjectURL(blob);
        
        // Create a more visible download button for mobile
        const mobileDownloadDiv = document.createElement('div');
        mobileDownloadDiv.className = 'mobile-download-prompt';
        mobileDownloadDiv.innerHTML = `
            <div style="
                background: #007bff;
                color: white;
                padding: 15px;
                border-radius: 8px;
                margin: 10px 0;
                text-align: center;
                box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            ">
                <p style="margin: 0 0 10px 0; font-weight: bold;">🎵 Your MP3 is ready!</p>
                <a href="${downloadUrl}"
                   download="${filename}"
                   style="
                       background: #28a745;
                       color: white;
                       padding: 12px 24px;
                       text-decoration: none;
                       border-radius: 6px;
                       display: inline-block;
                       font-weight: bold;
                       touch-action: manipulation;
                   "
                   onclick="this.parentElement.parentElement.remove();">
                    📱 Tap to Download ${filename}
                </a>
                <p style="margin: 10px 0 0 0; font-size: 12px; opacity: 0.9;">
                    Tap the button above to download your file
                </p>
            </div>
        `;

        this.videoInfo.appendChild(mobileDownloadDiv);

        // Auto-remove after 30 seconds
        setTimeout(() => {
            if (mobileDownloadDiv.parentNode) {
                mobileDownloadDiv.parentNode.removeChild(mobileDownloadDiv);
                window.URL.revokeObjectURL(downloadUrl);
            }
        }, 30000);
    }

    async handleDesktopDownload(response, filename) {
        // Standard desktop download method
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);
    }

    showSuccessMessage() {
        // Create a temporary success message
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.innerHTML = '<i class="fas fa-check-circle"></i> Download started successfully!';
        successDiv.style.cssText = `
            background: #d4edda;
            color: #155724;
            padding: 1rem;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin-top: 1rem;
            animation: fadeInOut 3s ease-in-out;
        `;

        // Add CSS animation
        if (!document.querySelector('#success-animation-style')) {
            const style = document.createElement('style');
            style.id = 'success-animation-style';
            style.textContent = `
                @keyframes fadeInOut {
                    0%, 100% { opacity: 0; transform: translateY(10px); }
                    10%, 90% { opacity: 1; transform: translateY(0); }
                }
            `;
            document.head.appendChild(style);
        }

        this.videoInfo.appendChild(successDiv);

        // Remove message after animation
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.parentNode.removeChild(successDiv);
            }
        }, 3000);
    }
}

// Initialize the converter when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new YT2MP3Converter();
});

// Add some nice animations and interactions
document.addEventListener('DOMContentLoaded', () => {
    // Add smooth scroll behavior
    document.documentElement.style.scrollBehavior = 'smooth';

    // Add input focus animations
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.style.transform = 'scale(1.02)';
        });
        
        input.addEventListener('blur', function() {
            this.parentElement.style.transform = 'scale(1)';
        });
    });

    // Add button hover effects
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(button => {
        button.addEventListener('mouseenter', function() {
            if (!this.disabled) {
                this.style.transform = 'translateY(-2px)';
            }
        });
        
        button.addEventListener('mouseleave', function() {
            if (!this.disabled) {
                this.style.transform = 'translateY(0)';
            }
        });
    });
});