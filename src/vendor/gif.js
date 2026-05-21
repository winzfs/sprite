/*
 * Local lightweight GIF encoder for Sprite Tool Studio.
 * Provides a gif.js-compatible subset used by src/media-converter.js:
 *   new GIF({ width, height, repeat })
 *   gif.addFrame(ctx, { delay })
 *   gif.on('finished', callback)
 *   gif.render()
 *
 * Notes:
 * - This encoder uses a fixed 256-color RGB 3-3-2 global palette.
 * - It is intentionally dependency-free for static hosting/offline use.
 * - The `quality`, `workers`, and `workerScript` options are accepted for API compatibility but ignored.
 */
(() => {
  class ByteWriter {
    constructor() {
      this.bytes = [];
    }

    byte(value) {
      this.bytes.push(value & 255);
    }

    bytesArray(values) {
      for (const value of values) this.byte(value);
    }

    ascii(text) {
      for (let i = 0; i < text.length; i += 1) this.byte(text.charCodeAt(i));
    }

    word(value) {
      this.byte(value & 255);
      this.byte((value >> 8) & 255);
    }

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

    blob(type) {
      return new Blob([new Uint8Array(this.bytes)], { type });
    }
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
      if (this.bitCount > 0) {
        this.bytes.push(this.current);
        this.current = 0;
        this.bitCount = 0;
      }
      return new Uint8Array(this.bytes);
    }
  }

  function makePalette() {
    const palette = [];
    for (let index = 0; index < 256; index += 1) {
      const r = Math.round(((index >> 5) & 7) * 255 / 7);
      const g = Math.round(((index >> 2) & 7) * 255 / 7);
      const b = Math.round((index & 3) * 255 / 3);
      palette.push(r, g, b);
    }
    return palette;
  }

  function rgbaToPaletteIndex(r, g, b, a) {
    if (a < 16) return 0;
    return ((r >> 5) << 5) | ((g >> 5) << 2) | (b >> 6);
  }

  function extractIndexedPixels(source, width, height) {
    let imageData;
    if (source && typeof source.getImageData === 'function') {
      imageData = source.getImageData(0, 0, width, height).data;
    } else if (source instanceof ImageData) {
      imageData = source.data;
    } else {
      throw new Error('GIF.addFrame은 CanvasRenderingContext2D 또는 ImageData를 필요로 합니다.');
    }

    const pixels = new Uint8Array(width * height);
    for (let i = 0, p = 0; i < imageData.length; i += 4, p += 1) {
      pixels[p] = rgbaToPaletteIndex(imageData[i], imageData[i + 1], imageData[i + 2], imageData[i + 3]);
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
        delay: Math.max(1, Math.round(delayMs / 10)),
        pixels: extractIndexedPixels(source, this.width, this.height),
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

      const writer = new ByteWriter();
      writer.ascii('GIF89a');
      writer.word(this.width);
      writer.word(this.height);
      writer.byte(0b11110111);
      writer.byte(0);
      writer.byte(0);
      writer.bytesArray(makePalette());

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
        writer.byte(0x21);
        writer.byte(0xf9);
        writer.byte(4);
        writer.byte(0);
        writer.word(frame.delay);
        writer.byte(0);
        writer.byte(0);

        writer.byte(0x2c);
        writer.word(0);
        writer.word(0);
        writer.word(this.width);
        writer.word(this.height);
        writer.byte(0);

        writer.byte(8);
        writer.subBlocks(lzwEncode(frame.pixels, 8));
      }

      writer.byte(0x3b);
      return writer.blob('image/gif');
    }
  }

  window.GIF = GIF;
})();
