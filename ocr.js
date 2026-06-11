/**
 * OCR & Camera Module for Smart Fridge & Ledger
 * Handles camera access, image cropping, and text extraction using Tesseract.js
 */

class OcrManager {
  constructor() {
    this.stream = null;
    this.facingMode = 'environment'; // 'environment' (back) or 'user' (front)
    this.worker = null;
    this.isWorkerInitializing = false;
  }

  /**
   * Initialize Tesseract Worker (lazy load)
   */
  async initWorker(onProgress) {
    if (this.worker) return this.worker;
    if (this.isWorkerInitializing) {
      // Wait if already initializing
      return new Promise((resolve) => {
        const check = setInterval(() => {
          if (this.worker) {
            clearInterval(check);
            resolve(this.worker);
          }
        }, 100);
      });
    }

    this.isWorkerInitializing = true;
    try {
      // Create Tesseract worker (uses globally loaded Tesseract from CDN)
      this.worker = await Tesseract.createWorker('jpn+eng');
      this.isWorkerInitializing = false;
      return this.worker;
    } catch (error) {
      console.error('Failed to initialize Tesseract worker:', error);
      this.isWorkerInitializing = false;
      throw error;
    }
  }

  /**
   * Start Camera stream in the specified video element
   */
  async startCamera(videoElement) {
    if (this.stream) {
      this.stopCamera();
    }

    const constraints = {
      video: {
        facingMode: this.facingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoElement.srcObject = this.stream;
      return true;
    } catch (error) {
      console.error('Camera access error:', error);
      // Fallback for devices without facingMode environment support
      if (this.facingMode === 'environment') {
        this.facingMode = 'user';
        return this.startCamera(videoElement);
      }
      throw error;
    }
  }

  /**
   * Stop current camera stream
   */
  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }

  /**
   * Toggle camera facing mode
   */
  async toggleFacingMode(videoElement) {
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    await this.startCamera(videoElement);
  }

  /**
   * Capture cropped region of the video feed matching the guide box
   */
  captureGuideRegion(videoElement, canvasElement) {
    const videoWidth = videoElement.videoWidth;
    const videoHeight = videoElement.videoHeight;
    const displayWidth = videoElement.clientWidth;
    const displayHeight = videoElement.clientHeight;

    if (!videoWidth || !videoHeight) return null;

    // Define coordinates of the cropping area relative to the display size.
    // The guide box is defined in CSS as: width 70%, height 25%, centered.
    const guideWidthPercent = 0.70;
    const guideHeightPercent = 0.25;

    const displayGuideWidth = displayWidth * guideWidthPercent;
    const displayGuideHeight = displayHeight * guideHeightPercent;
    const displayGuideX = (displayWidth - displayGuideWidth) / 2;
    const displayGuideY = (displayHeight - displayGuideHeight) / 2;

    // Map display coordinates to actual video source coordinates
    const scaleX = videoWidth / displayWidth;
    const scaleY = videoHeight / displayHeight;

    const cropX = displayGuideX * scaleX;
    const cropY = displayGuideY * scaleY;
    const cropWidth = displayGuideWidth * scaleX;
    const cropHeight = displayGuideHeight * scaleY;

    // Set canvas dimensions to cropped area size
    canvasElement.width = cropWidth;
    canvasElement.height = cropHeight;

    const ctx = canvasElement.getContext('2d');
    
    // Draw cropped region from video stream
    ctx.drawImage(
      videoElement,
      cropX, cropY, cropWidth, cropHeight, // source rectangle
      0, 0, cropWidth, cropHeight         // destination rectangle
    );

    // Apply pre-processing (Grayscale & Contrast boost) to assist OCR
    this.preprocessImage(ctx, cropWidth, cropHeight);

    return canvasElement.toDataURL('image/jpeg');
  }

  /**
   * Apply simple grayscale and threshold filter to improve OCR accuracy
   */
  preprocessImage(ctx, width, height) {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Simple grayscale conversion
      let gray = 0.299 * r + 0.587 * g + 0.114 * b;
      
      // Basic binarization (thresholding) to separate text from background
      // If it is gray, push closer to pure white/black.
      // Threshold level 120 (adjustable)
      const threshold = 128;
      const v = (gray >= threshold) ? 255 : 0;
      
      data[i] = v;     // R
      data[i + 1] = v; // G
      data[i + 2] = v; // B
    }
    ctx.putImageData(imgData, 0, 0);
  }

  /**
   * Perform OCR on an image URL or base64 data
   */
  async recognizeText(imageDataUrl, onProgress) {
    const worker = await this.initWorker();
    
    // Perform OCR recognition
    const result = await worker.recognize(imageDataUrl);
    return result.data.text;
  }

  /**
   * Parse OCR raw text to find expiration dates
   * Supports: YYYY/MM/DD, YY/MM/DD, YYYY.MM.DD, YY.MM.DD, YYYY-MM-DD, YYYY年MM月DD日, YYMMDD, YYYYMMDD
   */
  parseExpiryDate(text) {
    // Clean up spaces, tabs, newlines, and brackets/symbols
    const cleanText = text.replace(/[\s\(\)\[\]\{\}（）「」]/g, '');
    console.log('Cleaned text for date parsing:', cleanText);

    // Date regex patterns
    const patterns = [
      // 1. YYYY/MM/DD, YYYY-MM-DD, YYYY.MM.DD
      /(\b20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/,
      // 2. YY/MM/DD, YY-MM-DD, YY.MM.DD
      /(\b\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/,
      // 3. YYYY年MM月DD日
      /(\b20\d{2})年(0?[1-9]|1[0-2])月(0?[1-9]|[12]\d|3[01])日?/,
      // 4. YY年MM月DD日
      /(\b\d{2})年(0?[1-9]|1[0-2])月(0?[1-9]|[12]\d|3[01])日?/,
      // 5. YYYYMMDD (8-digit consecutive numbers)
      /\b(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\b/,
      // 6. YYMMDD (6-digit consecutive numbers, e.g. 260630)
      /\b(\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\b/
    ];

    for (const pattern of patterns) {
      const match = cleanText.match(pattern);
      if (match) {
        let year = match[1];
        let month = match[2];
        let day = match[3];

        // Normalise year (if 2 digits, assume 20XX)
        if (year.length === 2) {
          year = '20' + year;
        }

        // Pad month and day
        month = month.padStart(2, '0');
        day = day.padStart(2, '0');

        // Verify if it is a valid calendar date
        const dateStr = `${year}-${month}-${day}`;
        const timestamp = Date.parse(dateStr);
        
        if (!isNaN(timestamp)) {
          // Double check values
          const date = new Date(dateStr);
          if (date.getFullYear() === parseInt(year) && 
              (date.getMonth() + 1) === parseInt(month) && 
              date.getDate() === parseInt(day)) {
            return dateStr;
          }
        }
      }
    }

    // Try a fuzzy search for numbers that might look like dates
    // e.g. look for 6 consecutive digits or 8 consecutive digits anywhere
    const numbersMatch8 = cleanText.match(/\b\d{8}\b/);
    if (numbersMatch8) {
      const s = numbersMatch8[0];
      const y = s.substring(0, 4);
      const m = s.substring(4, 6);
      const d = s.substring(6, 8);
      if (this.isValidDate(y, m, d)) return `${y}-${m}-${d}`;
    }

    const numbersMatch6 = cleanText.match(/\b\d{6}\b/);
    if (numbersMatch6) {
      const s = numbersMatch6[0];
      const y = '20' + s.substring(0, 2);
      const m = s.substring(2, 4);
      const d = s.substring(4, 6);
      if (this.isValidDate(y, m, d)) return `${y}-${m}-${d}`;
    }

    return null;
  }

  /**
   * Helper to check validity of parsed date components
   */
  isValidDate(year, month, day) {
    const y = parseInt(year);
    const m = parseInt(month);
    const d = parseInt(day);

    if (isNaN(y) || isNaN(m) || isNaN(d)) return false;
    if (y < 2000 || y > 2100) return false;
    if (m < 1 || m > 12) return false;
    if (d < 1 || d > 31) return false;

    const date = new Date(y, m - 1, d);
    return date.getFullYear() === y && (date.getMonth() + 1) === m && date.getDate() === d;
  }
}

// Export a single instance to be used globally
window.ocrManager = new OcrManager();
