/**
 * KakaoTalk Chat Export Parser
 * Supports:
 * 1. Mobile Android/iOS (.txt, .eml)
 *    - 2024년 9월 2일 오전 12:15, 홍길동 : 메시지
 *    - 2024. 9. 2. 오전 12:15, 홍길동 : 메시지
 *    - 2024. 9. 2. 12:15, 홍길동 : 메시지
 * 2. Windows PC (.txt)
 *    - --------------- 2024년 9월 2일 월요일 ---------------
 *    - [홍길동] [오전 12:15] 메시지
 * 3. Mac (.txt)
 *    - 2024-09-02 12:15:30, 홍길동 : 메시지
 * 4. Multi-line message continuation
 */

const regexMobileKo = /^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(오전|오후)\s*(\d{1,2}):(\d{2}),\s*(.+?)\s*:\s*(.*)$/;
const regexMobileDot = /^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(?:(오전|오후)\s*)?(\d{1,2}):(\d{2}),\s*(.+?)\s*:\s*(.*)$/;
const regexIso = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2}),\s*(.+?)\s*:\s*(.*)$/;

// Date divider lines in PC / Mobile
const regexPcDivider = /^-{3,}\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*.*?---+$/;
const regexDotDivider = /^-{3,}\s*(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\..*?---+$/;
const regexStandAloneDate = /^\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일(?:\s+[월화수목금토일]요일)?\s*$/;

const regexPcMessage = /^\[(.+?)\]\s*\[(?:(오전|오후)\s*)?(\d{1,2}):(\d{2})\]\s*(.*)$/;

const mediaExact = new Set([
  '사진', '동영상', '이모티콘', '음성메시지', '지도', '파일', '보이스톡', '페이스톡', '연락처'
]);

function to24Hour(period, hour) {
  let h = parseInt(hour, 10);
  if (!period) return h;
  h = h % 12;
  return period === '오후' ? h + 12 : h;
}

export function isMediaMessage(text) {
  const trimmed = text.trim();
  if (mediaExact.has(trimmed)) return true;
  if (/^(사진|동영상|이모티콘|파일)\s*\d+[개장]$/.test(trimmed)) return true;
  return false;
}

export function isSystemMessage(text) {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (/^삭제된 메시지입니다\.?$/.test(trimmed)) return true;
  if (/운영정책을 위반하여 가려진 메시지입니다/.test(trimmed)) return true;
  if (/님이 (들어왔습니다|나갔습니다|초대되었습니다|나갔습니다\.)/.test(trimmed)) return true;
  return false;
}

export function parseKakaoText(rawContent) {
  const lines = rawContent.replace(/^\uFEFF/, '').split(/\r?\n/);
  const messages = [];
  let currentDate = null;
  let currentMsg = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Check PC / Export Date Divider
    // Must be surrounded by dashes or be a pure standalone date line, and must NOT contain colons or square brackets
    if (!line.includes(':') && !line.startsWith('[')) {
      const pcDivMatch = line.match(regexPcDivider) || line.match(regexDotDivider) || line.match(regexStandAloneDate);
      if (pcDivMatch) {
        currentDate = {
          year: parseInt(pcDivMatch[1], 10),
          month: parseInt(pcDivMatch[2], 10),
          day: parseInt(pcDivMatch[3], 10),
        };
        continue;
      }
    }

    // Try Mobile Ko format
    let match = line.match(regexMobileKo);
    if (match) {
      if (currentMsg) messages.push(currentMsg);
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const day = parseInt(match[3], 10);
      const hour = to24Hour(match[4], match[5]);
      const minute = parseInt(match[6], 10);
      const sender = match[7].trim();
      const text = match[8];

      currentDate = { year, month, day };
      currentMsg = {
        sender,
        year, month, day, hour, minute,
        text,
      };
      continue;
    }

    // Try Mobile Dot format
    match = line.match(regexMobileDot);
    if (match) {
      if (currentMsg) messages.push(currentMsg);
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const day = parseInt(match[3], 10);
      const hour = to24Hour(match[4], match[5]);
      const minute = parseInt(match[6], 10);
      const sender = match[7].trim();
      const text = match[8];

      currentDate = { year, month, day };
      currentMsg = {
        sender,
        year, month, day, hour, minute,
        text,
      };
      continue;
    }

    // Try ISO format (Mac)
    match = line.match(regexIso);
    if (match) {
      if (currentMsg) messages.push(currentMsg);
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const day = parseInt(match[3], 10);
      const hour = parseInt(match[4], 10);
      const minute = parseInt(match[5], 10);
      const sender = match[7].trim();
      const text = match[8];

      currentDate = { year, month, day };
      currentMsg = {
        sender,
        year, month, day, hour, minute,
        text,
      };
      continue;
    }

    // Try PC format
    match = line.match(regexPcMessage);
    if (match && currentDate) {
      if (currentMsg) messages.push(currentMsg);
      const sender = match[1].trim();
      const hour = to24Hour(match[2], match[3]);
      const minute = parseInt(match[4], 10);
      const text = match[5];

      currentMsg = {
        sender,
        year: currentDate.year,
        month: currentDate.month,
        day: currentDate.day,
        hour,
        minute,
        text,
      };
      continue;
    }

    // If no pattern matched and we have an ongoing message, it's a multi-line message continuation
    if (currentMsg) {
      currentMsg.text += '\n' + line;
    }
  }

  if (currentMsg) {
    messages.push(currentMsg);
  }

  return messages;
}
