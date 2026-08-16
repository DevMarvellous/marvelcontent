/**
 * Marvel Content — HTML5 Canvas Card Rendering Engine
 * Implements high-resolution card generator with **bold** and ++big++ markup parsing,
 * word-by-word wrapping, custom header/avatar, and multi-ratio exports.
 */

const PRESETS = {
  square: { width: 1080, height: 1080, name: "Square (1:1)" },
  portrait: { width: 1080, height: 1350, name: "Portrait (4:5)" },
  story: { width: 1080, height: 1920, name: "Story / Reel (9:16)" }
};

/**
 * Parses markdown text into formatted word tokens.
 * Handles **bold text** and ++big text++
 */
function parseMarkupTokens(text) {
  if (!text) return [];

  // Normalize line endings
  const paragraphs = text.split(/\r?\n/);
  const parsedParagraphs = [];

  paragraphs.forEach((pText) => {
    const tokens = [];
    
    // Regex matches **bold** or ++big++ or regular words
    // We match tokens preserving spaces
    const regex = /(\*\*[^*]+\*\*|\+\+[^+]+\+\+|[^\s*+]+|\s+)/g;
    let match;

    while ((match = regex.exec(pText)) !== null) {
      const raw = match[0];
      if (!raw) continue;

      if (raw.startsWith('**') && raw.endsWith('**') && raw.length >= 4) {
        const content = raw.slice(2, -2);
        // split inside into words if multi-word
        const innerWords = content.split(/(\s+)/);
        innerWords.forEach(w => {
          if (w.trim().length === 0) {
            tokens.push({ text: w, type: 'space', isBold: true, isBig: false });
          } else {
            tokens.push({ text: w, type: 'word', isBold: true, isBig: false });
          }
        });
      } else if (raw.startsWith('++') && raw.endsWith('++') && raw.length >= 4) {
        const content = raw.slice(2, -2);
        const innerWords = content.split(/(\s+)/);
        innerWords.forEach(w => {
          if (w.trim().length === 0) {
            tokens.push({ text: w, type: 'space', isBold: true, isBig: true });
          } else {
            tokens.push({ text: w, type: 'word', isBold: true, isBig: true });
          }
        });
      } else if (/^\s+$/.test(raw)) {
        tokens.push({ text: raw, type: 'space', isBold: false, isBig: false });
      } else {
        tokens.push({ text: raw, type: 'word', isBold: false, isBig: false });
      }
    }

    parsedParagraphs.push(tokens);
  });

  return parsedParagraphs;
}

/**
 * Main Canvas Card Renderer
 */
async function renderCardToCanvas(canvas, cardText, userOptions = {}) {
  const settings = {
    headerName: userOptions.headerName || "Marvellous Adepoju",
    headerHandle: userOptions.headerHandle || "@devmarvellous",
    headerAvatar: userOptions.headerAvatar || "",
    cardBg: userOptions.cardBg || "#0f172a",
    cardTextColor: userOptions.cardTextColor || "#f8fafc",
    cardAccentColor: userOptions.cardAccentColor || "#6366f1",
    cardFont: userOptions.cardFont || "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
    cardFontSize: Number(userOptions.cardFontSize) || 48,
    cardAlign: userOptions.cardAlign || "left", // 'left' | 'center'
    cardPreset: userOptions.cardPreset || "square" // 'square' | 'portrait' | 'story'
  };

  const preset = PRESETS[settings.cardPreset] || PRESETS.square;
  const width = preset.width;
  const height = preset.height;

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 1. Draw Background
  ctx.fillStyle = settings.cardBg;
  ctx.fillRect(0, 0, width, height);

  // Subtle radial ambient glow in top-right / center
  const glowGrad = ctx.createRadialGradient(width * 0.85, height * 0.15, 50, width * 0.85, height * 0.15, width * 0.6);
  glowGrad.addColorStop(0, 'rgba(99, 102, 241, 0.12)');
  glowGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle border / frame inset
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 4;
  ctx.strokeRect(32, 32, width - 64, height - 64);

  // Margin and layout constants
  const paddingX = 96;
  const maxContentWidth = width - (paddingX * 2);

  let currentY = 110;

  // 2. Draw Header (Avatar + Name + Handle)
  const avatarSize = 80;
  const avatarX = paddingX;
  const avatarY = currentY;

  // Avatar Circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + (avatarSize / 2), avatarY + (avatarSize / 2), avatarSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  let avatarDrawn = false;
  if (settings.headerAvatar && typeof settings.headerAvatar === 'string' && settings.headerAvatar.startsWith('data:image')) {
    try {
      const img = await loadImage(settings.headerAvatar);
      ctx.drawImage(img, avatarX, avatarY, avatarSize, avatarSize);
      avatarDrawn = true;
    } catch (e) {
      console.warn('Avatar image render fallback:', e);
    }
  }

  if (!avatarDrawn) {
    // Gradient initials avatar
    const aGrad = ctx.createLinearGradient(avatarX, avatarY, avatarX + avatarSize, avatarY + avatarSize);
    aGrad.addColorStop(0, settings.cardAccentColor);
    aGrad.addColorStop(1, '#9333ea');
    ctx.fillStyle = aGrad;
    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);

    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${Math.round(avatarSize * 0.42)}px ${settings.cardFont}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const initials = settings.headerName
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'MA';
    ctx.fillText(initials, avatarX + (avatarSize / 2), avatarY + (avatarSize / 2));
  }
  ctx.restore();

  // Header Text
  const textStartX = avatarX + avatarSize + 22;
  const textCenterY = avatarY + (avatarSize / 2);

  // Name
  ctx.fillStyle = settings.cardTextColor;
  ctx.font = `800 32px ${settings.cardFont}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(settings.headerName, textStartX, textCenterY - 4);

  // Verified Badge (Next to name)
  const nameWidth = ctx.measureText(settings.headerName).width;
  drawVerifiedBadge(ctx, textStartX + nameWidth + 10, textCenterY - 20, 20);

  // Handle
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.font = `500 24px ${settings.cardFont}`;
  ctx.textBaseline = 'top';
  ctx.fillText(settings.headerHandle, textStartX, textCenterY + 4);

  // Header Divider Line
  currentY += avatarSize + 50;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(paddingX, currentY);
  ctx.lineTo(width - paddingX, currentY);
  ctx.stroke();

  currentY += 60;

  // 3. Word-by-Word Text Layout Engine
  const baseFontSize = settings.cardFontSize;
  const bigFontSize = Math.round(baseFontSize * 1.25);
  const baseLineHeight = baseFontSize * 1.52;
  const paragraphGap = baseFontSize * 0.9;

  const paragraphs = parseMarkupTokens(cardText || "Enter your **headline** or ++highlight++ content.");

  // Build wrapped lines for each paragraph
  const linesToRender = [];

  paragraphs.forEach((tokens, pIdx) => {
    let currentLine = [];
    let currentLineWidth = 0;

    tokens.forEach((tok) => {
      // Determine font for token
      const fSize = tok.isBig ? bigFontSize : baseFontSize;
      const fWeight = (tok.isBold || tok.isBig) ? '800' : '400';
      ctx.font = `${fWeight} ${fSize}px ${settings.cardFont}`;

      const tokWidth = ctx.measureText(tok.text).width;

      if (tok.type === 'space') {
        if (currentLine.length > 0) {
          currentLine.push({ ...tok, width: tokWidth, fontSize: fSize, fontWeight: fWeight });
          currentLineWidth += tokWidth;
        }
      } else {
        if (currentLineWidth + tokWidth > maxContentWidth && currentLine.length > 0) {
          // Push current line and start a new one
          linesToRender.push({ tokens: currentLine, width: currentLineWidth, isParagraphEnd: false });
          currentLine = [{ ...tok, width: tokWidth, fontSize: fSize, fontWeight: fWeight }];
          currentLineWidth = tokWidth;
        } else {
          currentLine.push({ ...tok, width: tokWidth, fontSize: fSize, fontWeight: fWeight });
          currentLineWidth += tokWidth;
        }
      }
    });

    if (currentLine.length > 0) {
      linesToRender.push({ tokens: currentLine, width: currentLineWidth, isParagraphEnd: (pIdx < paragraphs.length - 1) });
    } else if (pIdx < paragraphs.length - 1) {
      // Empty paragraph break
      linesToRender.push({ tokens: [], width: 0, isParagraphEnd: true });
    }
  });

  // Calculate total height of text block to vertically center if desired
  let totalTextHeight = 0;
  linesToRender.forEach((line) => {
    totalTextHeight += baseLineHeight;
    if (line.isParagraphEnd) totalTextHeight += paragraphGap;
  });

  const availableHeight = height - currentY - 110;
  if (totalTextHeight < availableHeight * 0.75 && linesToRender.length > 0) {
    // Vertically balance text block within available canvas area
    const offset = Math.max(0, (availableHeight - totalTextHeight) * 0.35);
    currentY += offset;
  }

  // Render each line
  linesToRender.forEach((line) => {
    if (line.tokens.length === 0 && line.isParagraphEnd) {
      currentY += paragraphGap;
      return;
    }

    let lineStartX = paddingX;
    if (settings.cardAlign === 'center') {
      lineStartX = (width - line.width) / 2;
    }

    let drawX = lineStartX;

    line.tokens.forEach((tok) => {
      ctx.font = `${tok.fontWeight} ${tok.fontSize}px ${settings.cardFont}`;
      ctx.textBaseline = 'alphabetic';

      if (tok.isBig) {
        ctx.fillStyle = settings.cardAccentColor;
      } else if (tok.isBold) {
        ctx.fillStyle = settings.cardTextColor;
      } else {
        ctx.fillStyle = 'rgba(248, 250, 252, 0.88)';
      }

      if (tok.type !== 'space') {
        ctx.fillText(tok.text, drawX, currentY + baseFontSize);
      }

      drawX += tok.width;
    });

    currentY += baseLineHeight;
    if (line.isParagraphEnd) {
      currentY += paragraphGap;
    }
  });

  // 4. Footer Branding & Corner Accent
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font = `600 22px ${settings.cardFont}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('Marvel Content Studio', width - paddingX, height - 60);

  // Bottom-left mini badge
  ctx.fillStyle = settings.cardAccentColor;
  ctx.fillRect(paddingX, height - 72, 32, 6);
}

/**
 * Draw Verified Badge Icon
 */
function drawVerifiedBadge(ctx, x, y, size) {
  ctx.save();
  ctx.fillStyle = '#38bdf8'; // Twitter/Blue verified color
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();

  // White Checkmark
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x + size * 0.3, y + size * 0.52);
  ctx.lineTo(x + size * 0.46, y + size * 0.7);
  ctx.lineTo(x + size * 0.74, y + size * 0.34);
  ctx.stroke();
  ctx.restore();
}

/**
 * Helper to load an image asynchronously
 */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/**
 * Render card directly to Blob (PNG)
 */
async function renderCardToBlob(cardText, options = {}) {
  const canvas = document.createElement('canvas');
  await renderCardToCanvas(canvas, cardText, options);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png', 1.0);
  });
}

/**
 * Render card to Data URL (Base64)
 */
async function renderCardToDataURL(cardText, options = {}) {
  const canvas = document.createElement('canvas');
  await renderCardToCanvas(canvas, cardText, options);
  return canvas.toDataURL('image/png', 1.0);
}

/**
 * Trigger direct download of card image
 */
async function downloadCardImage(cardText, options = {}, filename = 'marvel-content-card.png') {
  const blob = await renderCardToBlob(cardText, options);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

window.MarvelCardRenderer = {
  PRESETS,
  renderCardToCanvas,
  renderCardToBlob,
  renderCardToDataURL,
  downloadCardImage
};
