"""Extract text from an unencrypted Word 97–2003 DOC with regular streams.

Supports 512-byte sectors and up to 109 FAT sectors. Mini streams and encrypted
documents are rejected explicitly. No Word process or macros are executed.
"""
import struct
import sys
from pathlib import Path


def extract(path):
    data = Path(path).read_bytes()
    u32 = lambda buf, offset: struct.unpack_from('<I', buf, offset)[0]
    if data[:8] != bytes.fromhex('d0cf11e0a1b11ae1'):
        raise ValueError('Expected a binary Word DOC')
    size = 1 << struct.unpack_from('<H', data, 30)[0]
    if size != 512 or u32(data, 44) > 109:
        raise ValueError('Unsupported compound file sector layout')
    sector = lambda sid: data[(sid + 1) * size:(sid + 2) * size]
    fat_ids = struct.unpack_from('<109I', data, 76)[:u32(data, 44)]
    fat_bytes = b''.join(sector(sid) for sid in fat_ids)
    fat = struct.unpack('<%dI' % (len(fat_bytes) // 4), fat_bytes)

    def chain(sid):
        chunks, seen = [], set()
        while sid < 0xfffffffa:
            if sid in seen:
                raise ValueError('Invalid sector chain')
            seen.add(sid)
            chunks.append(sector(sid))
            sid = fat[sid]
        return b''.join(chunks)

    directory = chain(u32(data, 48))
    streams = {}
    for offset in range(0, len(directory), 128):
        entry = directory[offset:offset + 128]
        length = struct.unpack_from('<H', entry, 64)[0]
        name = entry[:max(0, length - 2)].decode('utf-16le')
        if name in ('WordDocument', '0Table', '1Table'):
            if u32(entry, 120) < u32(data, 56):
                raise ValueError('Mini streams are unsupported')
            streams[name] = chain(u32(entry, 116))[:u32(entry, 120)]
    word = streams['WordDocument']
    flags = struct.unpack_from('<H', word, 10)[0]
    if flags & 0x100:
        raise ValueError('Encrypted DOC is unsupported')
    table = streams['1Table' if flags & 0x200 else '0Table']
    clx = table[u32(word, 418):u32(word, 418) + u32(word, 422)]
    pos = 0
    while clx[pos] == 1:
        pos += 3 + struct.unpack_from('<H', clx, pos + 1)[0]
    if clx[pos] != 2:
        raise ValueError('Missing piece table')
    plc = clx[pos + 5:pos + 5 + u32(clx, pos + 1)]
    count = (len(plc) - 4) // 12
    cp = struct.unpack_from('<%dI' % (count + 1), plc)
    text = []
    for i in range(count):
        fc = u32(plc, 4 * (count + 1) + 8 * i + 2)
        compressed = bool(fc & 0x40000000)
        offset = (fc & 0x3fffffff) // (2 if compressed else 1)
        length = (cp[i + 1] - cp[i]) * (1 if compressed else 2)
        text.append(word[offset:offset + length].decode('cp1251' if compressed else 'utf-16le'))
    return ''.join(text)[:u32(word, 76)].replace('\r', '\n')


if __name__ == '__main__':
    Path(sys.argv[2]).write_text(extract(sys.argv[1]), encoding='utf-8')
