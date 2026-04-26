import React, { useState, useEffect, useRef } from 'react';
import * as faceapi from 'face-api.js';
import axios from 'axios';
import Editor from "@monaco-editor/react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import {
  Upload, FileText, Play, CheckCircle, Loader2,
  Mic, MicOff, Volume2, ChevronRight, RotateCcw,
  LayoutDashboard, Video, ShieldCheck, Award, TrendingUp, XCircle,
  BrainCircuit, MessageSquare, UserCheck, Activity, Globe, BarChart3, Clock, AlertTriangle
} from 'lucide-react';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;

if (recognition) {
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
}

function App() {
  const [file, setFile] = useState(null);
  const [jd, setJd] = useState('');
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isInterviewStarted, setIsInterviewStarted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [answers, setAnswers] = useState({});
  const [emotion, setEmotion] = useState("Neutral");
  const [history, setHistory] = useState([]);
  const [isCodingRound, setIsCodingRound] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);

  const [difficulty, setDifficulty] = useState('Junior');
  const [language, setLanguage] = useState('en-US');

  const [emotionLog, setEmotionLog] = useState([]);
  const [interviewAnalysis, setInterviewAnalysis] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [timeLeft, setTimeLeft] = useState(120);
  const [isTimeUp, setIsTimeUp] = useState(false);

  // 🔥 ANTI-CHEATING STATES
  const [warnings, setWarnings] = useState(0);
  const [proctoringMessage, setProctoringMessage] = useState("");

  const videoRef = useRef(null);

  const speak = (text) => {
    if (!text) return;
    window.speechSynthesis.cancel();
    setTimeout(() => {
      const msg = new SpeechSynthesisUtterance(text);
      msg.rate = 0.95;
      msg.pitch = 1;
      window.speechSynthesis.speak(msg);
    }, 150);
  };

  // 🔥 FEATURE: ANTI-TAB SWITCHING
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isInterviewStarted) {
        alert("CHEATING DETECTED: Interview terminated for tab switching.");
        window.location.reload();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isInterviewStarted]);

  // 🔥 FEATURE: PROCTORING MONITOR (Face & Gaze)
  // 🔥 UPDATED PROCTORING MONITOR (More stable version)
  // 🔥 UPDATED PROCTORING LOGIC (Gaze Tracking + Auto-Termination)
  const runProctoring = async () => {
    if (videoRef.current && isInterviewStarted && !showResult && videoRef.current.readyState === 4) {
      try {
        const detection = await faceapi.detectSingleFace(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.5 })
        ).withFaceLandmarks();

        if (!detection) {
          setProctoringMessage("FACE NOT DETECTED");
          setWarnings(prev => prev + 2); // Face gayab hone par warnings tez badhengi
        } else {
          const landmarks = detection.landmarks;
          const nose = landmarks.getNose();
          const leftEye = landmarks.getLeftEye();
          const rightEye = landmarks.getRightEye();

          // --- Gaze Detection Logic ---
          // Chehre ka center point (eyes ke beech mein)
          const eyeCenter = (leftEye[0].x + rightEye[3].x) / 2;
          const noseTip = nose[3].x; // Naak ka point

          // Naak aur eyes ke center ka gap check karte hain
          // Agar user seedha dekh raha hai toh gap kam hoga, side dekhne par badh jayega
          const faceRotation = Math.abs(noseTip - eyeCenter);
          const sensitivityThreshold = 12; // Is value ko kam karoge toh system aur sakht ho jayega

          if (faceRotation > sensitivityThreshold) {
            setProctoringMessage("WARNING: LOOK AT THE SCREEN");
            setWarnings(prev => prev + 1); // Side dekhne par warnings slowly badhengi
          } else {
            setProctoringMessage("");
            // Agar user wapas screen par dekhne lage, toh warnings dheere-dheere kam karo (Recovery logic)
            setWarnings(prev => Math.max(0, prev - 0.5));
          }
        }

        // Termination Logic: Agar warnings threshold (e.g. 50) cross kare
        // 2-second interval ke hisab se user ko ~8-10 seconds ka total grace time milega
        if (warnings > 50) {
          alert("CHEATING DETECTED: Interview terminated for looking away from the camera repeatedly.");
          window.location.reload();
        }

      } catch (err) {
        console.log("Detection skip...");
      }
    }
  };
  const triggerWarning = () => {
    setWarnings(prev => {
      const next = prev + 1;
      if (next >= 100) { // Using 100 as a threshold for accumulation (check speed is high)
        alert("INTERVIEW TERMINATED: Multiple proctoring violations.");
        window.location.reload();
      }
      return next;
    });
  };

  useEffect(() => {
    let proctorInterval;
    if (isInterviewStarted) {
      proctorInterval = setInterval(runProctoring, 2000); // Check every 2 seconds
    }
    return () => clearInterval(proctorInterval);
  }, [isInterviewStarted, currentQuestionIndex]);

  useEffect(() => {
    let timer;
    if (isInterviewStarted && timeLeft > 0 && !isTimeUp && !isAiThinking) {
      timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    } else if (timeLeft === 0 && !isTimeUp) {
      setIsTimeUp(true);
      if (isListening) toggleListening();
      speak("Time is up, please move to the next question.");
    }
    return () => clearTimeout(timer);
  }, [timeLeft, isTimeUp, isInterviewStarted, isAiThinking]);

  useEffect(() => {
    setTimeLeft(120);
    setIsTimeUp(false);
  }, [currentQuestionIndex]);

  useEffect(() => {
    if (isInterviewStarted && questions[currentQuestionIndex]) {
      speak(questions[currentQuestionIndex]);
    }
  }, [currentQuestionIndex, isInterviewStarted]);

  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = '/models';
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        ]);
      } catch (err) { console.error("Models failed", err); }
    };
    loadModels();
  }, []);

  const startVideo = () => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then((stream) => { if (videoRef.current) videoRef.current.srcObject = stream; })
      .catch((err) => console.error(err));
  };

  const handleVideoPlay = () => {
    setInterval(async () => {
      if (videoRef.current && !videoRef.current.paused) {
        const detections = await faceapi.detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions()).withFaceExpressions();
        if (detections.length > 0) {
          const expressions = detections[0].expressions;
          const max = Object.keys(expressions).reduce((a, b) => expressions[a] > expressions[b] ? a : b);
          setEmotion(max);
          if (isInterviewStarted) {
            const confidenceScore = (expressions.happy + expressions.neutral) * 100;
            const stressScore = (expressions.sad + expressions.fearful + expressions.angry + expressions.disgusted) * 100;
            setEmotionLog(prev => [...prev, {
              time: prev.length,
              confidence: Math.round(confidenceScore),
              stress: Math.round(stressScore),
              emotion: max
            }]);
          }
        }
      }
    }, 1000);
  };

  const toggleListening = () => {
    if (isTimeUp) return alert("Bhai, time khatam ho gaya hai!");
    if (isListening) {
      recognition.stop();
      setIsListening(false);
    }
    else {
      setTranscript('');
      if (recognition) recognition.lang = language;
      recognition.start();
      setIsListening(true);
    }
  };

  useEffect(() => {
    if (!recognition) return;
    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          setAnswers(prev => ({ ...prev, [currentQuestionIndex]: (prev[currentQuestionIndex] || '') + event.results[i][0].transcript + ' ' }));
        } else { interim += event.results[i][0].transcript; }
      }
      setTranscript(interim);
    };
    recognition.onerror = () => setIsListening(false);
  }, [currentQuestionIndex]);

  const handleUpload = async () => {
    if (!file || !jd) return alert("Bhai, Resume aur JD dono dalo!");
    setLoading(true);
    const formData = new FormData();
    formData.append('resume', file);
    formData.append('jobDescription', jd);
    formData.append('difficulty', difficulty);
    formData.append('language', language === 'hi-IN' ? 'Hinglish' : 'English');
    try {
      const res = await axios.post('http://localhost:5000/api/start-interview', formData);
      setQuestions(res.data.questions);
    } catch (err) { alert("Server Error!"); }
    setLoading(false);
  };

  const nextQuestion = async () => {
    if (isAiThinking) return;
    if (recognition) recognition.stop();
    setIsListening(false);

    // 1. Current answer pick karo based on mode
    const currentAns = isCodingRound
      ? (answers[currentQuestionIndex] || "// No code submitted")
      : (transcript || answers[currentQuestionIndex] || "No answer");

    const updatedHistory = [...history, {
      q: questions[currentQuestionIndex],
      a: currentAns,
      timeTaken: 120 - timeLeft
    }];

    setHistory(updatedHistory);
    setTranscript('');
    setIsAiThinking(true);

    try {
      const res = await axios.post('http://localhost:5000/api/next-question', {
        currentQuestion: questions[currentQuestionIndex],
        userAnswer: currentAns,
        history: updatedHistory,
        jd: jd,
        difficulty: difficulty,
        language: language
      });

      const data = res.data;

      // 🔥 Yahan Fix Hai: AI decide karega editor dikhana hai ya nahi
      setIsCodingRound(data.isCodingRound);

      setQuestions(prev => [...prev, data.nextQuestion]);
      setCurrentQuestionIndex(prev => prev + 1);
    } catch (err) {
      console.error("Next Q Error:", err);
    } finally {
      setIsAiThinking(false);
    }
  };
  const finishInterview = async () => {
    setIsAiThinking(true);
    const currentAns = transcript || answers[currentQuestionIndex] || "No answer";
    const finalHistory = [...history, { q: questions[currentQuestionIndex], a: currentAns }];
    try {
      const res = await axios.post('http://localhost:5000/api/analyze-interview', {
        history: finalHistory,
        jd: jd,
        difficulty: difficulty,
        emotionSummary: emotionLog
      });
      const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      setInterviewAnalysis(data);
      setShowResult(true);
    } catch (err) {
      alert("Analysis failed!");
    } finally {
      setIsAiThinking(false);
    }
  };

  if (showResult && interviewAnalysis) {
    return (
      <div className="min-h-screen bg-[#020617] text-white p-6 md:p-12 flex flex-col items-center overflow-y-auto">
        <div className="max-w-6xl w-full space-y-8">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10"><Award size={120} /></div>
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
              <div>
                <h1 className="text-5xl font-black mb-2 tracking-tight">Interview <span className="text-blue-500">Verdict</span></h1>
                <p className="text-slate-400 font-mono tracking-widest uppercase text-sm">Performance Analysis Report</p>
              </div>
              <div className="flex gap-6">
                <div className="text-center px-8 py-4 bg-slate-800/50 rounded-3xl border border-slate-700">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Score</p>
                  <p className="text-4xl font-black text-blue-400">{interviewAnalysis.overallScore}</p>
                </div>
                <div className="text-center px-8 py-4 bg-blue-600 rounded-3xl shadow-lg shadow-blue-600/20">
                  <p className="text-[10px] font-bold text-blue-100 uppercase mb-1">Status</p>
                  <p className="text-xl font-black uppercase whitespace-nowrap">{interviewAnalysis.finalVerdict}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-8">
              <div className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] p-8">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="font-bold flex items-center gap-2 uppercase tracking-tighter text-slate-300">
                    <Activity className="text-blue-500" size={20} /> Confidence vs Stress Trend
                  </h3>
                  <div className="flex gap-4 text-[10px] font-bold">
                    <span className="flex items-center gap-1 text-green-400"><div className="w-2 h-2 bg-green-400 rounded-full" /> CONFIDENCE</span>
                    <span className="flex items-center gap-1 text-red-400"><div className="w-2 h-2 bg-red-400 rounded-full" /> STRESS</span>
                  </div>
                </div>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={emotionLog}>
                      <defs>
                        <linearGradient id="colorConf" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorStress" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="time" hide />
                      <YAxis stroke="#475569" fontSize={10} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b' }} />
                      <Area type="monotone" dataKey="confidence" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorConf)" name="Confidence %" />
                      <Area type="monotone" dataKey="stress" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorStress)" name="Stress Level %" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] p-8 mt-10">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-blue-400">
                  <MessageSquare size={22} /> Question-wise Detailed Review
                </h3>
                <div className="space-y-6">
                  {interviewAnalysis.detailedHistory && interviewAnalysis.detailedHistory.length > 0 ? (
                    interviewAnalysis.detailedHistory.map((item, index) => (
                      <div key={index} className={`p-6 rounded-3xl border ${item.isCorrect ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-[10px] font-black uppercase px-3 py-1 bg-slate-800 rounded-full text-slate-400">Question {index + 1}</span>
                          <span className={`text-[10px] font-black px-3 py-1 rounded-full ${item.isCorrect ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {item.isCorrect ? "PASSED" : "FAILED"}
                          </span>
                        </div>
                        <p className="text-white font-medium mb-4 italic">"{item.q}"</p>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                            <p className="text-[9px] font-bold text-slate-500 uppercase mb-2">Your Response</p>
                            <p className="text-sm text-slate-300">{item.a || "No answer provided"}</p>
                          </div>
                          {!item.isCorrect && (
                            <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                              <p className="text-[9px] font-bold text-blue-400 uppercase mb-2">Ideal Answer</p>
                              <p className="text-sm text-blue-100">{item.correctAnswer}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-500 italic">No detailed review available. Try a shorter interview.</p>
                  )}
                </div>
              </div>
            </div>
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] p-8 h-full">
                <h3 className="text-sm font-bold uppercase tracking-[0.2em] mb-8 text-slate-500">Skill Breakdown</h3>
                <div className="space-y-10">
                  <div className="space-y-3">
                    <div className="flex justify-between text-[10px] font-black uppercase"><span className="text-slate-400">Technical Depth</span> <span className="text-blue-500">8/10</span></div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-blue-500 w-[80%]" /></div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-[10px] font-black uppercase"><span className="text-slate-400">Communication</span> <span className="text-indigo-500">7/10</span></div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 w-[70%]" /></div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-[10px] font-black uppercase"><span className="text-slate-400">Emotional Control</span> <span className="text-green-500">9/10</span></div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-green-500 w-[90%]" /></div>
                  </div>
                </div>
                <div className="mt-16 pt-8 border-t border-slate-800 space-y-6">
                  <div>
                    <h4 className="text-green-400 font-bold text-[10px] uppercase mb-4 flex items-center gap-2"><CheckCircle size={14} /> Top Strengths</h4>
                    <ul className="space-y-2">
                      {interviewAnalysis.strengths?.map((s, i) => (
                        <li key={i} className="text-xs text-slate-400 flex gap-2"><span>•</span> {s}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-red-400 font-bold text-[10px] uppercase mb-4 flex items-center gap-2"><XCircle size={14} /> Key Weaknesses</h4>
                    <ul className="space-y-2">
                      {interviewAnalysis.improvements?.map((im, i) => (
                        <li key={i} className="text-xs text-slate-400 flex gap-2"><span>•</span> {im}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <button onClick={() => window.location.reload()} className="w-full bg-white text-black py-6 rounded-[2rem] font-black text-lg hover:bg-slate-200 transition-all flex items-center justify-center gap-3 shadow-xl">
            <RotateCcw /> RESTART SIMULATION
          </button>
        </div>
      </div>
    );
  }

  if (isInterviewStarted) {
    return (
      <div className="min-h-screen bg-[#020617] text-white p-6 flex flex-col items-center relative">
        <header className="w-full max-w-6xl flex justify-between items-center mb-8">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
            <span className="font-mono text-sm tracking-widest text-slate-400 uppercase">
              {isCodingRound ? 'Coding Challenge' : 'Technical Session'}
            </span>
          </div>
          <div className={`flex items-center gap-3 px-6 py-2 rounded-full border transition-all duration-500 ${timeLeft < 20 ? 'bg-red-500/20 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'bg-slate-800/50 border-slate-700'}`}>
            <Clock size={16} className={timeLeft < 20 ? 'text-red-500 animate-pulse' : 'text-slate-400'} />
            <span className={`font-mono text-xl font-black ${timeLeft < 20 ? 'text-red-500' : 'text-white'}`}>
              {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
            </span>
          </div>
          <div className="flex gap-4">
            <div className="bg-blue-600/20 px-4 py-1 rounded-full border border-blue-500/30 text-[10px] text-blue-400 font-black uppercase">
              Level: {difficulty}
            </div>
            <div className="bg-slate-800/50 px-4 py-1 rounded-full border border-slate-700 text-xs text-blue-400 font-bold">
              Q {currentQuestionIndex + 1}
            </div>
          </div>
        </header>

        <div className="w-full max-w-7xl grid lg:grid-cols-12 gap-8 flex-1">
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="bg-slate-900/40 border border-slate-800 rounded-[2rem] p-8 backdrop-blur-xl flex-1 shadow-2xl overflow-y-auto">
              <div className="mb-8">
                <p className="text-blue-500 text-[10px] font-bold uppercase mb-2 tracking-[0.2em]">Interviewer:</p>
                <h2 className="text-2xl font-medium leading-relaxed italic text-slate-100 italic">"{questions[currentQuestionIndex]}"</h2>
              </div>
              {isCodingRound ? (
                <div className="rounded-2xl border border-slate-800 overflow-hidden h-[400px] shadow-2xl">
                  <Editor
                    height="100%"
                    theme="vs-dark"
                    defaultLanguage="javascript"
                    defaultValue="// Write your code here..."
                    onChange={(value) => setAnswers(prev => ({ ...prev, [currentQuestionIndex]: value }))}
                    options={{ minimap: { enabled: false }, fontSize: 14, padding: { top: 20 } }}
                  />
                </div>
              ) : (
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-6 min-h-[200px] shadow-inner">
                  <p className="text-slate-600 text-[10px] font-bold mb-4 uppercase">Live Transcript ({language === 'hi-IN' ? 'Hinglish Mode' : 'English Mode'})</p>
                  <p className="text-lg leading-relaxed text-slate-400">
                    {answers[currentQuestionIndex] || ''}
                    <span className="text-blue-500 border-l-2 border-blue-500 ml-1 pl-1">{transcript}</span>
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-4">
              <button onClick={toggleListening} disabled={isTimeUp} className={`flex-1 py-5 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all ${isListening ? 'bg-red-500 shadow-lg shadow-red-500/20' : 'bg-slate-800 hover:bg-slate-700 border border-slate-700'} ${isTimeUp ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {isListening ? <MicOff /> : <Mic />} {isListening ? "Listening..." : isTimeUp ? "Time's Up" : "Unmute to Speak"}
              </button>
              <button onClick={nextQuestion} disabled={isAiThinking} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 py-5 rounded-2xl font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2">
                {isAiThinking ? <Loader2 className="animate-spin" /> : <>Next Question <ChevronRight /></>}
              </button>
              {currentQuestionIndex > 2 && (
                <button onClick={finishInterview} disabled={isAiThinking} className="bg-red-600/20 text-red-500 border border-red-500/30 px-6 rounded-2xl font-bold hover:bg-red-600 hover:text-white transition-all">
                  {isAiThinking ? <Loader2 className="animate-spin" /> : 'Finish'}
                </button>
              )}
            </div>
          </div>
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="relative group flex-1">
              {/* 🔥 Proctoring Message UI */}
              {proctoringMessage && (
                <div className="absolute top-10 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-6 py-2 rounded-full font-black animate-bounce shadow-2xl flex items-center gap-2">
                  <AlertTriangle size={18} /> {proctoringMessage}
                </div>
              )}
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-[2rem] blur opacity-10 transition duration-1000"></div>
              <div className="relative h-full min-h-[400px] bg-black rounded-[2rem] overflow-hidden border border-slate-800 shadow-2xl">
                <video ref={videoRef} autoPlay muted onPlay={handleVideoPlay} className="w-full h-full object-cover scale-x-[-1]" />
                <div className="absolute bottom-6 left-6 bg-black/80 backdrop-blur-xl px-6 py-3 rounded-2xl border border-white/5 flex items-center gap-4">
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Live Emotion</p>
                    <p className="text-xl font-bold text-blue-400 uppercase tracking-widest">{emotion}</p>
                  </div>
                  <div className="w-px h-8 bg-slate-800" />
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Proctoring</p>
                    <div className="flex gap-1 items-center">
                      <div className={`w-3 h-3 rounded-full ${proctoringMessage ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                      <span className="text-[9px] font-black text-slate-300 ml-1">{proctoringMessage ? 'Violating' : 'Secure'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans">
      <nav className="border-b border-slate-800/60 bg-slate-950/50 backdrop-blur-xl p-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold">AI</div>
            <h1 className="text-xl font-bold text-white tracking-tight">Interviewer <span className="text-blue-500">Pro</span></h1>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h2 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight">Master Your <br /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 italic">Interview Skills.</span></h2>
        </div>
        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7 bg-slate-900/40 border border-slate-800 p-10 rounded-[2.5rem] backdrop-blur-sm shadow-2xl">
            <div className="space-y-8">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <BarChart3 size={14} className="text-blue-500" /> Interview Level
                  </label>
                  <div className="flex gap-2 bg-slate-800/40 p-1.5 rounded-2xl border border-slate-700">
                    {['Junior', 'Mid', 'Senior'].map((level) => (
                      <button
                        key={level}
                        onClick={() => setDifficulty(level)}
                        className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${difficulty === level ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:bg-slate-700/50'}`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Globe size={14} className="text-indigo-500" /> Language
                  </label>
                  <div className="flex gap-2 bg-slate-800/40 p-1.5 rounded-2xl border border-slate-700">
                    <button
                      onClick={() => setLanguage('en-US')}
                      className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${language === 'en-US' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-700/50'}`}
                    >
                      English
                    </button>
                    <button
                      onClick={() => setLanguage('hi-IN')}
                      className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${language === 'hi-IN' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-700/50'}`}
                    >
                      Hinglish
                    </button>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-400 uppercase tracking-widest ml-1">Upload Resume</label>
                <div className={`relative group border-2 border-dashed rounded-3xl p-10 transition-all cursor-pointer ${file ? 'border-green-500/40 bg-green-500/5' : 'border-slate-700 bg-slate-800/20 hover:border-blue-500/40 hover:bg-blue-500/5'}`}>
                  <input type="file" id="file-upload" className="hidden" onChange={(e) => setFile(e.target.files[0])} />
                  <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                    <Upload className={`w-12 h-12 mb-4 ${file ? 'text-green-400' : 'text-slate-600'}`} />
                    <p className="text-sm text-slate-400 font-medium">{file ? file.name : "Select PDF Document"}</p>
                  </label>
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-400 uppercase tracking-widest ml-1">Job Description</label>
                <textarea
                  className="w-full bg-slate-800/20 border border-slate-700 rounded-3xl p-6 text-sm h-44 outline-none text-slate-300"
                  placeholder="Paste target job requirements here..."
                  value={jd}
                  onChange={(e) => setJd(e.target.value)}
                />
              </div>
              <button onClick={handleUpload} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 py-5 rounded-[1.5rem] font-bold text-white shadow-xl flex items-center justify-center gap-3 uppercase tracking-widest text-xs">
                {loading ? <><Loader2 className="animate-spin" /> Synchronizing...</> : <><ShieldCheck size={18} /> Process Technical Roadmap</>}
              </button>
            </div>
          </div>
          <div className="lg:col-span-5 bg-slate-900/40 border border-slate-800 rounded-[2.5rem] p-10 backdrop-blur-sm flex flex-col">
            <h3 className="text-lg font-bold text-white mb-8 flex items-center gap-3 uppercase tracking-widest">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div> Live Preview
            </h3>
            <div className="flex-1 space-y-4">
              {questions.map((q, i) => (
                <div key={i} className="bg-slate-800/30 border border-slate-700/50 p-5 rounded-2xl border-l-4 border-l-blue-600">
                  <p className="text-sm text-slate-300 leading-relaxed italic"><span className="text-blue-500 font-mono mr-2">Q{i + 1}:</span> {q}</p>
                </div>
              ))}
            </div>
            {questions.length > 0 && (
              <button
                onClick={() => {
                  const codingKeywords = ["write", "code", "program", "function"];
                  const isFirstCoding = codingKeywords.some(word => questions[0].toLowerCase().includes(word));
                  setIsCodingRound(isFirstCoding);
                  setIsInterviewStarted(true);
                  setTimeout(() => { startVideo(); }, 500);
                }}
                className="mt-8 w-full bg-green-600 hover:bg-green-500 py-6 rounded-3xl font-black text-xl text-white shadow-2xl"
              >
                LAUNCH SIMULATOR 🚀
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;