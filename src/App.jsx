import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, RefreshCw, ChevronRight, Award, AlertCircle, Info } from 'lucide-react';

/**
 * API Configuration
 * 実行環境からAPIキーが自動的に提供されるため、ここでは空の文字列を設定します。
 * Vercelなどの外部環境で実行する場合は、環境変数から読み込む設定に戻す必要があります。
 */
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || ""; 
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
    accent: "중고형 (暑い: 덥다)", 
    pattern: [0, 1, 0],
    description: "가운데 음절인 'つ'를 가장 높게 발음하는 것이 포인트입니다.", 
    id: 3 
  },
  { 
    word: "がっこう", 
    reading: "가っこう", 
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
            <line key={`l-${i}`} x1={getX(i)} y1={getY(val)} x2={getX(i+1)} y2={getY(pattern[i+1])} stroke="#6366f1" strokeWidth="2" />
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
    const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"];
    if (typeof MediaRecorder === 'undefined') return "audio/wav";
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return "audio/wav";
  };

  const startRecording = async () => {
    try {
      setError(null); setEvaluation(null); setAudioUrl(null); setBase64Audio(null);
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
      setError(`마이크 오류: ${err.message}`); 
      setIsRecording(false); 
    }
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
    
    const prompt = `당신은 일본어 교사입니다. 발음을 분석하여 JSON으로 응답하세요.
{
  "score": 0-100,
  "result": "결과 요약",
  "accent_feedback": "악센트 분석",
  "advice": "한국인을 위한 조언"
}
대상 단어: ${currentWord.word} (${currentWord.reading})`;

    const payload = {
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType: mimeType.split(';')[0], data: base64Audio } }
        ]
      }],
      generationConfig: { responseMimeType: "application/json" }
    };

    // Exponential backoff for API calls
    const callApi = async (attempt = 0) => {
      try {
        const res = await fetch(`${BASE_URL}?key=${apiKey}`, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify(payload) 
        });
        
        if (!res.ok) {
          const errJson = await res.json();
          throw new Error(`HTTP ${res.status}: ${errJson.error?.message || '알 수 없는 오류'}`);
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
      <div className="w-full max-w-md bg-white h-full sm:h-[90%] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        <header className="bg-indigo-600 px-4 py-3 text-white flex justify-between items-center shrink-0 shadow-md">
          <div>
            <h1 className="font-bold text-lg leading-tight text-white">일본어 발음 코치</h1>
            <p className="text-[10px] text-indigo-200">Gemini AI Engine</p>
          </div>
          <div className="bg-indigo-500 px-3 py-1 rounded-full text-[10px] font-bold text-white">LIVE</div>
        </header>

        <main className="flex-1 flex flex-col overflow-hidden">
          <section className="p-4 text-center space-y-2 shrink-0 bg-slate-50/50 border-b border-slate-100">
            <div className="text-5xl font-black text-slate-800 tracking-tighter">{currentWord.word}</div>
            <div className="text-base text-indigo-600 font-bold">{currentWord.reading}</div>
            <div className="flex justify-center pt-1">
              <div className="bg-white px-4 py-1 rounded-xl border border-slate-200 shadow-sm">
                <PitchDiagram pattern={currentWord.pattern} reading={currentWord.reading} />
              </div>
            </div>
          </section>

          <section className="px-6 py-4 flex flex-col items-center justify-center shrink-0">
            {!isRecording ? (
              <button onClick={startRecording} disabled={loading} className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white shadow-lg active:scale-95 transition-transform disabled:opacity-50">
                <Mic size={30} className="text-white" />
              </button>
            ) : (
              <button onClick={stopRecording} className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-white shadow-lg">
                <Square size={24} className="animate-pulse text-white" />
              </button>
            )}
            <div className="h-6 mt-2">
              {isRecording && <p className="text-red-500 text-[10px] font-bold animate-pulse">RECORDING...</p>}
            </div>
          </section>

          <section className="flex-1 overflow-y-auto px-4 pb-4 scroll-smooth">
            {!evaluation && audioUrl && !isRecording && (
              <div className="space-y-3 animate-in fade-in">
                <div className="bg-indigo-50/50 p-3 rounded-2xl flex flex-col items-center border border-indigo-100">
                   <audio src={audioUrl} controls className="h-8 w-full max-w-[240px]" />
                </div>
                <button onClick={evaluate} disabled={loading} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-sm shadow-xl flex items-center justify-center gap-3">
                  {loading ? <RefreshCw className="animate-spin text-white" size={18} /> : <span className="text-white">선생님께 채점받기</span>}
                </button>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 text-red-600 text-xs rounded-xl flex items-start gap-2 border border-red-200 break-all">
                <AlertCircle size={16} className="shrink-0" />
                <p><strong>Error Details:</strong><br/>{error}</p>
              </div>
            )}

            {evaluation && (
              <div className="space-y-3 animate-in zoom-in-95">
                <div className="bg-white rounded-2xl border-2 border-indigo-100 p-4 shadow-sm space-y-3">
                  <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <Award className="text-amber-500" size={20} />
                      <span className="text-xs font-bold text-slate-500">SCORE</span>
                    </div>
                    <div className="text-3xl font-black text-indigo-600">{evaluation.score}点</div>
                  </div>
                  <div className="text-sm font-bold text-center text-indigo-800 bg-indigo-50 py-2 rounded-xl">「{evaluation.result}」</div>
                  <div className="space-y-3 pt-1 text-[11px]">
                    <p className="text-slate-600 leading-relaxed font-medium bg-slate-100 p-2 rounded-lg">{evaluation.accent_feedback}</p>
                    <div className="bg-amber-50 p-3 rounded-lg text-amber-900 border border-amber-100 font-medium">{evaluation.advice}</div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </main>

        <footer className="px-4 py-3 bg-white border-t border-slate-100 flex justify-between items-center shrink-0">
          <button onClick={() => {setEvaluation(null); setAudioUrl(null); setError(null);}} className="text-slate-400 text-xs font-bold">다시 하기</button>
          <button onClick={() => {
            const idx = WORD_LIST.findIndex(w => w.id === currentWord.id);
            setCurrentWord(WORD_LIST[(idx + 1) % WORD_LIST.length]);
            setEvaluation(null); setAudioUrl(null); setError(null);
          }} className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-2">
            <span className="text-white">다음 문제</span><ChevronRight size={16} className="text-white" />
          </button>
        </footer>
      </div>
    </div>
  );
};

export default App;
