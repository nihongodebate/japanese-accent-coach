import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, RefreshCw, ChevronRight, Award, AlertCircle, Info } from 'lucide-react';

/**
 * API Configuration
 * 이 환경에서는 apiKey를 빈 문자열로 설정합니다.
 * 실행 시 시스템에서 자동으로 키를 제공합니다.
 */
const apiKey = ""; 
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent";

const WORD_LIST = [
  { 
    word: "はし", 
    reading: "はし", 
    accent: "두고형 (箸: 젓가락)", 
    pattern: [1, 0],
    description: "첫 음절이 '높고' 두 번째 음절이 '낮습니다'. 계단을 내려가듯 발음해 보세요.", 
    id: 1 
  },
  { 
    word: "はし", 
    reading: "はし", 
    accent: "평판형/미고형 (橋: 다리)", 
    pattern: [0, 1],
    description: "첫 음절이 '낮고' 두 번째 음절이 '높습니다'. 끝을 올리는 느낌으로 발음합니다.", 
    id: 2 
  },
  { 
    word: "あつい", 
    reading: "あつい", 
    accent: "중고형 (暑이: 덥다)", 
    pattern: [0, 1, 0],
    description: "가운데 음절인 'つ'를 가장 높게 발음하는 것이 포인트입니다.", 
    id: 3 
  },
  { 
    word: "がっこう", 
    reading: "がっこう", 
    accent: "평판형 (学校: 학교)", 
    pattern: [0, 1, 1, 1],
    description: "첫 음만 낮게 시작하고 나머지는 평평하고 높게 유지합니다.", 
    id: 4 
  },
  { 
    word: "ざっし", 
    reading: "ざっし", 
    accent: "평판형 (雑誌: 잡지)", 
    pattern: [0, 1, 1],
    description: "탁음(ざ)이 청음처럼 들리지 않게 주의하며 평평하게 발음하세요.", 
    id: 5 
  },
];

const PitchDiagram = ({ pattern, reading }) => {
  const charArray = reading.split('');
  const height = 36;
  const width = charArray.length * 36;
  const dotRadius = 4;
  const padding = 10;
  const getY = (val) => (val === 1 ? padding : height - padding);
  const getX = (index) => index * 36 + 18;

  return (
    <div className="flex flex-col items-center py-1">
      <svg width={width} height={height} className="overflow-visible">
        {pattern.map((val, i) => {
          if (i === pattern.length - 1) return null;
          return (
            <line key={`l-${i}`} x1={getX(i)} y1={getY(val)} x2={getX(i + 1)} y2={getY(pattern[i + 1])} stroke="#6366f1" strokeWidth="2" />
          );
        })}
        {pattern.map((val, i) => (
          <circle key={`d-${i}`} cx={getX(i)} cy={getY(val)} r={dotRadius} fill={val === 1 ? "#6366f1" : "#cbd5e1"} stroke="#6366f1" strokeWidth="1" />
        ))}
      </svg>
      <div className="flex w-full justify-between px-1 mt-1" style={{ width: `${width}px` }}>
        {charArray.map((char, i) => (
          <span key={`c-${i}`} className="text-[10px] font-bold text-slate-400 w-[36px] text-center">{char}</span>
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

  const getSupportedMimeType = () => {
    const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
    for (const type of types) if (MediaRecorder.isTypeSupported(type)) return type;
    return "audio/webm";
  };

  const startRecording = async () => {
    try {
      setError(null); setEvaluation(null); setAudioUrl(null); setBase64Audio(null);
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const type = getSupportedMimeType();
      setMimeType(type);
      const recorder = new MediaRecorder(stream, { mimeType: type });
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type });
        if (blob.size < 1000) {
          setError("녹음이 너무 짧거나 소리가 입력되지 않았습니다.");
          return;
        }
        setAudioUrl(URL.createObjectURL(blob));
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => setBase64Audio(reader.result.split(',')[1]);
      };
      recorder.start();
      setIsRecording(true);
    } catch (err) { setError("마이크 권한을 허용해 주세요."); setIsRecording(false); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      streamRef.current?.getTracks().forEach(t => t.stop());
    }
  };

  const evaluate = async () => {
    if (!base64Audio) return;
    setLoading(true); setEvaluation(null); setError(null);
    
    const prompt = `당신은 엄격하면서도 친절한 일본어 교사입니다. 한국인 초급 학습자의 발음을 분석하고 반드시 한국어(Korean)로 피드백을 제공하세요.
    
대상 단어: ${currentWord.word} (${currentWord.reading})
기대되는 악센트 패턴: ${currentWord.accent}

【규칙】
1. 음성이 확인되지 않거나 무음일 경우 score를 0으로 하고 result에 "음성을 인식할 수 없습니다"라고 적어주세요.
2. 모든 피드백 텍스트(result, accent_feedback, advice)는 한국어로 작성하세요.
3. 악센트의 높낮이와 한국인이 자주 틀리는 발음(탁음, 촉음 등)을 중심으로 평가하세요.

{
  "score": 숫자(0-100),
  "result": "판정 메시지 (한국어)",
  "accent_feedback": "악센트 분석 내용 (한국어)",
  "advice": "한국인 학습자를 위한 구체적인 조언 (한국어)"
}`;

    const payload = {
      contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType: mimeType.split(';')[0], data: base64Audio } }] }],
      generationConfig: { responseMimeType: "application/json" }
    };

    const callApiWithBackoff = async (at = 0) => {
      try {
        const res = await fetch(`${BASE_URL}?key=${apiKey}`, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify(payload) 
        });
        
        if (!res.ok) throw new Error('API Error');
        const data = await res.json();
        const resultText = data.candidates[0].content.parts[0].text;
        const parsed = JSON.parse(resultText);
        
        if (parsed.score === 0 && parsed.result.includes("인식할 수 없")) {
          setError("AI가 목소리를 듣지 못했습니다. 다시 한번 녹음해 주세요.");
        } else {
          setEvaluation(parsed);
        }
      } catch (e) {
        if (at < 4) {
          const delay = Math.pow(2, at) * 1000;
          setTimeout(() => callApiWithBackoff(at + 1), delay);
        } else {
          setError("분석에 실패했습니다. 다시 시도해 주세요.");
        }
      } finally {
        setLoading(false);
      }
    };

    callApiWithBackoff();
  };

  return (
    <div className="fixed inset-0 bg-slate-100 flex items-center justify-center p-0 sm:p-4 overflow-hidden">
      <div className="w-full max-w-md bg-white h-full sm:h-[90%] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <header className="bg-indigo-600 px-4 py-3 text-white flex justify-between items-center shrink-0 shadow-md z-10">
          <div>
            <h1 className="font-bold text-lg leading-tight">일본어 발음 코치</h1>
            <p className="text-[10px] text-indigo-200">For Korean Learners</p>
          </div>
          <div className="bg-indigo-500 px-3 py-1 rounded-full text-[10px] font-bold">
            초급
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          
          {/* Question Display */}
          <section className="p-4 text-center space-y-2 shrink-0 bg-slate-50/50 border-b border-slate-100">
            <div className="text-5xl font-black text-slate-800 tracking-tighter">
              {currentWord.word}
            </div>
            <div className="text-base text-indigo-600 font-bold">
              {currentWord.reading}
            </div>
            
            <div className="flex justify-center pt-1">
              <div className="bg-white px-4 py-1 rounded-xl border border-slate-200 shadow-sm">
                <PitchDiagram pattern={currentWord.pattern} reading={currentWord.reading} />
              </div>
            </div>
            <p className="text-[10px] text-slate-500 font-bold px-6">
              {currentWord.accent}
            </p>
          </section>

          {/* Interaction Area */}
          <section className="px-6 py-4 flex flex-col items-center justify-center shrink-0">
            <div className="relative mb-2">
              {!isRecording ? (
                <button 
                  onClick={startRecording} 
                  disabled={loading} 
                  className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white shadow-lg active:scale-95 transition-transform disabled:opacity-50"
                >
                  <Mic size={30} />
                </button>
              ) : (
                <button 
                  onClick={stopRecording} 
                  className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-white shadow-lg"
                >
                  <Square size={24} className="animate-pulse" />
                </button>
              )}
              {isRecording && (
                <div className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-20 scale-125 -z-10"></div>
              )}
            </div>
            <div className="h-4">
              {isRecording && <p className="text-red-500 text-[10px] font-bold animate-pulse uppercase tracking-widest">Recording...</p>}
            </div>
          </section>

          {/* Results Area - Scrollable */}
          <section className="flex-1 overflow-y-auto px-4 pb-4 scroll-smooth">
            {!evaluation && audioUrl && !isRecording && (
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                <div className="bg-indigo-50/50 p-3 rounded-2xl flex flex-col items-center border border-indigo-100">
                   <audio src={audioUrl} controls className="h-8 w-full max-w-[240px]" />
                   <p className="text-[9px] text-indigo-400 mt-1 font-bold tracking-tight">내 목소리 듣기</p>
                </div>
                <button 
                  onClick={evaluate} 
                  disabled={loading} 
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-sm shadow-xl flex items-center justify-center gap-3 active:translate-y-0.5 transition-all"
                >
                  {loading ? <RefreshCw className="animate-spin" size={18} /> : <span>선생님께 채점받기</span>}
                </button>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl flex items-center gap-2 border border-red-100">
                <AlertCircle size={14} /> {error}
              </div>
            )}

            {evaluation && (
              <div className="space-y-3 animate-in zoom-in-95 duration-300">
                <div className="bg-white rounded-2xl border-2 border-indigo-100 p-4 shadow-sm space-y-3">
                  <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <Award className="text-amber-500" size={20} />
                      <span className="text-xs font-bold text-slate-500">SCORE</span>
                    </div>
                    <div className="text-3xl font-black text-indigo-600">{evaluation.score}<span className="text-xs ml-1 font-bold">점</span></div>
                  </div>
                  
                  <div className="text-sm font-bold text-center text-indigo-800 bg-indigo-50 py-2 rounded-xl">
                    「{evaluation.result}」
                  </div>
                  
                  <div className="space-y-3 pt-1">
                    <div className="space-y-1">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Accent Feedback</h4>
                      <p className="text-[11px] text-slate-600 leading-relaxed font-medium bg-slate-50 p-2 rounded-lg whitespace-pre-wrap">{evaluation.accent_feedback}</p>
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-tighter">Teacher's Advice</h4>
                      <div className="bg-amber-50 p-3 rounded-lg text-[11px] text-amber-900 leading-relaxed border border-amber-100 font-medium whitespace-pre-wrap">
                        {evaluation.advice}
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-center text-[9px] text-slate-300 pb-2 tracking-widest uppercase">End of Feedback</p>
              </div>
            )}
          </section>
        </main>

        {/* Footer */}
        <footer className="px-4 py-3 bg-white border-t border-slate-100 flex justify-between items-center shrink-0 z-10">
          <button 
            onClick={() => {setEvaluation(null); setAudioUrl(null); setError(null);}} 
            className="text-slate-400 text-xs font-bold hover:text-indigo-600 transition-colors"
          >
            다시 하기
          </button>
          <button 
            onClick={() => {
              const idx = WORD_LIST.findIndex(w => w.id === currentWord.id);
              setCurrentWord(WORD_LIST[(idx + 1) % WORD_LIST.length]);
              setEvaluation(null); setAudioUrl(null); setError(null);
            }} 
            className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-2 active:scale-95 transition-transform"
          >
            <span>다음 문제</span>
            <ChevronRight size={16} />
          </button>
        </footer>
      </div>
    </div>
  );
};

export default App;