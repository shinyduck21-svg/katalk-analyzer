import React, { useState, useMemo } from 'react';
import {
  MessageSquare,
  Users,
  Clock,
  Award,
  Upload,
  FileText,
  ShieldCheck,
  Sparkles,
  BarChart2,
  Calendar,
  Share2,
  Check,
  Search,
  Moon,
  Camera,
  Flame,
  ArrowLeft,
  ChevronRight,
  Info,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Minus,
  Plus
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { parseKakaoText } from './utils/parser.js';
import { analyzeMessages } from './utils/analyzer.js';
import { SAMPLE_CHAT } from './utils/sampleData.js';

const COLORS = ['#3182F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'];

export default function App() {
  const [allMessages, setAllMessages] = useState(null);
  const [fileName, setFileName] = useState('');
  const [fileMinDate, setFileMinDate] = useState('');
  const [fileMaxDate, setFileMaxDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [preset, setPreset] = useState('all'); // 'all' | '7days' | '30days' | 'thisMonth' | 'custom'

  // Challenge Rule settings (하루 3마디 * 2배 = 하루 6개)
  const [dailyComments, setDailyComments] = useState(3); // 하루 3마디
  const [multiplier, setMultiplier] = useState(2); // 2배
  const [targetDaysMode, setTargetDaysMode] = useState('monthActual'); // 'monthActual' (해당 월 실제 일수: 10월은 31일 등) | 'month30' (30일 고정 180개) | 'selection' | 'custom'
  const [customGoal, setCustomGoal] = useState(180);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pass' | 'fail'

  const [activeTab, setActiveTab] = useState('ranking'); // 'ranking' | 'time' | 'timeline' | 'badges'
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('messageCount'); // 'messageCount' | 'charCount' | 'mediaCount'
  const [copied, setCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);

  // Compute date bounds and parse
  const processFileContent = (content, name) => {
    setLoading(true);
    setTimeout(() => {
      try {
        const parsed = parseKakaoText(content);
        if (parsed.length === 0) {
          alert('카카오톡 대화 내용을 찾지 못했습니다. 카카오톡 대화 내보내기 파일(.txt 또는 .eml)인지 확인해 주세요.');
          setLoading(false);
          return;
        }

        let minD = null;
        let maxD = null;
        for (const msg of parsed) {
          const dStr = `${msg.year}-${String(msg.month).padStart(2, '0')}-${String(msg.day).padStart(2, '0')}`;
          if (!minD || dStr < minD) minD = dStr;
          if (!maxD || dStr > maxD) maxD = dStr;
        }

        setAllMessages(parsed);
        setFileName(name);
        setFileMinDate(minD || '');
        setFileMaxDate(maxD || '');
        setStartDate(minD || '');
        setEndDate(maxD || '');
        setPreset('all');
      } catch (err) {
        console.error(err);
        alert('파일을 분석하는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    }, 50);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      processFileContent(event.target.result, file.name);
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      processFileContent(event.target.result, file.name);
    };
    reader.readAsText(file, 'utf-8');
  };

  const loadSample = () => {
    processFileContent(SAMPLE_CHAT, '샘플_챌린지_대화방.txt');
  };

  // Preset Date handler
  const handlePresetChange = (selectedPreset) => {
    setPreset(selectedPreset);
    if (!fileMaxDate) return;

    if (selectedPreset === 'all') {
      setStartDate(fileMinDate);
      setEndDate(fileMaxDate);
      return;
    }

    const maxD = new Date(fileMaxDate);
    if (selectedPreset === '7days') {
      const s = new Date(maxD);
      s.setDate(s.getDate() - 6);
      const sStr = s.toISOString().slice(0, 10);
      setStartDate(sStr < fileMinDate ? fileMinDate : sStr);
      setEndDate(fileMaxDate);
    } else if (selectedPreset === '30days') {
      const s = new Date(maxD);
      s.setDate(s.getDate() - 29);
      const sStr = s.toISOString().slice(0, 10);
      setStartDate(sStr < fileMinDate ? fileMinDate : sStr);
      setEndDate(fileMaxDate);
    } else if (selectedPreset === 'thisMonth') {
      const sStr = `${fileMaxDate.slice(0, 7)}-01`;
      setStartDate(sStr < fileMinDate ? fileMinDate : sStr);
      setEndDate(fileMaxDate);
    }
  };

  // Filter messages by selected date range
  const filteredMessages = useMemo(() => {
    if (!allMessages) return [];
    return allMessages.filter(msg => {
      const dStr = `${msg.year}-${String(msg.month).padStart(2, '0')}-${String(msg.day).padStart(2, '0')}`;
      if (startDate && dStr < startDate) return false;
      if (endDate && dStr > endDate) return false;
      return true;
    });
  }, [allMessages, startDate, endDate]);

  // Analyze filtered messages dynamically
  const data = useMemo(() => {
    if (!filteredMessages || filteredMessages.length === 0) return null;
    return analyzeMessages(filteredMessages);
  }, [filteredMessages]);

  // Target Goal Calculation based on rule (하루 3마디 * 2배 = 하루 6개)
  // 해당 월의 실제 일수 (10월: 31일, 9월/11월: 30일, 2월: 28/29일)
  const currentMonthInfo = useMemo(() => {
    if (!endDate) return { year: 2026, month: 10, daysInMonth: 31 };
    const parts = endDate.split('-');
    const year = parseInt(parts[0], 10) || 2026;
    const month = parseInt(parts[1], 10) || 10;
    const daysInMonth = new Date(year, month, 0).getDate();
    return { year, month, daysInMonth };
  }, [endDate]);

  const targetDays = useMemo(() => {
    if (targetDaysMode === 'monthActual') return currentMonthInfo.daysInMonth;
    if (targetDaysMode === 'month30') return 30;
    return data?.summary?.totalDays || currentMonthInfo.daysInMonth;
  }, [targetDaysMode, currentMonthInfo, data]);

  const targetGoal = useMemo(() => {
    if (targetDaysMode === 'custom') return customGoal;
    // 하루 3마디 * 2배 * 일수 (예: 10월 31일 * 3 * 2 = 186개)
    return targetDays * dailyComments * multiplier;
  }, [targetDaysMode, targetDays, dailyComments, multiplier, customGoal]);

  // Count passed / failed members
  const passedMembers = useMemo(() => {
    return data?.members?.filter(m => m.messageCount >= targetGoal) || [];
  }, [data, targetGoal]);

  const failedMembers = useMemo(() => {
    return data?.members?.filter(m => m.messageCount < targetGoal) || [];
  }, [data, targetGoal]);

  const copyReport = () => {
    if (!data) return;
    const top3 = data.members.slice(0, 3).map((m, i) => `${i + 1}위: ${m.sender} (${m.messageCount.toLocaleString()}개, ${m.percentage}%)`).join('\n');
    
    const failedList = failedMembers.length > 0
      ? failedMembers.map((m, idx) => ` ${idx + 1}. ${m.sender}: ${m.messageCount}개 (부족 -${targetGoal - m.messageCount}개)`).join('\n')
      : ' (탈락 위기자 없음! 전원 달성 🎉)';

    const text = `📊 [카톡 대화방 챌린지 점검 리포트]
📅 분석 기간: ${startDate} ~ ${endDate} (${data.summary.totalDays}일간)
💬 총 대화수: ${data.summary.totalTextMessages.toLocaleString()}개 (사진/미디어 ${data.summary.totalMediaCount.toLocaleString()}개)
👥 참여 멤버: ${data.summary.totalMembers}명
⏰ 피크 시간: ${data.summary.peakHour}

🎯 [챌린지 탈락 기준]
규칙: 하루 ${dailyComments}마디 × ${multiplier}배 (하루 ${dailyComments * multiplier}개) × ${targetDays}일 = 최소 ${targetGoal}개 이상 대화 필수
✅ 통과(생존): ${passedMembers.length}명
🚨 미달(탈락 위기): ${failedMembers.length}명

🚨 [탈락 위기 멤버 목록 (${failedMembers.length}명)]
${failedList}

🏆 [대화 수다왕 TOP 3]
${top3}

분석기: Katalk Analyzer`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredMembers = (data?.members || [])
    .filter(m => m.sender.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter(m => {
      if (statusFilter === 'pass') return m.messageCount >= targetGoal;
      if (statusFilter === 'fail') return m.messageCount < targetGoal;
      return true;
    })
    .sort((a, b) => b[sortBy] - a[sortBy]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#191F28] flex flex-col font-sans">
      {/* Navigation */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 flex items-center justify-center shadow-sm">
              <MessageSquare className="w-5 h-5 text-amber-950 fill-amber-950" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight">Katalk Analyzer</span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                .txt & .eml
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>100% 브라우저 로컬 분석 (서버 전송 없음)</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        {!allMessages ? (
          /* Empty / Upload View */
          <div className="max-w-2xl mx-auto mt-6">
            <div className="text-center mb-8">
              <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight">
                우리 단톡방에서<br />
                <span className="text-blue-600">누가 가장 말을 많이 했을까?</span>
              </h1>
              <p className="mt-3 text-base text-gray-500">
                카카오톡 대화 내보내기 파일(<code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded font-mono text-sm">.txt</code>, <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded font-mono text-sm">.eml</code>)을 올려보세요.<br />
                원하는 기간 필터와 <strong>챌린지 탈락 기준(하루 3마디 × 2배, 해당 월 일수 자동 계산)</strong>을 실시간으로 판정해 드립니다.
              </p>
            </div>

            {/* Dropzone Card */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-3xl p-10 text-center transition-all duration-200 bg-white ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/50 scale-[1.01]'
                  : 'border-gray-200 hover:border-gray-300 shadow-sm'
              }`}
            >
              <input
                type="file"
                id="file-upload"
                accept=".txt,.eml"
                onChange={handleFileUpload}
                className="hidden"
              />

              <div className="w-16 h-16 mx-auto rounded-3xl bg-blue-50 flex items-center justify-center text-blue-600 mb-4">
                <Upload className="w-8 h-8" />
              </div>

              <h3 className="text-lg font-bold text-gray-800">
                대화 내보내기 파일(.txt, .eml)을 끌어다 놓으세요
              </h3>
              <p className="text-sm text-gray-400 mt-1 mb-6">
                모바일 카카오톡 메일 내보내기(.eml)와 PC 버전(.txt) 모두 지원합니다
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <label
                  htmlFor="file-upload"
                  className="w-full sm:w-auto px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-2xl cursor-pointer shadow-md shadow-blue-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  파일 선택하기
                </label>
                <button
                  onClick={loadSample}
                  className="w-full sm:w-auto px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm rounded-2xl cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  샘플 데이터로 둘러보기
                </button>
              </div>

              {loading && (
                <div className="absolute inset-0 bg-white/90 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center z-10">
                  <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                  <p className="font-bold text-gray-800">대화 내용을 정밀 분석하고 있습니다...</p>
                </div>
              )}
            </div>

            {/* Privacy notice banner */}
            <div className="mt-6 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-start gap-3">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="text-xs text-gray-500 leading-relaxed">
                <strong className="text-gray-800 font-semibold">완전한 개인정보 안심 보장</strong><br />
                선택하신 대화 파일은 외부 서버로 절대 전송되지 않으며, 방문자의 웹 브라우저 메모리 안에서만 즉시 계산되고 창을닫으면 완전히 소멸합니다.
              </div>
            </div>

            {/* How to export guide */}
            <div className="mt-8 p-6 rounded-3xl bg-white border border-gray-100 shadow-sm">
              <h4 className="font-bold text-sm text-gray-900 mb-3 flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-600" />
                카카오톡 대화 내용 내보내는 방법
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-600">
                <div className="p-3.5 rounded-2xl bg-gray-50">
                  <span className="font-bold text-gray-800 block mb-1">📱 모바일 (스마트폰)</span>
                  채팅방 우측 상단 메뉴(≡) &gt; 하단 설정(⚙️) &gt; <strong className="text-blue-600">대화 내용 내보내기</strong> &gt; '텍스트만 보내기' 또는 '이메일' 선택
                </div>
                <div className="p-3.5 rounded-2xl bg-gray-50">
                  <span className="font-bold text-gray-800 block mb-1">💻 PC 카카오톡</span>
                  채팅방 우측 상단 메뉴(≡) &gt; <strong className="text-blue-600">대화 내용 &gt; 대화 내보내기</strong> &gt; 원하는 폴더에 .txt 파일 저장
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Dashboard View */
          <div className="space-y-6">
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setAllMessages(null)}
                  className="p-2.5 rounded-2xl hover:bg-gray-100 text-gray-600 transition-colors"
                  title="다른 파일 분석하기"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-lg font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                    {fileName}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    전체 대화 기록: {fileMinDate} ~ {fileMaxDate}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={copyReport}
                  disabled={!data}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-2xl bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
                  {copied ? '리포트 복사됨!' : '요약 리포트 복사'}
                </button>
                <button
                  onClick={() => setAllMessages(null)}
                  className="px-4 py-2.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs transition-colors"
                >
                  새 파일 분석
                </button>
              </div>
            </div>

            {/* 🗓️ Period Filter Card (기간 선택 바) */}
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-gray-900">분석 기간 설정</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                      {filteredMessages.length.toLocaleString()}개 메시지 선택됨
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    원하는 기간만 선택하면 랭킹과 챌린지 탈락 여부가 즉시 다시 계산됩니다.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                {/* Presets */}
                <div className="flex items-center bg-gray-100/80 p-1 rounded-2xl">
                  <button
                    onClick={() => handlePresetChange('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      preset === 'all'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    전체
                  </button>
                  <button
                    onClick={() => handlePresetChange('7days')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      preset === '7days'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    최근 7일
                  </button>
                  <button
                    onClick={() => handlePresetChange('30days')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      preset === '30days'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    최근 30일
                  </button>
                  <button
                    onClick={() => handlePresetChange('thisMonth')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      preset === 'thisMonth'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    해당 월
                  </button>
                </div>

                {/* Custom Date Pickers */}
                <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-2xl border border-gray-200 text-xs">
                  <input
                    type="date"
                    value={startDate}
                    min={fileMinDate}
                    max={endDate || fileMaxDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setPreset('custom');
                    }}
                    className="bg-transparent text-xs text-gray-800 font-bold focus:outline-none cursor-pointer"
                  />
                  <span className="text-gray-400 font-bold">~</span>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate || fileMinDate}
                    max={fileMaxDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setPreset('custom');
                    }}
                    className="bg-transparent text-xs text-gray-800 font-bold focus:outline-none cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* If no data in selected date range */}
            {!data ? (
              <div className="bg-white p-12 rounded-3xl border border-gray-100 shadow-sm text-center">
                <div className="w-14 h-14 mx-auto rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl mb-3">
                  ⚠️
                </div>
                <h3 className="font-extrabold text-gray-900 text-base">선택한 기간에는 대화 내역이 없습니다</h3>
                <p className="text-xs text-gray-400 mt-1 mb-5">
                  선택하신 기간({startDate} ~ {endDate}) 사이에 오간 메시지가 없습니다.<br />
                  시작일과 종료일을 조정하거나 '전체' 버튼을 눌러보세요.
                </p>
                <button
                  onClick={() => handlePresetChange('all')}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  전체 기간으로 초기화
                </button>
              </div>
            ) : (
              <>
                {/* 🎯 Challenge Survival / Elimination KPI Card */}
                <div className="bg-gradient-to-r from-white via-white to-gray-50/50 p-6 rounded-3xl border border-gray-100 shadow-sm">
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                        <Award className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-extrabold text-gray-900">챌린지 규칙 판정 현황</h3>
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            {targetDaysMode === 'monthActual' ? `${currentMonthInfo.month}월(${targetDays}일) 기준 ${targetGoal}개` : `${targetDays}일 기준 ${targetGoal}개`}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          기준: <strong>하루 {dailyComments}마디 × {multiplier}배 (하루 {dailyComments * multiplier}개) × {targetDays}일 = 최소 {targetGoal}개 이상</strong> 대화 달성 시 생존!
                        </p>
                      </div>
                    </div>

                    {/* Rule adjustment controls */}
                    <div className="flex flex-wrap items-center gap-2 bg-gray-50 p-2 rounded-2xl border border-gray-200 text-xs">
                      <div className="flex items-center gap-1.5 pl-1">
                        <span className="font-bold text-gray-600">기준 일수:</span>
                        <select
                          value={targetDaysMode}
                          onChange={(e) => setTargetDaysMode(e.target.value)}
                          className="bg-white border border-gray-200 rounded-xl px-2.5 py-1 font-semibold text-gray-800 text-xs focus:outline-none cursor-pointer"
                        >
                          <option value="monthActual">{currentMonthInfo.month}월 실제 일수 ({currentMonthInfo.daysInMonth}일 기준, {currentMonthInfo.daysInMonth * dailyComments * multiplier}개)</option>
                          <option value="month30">30일 고정 (180개)</option>
                          <option value="selection">선택 기간 ({data?.summary?.totalDays || 30}일)</option>
                          <option value="custom">직접 목표 입력</option>
                        </select>
                      </div>

                      {targetDaysMode === 'custom' ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={customGoal}
                            onChange={(e) => setCustomGoal(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="w-16 px-2 py-1 bg-white border border-gray-200 rounded-xl font-bold text-center text-xs"
                          />
                          <span className="font-bold text-gray-600">개</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 pl-2 border-l border-gray-200">
                          <span className="text-sm font-black text-blue-600 px-1">
                            목표: {targetGoal}개
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Summary Progress Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
                    {/* Passed count card */}
                    <button
                      onClick={() => setStatusFilter(statusFilter === 'pass' ? 'all' : 'pass')}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        statusFilter === 'pass'
                          ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20'
                          : 'bg-emerald-50/40 border-emerald-100 hover:bg-emerald-50/70'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          생존 확정 (목표 {targetGoal}개 달성)
                        </span>
                        <span className="text-xs font-semibold text-emerald-600 bg-white px-2 py-0.5 rounded-full border border-emerald-200">
                          {data.summary.totalMembers > 0 ? Math.round((passedMembers.length / data.summary.totalMembers) * 100) : 0}%
                        </span>
                      </div>
                      <div className="text-2xl font-black text-emerald-900 mt-2">
                        {passedMembers.length}
                        <span className="text-xs font-medium text-emerald-700 ml-1">명 통과</span>
                      </div>
                      <div className="text-[11px] text-emerald-600 mt-1">
                        클릭하여 생존 멤버만 필터링
                      </div>
                    </button>

                    {/* Failed count card */}
                    <button
                      onClick={() => setStatusFilter(statusFilter === 'fail' ? 'all' : 'fail')}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        statusFilter === 'fail'
                          ? 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-500/20'
                          : 'bg-rose-50/40 border-rose-100 hover:bg-rose-50/70'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-rose-600" />
                          탈락 위기 (미달)
                        </span>
                        <span className="text-xs font-semibold text-rose-600 bg-white px-2 py-0.5 rounded-full border border-rose-200">
                          {failedMembers.length}명
                        </span>
                      </div>
                      <div className="text-2xl font-black text-rose-900 mt-2">
                        {failedMembers.length}
                        <span className="text-xs font-medium text-rose-700 ml-1">명 미달</span>
                      </div>
                      <div className="text-[11px] text-rose-600 mt-1">
                        클릭하여 탈락 대상자만 모아보기
                      </div>
                    </button>
                  </div>
                </div>

                {/* 4 Key Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div className="text-xs font-semibold text-gray-400">총 텍스트 대화</div>
                    <div className="text-2xl font-black text-gray-900 mt-1">
                      {data.summary.totalTextMessages.toLocaleString()}
                      <span className="text-xs font-medium text-gray-400 ml-1">개</span>
                    </div>
                    <div className="text-[11px] text-gray-400 mt-1">
                      사진/미디어 {data.summary.totalMediaCount.toLocaleString()}개 별도
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="text-xs font-semibold text-gray-400">참여 멤버</div>
                    <div className="text-2xl font-black text-gray-900 mt-1">
                      {data.summary.totalMembers}
                      <span className="text-xs font-medium text-gray-400 ml-1">명</span>
                    </div>
                    <div className="text-[11px] text-gray-400 mt-1">
                      총 {data.summary.totalChars.toLocaleString()}자 대화
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
                    <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
                      <Award className="w-5 h-5" />
                    </div>
                    <div className="text-xs font-semibold text-gray-400">수다왕 1위</div>
                    <div className="text-lg font-black text-gray-900 mt-1 truncate" title={data.summary.talkKing?.sender}>
                      {data.summary.talkKing?.sender || '-'}
                    </div>
                    <div className="text-[11px] text-amber-600 font-semibold mt-1">
                      지분율 {data.summary.talkKing?.percentage}% ({data.summary.talkKing?.messageCount.toLocaleString()}개)
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
                    <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div className="text-xs font-semibold text-gray-400">피크 대화 시간대</div>
                    <div className="text-lg font-black text-gray-900 mt-1">
                      {data.summary.peakHour}
                    </div>
                    <div className="text-[11px] text-purple-600 font-semibold mt-1">
                      해당 시간에 {data.summary.peakHourCount.toLocaleString()}개 발송
                    </div>
                  </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex items-center gap-2 p-1.5 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
                  <button
                    onClick={() => setActiveTab('ranking')}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                      activeTab === 'ranking'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    🏆 참여자 랭킹 및 생존 현황
                  </button>
                  <button
                    onClick={() => setActiveTab('time')}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                      activeTab === 'time'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    ⏰ 시간대 & 요일 분석
                  </button>
                  <button
                    onClick={() => setActiveTab('timeline')}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                      activeTab === 'timeline'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    📈 일자별 추이
                  </button>
                  <button
                    onClick={() => setActiveTab('badges')}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                      activeTab === 'badges'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    🎖️ 멤버별 캐릭터 뱃지
                  </button>
                </div>

                {/* Tab 1: Ranking */}
                {activeTab === 'ranking' && (
                  <div className="space-y-6">
                    {/* Top 5 Share Pie Chart & Summary Card */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="md:col-span-1 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center justify-center">
                        <h3 className="font-bold text-sm text-gray-800 self-start mb-2">상위 발언자 대화 지분</h3>
                        <div className="w-full h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={data.members.slice(0, 5)}
                                dataKey="messageCount"
                                nameKey="sender"
                                cx="50%"
                                cy="50%"
                                innerRadius={45}
                                outerRadius={75}
                                paddingAngle={3}
                              >
                                {data.members.slice(0, 5).map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(value, name) => [`${value.toLocaleString()}개`, name]}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="w-full flex flex-wrap gap-2 justify-center mt-2">
                          {data.members.slice(0, 5).map((m, i) => (
                            <div key={m.sender} className="flex items-center gap-1.5 text-[11px] text-gray-600">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                              <span className="truncate max-w-[80px]">{m.sender}</span>
                              <span className="font-bold">{m.percentage}%</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* List Controls & Table */}
                      <div className="md:col-span-2 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
                        <div>
                          {/* Search & Status Filters */}
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
                            <div className="relative flex-1">
                              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                placeholder="멤버 닉네임 검색..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                              />
                            </div>

                            {/* Status filter toggle */}
                            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
                              <button
                                onClick={() => setStatusFilter('all')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                  statusFilter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                                }`}
                              >
                                전체 ({data.members.length})
                              </button>
                              <button
                                onClick={() => setStatusFilter('pass')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                  statusFilter === 'pass' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-700 hover:text-emerald-900'
                                }`}
                              >
                                ✅ 생존 ({passedMembers.length})
                              </button>
                              <button
                                onClick={() => setStatusFilter('fail')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                  statusFilter === 'fail' ? 'bg-rose-600 text-white shadow-sm' : 'text-rose-700 hover:text-rose-900'
                                }`}
                              >
                                🚨 탈락 위기 ({failedMembers.length})
                              </button>
                            </div>
                          </div>

                          {/* Sorting row */}
                          <div className="flex items-center justify-between gap-1.5 pb-3 border-b border-gray-100 mb-3 text-xs">
                            <span className="text-gray-400">
                              {statusFilter === 'fail'
                                ? `🚨 목표(${targetGoal}개) 미달자 목록`
                                : statusFilter === 'pass'
                                ? `✅ 목표(${targetGoal}개) 달성자 목록`
                                : '전체 참가자 목록'}
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="text-gray-400 mr-1">정렬:</span>
                              <button
                                onClick={() => setSortBy('messageCount')}
                                className={`px-2.5 py-1 rounded-lg font-semibold ${
                                  sortBy === 'messageCount' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                메시지 수
                              </button>
                              <button
                                onClick={() => setSortBy('charCount')}
                                className={`px-2.5 py-1 rounded-lg font-semibold ${
                                  sortBy === 'charCount' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                글자 수
                              </button>
                              <button
                                onClick={() => setSortBy('mediaCount')}
                                className={`px-2.5 py-1 rounded-lg font-semibold ${
                                  sortBy === 'mediaCount' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                사진/미디어
                              </button>
                            </div>
                          </div>

                          {/* Member list */}
                          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                            {filteredMembers.map((member) => {
                              const isPassed = member.messageCount >= targetGoal;
                              const diff = member.messageCount - targetGoal;
                              const progressPct = Math.min(100, Math.round((member.messageCount / targetGoal) * 100));

                              return (
                                <div
                                  key={member.sender}
                                  className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                                    isPassed
                                      ? 'bg-gray-50/70 border-gray-100 hover:bg-gray-50'
                                      : 'bg-rose-50/30 border-rose-100 hover:bg-rose-50/60'
                                  }`}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <span
                                      className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                                        member.rank === 1
                                          ? 'bg-amber-100 text-amber-800'
                                          : member.rank === 2
                                          ? 'bg-gray-200 text-gray-700'
                                          : member.rank === 3
                                          ? 'bg-amber-50 text-amber-700'
                                          : 'bg-white text-gray-500 border border-gray-200'
                                      }`}
                                    >
                                      {member.rank === 1 ? '🥇' : member.rank === 2 ? '🥈' : member.rank === 3 ? '🥉' : member.rank}
                                    </span>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold text-sm text-gray-900 truncate">
                                          {member.sender}
                                        </span>
                                        {/* Status badge */}
                                        {isPassed ? (
                                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 shrink-0">
                                            ✅ 통과 (+{diff}개)
                                          </span>
                                        ) : (
                                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 shrink-0 animate-pulse">
                                            🚨 탈락 위기 (-{Math.abs(diff)}개)
                                          </span>
                                        )}
                                      </div>
                                      
                                      {/* Goal progress bar */}
                                      <div className="w-36 bg-gray-200 h-1.5 rounded-full overflow-hidden mt-1.5 flex">
                                        <div
                                          className={`h-full rounded-full transition-all ${
                                            isPassed ? 'bg-emerald-500' : 'bg-rose-500'
                                          }`}
                                          style={{ width: `${progressPct}%` }}
                                        ></div>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="text-right shrink-0">
                                    <div className="text-sm font-black text-gray-900">
                                      {member.messageCount.toLocaleString()}
                                      <span className="text-xs font-normal text-gray-400 ml-1">/ {targetGoal}개</span>
                                    </div>
                                    <div className="text-[11px] text-gray-400 mt-0.5">
                                      달성률 {progressPct}% · 사진 {member.mediaCount}개
                                    </div>
                                  </div>
                                </div>
                              );
                            })}

                            {filteredMembers.length === 0 && (
                              <div className="text-center py-8 text-gray-400 text-xs">
                                조건에 일치하는 멤버가 없습니다.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 2: Time & Weekday */}
                {activeTab === 'time' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Hourly Chart */}
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                      <h3 className="font-bold text-sm text-gray-800 mb-1">24시간 시간대별 대화량</h3>
                      <p className="text-xs text-gray-400 mb-5">어느 시간대에 대화가 가장 활발하게 오갔을까요?</p>
                      <div className="w-full h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={data.hourlyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                            <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={2} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip formatter={(value) => [`${value.toLocaleString()}개`, '메시지 수']} />
                            <Bar dataKey="count" fill="#3182F6" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-4 p-3 rounded-2xl bg-blue-50 text-xs text-blue-700 font-medium text-center">
                        🔥 <strong>{data.summary.peakHour}</strong>에 대화가 가장 많이 몰렸습니다!
                      </div>
                    </div>

                    {/* Weekday Chart */}
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                      <h3 className="font-bold text-sm text-gray-800 mb-1">요일별 대화량 분포</h3>
                      <p className="text-xs text-gray-400 mb-5">주중과 주말 중 언제 채팅방이 핫했을까요?</p>
                      <div className="w-full h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={data.weekdayData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                            <XAxis dataKey="day" tick={{ fontSize: 12, fontWeight: 'bold' }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip formatter={(value) => [`${value.toLocaleString()}개`, '메시지 수']} />
                            <Bar dataKey="count" fill="#10B981" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-4 p-3 rounded-2xl bg-emerald-50 text-xs text-emerald-700 font-medium text-center">
                        📊 요일별 평균 대화량을 한눈에 비교할 수 있습니다.
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 3: Timeline */}
                {activeTab === 'timeline' && (
                  <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-6">
                      <div>
                        <h3 className="font-bold text-base text-gray-800">일자별 대화량 타임라인</h3>
                        <p className="text-xs text-gray-400">대화방이 가장 뜨겁게 불타올랐던 날을 찾아보세요.</p>
                      </div>
                      <div className="px-3.5 py-1.5 rounded-xl bg-amber-50 text-amber-800 text-xs font-semibold">
                        가장 활발했던 날: <strong>{data.summary.mostActiveDay.date}</strong> ({data.summary.mostActiveDay.count.toLocaleString()}개)
                      </div>
                    </div>

                    <div className="w-full h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data.dailyTimeline} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3182F6" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="#3182F6" stopOpacity={0.0}/>
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(value) => [`${value.toLocaleString()}개`, '메시지']} />
                          <Area type="monotone" dataKey="count" stroke="#3182F6" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Tab 4: Badges & Keywords */}
                {activeTab === 'badges' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Badge 1 */}
                      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm text-center">
                        <div className="w-14 h-14 mx-auto rounded-3xl bg-amber-100 text-amber-600 flex items-center justify-center text-2xl mb-4">
                          👑
                        </div>
                        <span className="text-xs font-bold text-amber-600 uppercase tracking-wider block mb-1">대화방 수다왕</span>
                        <h4 className="text-base font-extrabold text-gray-900 truncate">{data.badges.talkKing?.sender || '-'}</h4>
                        <p className="text-xs text-gray-400 mt-2">
                          전체 메시지의 <strong>{data.badges.talkKing?.percentage}%</strong>를 주도한 대화방의 핵심 멤버!
                        </p>
                      </div>

                      {/* Badge 2 */}
                      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm text-center">
                        <div className="w-14 h-14 mx-auto rounded-3xl bg-blue-100 text-blue-600 flex items-center justify-center text-2xl mb-4">
                          ✍️
                        </div>
                        <span className="text-xs font-bold text-blue-600 uppercase tracking-wider block mb-1">정성 타자왕</span>
                        <h4 className="text-base font-extrabold text-gray-900 truncate">{data.badges.typerKing?.sender || '-'}</h4>
                        <p className="text-xs text-gray-400 mt-2">
                          총 <strong>{data.badges.typerKing?.charCount.toLocaleString()}자</strong>의 글을 정성껏 작성한 장문러!
                        </p>
                      </div>

                      {/* Badge 3 */}
                      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm text-center">
                        <div className="w-14 h-14 mx-auto rounded-3xl bg-purple-100 text-purple-600 flex items-center justify-center text-2xl mb-4">
                          🦉
                        </div>
                        <span className="text-xs font-bold text-purple-600 uppercase tracking-wider block mb-1">새벽 올빼미</span>
                        <h4 className="text-base font-extrabold text-gray-900 truncate">{data.badges.nightOwl?.sender || '-'}</h4>
                        <p className="text-xs text-gray-400 mt-2">
                          새벽(0~6시)에 <strong>{data.badges.nightOwl?.nightCount || 0}번</strong> 말을 건 밤샘 대화 마스터!
                        </p>
                      </div>

                      {/* Badge 4 */}
                      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm text-center">
                        <div className="w-14 h-14 mx-auto rounded-3xl bg-pink-100 text-pink-600 flex items-center justify-center text-2xl mb-4">
                          📸
                        </div>
                        <span className="text-xs font-bold text-pink-600 uppercase tracking-wider block mb-1">미디어 요정</span>
                        <h4 className="text-base font-extrabold text-gray-900 truncate">{data.badges.mediaMaster?.sender || '-'}</h4>
                        <p className="text-xs text-gray-400 mt-2">
                          사진·이모티콘을 <strong>{data.badges.mediaMaster?.mediaCount || 0}회</strong> 공유하여 분위기를 띄운 멤버!
                        </p>
                      </div>
                    </div>

                    {/* Top Keywords */}
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                      <h3 className="font-bold text-sm text-gray-800 mb-2">대화방 최다 언급 키워드 TOP 15</h3>
                      <p className="text-xs text-gray-400 mb-5">대화방 멤버들이 가장 자주 쓴 단어와 감정 표현입니다.</p>
                      <div className="flex flex-wrap gap-2.5">
                        {data.topKeywords.map((item, idx) => (
                          <div
                            key={item.word}
                            className="px-3.5 py-2 rounded-2xl bg-gray-50 border border-gray-100 text-xs flex items-center gap-2 hover:bg-gray-100 transition-colors"
                          >
                            <span className="font-bold text-blue-600">#{idx + 1}</span>
                            <span className="font-extrabold text-gray-800">{item.word}</span>
                            <span className="text-[11px] text-gray-400 bg-white px-2 py-0.5 rounded-full border border-gray-100 font-semibold">
                              {item.count}회
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-gray-100 bg-white py-6">
        <div className="max-w-6xl mx-auto px-4 text-center text-xs text-gray-400">
          <p>© {new Date().getFullYear()} Katalk Analyzer · 100% 브라우저 기반 안전한 카카오톡 대화 분석기</p>
          <p className="mt-1">대화 내용은 사용자의 컴퓨터 브라우저에서만 처리되며 어떠한 서버에도 저장되지 않습니다.</p>
        </div>
      </footer>
    </div>
  );
}
