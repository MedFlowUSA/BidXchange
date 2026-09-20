import net from 'node:net';
export async function clamdCommand(
  command,
  bytes,
  { host = '127.0.0.1', port = 3310, timeout = 30000 } = {},
) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    let response = Buffer.alloc(0),
      done = false;
    const finish = (error, value) => {
      if (done) return;
      done = true;
      socket.destroy();
      error ? reject(error) : resolve(value);
    };
    socket.setTimeout(timeout, () => finish(new Error('Scanner timeout')));
    socket.on('error', () => finish(new Error('Scanner unavailable')));
    socket.on('end', () => {
      if (!done) finish(new Error('Incomplete scanner response'));
    });
    socket.on('data', (chunk) => {
      response = Buffer.concat([response, chunk]);
      if (response.length > 4096) return finish(new Error('Invalid scanner response'));
      const end = response.indexOf(0);
      if (end >= 0) finish(null, response.subarray(0, end).toString('utf8').trim());
    });
    socket.on('connect', () => {
      socket.write(`z${command}\0`);
      if (bytes) {
        for (let offset = 0; offset < bytes.length; offset += 65536) {
          const chunk = bytes.subarray(offset, offset + 65536),
            length = Buffer.alloc(4);
          length.writeUInt32BE(chunk.length);
          socket.write(length);
          socket.write(chunk);
        }
        socket.write(Buffer.alloc(4));
      }
    });
  });
}
export function validateScannerVersion(version, now = Date.now()) {
  const match = /^ClamAV [^/]+\/\d+\/(.+)$/.exec(version);
  const date = match ? Date.parse(match[1] + ' UTC') : NaN;
  if (!Number.isFinite(date) || date > now + 300000 || now - date > 48 * 60 * 60 * 1000)
    throw new Error('Scanner signatures are missing or stale');
  return version;
}
export function scanVerdict(response) {
  if (response === 'stream: OK') return 'clean';
  if (/^stream: .+ FOUND$/.test(response)) return 'rejected';
  throw new Error('Scanner did not complete successfully');
}
export async function scanBytes(bytes, options) {
  if (!bytes.length || bytes.length > 2097152) throw new Error('Scan size invalid');
  const engine = validateScannerVersion(await clamdCommand('VERSION', undefined, options));
  return { verdict: scanVerdict(await clamdCommand('INSTREAM', bytes, options)), engine };
}
