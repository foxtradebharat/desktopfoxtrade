/**
 * Client-side HTML5 Canvas Image Compression Utility
 * Prevents localStorage quota exceeded errors by resizing and compressing
 * raw high-res TradingView screenshots (typically 2MB-4MB -> 100KB-180KB).
 */

export async function compressImage(source, { maxDimension = 1200, quality = 0.75 } = {}) {
  return new Promise((resolve, reject) => {
    let dataUrl = '';

    const processDataUrl = (url) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate proportional scaling
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(url);
          return;
        }

        // Fill background with white for transparency fallback
        ctx.fillStyle = '#1e222d';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        try {
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        } catch (err) {
          resolve(url);
        }
      };

      img.onerror = () => {
        resolve(url);
      };

      img.src = url;
    };

    if (typeof source === 'string') {
      processDataUrl(source);
    } else if (source instanceof File || source instanceof Blob) {
      const reader = new FileReader();
      reader.onload = (e) => processDataUrl(e.target?.result);
      reader.onerror = reject;
      reader.readAsDataURL(source);
    } else {
      resolve('');
    }
  });
}
