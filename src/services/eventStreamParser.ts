/** Server-Sent Events 的一個事件 */
export interface EventStreamMessage {
  /** 事件名稱；後端沒寫 event 欄位時為 message */
  event: string
  /** data 欄位；有多行時以換行串接 */
  data: string
}

/** Server-Sent Events 的解析器 */
export interface EventStreamParser {
  /** 依序餵入解碼後的文字片段 */
  push: (chunk: string) => void
  /** 串流結束時呼叫，收掉最後留著的換行 */
  end: () => void
}

/**
 * 建立 Server-Sent Events 的解析器：每湊滿一個事件（以空行結束）就交給 onMessage
 * @description 片段可能在任何位置切斷，沒結束的一行先留著等下一段。依 SSE 規格支援 \r\n、\n、\r 三種換行、多行 data 與 : 開頭的註解；
 * 沒有 data 的事件不送出，串流結束時沒以空行收尾的事件也捨棄
 * @param onMessage 每湊滿一個事件就呼叫
 * @returns 解析器
 */
export function createEventStreamParser(onMessage: (message: EventStreamMessage) => void): EventStreamParser {
  let buffer = ''
  let eventName = ''
  let dataLines: string[] = []

  /**
   * 處理一行；空行代表一個事件結束
   * @param line 不含換行的一行
   */
  function readLine(line: string) {
    if (line === '') {
      if (dataLines.length > 0) {
        onMessage({ event: eventName === '' ? 'message' : eventName, data: dataLines.join('\n') })
      }
      eventName = ''
      dataLines = []
      return
    }
    if (line.startsWith(':')) {
      return
    }

    const colonIndex = line.indexOf(':')
    const field = colonIndex === -1 ? line : line.slice(0, colonIndex)
    const value = colonIndex === -1 ? '' : line.slice(colonIndex + 1).replace(/^ /, '')
    if (field === 'event') {
      eventName = value
    }
    if (field === 'data') {
      dataLines.push(value)
    }
  }

  /**
   * 餵入一段文字，把其中完整的行交給 readLine
   * @param chunk 解碼後的文字片段
   */
  function push(chunk: string) {
    buffer += chunk
    // 結尾的 \r 可能是 \r\n 的前半，留到下一段再判斷，免得多切出一個空行而把事件拆成兩半
    const end = buffer.endsWith('\r') ? buffer.length - 1 : buffer.length
    const lines = buffer.slice(0, end).split(/\r\n|\r|\n/)
    buffer = (lines.pop() ?? '') + buffer.slice(end)
    lines.forEach((line) => readLine(line))
  }

  /** 串流結束：留著等下一段的 \r 當成行尾處理，其餘沒結束的一行捨棄 */
  function end() {
    if (buffer.endsWith('\r')) {
      readLine(buffer.slice(0, -1))
    }
    buffer = ''
  }

  return { push, end }
}
