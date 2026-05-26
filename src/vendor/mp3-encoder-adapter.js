(() => {
  const hasEncoder = () => !!window.lamejs && typeof window.lamejs.Mp3Encoder === 'function';

  function toInt16(float32) {
    const out = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i += 1) {
      const sample = Math.max(-1, Math.min(1, float32[i] || 0));
      out[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
    return out;
  }

  async function encode(buffer, bitrateKbps, onProgress) {
    if (!hasEncoder()) throw new Error('MP3 인코더가 로드되지 않았습니다.');

    const channels = Math.min(2, Math.max(1, buffer.numberOfChannels));
    const sampleRate = buffer.sampleRate;
    const bitrate = Math.max(32, Math.min(320, Math.round(bitrateKbps || 128)));
    const encoder = new window.lamejs.Mp3Encoder(channels, sampleRate, bitrate);
    const blockSize = 1152;
    const chunks = [];

    const left = toInt16(buffer.getChannelData(0));
    const right = channels > 1 ? toInt16(buffer.getChannelData(1)) : left;

    for (let offset = 0; offset < left.length; offset += blockSize) {
      const mp3 = channels === 1
        ? encoder.encodeBuffer(left.subarray(offset, offset + blockSize))
        : encoder.encodeBuffer(left.subarray(offset, offset + blockSize), right.subarray(offset, offset + blockSize));

      if (mp3.length > 0) chunks.push(mp3);
      if (onProgress) onProgress(Math.min(0.98, offset / left.length));
      if (offset % (blockSize * 24) === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const flush = encoder.flush();
    if (flush.length > 0) chunks.push(flush);
    if (onProgress) onProgress(1);
    return new Blob(chunks, { type: 'audio/mpeg' });
  }

  window.SpriteMp3Encoder = { isAvailable: hasEncoder, encode };
})();
