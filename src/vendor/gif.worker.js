/*
 * Placeholder worker file for local GIF encoder compatibility.
 * The local src/vendor/gif.js encoder is synchronous and does not use workers.
 * This file exists so paths like src/vendor/gif.worker.js remain valid if older code passes workerScript.
 */
self.onmessage = () => {
  self.postMessage({ error: 'This lightweight local GIF encoder does not use a worker.' });
};
