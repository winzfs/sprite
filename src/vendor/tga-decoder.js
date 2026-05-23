/*
 * Small local TGA decoder for Sprite Tool Studio.
 * Supports:
 * - Uncompressed true-color TGA: type 2, 16/24/32 bpp
 * - RLE true-color TGA: type 10, 16/24/32 bpp
 * - Uncompressed grayscale TGA: type 3, 8 bpp
 * - RLE grayscale TGA: type 11, 8 bpp
 *
 * Indexed/color-mapped TGA is not supported yet.
 */
(() => {
  function fail(message) {
    throw new Error(message);
  }

  function ensure(condition, message) {
    if (!condition) fail(message);
  }

  function readHeader(view) {
    ensure(view.byteLength >= 18, 'TGA 파일이 너무 짧습니다.');
    return {
      idLength: view.getUint8(0),
      colorMapType: view.getUint8(1),
      imageType: view.getUint8(2),
      colorMapFirst: view.getUint16(3, true),
      colorMapLength: view.getUint16(5, true),
      colorMapDepth: view.getUint8(7),
      xOrigin: view.getUint16(8, true),
      yOrigin: view.getUint16(10, true),
      width: view.getUint16(12, true),
      height: view.getUint16(14, true),
      pixelDepth: view.getUint8(16),
      descriptor: view.getUint8(17),
    };
  }

  function getBytesPerPixel(header) {
    if (header.imageType === 3 || header.imageType === 11) {
      ensure(header.pixelDepth === 8, '지원하지 않는 그레이스케일 TGA 비트 깊이입니다.');
      return 1;
    }

    if (header.imageType === 2 || header.imageType === 10) {
      ensure([16, 24, 32].includes(header.pixelDepth), '지원하지 않는 true-color TGA 비트 깊이입니다.');
      return header.pixelDepth / 8;
    }

    fail('지원하지 않는 TGA 이미지 타입입니다. 지원: 2, 3, 10, 11');
  }

  function decodePixel(bytes, offset, bpp, imageType) {
    if (imageType === 3 || imageType === 11) {
      const value = bytes[offset];
      return [value, value, value, 255];
    }

    if (bpp === 4) {
      return [bytes[offset + 2], bytes[offset + 1], bytes[offset], bytes[offset + 3]];
    }

    if (bpp === 3) {
      return [bytes[offset + 2], bytes[offset + 1], bytes[offset], 255];
    }

    const value = bytes[offset] | (bytes[offset + 1] << 8);
    const b = value & 0x1f;
    const g = (value >> 5) & 0x1f;
    const r = (value >> 10) & 0x1f;
    const alphaBits = value & 0x8000;
    return [
      Math.round((r * 255) / 31),
      Math.round((g * 255) / 31),
      Math.round((b * 255) / 31),
      alphaBits ? 255 : 255,
    ];
  }

  function getPixelDataOffset(header) {
    const colorMapBytes = header.colorMapType ? Math.ceil((header.colorMapLength * header.colorMapDepth) / 8) : 0;
    return 18 + header.idLength + colorMapBytes;
  }

  function mapOutputOffset(index, width, height, descriptor) {
    const x = index % width;
    const y = Math.floor(index / width);
    const originRight = (descriptor & 0x10) !== 0;
    const originTop = (descriptor & 0x20) !== 0;
    const outX = originRight ? width - 1 - x : x;
    const outY = originTop ? y : height - 1 - y;
    return (outY * width + outX) * 4;
  }

  function writeColor(output, outOffset, color) {
    output[outOffset] = color[0];
    output[outOffset + 1] = color[1];
    output[outOffset + 2] = color[2];
    output[outOffset + 3] = color[3];
  }

  function decodeRaw(bytes, header, start, bpp, output) {
    const total = header.width * header.height;
    let offset = start;

    for (let i = 0; i < total; i += 1) {
      ensure(offset + bpp <= bytes.length, 'TGA 픽셀 데이터가 부족합니다.');
      const color = decodePixel(bytes, offset, bpp, header.imageType);
      writeColor(output, mapOutputOffset(i, header.width, header.height, header.descriptor), color);
      offset += bpp;
    }
  }

  function decodeRle(bytes, header, start, bpp, output) {
    const total = header.width * header.height;
    let offset = start;
    let index = 0;

    while (index < total) {
      ensure(offset < bytes.length, 'TGA RLE 데이터가 부족합니다.');
      const packet = bytes[offset];
      offset += 1;
      const count = (packet & 0x7f) + 1;

      if ((packet & 0x80) !== 0) {
        ensure(offset + bpp <= bytes.length, 'TGA RLE 픽셀 데이터가 부족합니다.');
        const color = decodePixel(bytes, offset, bpp, header.imageType);
        offset += bpp;
        for (let i = 0; i < count && index < total; i += 1) {
          writeColor(output, mapOutputOffset(index, header.width, header.height, header.descriptor), color);
          index += 1;
        }
      } else {
        for (let i = 0; i < count && index < total; i += 1) {
          ensure(offset + bpp <= bytes.length, 'TGA RLE raw 픽셀 데이터가 부족합니다.');
          const color = decodePixel(bytes, offset, bpp, header.imageType);
          offset += bpp;
          writeColor(output, mapOutputOffset(index, header.width, header.height, header.descriptor), color);
          index += 1;
        }
      }
    }
  }

  function decodeTga(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    const bytes = new Uint8Array(arrayBuffer);
    const header = readHeader(view);

    ensure(header.width > 0 && header.height > 0, 'TGA 이미지 크기가 올바르지 않습니다.');
    ensure(header.colorMapType === 0, '색상맵/인덱스 TGA는 아직 지원하지 않습니다.');

    const bpp = getBytesPerPixel(header);
    const start = getPixelDataOffset(header);
    ensure(start < bytes.length, 'TGA 헤더/ID 영역이 파일 크기를 초과합니다.');

    const imageDataArray = new Uint8ClampedArray(header.width * header.height * 4);
    if (header.imageType === 10 || header.imageType === 11) {
      decodeRle(bytes, header, start, bpp, imageDataArray);
    } else {
      decodeRaw(bytes, header, start, bpp, imageDataArray);
    }

    return {
      width: header.width,
      height: header.height,
      header,
      imageData: new ImageData(imageDataArray, header.width, header.height),
    };
  }

  window.decodeTga = decodeTga;
})();
