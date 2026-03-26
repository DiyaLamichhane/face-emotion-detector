// DOM Elements
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusDiv = document.getElementById('status');
const dominantEmotionDiv = document.getElementById('dominantEmotion');
const emotionGrid = document.getElementById('emotionGrid');
const faceCountSpan = document.getElementById('faceCount');
const fpsSpan = document.getElementById('fps');

// State
let stream = null;
let animationId = null;
let modelsLoaded = false;
let lastTimestamp = 0;
let frameCount = 0;
let currentFPS = 0;
let cameraStartTime = null;
let firstDetectionDone = false;

// Emotion labels
const emotionLabels = ['happy', 'neutral', 'sad', 'angry', 'surprised', 'fearful', 'disgusted'];
const emotionEmojis = {
    'angry': '😠', 'disgusted': '🤢', 'fearful': '😨', 
    'happy': '😊', 'neutral': '😐', 'sad': '😢', 'surprised': '😲'
};
const emotionColors = {
    'angry': '#f5576c', 'disgusted': '#6b8c42', 'fearful': '#9b59b6',
    'happy': '#f1c40f', 'neutral': '#95a5a6', 'sad': '#3498db', 'surprised': '#e67e22'
};

// Create emotion grid
function createEmotionGrid() {
    emotionGrid.innerHTML = '';
    emotionLabels.forEach(label => {
        const emotionCard = document.createElement('div');
        emotionCard.className = 'emotion-card';
        emotionCard.id = `emotion-${label}`;
        emotionCard.innerHTML = `
            <div class="emotion-name">${emotionEmojis[label]} ${label.toUpperCase()}</div>
            <div class="emotion-value" id="${label}-value">0%</div>
            <div class="progress-bar">
                <div class="progress-fill" id="${label}-progress" style="width: 0%"></div>
            </div>
        `;
        emotionGrid.appendChild(emotionCard);
    });
}

// Update emotion display
function updateEmotionDisplay(expressions) {
    if (!expressions) return;
    let maxEmotion = '';
    let maxValue = 0;
    
    emotionLabels.forEach(label => {
        const value = expressions[label] || 0;
        const percentage = Math.round(value * 100);
        
        const valueElement = document.getElementById(`${label}-value`);
        const progressElement = document.getElementById(`${label}-progress`);
        
        if (valueElement) valueElement.textContent = `${percentage}%`;
        if (progressElement) progressElement.style.width = `${percentage}%`;
        
        if (value > maxValue) {
            maxValue = value;
            maxEmotion = label;
        }
    });
    
    if (maxEmotion && maxValue > 0) {
        const confidencePercent = Math.round(maxValue * 100);
        dominantEmotionDiv.innerHTML = `
            <div class="dominant-label">🎯 DOMINANT EMOTION</div>
            <div class="dominant-value">${emotionEmojis[maxEmotion]} ${maxEmotion.toUpperCase()}</div>
            <div class="confidence">Confidence: ${confidencePercent}%</div>
        `;
        dominantEmotionDiv.style.background = `linear-gradient(135deg, ${emotionColors[maxEmotion]}40, ${emotionColors[maxEmotion]}20)`;
    }
}

// Draw face box
function drawFaceBox(detection) {
    if (!detection || !detection.detection) return;
    
    const box = detection.detection.box;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);
    
    ctx.strokeStyle = '#4facfe';
    ctx.lineWidth = 3;
    ctx.strokeRect(box.x, box.y, box.width, box.height);
    
    if (detection.expressions) {
        let maxEmotion = '';
        let maxValue = 0;
        for (const [emotion, value] of Object.entries(detection.expressions)) {
            if (value > maxValue) {
                maxValue = value;
                maxEmotion = emotion;
            }
        }
        if (maxEmotion && maxValue > 0.3) {
            ctx.font = 'bold 14px "Segoe UI"';
            ctx.fillStyle = emotionColors[maxEmotion] || '#fff';
            ctx.shadowBlur = 4;
            ctx.shadowColor = 'black';
            ctx.fillText(`${emotionEmojis[maxEmotion]} ${Math.round(maxValue * 100)}%`, box.x + 5, box.y - 5);
            ctx.shadowBlur = 0;
        }
    }
    
    ctx.restore();
}

// Main detection loop - OPTIMIZED FOR SPEED
async function detectFaces() {
    if (!video.videoWidth || !video.videoHeight || !modelsLoaded) {
        animationId = requestAnimationFrame(detectFaces);
        return;
    }
    
    const startTime = performance.now();
    
    try {
        // Ultra-fast detection settings
        const options = new faceapi.TinyFaceDetectorOptions({
            inputSize: 224,
            scoreThreshold: 0.3
        });
        
        const detections = await faceapi.detectAllFaces(video, options)
            .withFaceExpressions();
        
        const endTime = performance.now();
        const processingTime = Math.round(endTime - startTime);
        
        // Track first detection time
        if (!firstDetectionDone && detections.length > 0) {
            const timeToDetect = Math.round((Date.now() - cameraStartTime) / 1000);
            firstDetectionDone = true;
            statusDiv.innerHTML = `<span>✅ First face detected in ${timeToDetect} seconds! | ${emotionEmojis[Object.keys(detections[0].expressions).reduce((a,b) => detections[0].expressions[a] > detections[0].expressions[b] ? a : b)]} ${Math.round(Object.values(detections[0].expressions).reduce((a,b) => Math.max(a,b)) * 100)}%</span>`;
        }
        
        // Update FPS
        frameCount++;
        const now = performance.now();
        if (now - lastTimestamp >= 1000) {
            currentFPS = frameCount;
            fpsSpan.textContent = currentFPS;
            frameCount = 0;
            lastTimestamp = now;
        }
        
        // Update UI
        faceCountSpan.textContent = detections.length;
        
        if (detections.length > 0 && detections[0].expressions) {
            updateEmotionDisplay(detections[0].expressions);
            drawFaceBox(detections[0]);
            
            const topEmotion = Object.entries(detections[0].expressions).sort((a,b) => b[1] - a[1])[0];
            if (!firstDetectionDone) {
                statusDiv.innerHTML = `<span>✅ Detected! ${topEmotion[0]}: ${Math.round(topEmotion[1] * 100)}% | ⚡ ${processingTime}ms</span>`;
            } else {
                statusDiv.innerHTML = `<span>✅ ${detections.length} face(s) | ${emotionEmojis[topEmotion[0]]} ${topEmotion[0]}: ${Math.round(topEmotion[1] * 100)}% | ⚡ ${processingTime}ms</span>`;
            }
        } else {
            statusDiv.innerHTML = `<span>👤 Looking for face... (${processingTime}ms) | Position face clearly</span>`;
            const emptyExpressions = {};
            emotionLabels.forEach(label => emptyExpressions[label] = 0);
            updateEmotionDisplay(emptyExpressions);
            
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        
    } catch (error) {
        console.error('Detection error:', error);
        statusDiv.innerHTML = `<span>⚠️ Error: ${error.message}</span>`;
    }
    
    animationId = requestAnimationFrame(detectFaces);
}

// Load models with reliable CDN
async function loadModels() {
    const startLoadTime = Date.now();
    
    statusDiv.innerHTML = '<span><i class="loading"></i> Loading AI models (5-15 sec)...</span>';
    
    try {
        // Use reliable CDN that works with face-api.js
        const MODEL_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
        
        statusDiv.innerHTML = '<span><i class="loading"></i> Loading Face Detector...</span>';
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        
        statusDiv.innerHTML = '<span><i class="loading"></i> Loading Emotion Model...</span>';
        await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
        
        const loadTime = Math.round((Date.now() - startLoadTime) / 1000);
        
        modelsLoaded = true;
        statusDiv.innerHTML = `<span>✅ Models loaded in ${loadTime} seconds! Click "Start Camera"</span>`;
        console.log(`✅ Models loaded in ${loadTime} seconds`);
        
        startBtn.disabled = false;
        
    } catch (error) {
        console.error('Model loading error:', error);
        statusDiv.innerHTML = `<span>❌ Failed to load: ${error.message}<br>Check internet and refresh.</span>`;
        startBtn.disabled = true;
    }
}

// Start camera
async function startCamera() {
    console.log('📷 Starting camera...');
    
    if (!modelsLoaded) {
        statusDiv.innerHTML = '<span>⏳ Wait for models to load first...</span>';
        return;
    }
    
    if (stream) stopCamera();
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        statusDiv.innerHTML = '<span>❌ Camera not supported.</span>';
        return;
    }
    
    const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (!isSecure) {
        statusDiv.innerHTML = '<span>⚠️ Use localhost or HTTPS.<br>Run with Live Server extension.</span>';
        return;
    }
    
    try {
        statusDiv.innerHTML = '<span>📷 Requesting camera...</span>';
        
        const constraints = {
            video: {
                width: { ideal: 320, max: 480 },
                height: { ideal: 240, max: 360 },
                facingMode: 'user'
            }
        };
        
        cameraStartTime = Date.now();
        firstDetectionDone = false;
        
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        
        await video.play();
        
        statusDiv.innerHTML = '<span>✅ Camera ready! Detecting face... (Results in 3-8 seconds)</span>';
        
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 240;
        
        if (!animationId) {
            detectFaces();
        }
        
        startBtn.disabled = true;
        stopBtn.disabled = false;
        
        // Show timeout warning
        setTimeout(() => {
            if (!firstDetectionDone && stream) {
                statusDiv.innerHTML = '<span>⚠️ No face detected yet. Make sure:<br>• Face is visible<br>• Good lighting<br>• Look directly at camera</span>';
            }
        }, 8000);
        
    } catch (error) {
        console.error('Camera error:', error);
        let errorMessage = 'Camera access denied. ';
        if (error.name === 'NotAllowedError') {
            errorMessage += 'Please allow camera permission.';
        } else if (error.name === 'NotFoundError') {
            errorMessage += 'No camera found.';
        } else {
            errorMessage += error.message;
        }
        statusDiv.innerHTML = `<span>❌ ${errorMessage}</span>`;
    }
}

// Stop camera
function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
        video.srcObject = null;
    }
    
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    faceCountSpan.textContent = '0';
    const emptyExpressions = {};
    emotionLabels.forEach(label => emptyExpressions[label] = 0);
    updateEmotionDisplay(emptyExpressions);
    fpsSpan.textContent = '0';
    
    statusDiv.innerHTML = '<span>⏹ Camera stopped. Click "Start Camera" to resume.</span>';
    
    startBtn.disabled = false;
    stopBtn.disabled = true;
    firstDetectionDone = false;
}

// Initialize
function init() {
    console.log('🚀 Emotion Detector Starting...');
    createEmotionGrid();
    loadModels();
    
    startBtn.addEventListener('click', startCamera);
    stopBtn.addEventListener('click', stopCamera);
    stopBtn.disabled = true;
    
    canvas.width = 320;
    canvas.height = 240;
}

init();

window.addEventListener('beforeunload', () => {
    if (stream) stream.getTracks().forEach(track => track.stop());
    if (animationId) cancelAnimationFrame(animationId);
});