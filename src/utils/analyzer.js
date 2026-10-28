import { isMediaMessage, isSystemMessage } from './parser.js';

const WEEKDAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

export function analyzeMessages(rawMessages) {
  if (!rawMessages || rawMessages.length === 0) {
    return null;
  }

  let totalTextMessages = 0;
  let totalMediaCount = 0;
  let totalChars = 0;

  const memberMap = new Map();
  const hourlyCount = new Array(24).fill(0);
  const weekdayCount = new Array(7).fill(0);
  const dailyCountMap = new Map();
  const wordFrequency = new Map();

  let earliestDate = null;
  let latestDate = null;

  for (const msg of rawMessages) {
    const { sender, year, month, day, hour, minute, text } = msg;

    if (isSystemMessage(text)) {
      continue;
    }

    const isMedia = isMediaMessage(text);
    const dateObj = new Date(year, month - 1, day, hour, minute);
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayOfWeek = dateObj.getDay();

    if (!earliestDate || dateObj < earliestDate) earliestDate = dateObj;
    if (!latestDate || dateObj > latestDate) latestDate = dateObj;

    // Track member stats
    if (!memberMap.has(sender)) {
      memberMap.set(sender, {
        sender,
        messageCount: 0,
        mediaCount: 0,
        charCount: 0,
        nightCount: 0, // 00:00 - 06:00
      });
    }
    const member = memberMap.get(sender);

    if (isMedia) {
      totalMediaCount++;
      member.mediaCount++;
    } else {
      totalTextMessages++;
      member.messageCount++;
      const cleaned = text.trim();
      const length = cleaned.replace(/\s+/g, '').length;
      totalChars += length;
      member.charCount += length;

      // Hourly & Weekday
      hourlyCount[hour]++;
      weekdayCount[dayOfWeek]++;

      // Daily
      dailyCountMap.set(dateStr, (dailyCountMap.get(dateStr) || 0) + 1);

      // Night owl check (00 to 05:59)
      if (hour >= 0 && hour < 6) {
        member.nightCount++;
      }

      // Keyword extraction (words of length >= 2, count hangul/laugh)
      const words = cleaned.match(/[가-힣]{2,}|[ㅋㅎ]{2,}/g);
      if (words) {
        for (const w of words) {
          if (w.length > 10) continue;
          wordFrequency.set(w, (wordFrequency.get(w) || 0) + 1);
        }
      }
    }
  }

  // Sort members by message count
  const members = Array.from(memberMap.values())
    .map(m => ({
      ...m,
      totalCount: m.messageCount + m.mediaCount,
      percentage: totalTextMessages > 0 ? Number(((m.messageCount / totalTextMessages) * 100).toFixed(1)) : 0,
      avgLength: m.messageCount > 0 ? Number((m.charCount / m.messageCount).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.messageCount - a.messageCount)
    .map((m, idx) => ({ ...m, rank: idx + 1 }));

  // Peak hour
  let peakHour = 0;
  let peakHourCount = 0;
  hourlyCount.forEach((count, h) => {
    if (count > peakHourCount) {
      peakHourCount = count;
      peakHour = h;
    }
  });

  // Daily timeline sorted
  const dailyTimeline = Array.from(dailyCountMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Most active day
  let mostActiveDay = { date: '-', count: 0 };
  dailyTimeline.forEach(d => {
    if (d.count > mostActiveDay.count) mostActiveDay = d;
  });

  // Top keywords
  const stopWords = new Set([
    '있어요', '있는', '있습니다', '하는', '하면', '하고', '그냥', '진짜', '너무',
    '저도', '제가', '저는', '네네', '해서', '근데', '오늘', '내일', '지금', '어제'
  ]);
  const topKeywords = Array.from(wordFrequency.entries())
    .filter(([w]) => !stopWords.has(w))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word, count]) => ({ word, count }));

  // Badges / Persona
  const talkKing = members[0] || null;
  const typerKing = [...members].sort((a, b) => b.charCount - a.charCount)[0] || null;
  const nightOwl = [...members].sort((a, b) => b.nightCount - a.nightCount)[0] || null;
  const mediaMaster = [...members].sort((a, b) => b.mediaCount - a.mediaCount)[0] || null;

  // Total days
  const totalDays = dailyTimeline.length;

  return {
    summary: {
      totalTextMessages,
      totalMediaCount,
      totalChars,
      totalMembers: members.length,
      totalDays,
      earliestDate: earliestDate ? earliestDate.toISOString().slice(0, 10) : '-',
      latestDate: latestDate ? latestDate.toISOString().slice(0, 10) : '-',
      peakHour: `${String(peakHour).padStart(2, '0')}:00 ~ ${String((peakHour + 1) % 24).padStart(2, '0')}:00`,
      peakHourCount,
      mostActiveDay,
      talkKing,
    },
    members,
    hourlyData: hourlyCount.map((count, h) => ({
      hour: `${h}시`,
      rawHour: h,
      count,
    })),
    weekdayData: ['월', '화', '수', '목', '금', '토', '일'].map((name, i) => {
      // WEEKDAYS: 0 is Sun, 1 is Mon...
      const weekdayIndex = (i + 1) % 7;
      return {
        day: name,
        count: weekdayCount[weekdayIndex],
      };
    }),
    dailyTimeline,
    topKeywords,
    badges: {
      talkKing,
      typerKing,
      nightOwl: nightOwl && nightOwl.nightCount > 0 ? nightOwl : null,
      mediaMaster: mediaMaster && mediaMaster.mediaCount > 0 ? mediaMaster : null,
    },
  };
}
