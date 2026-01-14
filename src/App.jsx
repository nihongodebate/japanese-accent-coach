import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, RefreshCw, ChevronRight, Award, AlertCircle, Info } from 'lucide-react';

/**
 * API Configuration
 * このプレビュー環境のルールに従い、apiKeyは空の文字列 "" に設定します。
 * 実行時にシステムによって自動的にキーが注入されます。
 * (注: Vercelなどの外部環境にデプロイする場合は、環境変数 import.meta.env... を使用する形式に戻してください)
 */
const apiKey = ""; 
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent";

const WORD_LIST = [
  { 
    word: "はし", 
    reading: "はし", 
    accent: "두고형 (箸: 젓가락)", 
    pattern: [1, 0],
    description: "첫 음이 '높고' 두 번째 음이 '낮음'. '하'에서 소리를 떨어뜨리세요.", 
    id: 1 
  },
  { 
    word: "はし", 
    reading: "はし", 
    accent: "평판형/미고형 (橋: 다리)", 
    pattern: [0, 1],
    description: "첫 음이 '낮고' 두 번째 음이 '높음'. 끝을 살짝 올리는 느낌입니다.", 
    id: 2 
  },
  { 
    word: "あつい", 
    reading: "あつい", 
    accent: "중고형 (暑い: 덥다)", 
    pattern: [0, 1, 0],
    description: "가운데 'つ'만 높습니다. 산을 넘어가듯 발음하세요.", 
    id: 3 
  },
  { 
    word: "がっこう", 
    reading: "가っ공", 
    accent: "평판형 (学校: 학교)", 
    pattern: [0, 1, 1, 1],
    description: "첫 음만 낮고 나머지는 평평하게 높음을 유지합니다.", 
    id: 4 
  },
  { 
    word: "ざっし", 
    reading: "ざっ시", 
    accent: "평판형 (雑誌: 잡지)", 
    pattern: [0, 1, 1],
    description: "첫 음만 낮고 나머지는 높게 유지. 'ざ'를 정확히 발음하세요.", 
    id: 5 
  },
];

const PitchDiagram = ({ pattern, reading }) => {
  const charArray = reading.split('');
  const height = 36;
  const width = charArray.length * 40;
  const dotRadius = 4;
  const padding = 10;
  const getY = (val) => (val === 1 ? padding : height - padding);
  const getX = (index) => index * 40 + 20;

  return (
    <div className="flex flex-col items-center py-1">
      <svg width={width} height={height} className="overflow-visible">
        {pattern.map((val, i) => {
          if (i === pattern.length - 1) return null;
          return (
            <line key={`l-${i}`} x1={getX(i)} y1={getY(val)} x2={getX(i+1)} y2={getY(pattern[i+1])} stroke="#6366f1" strokeWidth="2" />
          );
        })}
        {pattern.map((val, i) => (
          <circle key={`d-${i}`} cx={getX(i)} cy={getY(val)} r={dotRadius} fill={val === 1 ? "#6366f1" : "#cbd5e1"} stroke="#6366f1" strokeWidth="1" />
        ))}
      </svg>
      <div className="flex w-full justify-between px-1 mt-1" style={{ width: `${width}px` }}>
        {charArray.map((char, i) => (
          <span key={`c-${i}`} className="text-[10px] font-bold text-slate-400 w-[40px] text-center">{char}</span>
        ))}
      </div>
    </div>
  );
};

const App = () => {
  const [currentWord, setCurrentWord] = useState(WORD_LIST[0]);
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [base64Audio, setBase64Audio] = useState(null);
  const [mimeType, setMimeType] = useState("audio/webm");
  const [evaluation, setEvaluation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

  const resetAll = () => {
    setEvaluation(null);
    setAudioUrl(null);
    setBase64Audio(null);
    setError(null);
    setLoading(false);
    setIsRecording(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const getSupportedMimeType = () => {
    const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"];
    if (typeof MediaRecorder === 'undefined') return "audio/wav";
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return "audio/wav";
  };

  const startRecording = async () => {
    try {
      resetAll();
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const type = getSupportedMimeType();
      setMimeType(type);
      
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type });
        setAudioUrl(URL.createObjectURL(blob));
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          setBase64Audio(reader.result.split(',')[1]);
        };
      };
      recorder.start();
      setIsRecording(true);
    } catch (err) { 
      setError(`마이크 오류: ${err.message}. 권한을 확인해주세요.`); 
      setIsRecording(false); 
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    }
  };

  const evaluate = async () => {
    if (!base64Audio) return;
    setLoading(true); setEvaluation(null); setError(null);
    
    const prompt = `당신은 일본어 악센트 전문 교사입니다. 사용자의 음성을 분석하여 일본어 표준어(Tokyo Accent)의 '피치 액센트'를 매우 엄격하게 평가하세요.

[학습 데이터]
단어: ${currentWord.word}
읽기: ${currentWord.reading}
표준 패턴: ${currentWord.pattern.join(', ')} (0=저음, 1=고음)
패턴 설명: ${currentWord.description}

[채점 규칙 - 매우 엄격함]
1. 피치 일치도: 각 음절의 고저 추이가 표준 패턴과 다르면 무조건 감점하세요.
2. 한국인 특유의 오류 체크: 
   - 첫 음절을 고음으로 시작하는 버릇 (평판형인데 고음으로 시작 등)
   - 문장 끝을 한국어처럼 올리는 습관
   위 오류가 보이면 60점 이하로 엄격하게 채점하세요.
3. 90점 이상은 표준어 화자와 거의 차이가 없을 때만 부여하세요.

반드시 다음 JSON 형식으로 한국어로 응답하세요:
{
  "score": 숫자(0-100),
  "result": "합격/불합격 판정 메시지",
  "accent_feedback": "어느 음절에서 높낮이가 틀렸는지 상세 분석",
  "advice": "한국인 학습자를 위한 개선 팁"
}`;

    const payload = {
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType: mimeType.split(';')[0], data: base64Audio } }
        ]
      }],
      generationConfig: { responseMimeType: "application/json" }
    };

    const callApi = async (attempt = 0) => {
      try {
        const res = await fetch(`${BASE_URL}?key=${apiKey}`, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify(payload) 
        });
        
        if (!res.ok) {
          const errJson = await res.json();
          throw new Error(errJson.error?.message || 'API Error');
        }
        
        const data = await res.json();
        const resultText = data.candidates[0].content.parts[0].text;
        setEvaluation(JSON.parse(resultText));
      } catch (e) {
        if (attempt < 4) {
          const delay = Math.pow(2, attempt) * 1000;
          setTimeout(() => callApi(attempt + 1), delay);
        } else {
          setError(`분석 실패: ${e.message}`);
          setLoading(false);
        }
      } finally {
        if (attempt >= 4) setLoading(false);
      }
    };

    callApi();
  };

  return (
    <div className="fixed inset-0 bg-slate-100 flex items-center justify-center p-0 sm:p-4 overflow-hidden font-sans">
      <div className="w-full max-w-md bg-white h-full sm:h-[90%] sm:max-h-[800px] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        
        <header className="bg-indigo-600 px-4 py-3 text-white flex justify-between items-center shrink-0 shadow-md z-30">
          <div className="flex flex-col">
            <h1 className="font-bold text-lg leading-tight text-white">일본어 발음 코치</h1>
            <p className="text-[10px] text-indigo-200 uppercase tracking-widest">Accent AI Tutor</p>
          </div>
          <div className="bg-indigo-500 px-3 py-1 rounded-full text-[10px] font-bold text-white">LIVE</div>
        </header>

        <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          
          <section className="p-4 text-center space-y-1 shrink-0 bg-slate-50 border-b border-slate-100 z-20">
            <div className="text-5xl font-black text-slate-800 tracking-tighter">{currentWord.word}</div>
            <div className="text-base text-indigo-600 font-bold">{currentWord.reading}</div>
            
            <div className="flex justify-center pt-1">
              <div className="bg-white px-4 py-1 rounded-xl border border-slate-200 shadow-sm inline-block">
                <PitchDiagram pattern={currentWord.pattern} reading={currentWord.reading} />
              </div>
            </div>
            <p className="text-[10px] text-slate-500 font-bold px-4 leading-relaxed">
              {currentWord.accent}
            </p>
          </section>

          <section className="px-6 py-4 flex flex-col items-center justify-center shrink-0 z-20">
            <div className="relative">
              {!isRecording ? (
                <button 
                  onClick={startRecording} 
                  disabled={loading}
                  className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white shadow-xl active:scale-90 transition-all disabled:opacity-50"
                >
                  <Mic size={30} className="text-white" />
                </button>
              ) : (
                <button 
                  onClick={stopRecording} 
                  className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-white shadow-xl animate-pulse"
                >
                  <Square size={24} className="text-white" />
                </button>
              )}
              {isRecording && (
                <div className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-20 scale-150 -z-10"></div>
              )}
            </div>
            <div className="h-4 mt-2">
              {isRecording && <p className="text-red-500 text-[10px] font-black animate-pulse tracking-widest">RECORDING...</p>}
            </div>
          </section>

          <section className="flex-1 overflow-y-auto px-5 pb-8 min-h-0">
            {!evaluation && audioUrl && !isRecording && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 py-2">
                <div className="bg-indigo-50/80 p-3 rounded-2xl flex flex-col items-center border border-indigo-100 shadow-inner">
                   <audio src={audioUrl} controls className="h-10 w-full max-w-[280px]" />
                   <p className="text-[9px] text-indigo-400 mt-1 font-bold tracking-widest">내 목소리 확인</p>
                </div>
                <button 
                  onClick={evaluate} 
                  disabled={loading} 
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl flex items-center justify-center gap-3 active:translate-y-1 transition-all"
                >
                  {loading ? <RefreshCw className="animate-spin text-white" size={20} /> : <span className="text-white font-bold">선생님께 채점 받기</span>}
                </button>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 text-red-600 text-xs rounded-xl flex items-start gap-3 border border-red-100 mt-4">
                <AlertCircle size={18} className="shrink-0 text-red-500" />
                <p className="font-medium">{error}</p>
              </div>
            )}

            {evaluation && (
              <div className="space-y-4 animate-in zoom-in-95 duration-500 py-2">
                <div className="bg-white rounded-3xl border-2 border-indigo-100 p-5 shadow-lg space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2 text-amber-500">
                      <Award size={24} />
                      <span className="text-xs font-black uppercase tracking-tighter text-slate-400">Score</span>
                    </div>
                    <div className="text-4xl font-black text-indigo-600 tracking-tighter">
                      {evaluation.score}<span className="text-sm ml-1 font-bold">점</span>
                    </div>
                  </div>
                  
                  <div className="text-base font-black text-center text-indigo-800 bg-indigo-50 py-3 rounded-2xl">
                    "{evaluation.result}"
                  </div>
                  
                  <div className="space-y-4 pt-1">
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Accent Analysis</h4>
                      <p className="text-[11px] text-slate-600 leading-relaxed font-semibold bg-slate-50 p-3 rounded-xl whitespace-pre-wrap">{evaluation.accent_feedback}</p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Teacher's Advice</h4>
                      <div className="bg-amber-50 p-4 rounded-xl text-[11px] text-amber-900 leading-relaxed border border-amber-100 font-semibold whitespace-pre-wrap shadow-sm">
                        {evaluation.advice}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="h-4"></div>
              </div>
            )}
          </section>
        </main>

        <footer className="px-5 py-4 bg-white border-t border-slate-100 flex justify-between items-center shrink-0 z-30 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
          <button 
            onClick={resetAll} 
            className="text-slate-400 text-xs font-black uppercase tracking-widest hover:text-indigo-600 transition-colors"
          >
            Clear
          </button>
          <button 
            onClick={() => {
              const idx = WORD_LIST.findIndex(w => w.id === currentWord.id);
              setCurrentWord(WORD_LIST[(idx + 1) % WORD_LIST.length]);
              resetAll();
            }} 
            className="px-8 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black flex items-center gap-2 active:scale-95 transition-transform shadow-lg"
          >
            <span className="text-white font-bold">NEXT</span>
            <ChevronRight size={18} className="text-white" />
          </button>
        </footer>
      </div>
    </div>
  );
};

export default App;
