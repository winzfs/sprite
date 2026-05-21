/*
 * Local GIF encoder for Sprite Tool Studio.
 * Provides a gif.js-compatible subset used by src/media-converter.js:
 *   new GIF({ width, height, repeat, quality })
 *   gif.addFrame(ctx, { delay })
 *   gif.on('finished', callback)
 *   gif.render()
 *
 * Encoder notes:
 * - Dependency-free and static-hosting friendly.
 * - Builds an adaptive global palette with median-cut quantization.
 * - Reserves palette index 0 for transparent pixels.
 * - `quality` controls sampling density: lower value = more samples / better palette.
 * - `workers` and `workerScript` are accepted for API compatibility but ignored.
 */
(() => {
  const MAX_COLORS = 256;
  const TRANSPARENT_INDEX = 0;

  class ByteWriter {
    constructor() {
      this.bytes = [];
    }

    byte(value) { this.bytes.push(value & 255); }
    bytesArray(values) { for (const value of values) this.byte(value); }
    ascii(text) { for (let i = 0; i < text.length; i += 1) this.byte(text.charCodeAt(i)); }
    word(value) { this.byte(value & 255); this.byte((value >> 8) & 255); }

    subBlocks(data) {
      let offset = 0;
      while (offset < data.length) {
        const size = Math.min(255, data.length - offset);
        this.byte(size);
        for (let i = 0; i < size; i += 1) this.byte(data[offset + i]);
        offset += size;
      }
      this.byte(0);
    }

    blob(type) { return new Blob([new Uint8Array(this.bytes)], { type }); }
  }

  class BitWriter {
    constructor() {
      this.bytes = [];
      this.current = 0;
      this.bitCount = 0;
    }

    write(code, size) {
      let value = code;
      for (let i = 0; i < size; i += 1) {
        this.current |= (value & 1) << this.bitCount;
        value >>= 1;
        this.bitCount += 1;
        if (this.bitCount === 8) {
          this.bytes.push(this.current);
          this.current = 0;
          this.bitCount = 0;
        }
      }
    }

    finish() {
      if (this.bitCount > 0) this.bytes.push(this.current);
      return new Uint8Array(this.bytes);
    }
  }

  function extractRgba(source, width, height) {
    if (source && typeof source.getImageData === 'function') {
      return new Uint8ClampedArray(source.getImageData(0, 0, width, height).data);
    }
    if (source instanceof ImageData) {
      return new Uint8ClampedArray(source.data);
    }
    throw new Error('GIF.addFrame은 CanvasRenderingContext2D 또는 ImageData를 필요로 합니다.');
  }

  function colorRange(colors, channel) {
    let min = 255;
    let max = 0;
    for (const color of colors) {
      const value = color[channel];
      if (value < min) min = value;
      if (value > max) max = value;
    }
    return max - min;
  }

  function averageColor(colors) {
    let r = 0;
    let g = 0;
    let b = 0;
    let weight = 0;
    for (const color of colors) {
      r += color.r * color.count;
      g += color.g * color.count;
      b += color.b * color.count;
      weight += color.count;
    }
    if (!weight) return { r: 0, g: 0, b: 0 };
    return {
      r: Math.round(r / weight),
      g: Math.round(g / weight),
      b: Math.round(b / weight),
    };
  }

  function chooseSplitChannel(colors) {
    const r = colorRange(colors, 'r');
    const g = colorRange(colors, 'g');
    const b = colorRange(colors, 'b');
    if (r >= g && r >= b) return 'r';
    if (g >= r && g >= b) return 'g';
    return 'b';
  }

  function splitColorBox(box) {
    const channel = chooseSplitChannel(box.colors);
    const sorted = box.colors.slice().sort((a, b) => a[channel] - b[channel]);
    const total = sorted.reduce((sum, color) => sum + color.count, 0);
    let acc = 0;
    let splitIndex = 1;
    for (let i = 0; i < sorted.length - 1; i += 1) {
      acc += sorted[i].count;
      if (acc >= total / 2) {
        splitIndex = i + 1;
        break;
      }
    }
    return [
      { colors: sorted.slice(0, splitIndex) },
      { colors: sorted.slice(splitIndex) },
    ];
  }

  function boxScore(box) {
    if (!box.colors.length) return 0;
    const range = Math.max(colorRange(box.colors, 'r'), colorRange(box.colors, 'g'), colorRange(box.colors, 'b'));
    const weight = box.colors.reduce((sum, color) => sum + color.count, 0);
    return range * weight;
  }

  function buildColorHistogram(frames, sampleStep) {
    const map = new Map();
    for (const frame of frames) {
      const data = frame.rgba;
      for (let i = 0, pixel = 0; i < data.length; i += 4, pixel += 1) {
        if (pixel % sampleStep !== 0) continue;
        const a = data[i + 3];
        if (a < 16) continue;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const key = `${r},${g},${b}`;
        const existing = map.get(key);
        if (existing) existing.count += 1;
        else map.set(key, { r, g, b, count: 1 });
      }
    }
    return Array.from(map.values());
  }

  function buildAdaptivePalette(frames, quality) {
    const sampleStep = Math.max(1, Math.min(30, Math.round(quality || 10)));
    const colors = buildColorHistogram(frames, sampleStep);
    const palette = [{ r: 0, g: 0, b: 0 }];

    if (!colors.length) {
      while (palette.length < MAX_COLORS) palette.push({ r: 0, g: 0, b: 0 });
      return palette;
    }

    let boxes = [{ colors }];
    while (boxes.length < MAX_COLORS - 1) {
      boxes.sort((a, b) => boxScore(b) - boxScore(a));
      const box = boxes.shift();
      if (!box || box.colors.length <= 1) {
        if (box) boxes.push(box);
        break;
      }
      const [left, right] = splitColorBox(box);
      if (left.colors.length) boxes.push(left);
      if (right.colors.length) boxes.push(right);
    }

    boxes = boxes.sort((a, b) => boxScore(b) - boxScore(a));
    for (const box of boxes) palette.push(averageColor(box.colors));
    while (palette.length < MAX_COLORS) palette.push(palette[palette.length - 1] || { r: 0, g: 0, b: 0 });
    return palette.slice(0, MAX_COLORS);
  }

  function nearestPaletteIndex(r, g, b, palette, cache) {
    const key = ((r & 248) << 8) | ((g & 248) << 3) | (b >> 3);
    const cached = cache.get(key);
    if (cached !== undefined) return cached;

    let best = 1;
    let bestDistance = Infinity;
    for (let i = 1; i < palette.length; i += 1) {
      const color = palette[i];
      const dr = r - color.r;
      const dg = g - color.g;
      const db = b - color.b;
      const distance = dr * dr * 0.299 + dg * dg * 0.587 + db * db * 0.114;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
        if (distance === 0) break;
      }
    }
    cache.set(key, best);
    return best;
  }

  function indexFrame(frame, palette) {
    const data = frame.rgba;
    const pixels = new Uint8Array(frame.width * frame.height);
    const cache = new Map();
    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      const a = data[i + 3];
      if (a < 16) pixels[p] = TRANSPARENT_INDEX;
      else pixels[p] = nearestPaletteIndex(data[i], data[i + 1], data[i + 2], palette, cache);
    }
    return pixels;
  }

  function lzwEncode(indices, minCodeSize = 8) {
    const clearCode = 1 << minCodeSize;
    const endCode = clearCode + 1;
    let nextCode = endCode + 1;
    let codeSize = minCodeSize + 1;
    let dictionary = new Map();

    const resetDictionary = () => {
      dictionary = new Map();
      for (let i = 0; i < clearCode; i += 1) dictionary.set(String(i), i);
      nextCode = endCode + 1;
      codeSize = minCodeSize + 1;
    };

    const writer = new BitWriter();
    resetDictionary();
    writer.write(clearCode, codeSize);

    let phrase = String(indices[0] || 0);
    for (let i = 1; i < indices.length; i += 1) {
      const current = indices[i];
      const nextPhrase = `${phrase},${current}`;
      if (dictionary.has(nextPhrase)) {
        phrase = nextPhrase;
        continue;
      }
      writer.write(dictionary.get(phrase), codeSize);
      if (nextCode < 4096) {
        dictionary.set(nextPhrase, nextCode);
        nextCode += 1;
        if (nextCode === (1 << codeSize) && codeSize < 12) codeSize += 1;
      } else {
        writer.write(clearCode, codeSize);
        resetDictionary();
      }
      phrase = String(current);
    }

    writer.write(dictionary.get(phrase), codeSize);
    writer.write(endCode, codeSize);
    return writer.finish();
  }

  class GIF {
    constructor(options = {}) {
      this.width = Math.max(1, Math.round(options.width || 1));
      this.height = Math.max(1, Math.round(options.height || 1));
      this.repeat = options.repeat === -1 ? -1 : 0;
      this.quality = Math.max(1, Math.min(30, Math.round(options.quality || 10)));
      this.frames = [];
      this.listeners = new Map();
    }

    on(eventName, callback) {
      if (!this.listeners.has(eventName)) this.listeners.set(eventName, []);
      this.listeners.get(eventName).push(callback);
      return this;
    }

    emit(eventName, payload) {
      const callbacks = this.listeners.get(eventName) || [];
      for (const callback of callbacks) callback(payload);
    }

    addFrame(source, options = {}) {
      const delayMs = Math.max(20, Math.round(options.delay || 100));
      this.frames.push({
        width: this.width,
        height: this.height,
        delay: Math.max(1, Math.round(delayMs / 10)),
        rgba: extractRgba(source, this.width, this.height),
      });
    }

    render() {
      window.setTimeout(() => {
        try {
          const blob = this.encode();
          this.emit('finished', blob);
        } catch (error) {
          this.emit('abort', error);
        }
      }, 0);
    }

    encode() {
      if (!this.frames.length) throw new Error('GIF 프레임이 없습니다.');

      const palette = buildAdaptivePalette(this.frames, this.quality);
      const writer = new ByteWriter();
      writer.ascii('GIF89a');
      writer.word(this.width);
      writer.word(this.height);
      writer.byte(0b11110111);
      writer.byte(0);
      writer.byte(0);
      for (const color of palette) writer.bytesArray([color.r, color.g, color.b]);

      if (this.repeat !== -1) {
        writer.byte(0x21);
        writer.byte(0xff);
        writer.byte(11);
        writer.ascii('NETSCAPE2.0');
        writer.byte(3);
        writer.byte(1);
        writer.word(this.repeat);
        writer.byte(0);
      }

      for (const frame of this.frames) {
        const indexed = indexFrame(frame, palette);
        writer.byte(0x21);
        writer.byte(0xf9);
        writer.byte(4);
        writer.byte(0b00000101);
        writer.word(frame.delay);
        writer.byte(TRANSPARENT_INDEX);
        writer.byte(0);

        writer.byte(0x2c);
        writer.word(0);
        writer.word(0);
        writer.word(this.width);
        writer.word(this.height);
        writer.byte(0);

        writer.byte(8);
        writer.subBlocks(lzwEncode(indexed, 8));
      }

      writer.byte(0x3b);
      return writer.blob('image/gif');
    }
  }

  window.GIF = GIF;
})();
