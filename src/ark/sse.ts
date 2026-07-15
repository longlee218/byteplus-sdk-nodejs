// Bộ giải mã Server-Sent Events cho Ark runtime streaming — port tối giản
// từ SSEDecoder của byteplussdkarkruntime (_streaming.py).

export interface ServerSentEvent {
  event: string | null;
  data: string;
}

/**
 * Đọc body HTTP dạng bytes và yield từng SSE event. Mỗi event kết thúc
 * bằng dòng trống; nhiều dòng `data:` được nối bằng `\n` theo spec SSE.
 */
export async function* iterServerSentEvents(
  body: AsyncIterable<Uint8Array>,
): AsyncGenerator<ServerSentEvent, void, undefined> {
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let event: string | null = null;
  let dataLines: string[] = [];

  const takeEvent = (): ServerSentEvent => {
    const sse = { event, data: dataLines.join('\n') };
    event = null;
    dataLines = [];
    return sse;
  };

  const consumeLine = (rawLine: string): ServerSentEvent | null => {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (line === '') {
      return event !== null || dataLines.length > 0 ? takeEvent() : null;
    }
    if (line.startsWith(':')) {
      return null;
    }
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) {
      value = value.slice(1);
    }
    if (field === 'event') {
      event = value;
    } else if (field === 'data') {
      dataLines.push(value);
    }
    return null;
  };

  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    let newlineAt = buffer.indexOf('\n');
    while (newlineAt !== -1) {
      const sse = consumeLine(buffer.slice(0, newlineAt));
      buffer = buffer.slice(newlineAt + 1);
      if (sse !== null) {
        yield sse;
      }
      newlineAt = buffer.indexOf('\n');
    }
  }

  buffer += decoder.decode();
  if (buffer !== '') {
    consumeLine(buffer);
  }
  if (event !== null || dataLines.length > 0) {
    yield takeEvent();
  }
}
