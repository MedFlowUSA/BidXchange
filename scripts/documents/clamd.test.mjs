import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { clamdCommand, scanVerdict, validateScannerVersion } from './clamd.mjs';
test('only complete successful scanner responses can release a document', () => {
  assert.equal(scanVerdict('stream: OK'), 'clean');
  assert.equal(scanVerdict('stream: Test.Signature FOUND'), 'rejected');
  for (const response of [
    'OK',
    'stream: OK ERROR',
    'stream: size limit exceeded. ERROR',
    '',
    'stream: UNKNOWN',
  ])
    assert.throws(() => scanVerdict(response));
  assert.throws(() => validateScannerVersion('ClamAV 1.4.0/123/Jan 01 2020 00:00:00'));
  assert.throws(() => validateScannerVersion('unknown'));
  const now = Date.now();
  assert.match(
    validateScannerVersion(
      `ClamAV 1.4.0/123/${new Date(now).toUTCString().replace(' GMT', '')}`,
      now,
    ),
    /^ClamAV/,
  );
});
test('INSTREAM transmits exact bytes with bounded framing and receives split responses', async () => {
  const payload = Buffer.from('%PDF-1.7\nSynthetic contents\n%%EOF');
  let received = Buffer.alloc(0);
  const server = net.createServer((socket) => {
    socket.on('data', (chunk) => {
      received = Buffer.concat([received, chunk]);
      if (received.length >= 10 + 4 + payload.length + 4) {
        socket.write('stream: ');
        socket.end('OK\0');
      }
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    assert.equal(
      await clamdCommand('INSTREAM', payload, { port: server.address().port, timeout: 1000 }),
      'stream: OK',
    );
    assert.equal(received.subarray(0, 10).toString(), 'zINSTREAM\0');
    assert.equal(received.readUInt32BE(10), payload.length);
    assert.deepEqual(received.subarray(14, -4), payload);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
