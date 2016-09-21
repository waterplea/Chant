importScripts('../assets/lib/lame.min.js');

var mp3encoder = new lamejs.Mp3Encoder(2, 44100, 320);
var mp3Data = [];
var mp3buf, leftChunk, rightChunk, buffers;

onmessage = function (event) {
    buffers = event.data;

    var left = new Int16Array(buffers[0].length);
    var right = new Int16Array(buffers[0].length);
    for (var i = 0; i < buffers[0].length; i++) {
        var s = Math.max(-1, Math.min(1, buffers[0][i]));
        left[i] = (s < 0 ? s * 0x8000 : s * 0x7FFF);
        s = Math.max(-1, Math.min(1, buffers[1][i]));
        right[i] = (s < 0 ? s * 0x8000 : s * 0x7FFF);
    }

    var sampleBlockSize = 1152;

    for (i = 0; i < buffers[0].length; i += sampleBlockSize) {
        leftChunk = left.subarray(i, i + sampleBlockSize);
        rightChunk = right.subarray(i, i + sampleBlockSize);
        mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
        if (mp3buf.length > 0) {
            mp3Data.push(mp3buf);
        }

        postMessage({ finished: false, content: Math.floor(i / buffers[0].length * 100) });
    }

    mp3buf = mp3encoder.flush();

    if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
    }

    postMessage({ finished: true, content: mp3Data })
};