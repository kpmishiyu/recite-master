import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signOut,
  signInWithCustomToken,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where,
  serverTimestamp 
} from 'firebase/firestore';

// --- SAFE ICONS ONLY ---
import { 
  Book, Plus, Play, Trash2, Edit, Search, ArrowLeft, 
  CheckCircle, XCircle, Clock, Zap, LogOut, User, Save, 
  AlertCircle, FileText, CheckSquare, RefreshCw, 
  PieChart, Eye, List, Trophy, Code, BookOpen, Layers,
  Activity, Flame, TrendingUp, AlertTriangle, Settings,
  LogIn, ChevronRight
} from 'lucide-react';

// --- Firebase Configuration ---
// ⚠️⚠️⚠️ 请确保这里填入了你的 Firebase 配置 ⚠️⚠️⚠️
const firebaseConfig = {
 apiKey: "AIzaSyDEFFqO1tnw7YZQCFbYmKiluAwjoACXJE0",
  authDomain: "recite-master.firebaseapp.com",
  projectId: "recite-master",
  storageBucket: "recite-master.firebasestorage.app",
  messagingSenderId: "953331179802",
  appId: "1:953331179802:web:db03b028bd63c55cea8ca3",
  measurementId: "G-N36X16DC3T"
};
// 防白屏保护
const app = Object.keys(firebaseConfig).length > 0 ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const appId = "public-library-v1";

// --- Helper Functions ---
const generateId = () => Math.random().toString(36).substr(2, 9);

const shuffleArray = (array) => {
  const newArr = [...array];
  newArr.sort(() => Math.random() - 0.5);
  return newArr;
};

const formatDateKey = (date) => {
  return date.toISOString().split('T')[0];
};

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// --- AI Prompt Templates ---
const AI_PROMPT_STANDARD = `请帮我把以下的复习资料整理成 JSON 格式，用于抽背网站。
格式要求：
[
  { "id": "q1", "question": "问题内容", "answer": "答案内容" },
  { "id": "q2", "question": "问题内容", "answer": "答案内容" }
]
请只输出 JSON 代码，不要包含 markdown 标记或其他文字。
以下是我的资料：
(在此处粘贴你的资料)`;

const AI_PROMPT_QUIZ = `请帮我把以下的复习资料整理成 JSON 格式，用于选择题抽背。
你需要为每个问题生成3个错误的干扰选项。
格式要求：
[
  { 
    "id": "q1", 
    "question": "问题内容", 
    "answer": "正确答案",
    "options": ["错误选项1", "错误选项2", "错误选项3"]
  }
]
请只输出 JSON 代码，不要包含 markdown 标记或其他文字。
以下是我的资料：
(在此处粘贴你的资料)`;

// --- COMPONENTS ---

// 1. Login Component
const LoginView = ({ onLogin }) => {
  const handleGoogleLogin = async () => {
    if (!auth) return alert("Firebase 未配置！请检查代码。");
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Google login failed:", error);
      alert("登录失败: " + error.message);
    }
  };

  const handleGuestLogin = async () => {
    if (!auth) return alert("Firebase 未配置！请检查代码。");
    try {
      await signInAnonymously(auth);
    } catch (error) {
      console.error("Guest login failed:", error);
      alert("游客登录失败: " + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
      <div className="bg-white/90 backdrop-blur-md p-8 rounded-2xl shadow-2xl w-full max-w-md animate-fade-in text-center">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-indigo-600 mb-2">记忆大师</h1>
          <p className="text-gray-500">打造你的专属抽背神器</p>
        </div>
        
        <div className="space-y-4">
          <button 
            onClick={handleGoogleLogin}
            className="w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold py-3 rounded-lg transition transform hover:scale-[1.02] active:scale-95 shadow-md flex items-center justify-center"
          >
            <span className="mr-3 font-bold text-blue-500">G</span>
            Google 账号登录
          </button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-300"></div>
            <span className="flex-shrink-0 mx-4 text-gray-400 text-xs">或者</span>
            <div className="flex-grow border-t border-gray-300"></div>
          </div>

          <button 
            onClick={handleGuestLogin}
            className="w-full bg-gray-800 hover:bg-gray-900 text-white font-bold py-3 rounded-lg transition transform hover:scale-[1.02] active:scale-95 shadow-md flex items-center justify-center"
          >
            <User className="mr-2" size={20}/>
            游客试用
          </button>
        </div>
        
        <p className="text-xs text-gray-400 mt-6">
           登录即代表同意我们的服务条款。
        </p>
      </div>
    </div>
  );
};

// 2. Book Component
const BookCard = ({ book, onClick, isOwner, onDelete, onEdit }) => {
  const colors = [
    'from-blue-400 to-blue-600',
    'from-red-400 to-red-600',
    'from-green-400 to-green-600',
    'from-amber-400 to-amber-600',
    'from-purple-400 to-purple-600',
    'from-teal-400 to-teal-600',
  ];
  const colorClass = colors[book.title.length % colors.length];

  return (
    <div className="relative group perspective-1000 cursor-pointer" onClick={onClick}>
      <div className={`relative h-64 w-44 rounded-r-lg rounded-l-sm shadow-xl transition-all duration-300 transform group-hover:-translate-y-2 group-hover:shadow-2xl bg-gradient-to-br ${colorClass}`}>
        <div className="absolute left-0 top-0 bottom-0 w-3 bg-black/20 rounded-l-sm"></div>
        <div className="absolute left-1 top-0 bottom-0 w-0.5 bg-white/10"></div>
        
        <div className="p-4 h-full flex flex-col justify-between text-white">
          <div>
            <h3 className="font-bold text-xl leading-tight break-words shadow-black drop-shadow-md">{book.title}</h3>
            <p className="text-xs mt-2 opacity-80">By {book.authorName || 'User'}</p>
          </div>
          <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
             <div className="bg-white/20 backdrop-blur rounded-full p-2">
                <Play size={16} fill="white" />
             </div>
          </div>
        </div>
      </div>

      {isOwner && (
        <div className="absolute -top-2 -right-2 flex flex-col space-y-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button onClick={(e) => { e.stopPropagation(); onEdit(book); }} className="p-2 bg-white text-blue-500 rounded-full shadow-lg hover:bg-blue-50"><Edit size={14} /></button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(book.id); }} className="p-2 bg-white text-red-500 rounded-full shadow-lg hover:bg-red-50"><Trash2 size={14} /></button>
        </div>
      )}
    </div>
  );
};

// 3. Mode Selection
const ModeSelection = ({ book, userProgress, onBack, onSelectMode }) => {
  const mistakeCount = useMemo(() => {
      let count = 0;
      if (userProgress) {
          Object.values(userProgress).forEach(p => {
              if (p.isMistake) count++;
          });
      }
      return count;
  }, [userProgress]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white shadow-sm p-4 flex items-center">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full mr-4"><ArrowLeft size={24} /></button>
        <h1 className="text-xl font-bold text-gray-800">{book.title} - 选择模式</h1>
      </div>
      <div className="flex-1 p-8 flex items-center justify-center">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl w-full">
          <div onClick={() => onSelectMode('normal')} className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all cursor-pointer border-t-8 border-blue-500 group hover:-translate-y-1">
            <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mb-6 text-blue-600 group-hover:scale-110 transition"><BookOpen size={32} /></div>
            <h2 className="text-2xl font-bold mb-2 text-gray-800">学习模式</h2>
            <p className="text-gray-500">循序渐进：小分组高频循环。</p>
          </div>
          <div onClick={() => onSelectMode('review')} className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all cursor-pointer border-t-8 border-green-500 group hover:-translate-y-1">
            <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mb-6 text-green-600 group-hover:scale-110 transition"><Clock size={32} /></div>
            <h2 className="text-2xl font-bold mb-2 text-gray-800">复习模式</h2>
            <p className="text-gray-500">基于记忆曲线复习。</p>
          </div>
          <div onClick={() => onSelectMode('test')} className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all cursor-pointer border-t-8 border-teal-500 group hover:-translate-y-1">
            <div className="bg-teal-100 w-16 h-16 rounded-full flex items-center justify-center mb-6 text-teal-600 group-hover:scale-110 transition"><FileText size={32} /></div>
            <h2 className="text-2xl font-bold mb-2 text-gray-800">测验卷</h2>
            <p className="text-gray-500">生成试卷并评分。</p>
          </div>
          <div onClick={() => onSelectMode('buzz')} className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all cursor-pointer border-t-8 border-purple-500 group hover:-translate-y-1">
            <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mb-6 text-purple-600 group-hover:scale-110 transition"><Zap size={32} /></div>
            <h2 className="text-2xl font-bold mb-2 text-gray-800">抢答挑战</h2>
            <p className="text-gray-500">手速大比拼！</p>
          </div>
          {mistakeCount > 0 && (
             <div onClick={() => onSelectMode('mistake')} className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all cursor-pointer border-t-8 border-red-500 group hover:-translate-y-1 col-span-1 md:col-span-2 lg:col-span-1">
               <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mb-6 text-red-600 group-hover:scale-110 transition"><AlertTriangle size={32} /></div>
               <div className="flex justify-between items-start">
                 <h2 className="text-2xl font-bold mb-2 text-gray-800">错题突击</h2>
                 <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-xs font-bold">{mistakeCount} 题</span>
               </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Normal Mode (Optimized Logic) ---
const NormalMode = ({ book, userProgress, onUpdateProgress, onExit }) => {
  const POOL_SIZE = 5; 
  const [activeQueue, setActiveQueue] = useState([]);
  const [pendingPool, setPendingPool] = useState([]);
  const [currentQ, setCurrentQ] = useState(null);
  
  // View states
  const [showAnswer, setShowAnswer] = useState(false);
  const [currentOptions, setCurrentOptions] = useState([]);
  const [quizFeedback, setQuizFeedback] = useState(null); // { selected, isCorrect }
  const [isFinished, setIsFinished] = useState(false);
  
  // Initial Load
  useEffect(() => {
    // Filter questions that are NOT mastered
    let initialQueue = book.content.map(q => {
      const prog = userProgress[q.id] || { score: 0, mastery: false };
      return { ...q, ...prog };
    }).filter(q => !q.mastery); 

    if (initialQueue.length === 0) {
        setIsFinished(true);
        return;
    }

    initialQueue.sort(() => Math.random() - 0.5);
    
    const initialActive = initialQueue.slice(0, POOL_SIZE);
    const remaining = initialQueue.slice(POOL_SIZE);
    
    setPendingPool(remaining);
    setActiveQueue(initialActive);
    
    if (initialActive.length > 0) {
        loadQuestion(initialActive[0]);
    }
  }, [book, userProgress]);

  const loadQuestion = (q) => {
     setCurrentQ(q);
     setShowAnswer(false);
     setQuizFeedback(null);
     if (q.score < 2) prepareOptions(q);
  };

  const prepareOptions = (q) => {
    let distractors = [];
    if (q.options && Array.isArray(q.options) && q.options.length >= 3) {
        distractors = q.options.slice(0, 3);
    } else {
      const otherAnswers = book.content.filter(item => item.id !== q.id).map(item => item.answer);
      const uniqueOthers = [...new Set(otherAnswers)].sort(() => Math.random() - 0.5).slice(0, 3);
      while (uniqueOthers.length < 3) uniqueOthers.push("N/A");
      distractors = uniqueOthers;
    }
    const all = [q.answer, ...distractors].sort(() => Math.random() - 0.5);
    setCurrentOptions(all);
  };

  // Stage 1 & 2 Interaction
  const handleOptionClick = (opt) => {
      if (quizFeedback) return; 

      const isCorrect = opt === currentQ.answer;
      setQuizFeedback({ selected: opt, isCorrect });

      if (isCorrect) {
          // Correct: Auto advance fast
          setTimeout(() => processResult(true), 800);
      }
      // Wrong: Stay on screen, show "Next" button
  };

  // Stage 3 Interaction
  const handleFlashcard = (type) => {
      if (type === 'unknown') {
          setShowAnswer(true);
          // Don't process yet, user needs to see answer
      } else if (type === 'correct') {
          processResult(true);
      } else if (type === 'wrong') {
          processResult(false);
      }
  };

  // Core Logic
  const processResult = (isCorrect) => {
    if (!currentQ) return;

    let newScore = currentQ.score;
    let mastered = false;

    if (isCorrect) newScore += 1;
    else newScore = 0; // Wrong resets to 0 (Start over)

    if (newScore >= 3) mastered = true;

    // Optimistic Update Local State first
    onUpdateProgress(currentQ.id, { score: newScore, mastery: mastered, lastReview: Date.now() });
    
    let nextQueue = [...activeQueue];
    let nextPending = [...pendingPool];
    
    // Remove current head
    nextQueue.shift();

    if (mastered) {
        // If mastered, bring in new blood
        if (nextPending.length > 0) {
            nextQueue.push(nextPending.shift());
        }
    } else {
        // Wrong or just stage up: Re-insert
        // Optimization: Don't put it immediately next (index 0). 
        // Put it at least 3 spots back to spacing out.
        const insertIndex = Math.min(nextQueue.length, 3 + Math.floor(Math.random() * 2));
        
        const updatedQ = { ...currentQ, score: newScore };
        
        if (insertIndex >= nextQueue.length) {
            nextQueue.push(updatedQ);
        } else {
            nextQueue.splice(insertIndex, 0, updatedQ);
        }
    }

    // Check if session done
    if (nextQueue.length === 0) {
        setIsFinished(true);
        return;
    }

    setPendingPool(nextPending);
    setActiveQueue(nextQueue);
    loadQuestion(nextQueue[0]);
  };

  if (isFinished) {
       return (
        <div className="flex flex-col items-center justify-center h-full animate-bounce-in">
          <Trophy size={80} className="text-yellow-500 mb-4"/>
          <h2 className="text-3xl font-bold text-gray-800">恭喜！本轮所有题目已掌握！</h2>
          <p className="text-gray-500 mt-2">你真棒！休息一下吧。</p>
          <button onClick={onExit} className="mt-8 px-8 py-3 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700">返回书架</button>
        </div>
       );
  }

  if (!currentQ) return <div className="flex items-center justify-center h-full">准备中...</div>;

  const isQuizPhase = currentQ.score < 2;

  return (
    <div className="max-w-2xl mx-auto w-full h-full flex flex-col justify-center p-4">
      <div className="absolute top-4 right-4 flex gap-4">
        <button onClick={onExit} className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium"><Save size={18} /> 退出</button>
      </div>

      <div className="mb-6 flex items-center justify-between text-gray-500 text-sm font-bold">
         <div className="flex items-center gap-2">
            <Layers size={18} className="text-indigo-500" />
            <span>学习池: {activeQueue.length}</span>
         </div>
         <div className="flex items-center gap-2">
            <Zap size={18} className={currentQ.score >= 2 ? "text-blue-600" : "text-gray-300"} />
            <span>{currentQ.score === 0 ? "阶段 1: 印象" : currentQ.score === 1 ? "阶段 2: 巩固" : "阶段 3: 回忆"}</span>
         </div>
      </div>

      <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 min-h-[400px] flex flex-col relative">
          <div className="h-2 bg-gray-100 w-full"><div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${(currentQ.score / 3) * 100}%` }}></div></div>
          
          <div className="flex-1 flex items-center justify-center p-8 text-center flex-col">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 leading-relaxed mb-8">{currentQ.question}</h2>
            
            {/* Stage 3: Answer Reveal */}
            {!isQuizPhase && showAnswer && (
              <div className="p-6 bg-blue-50 rounded-xl animate-fade-in w-full">
                <p className="text-xl text-blue-800 font-medium">{currentQ.answer}</p>
              </div>
            )}
          </div>

          <div className="p-6 bg-gray-50 border-t border-gray-100">
            {isQuizPhase ? (
               <div className="w-full">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {currentOptions.map((opt, idx) => {
                       let btnClass = "bg-white border-2 border-indigo-50 text-gray-700 font-bold text-lg hover:bg-indigo-50 hover:border-indigo-200";
                       if (quizFeedback) {
                           if (opt === currentQ.answer) btnClass = "bg-green-100 border-green-500 text-green-800";
                           else if (opt === quizFeedback.selected && !quizFeedback.isCorrect) btnClass = "bg-red-100 border-red-500 text-red-800";
                           else btnClass = "opacity-40 border-gray-100 bg-gray-50";
                       } else {
                           btnClass += " transition transform active:scale-95 shadow-sm";
                       }
                       return (
                         <button key={idx} onClick={() => handleOptionClick(opt)} disabled={!!quizFeedback} className={`p-4 rounded-xl ${btnClass}`}>{opt}</button>
                       )
                    })}
                 </div>
                 {/* Incorrect Feedback: Pause & Show Next Button */}
                 {quizFeedback && !quizFeedback.isCorrect && (
                     <div className="text-center animate-bounce-in p-4 bg-red-50 border border-red-100 rounded-lg">
                         <span className="text-red-500 font-bold text-lg block mb-3">正确答案是：{currentQ.answer}</span>
                         <button onClick={() => processResult(false)} className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-full shadow-lg hover:bg-indigo-700 transition transform active:scale-95 flex items-center justify-center mx-auto">
                            <ChevronRight className="mr-1"/> 下一题 (记住了)
                         </button>
                     </div>
                 )}
               </div>
            ) : (
               // Stage 3
               !showAnswer ? (
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => handleFlashcard('unknown')} className="py-4 rounded-xl bg-gray-200 text-gray-700 font-bold text-lg hover:bg-gray-300 transition transform active:scale-95">不清楚</button>
                    <button onClick={() => handleFlashcard('correct')} className="py-4 rounded-xl bg-indigo-600 text-white font-bold text-lg hover:bg-indigo-700 transition transform active:scale-95 shadow-lg shadow-indigo-200">知道答案</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => handleFlashcard('wrong')} className="py-4 rounded-xl bg-red-100 text-red-600 font-bold text-lg hover:bg-red-200 transition transform active:scale-95 flex items-center justify-center gap-2"><XCircle /> 还是没记住</button>
                    <button onClick={() => handleFlashcard('correct')} className="py-4 rounded-xl bg-green-100 text-green-600 font-bold text-lg hover:bg-green-200 transition transform active:scale-95 flex items-center justify-center gap-2"><CheckCircle /> 现在记住了</button>
                  </div>
                )
            )}
          </div>
      </div>
    </div>
  );
};

// --- Buzz Mode (Optimized with Exit & Summary) ---
const BuzzMode = ({ book, onExit, onUpdateProgress }) => {
    const [questions, setQuestions] = useState([]); 
    const [idx, setIdx] = useState(-1); 
    const [text, setText] = useState(""); 
    const [buzzed, setBuzzed] = useState(false); 
    const [results, setResults] = useState([]); 
    const [showAnswer, setShowAnswer] = useState(false); // New state for answer reveal
    const intervalRef = useRef(null);

    useEffect(() => { 
        const pool = shuffleArray([...book.content]); 
        setQuestions(pool.slice(0, 10)); 
        setIdx(0); 
    }, []);

    useEffect(() => { 
        if (idx >= 0 && idx < questions.length && !buzzed) { 
            setText(""); 
            let i = 0; 
            const q = questions[idx].question; 
            intervalRef.current = setInterval(() => { 
                setText(q.substring(0, i+1)); 
                i++; 
                if (i === q.length) clearInterval(intervalRef.current); 
            }, 150); 
        } 
        return () => clearInterval(intervalRef.current); 
    }, [idx, questions, buzzed]);

    const handleBuzz = () => { 
        clearInterval(intervalRef.current); 
        setText(questions[idx].question); 
        setBuzzed(true); 
        setShowAnswer(true); // Show answer immediately on buzz
    };

    const handleAnswer = (correct) => { 
        if(!correct) onUpdateProgress(questions[idx].id, { isMistake: true }); // Only buzz wrong goes to mistake
        setResults([...results, { q: questions[idx], correct }]); 
        setBuzzed(false); 
        setShowAnswer(false);
        setIdx(idx + 1); 
    };

    if (idx === -1) return <div className="flex items-center justify-center h-full">加载中...</div>;

    // Summary Screen
    if (idx >= questions.length) return (
        <div className="flex flex-col items-center justify-center h-full p-6 animate-fade-in">
            <h2 className="text-3xl font-bold mb-6 text-gray-800">挑战结束</h2>
            <div className="text-6xl font-black text-indigo-600 mb-2">{results.filter(r=>r.correct).length} / {questions.length}</div>
            <p className="text-gray-400 mb-8">错题已加入错题突击列表</p>
            <div className="w-full max-w-md bg-white rounded-xl shadow overflow-y-auto max-h-60 mb-8">
                {results.map((res, i) => (
                    <div key={i} className={`p-3 border-b flex justify-between items-center ${res.correct ? 'bg-green-50' : 'bg-red-50'}`}>
                        <span className="truncate w-3/4 text-sm">{res.q.question}</span>
                        {res.correct ? <CheckCircle size={16} className="text-green-600"/> : <XCircle size={16} className="text-red-600"/>}
                    </div>
                ))}
            </div>
            <button onClick={onExit} className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-bold shadow-lg">完成</button>
        </div>
    );

    return (
        <div className="flex flex-col h-full justify-center items-center p-4 relative">
            {/* Exit Button */}
            <button onClick={onExit} className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200"><XCircle size={24} className="text-gray-500"/></button>

            <div className="text-gray-400 font-mono mb-8">Q: {idx + 1} / {questions.length}</div>

            <div className="flex-1 flex flex-col justify-center items-center w-full">
                 <h2 className="text-3xl md:text-5xl font-bold mb-8 text-center leading-snug min-h-[120px]">
                     {text}
                     {!buzzed && <span className="animate-pulse text-indigo-500">|</span>}
                 </h2>
                 
                 {/* Answer Reveal */}
                 {showAnswer && (
                     <div className="animate-bounce-in bg-indigo-50 px-8 py-4 rounded-2xl mb-8">
                         <p className="text-2xl text-indigo-800 font-bold">{questions[idx].answer}</p>
                     </div>
                 )}
            </div>

            <div className="h-32 w-full flex items-center justify-center">
                {!buzzed ? (
                    <button onClick={handleBuzz} className="w-32 h-32 rounded-full bg-red-600 text-white font-black text-2xl shadow-2xl hover:scale-105 transition active:scale-95 flex flex-col items-center justify-center">
                        <Zap size={32} className="mb-2"/> 抢答
                    </button>
                ) : (
                    <div className="flex gap-6 w-full max-w-md animate-fade-in">
                        <button onClick={() => handleAnswer(false)} className="flex-1 py-4 bg-red-100 text-red-600 font-bold rounded-xl hover:bg-red-200 text-xl">答错</button>
                        <button onClick={() => handleAnswer(true)} className="flex-1 py-4 bg-green-100 text-green-600 font-bold rounded-xl hover:bg-green-200 text-xl">答对</button>
                    </div>
                )}
            </div>
        </div>
    );
};

// ... TestMode, ReviewMode, BookEditor, BookMistakeMode (Logic from previous perfected version) ...
const TestMode = ({ book, onExit, onUpdateProgress }) => {
    const [viewMode, setViewMode] = useState('config'); 
    const [config, setConfig] = useState({ matching: 0, mcq: 0, fill: 0, timeLimit: false, duration: 15 });
    const [testData, setTestData] = useState(null);
    const [userAnswers, setUserAnswers] = useState({}); 
    const [score, setScore] = useState(null); 
    const [timeLeft, setTimeLeft] = useState(0);
    const [showConfirm, setShowConfirm] = useState(false);

    const maxQuestions = book.content.length;
    const maxMatching = Math.floor(maxQuestions / 2);
    const totalSelected = config.matching + config.mcq + config.fill;
    const isConfigValid = totalSelected > 0 && totalSelected <= maxQuestions;
  
    useEffect(() => {
        setConfig({ matching: 0, mcq: 0, fill: 0, timeLimit: false, duration: 15 });
    }, []);
  
    useEffect(() => {
      if (viewMode === 'test' && config.timeLimit && timeLeft > 0) {
        const timer = setInterval(() => {
          setTimeLeft(prev => {
            if (prev <= 1) {
              clearInterval(timer);
              handleSubmit(true); 
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        return () => clearInterval(timer);
      }
    }, [viewMode, config.timeLimit, timeLeft]);

    const autoFillConfig = () => {
        const perType = Math.floor(maxQuestions / 3);
        const remain = maxQuestions % 3;
        const safeMatching = Math.min(perType, maxMatching);
        setConfig({
            ...config,
            matching: safeMatching,
            mcq: perType + (remain > 0 ? 1 : 0),
            fill: perType + (remain > 1 ? 1 : 0)
        });
    };
  
    const generateTest = () => {
      if (!isConfigValid) return;
      let pool = shuffleArray(book.content);
      let currentPoolIdx = 0;
      const getQuestions = (count) => {
        const slice = pool.slice(currentPoolIdx, currentPoolIdx + count);
        currentPoolIdx += count;
        return slice;
      };
      const matchingQ = getQuestions(config.matching);
      const mcqQ = getQuestions(config.mcq);
      const fillQ = getQuestions(config.fill);
  
      const matchingPairs = matchingQ.map(q => ({ id: q.id, q: q.question, a: q.answer }));
      const matchingRight = shuffleArray([...matchingPairs]);
      const mcqData = mcqQ.map(q => {
        let options = q.options && q.options.length >= 3 ? q.options.slice(0, 3) : [];
        if (options.length < 3) {
           const otherAnswers = book.content.filter(x => x.id !== q.id).map(x => x.answer);
           const unique = shuffleArray([...new Set(otherAnswers)]).slice(0, 3);
           options = unique;
           while(options.length < 3) options.push("暂无选项");
        }
        const all = shuffleArray([q.answer, ...options]);
        return { ...q, allOptions: all };
      });
      setTestData({ matching: { left: matchingPairs, right: matchingRight }, mcq: mcqData, fill: fillQ });
      if (config.timeLimit) setTimeLeft(config.duration * 60);
      setViewMode('test');
    };
  
    const handleSubmit = (auto = false) => {
      setShowConfirm(false);
  
      let correctCount = 0;
      const detail = {};
      
      const checkAndMark = (qId, isCorrect) => {
          if (isCorrect) correctCount++;
          detail[qId] = isCorrect;
          if (!isCorrect) {
              onUpdateProgress(qId, { isMistake: true });
          }
      };
  
      if(testData?.matching) testData.matching.left.forEach(item => {
         const userSelectedRightId = userAnswers[`match_left_${item.id}`];
         checkAndMark(item.id, userSelectedRightId === item.id);
      });
  
      if(testData?.mcq) testData.mcq.forEach(item => {
         const val = userAnswers[`mcq_${item.id}`];
         checkAndMark(item.id, val === item.answer);
      });
  
      if(testData?.fill) testData.fill.forEach(item => {
         const val = userAnswers[`fill_${item.id}`] || "";
         checkAndMark(item.id, val.trim().toLowerCase() === item.answer.trim().toLowerCase());
      });
  
      const total = config.matching + config.mcq + config.fill;
      let grade = 'F';
      const ratio = total === 0 ? 0 : correctCount / total;
      if (ratio >= 0.95) grade = 'S';
      else if (ratio >= 0.85) grade = 'A';
      else if (ratio >= 0.7) grade = 'B';
      else if (ratio >= 0.6) grade = 'C';

      let stats = { matching: {total: config.matching, correct: 0}, mcq: {total: config.mcq, correct: 0}, fill: {total: config.fill, correct: 0} };
      if(testData.matching) testData.matching.left.forEach(item => { if(detail[item.id]) stats.matching.correct++; });
      if(testData.mcq) testData.mcq.forEach(item => { if(detail[item.id]) stats.mcq.correct++; });
      if(testData.fill) testData.fill.forEach(item => { if(detail[item.id]) stats.fill.correct++; });
  
      setScore({ correct: correctCount, total, grade, detail, stats });
      setViewMode('report');
    };

    const handleMatchClickLeft = (id) => {
        if (viewMode !== 'test') return; 
        if (userAnswers[`match_left_${id}`]) {
            const newAns = {...userAnswers};
            delete newAns[`match_left_${id}`];
            setUserAnswers(newAns);
            return;
        }
        setUserAnswers({...userAnswers, selected_left: id});
    };
    const handleMatchClickRight = (id) => {
        if (viewMode !== 'test') return;
        const selectedLeft = userAnswers.selected_left;
        if (selectedLeft) {
            const isUsed = Object.keys(userAnswers).some(key => key.startsWith('match_left_') && userAnswers[key] === id);
            if (isUsed) return; 
            setUserAnswers({ ...userAnswers, [`match_left_${selectedLeft}`]: id, selected_left: null });
        }
    };
    const pairColors = ["bg-red-500", "bg-blue-500", "bg-green-500", "bg-yellow-500", "bg-purple-500", "bg-pink-500", "bg-indigo-500", "bg-teal-500"];

    if (viewMode === 'config') {
        return (
            <div className="max-w-2xl mx-auto pt-10 p-6 bg-white rounded-2xl shadow-xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center"><FileText className="mr-2 text-indigo-600"/> 测验卷配置</h2>
                    <button onClick={onExit}><XCircle className="text-gray-400"/></button>
                </div>
                <div className="space-y-6">
                    <div><label className="flex justify-between font-bold"><span>配对题</span><span>{config.matching}题</span></label><input type="range" min="0" max={maxMatching} value={config.matching} onChange={e => setConfig({...config, matching: parseInt(e.target.value)})} className="w-full accent-indigo-600"/></div>
                    <div><label className="flex justify-between font-bold"><span>选择题</span><span>{config.mcq}题</span></label><input type="range" min="0" max={maxQuestions} value={config.mcq} onChange={e => setConfig({...config, mcq: parseInt(e.target.value)})} className="w-full accent-indigo-600"/></div>
                    <div><label className="flex justify-between font-bold"><span>填充题</span><span>{config.fill}题</span></label><input type="range" min="0" max={maxQuestions} value={config.fill} onChange={e => setConfig({...config, fill: parseInt(e.target.value)})} className="w-full accent-indigo-600"/></div>
                    <div className="flex justify-between items-center pt-4 border-t"><div className="flex items-center gap-2"><span className={`text-sm font-bold ${totalSelected > maxQuestions ? 'text-red-500' : 'text-gray-500'}`}>总计: {totalSelected}/{maxQuestions}</span>{totalSelected > maxQuestions && <AlertCircle size={14} className="text-red-500"/>}</div><button onClick={autoFillConfig} className="text-xs text-indigo-600 font-bold hover:underline">智能填满</button></div>
                    <button disabled={!isConfigValid} onClick={generateTest} className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold shadow disabled:opacity-50">开始测验</button>
                </div>
            </div>
        )
    }

    if (viewMode === 'report') {
        return (
           <div className="max-w-3xl mx-auto pt-10 p-6 animate-fade-in">
              <div className="bg-white rounded-3xl shadow-2xl p-8 mb-8">
                 <div className="text-center border-b pb-6 mb-6">
                    <h2 className="text-gray-500 uppercase tracking-wider font-bold mb-2">测评报告</h2>
                    <div className={`text-8xl font-black mb-2 ${score.grade === 'S' || score.grade === 'A' ? 'text-green-500' : score.grade === 'F' ? 'text-red-500' : 'text-indigo-600'}`}>{score.grade}</div>
                    <div className="text-2xl font-bold text-gray-800">总分: {score.correct} / {score.total}</div>
                 </div>
                 
                 <div className="grid grid-cols-3 gap-4 mb-6 text-center">
                    <div className="p-4 bg-gray-50 rounded-xl">
                       <div className="text-xs text-gray-500 uppercase font-bold mb-1">配对题</div>
                       <div className={`text-xl font-bold ${score.stats.matching.correct === score.stats.matching.total ? 'text-green-600' : 'text-gray-800'}`}>{score.stats.matching.correct}/{score.stats.matching.total}</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl">
                       <div className="text-xs text-gray-500 uppercase font-bold mb-1">选择题</div>
                       <div className={`text-xl font-bold ${score.stats.mcq.correct === score.stats.mcq.total ? 'text-green-600' : 'text-gray-800'}`}>{score.stats.mcq.correct}/{score.stats.mcq.total}</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl">
                       <div className="text-xs text-gray-500 uppercase font-bold mb-1">填充题</div>
                       <div className={`text-xl font-bold ${score.stats.fill.correct === score.stats.fill.total ? 'text-green-600' : 'text-gray-800'}`}>{score.stats.fill.correct}/{score.stats.fill.total}</div>
                    </div>
                 </div>
                 <div className="flex gap-4">
                    <button onClick={() => setViewMode('review')} className="flex-1 py-3 bg-white border-2 border-indigo-100 text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 flex items-center justify-center"><Eye size={18} className="mr-2"/> 重阅试卷 (查看错题)</button>
                 </div>
              </div>
              <div className="flex justify-center gap-4">
                 <button onClick={() => { setViewMode('config'); setUserAnswers({}); }} className="text-gray-500 hover:text-gray-800 font-bold">再测一次</button>
                 <span className="text-gray-300">|</span>
                 <button onClick={onExit} className="text-gray-500 hover:text-gray-800 font-bold">退出</button>
              </div>
           </div>
        )
    }

    const isReview = viewMode === 'review';

    return (
        <div className="max-w-4xl mx-auto min-h-screen bg-white shadow-2xl my-8 rounded-lg overflow-hidden flex flex-col relative">
            <div className={`sticky top-0 z-30 backdrop-blur border-b px-8 py-4 flex justify-between items-center shadow-sm ${isReview ? 'bg-orange-50/95' : 'bg-white/95'}`}>
                <div className="font-bold text-gray-700 flex items-center">{isReview ? <><Eye className="mr-2 text-orange-600"/> 试卷回顾</> : <><FileText className="mr-2 text-indigo-600"/> 阶段测验</>}</div>
                {config.timeLimit && !isReview && <div className="font-mono text-xl font-bold px-4 py-1 bg-gray-100 rounded">{formatTime(timeLeft)}</div>}
                {isReview && <button onClick={() => setViewMode('report')} className="text-sm bg-white border px-3 py-1 rounded shadow-sm">返回报告</button>}
            </div>
            <div className="flex-1 p-8 space-y-12 overflow-y-auto">
                {/* Matching Render */}
                {testData.matching.left.length > 0 && (
                    <div>
                        <h3 className="font-bold text-lg mb-4 border-l-4 border-indigo-500 pl-3">一、配对题</h3>
                        {isReview ? (
                             <div className="space-y-2">
                                {testData.matching.left.map((item, idx) => {
                                   const userRightId = userAnswers[`match_left_${item.id}`];
                                   const userRightText = testData.matching.right.find(r => r.id === userRightId)?.a || "未作答";
                                   const isCorrect = userRightId === item.id;
                                   return (
                                      <div key={idx} className={`p-3 rounded border-l-4 ${isCorrect ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
                                         <div className="flex justify-between"><span className="font-bold w-1/2">{item.q}</span><div className="text-right w-1/2"><span className={isCorrect ? "text-green-700 font-bold" : "text-red-700 line-through mr-2"}>{userRightText}</span>{!isCorrect && <span className="text-green-700 font-bold block text-sm mt-1">正确: {item.a}</span>}</div></div>
                                      </div>
                                   )
                                })}
                             </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-2">{testData.matching.left.map(i => {
                                    const pairId = userAnswers[`match_left_${i.id}`];
                                    let color = pairId ? pairColors[Object.keys(userAnswers).filter(k => k.startsWith('match_left_')).sort().indexOf(`match_left_${i.id}`) % pairColors.length] : '';
                                    return <div key={i.id} onClick={() => handleMatchClickLeft(i.id)} className={`p-3 border-2 rounded cursor-pointer ${userAnswers.selected_left === i.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'} ${pairId ? 'opacity-50' : ''}`}>{i.q} {pairId && <span className={`inline-block w-3 h-3 rounded-full ml-2 ${color}`}></span>}</div>
                                })}</div>
                                <div className="space-y-2">{testData.matching.right.map(i => (
                                    <div key={i.id} onClick={() => handleMatchClickRight(i.id)} className="p-3 border rounded cursor-pointer hover:bg-gray-50">{i.a}</div>
                                ))}</div>
                            </div>
                        )}
                    </div>
                )}
                {/* MCQ Render */}
                {testData.mcq.length > 0 && (
                    <div>
                        <h3 className="font-bold text-lg mb-4 border-l-4 border-indigo-500 pl-3">二、选择题</h3>
                        <div className="space-y-6">{testData.mcq.map((item, idx) => {
                            const userVal = userAnswers[`mcq_${item.id}`];
                            const isCorrect = isReview ? userVal === item.answer : undefined;
                            return (
                            <div key={item.id} className={`p-4 rounded-xl ${isReview ? (isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200') : ''}`}>
                                <p className="font-bold mb-2">{idx+1}. {item.question} {isReview && !isCorrect && <span className="ml-2 text-red-500 text-sm font-bold">正确: {item.answer}</span>}</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {item.allOptions.map((opt, oid) => {
                                        const isSelected = userVal === opt;
                                        let style = "bg-white hover:bg-gray-50";
                                        if (isReview) {
                                            if (opt === item.answer) style = "bg-green-200 border-green-500";
                                            else if (isSelected) style = "bg-red-200 border-red-500";
                                        } else if (isSelected) {
                                            style = "bg-indigo-100 border-indigo-500";
                                        }
                                        return (
                                        <button key={oid} onClick={() => !isReview && setUserAnswers({...userAnswers, [`mcq_${item.id}`]: opt})} className={`p-2 border rounded text-left ${style}`}>{opt}</button>
                                    )})}
                                </div>
                            </div>
                        )})}</div>
                    </div>
                )}
                {/* Fill Render */}
                {testData.fill.length > 0 && (
                    <div>
                         <h3 className="font-bold text-lg mb-4 border-l-4 border-indigo-500 pl-3">三、填空题</h3>
                         <div className="space-y-4">{testData.fill.map((item, idx) => {
                             const userVal = userAnswers[`fill_${item.id}`] || '';
                             const isCorrect = isReview ? userVal.trim().toLowerCase() === item.answer.trim().toLowerCase() : undefined;
                             return (
                                 <div key={item.id} className={`flex flex-col gap-2 p-3 rounded ${isReview ? (isCorrect ? 'bg-green-50' : 'bg-red-50') : ''}`}>
                                     <div className="flex items-center gap-4">
                                         <span className="font-bold md:w-1/3">{idx+1}. {item.question}</span>
                                         <input disabled={isReview} className="border-b-2 border-gray-300 focus:border-indigo-500 outline-none flex-1 py-1 bg-transparent" onChange={e => setUserAnswers({...userAnswers, [`fill_${item.id}`]: e.target.value})} value={userVal} placeholder={isReview ? "" : "输入答案"}/>
                                     </div>
                                     {isReview && !isCorrect && <p className="text-xs text-green-700 font-bold pl-4">正确答案: {item.answer}</p>}
                                 </div>
                             )
                         })}</div>
                    </div>
                )}
            </div>
            {!isReview && (
                <div className="p-6 border-t bg-gray-50 flex justify-end gap-4 sticky bottom-0 shadow-lg z-30">
                    <button onClick={onExit} className="px-6 py-2 text-gray-500">暂存退出</button>
                    <button onClick={() => setShowConfirm(true)} className="px-8 py-2 bg-indigo-600 text-white rounded shadow">提交试卷</button>
                </div>
            )}
            {showConfirm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"><div className="bg-white rounded-xl p-6 shadow-2xl"><h3 className="text-lg font-bold mb-4">确认交卷？</h3><div className="flex gap-4"><button onClick={() => setShowConfirm(false)} className="flex-1 py-2 bg-gray-100 rounded">取消</button><button onClick={() => handleSubmit(false)} className="flex-1 py-2 bg-indigo-600 text-white rounded">确认</button></div></div></div>
            )}
        </div>
    )
};

const ReviewMode = ({ book, userProgress, onUpdateProgress, onExit }) => {
    const [queue, setQueue] = useState([]); const [currentQ, setCurrentQ] = useState(null); const [showAnswer, setShowAnswer] = useState(false);
    useEffect(() => { const now = Date.now(); const reviewQueue = book.content.map(q => { const prog = userProgress[q.id]; if (!prog || !prog.mastery || (prog.nextReview && prog.nextReview > now)) return null; return { ...q, ...prog }; }).filter(Boolean); setQueue(reviewQueue); if (reviewQueue.length > 0) setCurrentQ(reviewQueue[0]); }, []);
    const handleReview = (success) => { if (!currentQ) return; let currentStreak = currentQ.reviewStreak || 0; let nextIntervalDays = 1; if (success) { currentStreak += 1; nextIntervalDays = Math.pow(2, currentStreak); } else { currentStreak = 0; } const nextDate = Date.now() + (nextIntervalDays * 24 * 60 * 60 * 1000); onUpdateProgress(currentQ.id, { nextReview: nextDate, reviewStreak: currentStreak }); const nextQueue = queue.slice(1); setQueue(nextQueue); if (nextQueue.length > 0) { setCurrentQ(nextQueue[0]); setShowAnswer(false); } else { setCurrentQ(null); } };
    if (!currentQ) return <div className="flex flex-col items-center justify-center h-full"><CheckCircle size={60} className="text-green-600 mb-4"/><h2 className="text-2xl font-bold">今日复习完成！</h2><button onClick={onExit} className="mt-8 px-6 py-2 bg-gray-800 text-white rounded-lg">返回</button></div>;
    return (<div className="max-w-2xl mx-auto w-full h-full flex flex-col justify-center"><div className="text-center mb-4 font-bold">复习模式</div><div className="bg-white rounded-3xl shadow-xl p-10 text-center"><h2 className="text-3xl font-bold mb-8">{currentQ.question}</h2>{showAnswer ? <div className="text-xl text-green-800 mb-8">{currentQ.answer}</div> : <button onClick={() => setShowAnswer(true)} className="w-full py-4 bg-green-600 text-white rounded-xl font-bold">查看答案</button>}{showAnswer && <div className="grid grid-cols-2 gap-4"><button onClick={() => handleReview(false)} className="py-4 bg-red-100 text-red-600 rounded-xl font-bold">忘记了</button><button onClick={() => handleReview(true)} className="py-4 bg-green-100 text-green-600 rounded-xl font-bold">记得</button></div>}</div><button onClick={onExit} className="mt-6 text-gray-500">退出</button></div>);
};

const BookMistakeMode = ({ book, userProgress, onUpdateProgress, onExit }) => {
    const [mistakes, setMistakes] = useState([]);
    const [currentQ, setCurrentQ] = useState(null);
    const [showAnswer, setShowAnswer] = useState(false);
  
    useEffect(() => {
       const list = [];
       const bookProg = userProgress || {}; // Single book progress passed in
       book.content.forEach(q => {
           const qProg = bookProg[q.id];
           if (qProg && qProg.isMistake) {
              list.push({ ...q, ...qProg });
           }
       });
       setMistakes(shuffleArray(list));
    }, [book, userProgress]);
  
    useEffect(() => {
       if (!currentQ && mistakes.length > 0) {
          setCurrentQ(mistakes[0]);
          setShowAnswer(false);
       }
    }, [mistakes, currentQ]);
  
    const handleResolve = (isFixed) => {
       if (!currentQ) return;
       
       if (isFixed) {
           // Remove mistake flag
           onUpdateProgress(currentQ.id, { isMistake: false }); 
           setMistakes(prev => prev.slice(1)); 
       } else {
           // Keep mistake flag, move to end
           setMistakes(prev => [...prev.slice(1), currentQ]);
       }
       setCurrentQ(null);
    };
  
    if (mistakes.length === 0 && !currentQ) {
        return (
          <div className="flex flex-col items-center justify-center h-full animate-bounce-in">
             <CheckCircle size={80} className="text-green-500 mb-4"/>
             <h2 className="text-3xl font-bold text-gray-800">错题已清空！</h2>
             <button onClick={onExit} className="mt-8 px-8 py-3 bg-gray-800 text-white rounded-full shadow-lg hover:bg-gray-900">返回菜单</button>
          </div>
        );
    }
    
    if (!currentQ) return <div className="flex items-center justify-center h-full">加载中...</div>;
  
    return (
      <div className="max-w-2xl mx-auto w-full h-full flex flex-col justify-center p-4">
          <div className="flex justify-between items-center mb-6">
             <div className="flex items-center text-red-600 font-bold">
                <AlertTriangle className="mr-2" size={24}/> 错题突击 ({mistakes.length})
             </div>
             <button onClick={onExit} className="text-gray-400 hover:text-gray-600"><XCircle/></button>
          </div>
  
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border-t-8 border-red-500 min-h-[400px] flex flex-col">
              <div className="flex-1 flex items-center justify-center p-10 text-center flex-col">
                  <h2 className="text-3xl font-bold text-gray-800 mb-8">{currentQ.question}</h2>
                  {showAnswer && (
                      <div className="p-6 bg-red-50 rounded-xl w-full animate-fade-in border border-red-100">
                          <p className="text-xl text-red-800 font-medium">{currentQ.answer}</p>
                      </div>
                  )}
              </div>
              
              <div className="p-6 bg-gray-50 border-t border-gray-100">
                  {!showAnswer ? (
                      <button onClick={() => setShowAnswer(true)} className="w-full py-4 bg-red-600 text-white rounded-xl font-bold shadow-lg hover:bg-red-700 transform active:scale-95 transition">查看答案</button>
                  ) : (
                      <div className="grid grid-cols-2 gap-4">
                          <button onClick={() => handleResolve(false)} className="py-4 bg-red-100 text-red-600 rounded-xl font-bold hover:bg-red-200">还是不会</button>
                          <button onClick={() => handleResolve(true)} className="py-4 bg-green-100 text-green-600 rounded-xl font-bold hover:bg-green-200 flex items-center justify-center gap-2"><CheckSquare size={18}/> 我记住了 (移除)</button>
                      </div>
                  )}
              </div>
          </div>
      </div>
    );
};

// --- MAIN APP ---

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('auth'); 
  const [books, setBooks] = useState([]); 
  const [myBooks, setMyBooks] = useState([]); 
  const [currentBook, setCurrentBook] = useState(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [userProgress, setUserProgress] = useState({}); 
  
  useEffect(() => {
    const initAuth = async () => {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
        } else {
            await signInAnonymously(auth);
        }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
        if (u) {
            setUser(u);
            setView('home');
        } else {
            setUser(null); // Fix: clear user on logout
            setView('auth');
        }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'books'));
    const unsubBooks = onSnapshot(q, (snapshot) => {
        const b = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setBooks(b);
    }, (err) => console.error("Books fetch error", err));

    const userRef = doc(db, 'artifacts', appId, 'users', user.uid, 'data', 'profile');
    const unsubProfile = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
            setMyBooks(docSnap.data().myBooks || []);
            setUserProgress(docSnap.data().progress || {});
        }
    }, (err) => {
       setDoc(userRef, { myBooks: [], progress: {} }, { merge: true });
    });

    return () => {
        unsubBooks();
        unsubProfile();
    }
  }, [user]);

  const handleCreateBook = async ({ title, password, content }) => {
    try {
        const bookData = {
            title,
            password,
            content,
            ownerId: user.uid,
            authorName: localStorage.getItem('recite_user_name') || 'User',
            version: 1,
            createdAt: serverTimestamp()
        };

        let bookId;
        if (editTarget) {
            const newVersion = editTarget.version + 1;
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'books', editTarget.id), {
                ...bookData,
                version: newVersion
            });
            bookId = editTarget.id;
        } else {
            const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'books'), bookData);
            bookId = docRef.id;
            await addMyBook(bookId, password); 
        }
        setIsEditorOpen(false);
        setEditTarget(null);
    } catch (e) {
        console.error(e);
    }
  };

  const handleDeleteBook = async (bookId) => {
      if(!confirm("确定删除？这将无法恢复。")) return;
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'books', bookId));
  };

  const addMyBook = async (bookId, inputPassword) => {
      const book = books.find(b => b.id === bookId);
      if (!book) return;
      if (book.password && book.password !== inputPassword) {
          alert("密码错误");
          return;
      }
      const newMyBooks = [bookId, ...myBooks];
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'data', 'profile'), {
          myBooks: newMyBooks
      }, { merge: true });
  };
  
  const removeMyBook = async (bookId) => {
      const newMyBooks = myBooks.filter(id => id !== bookId);
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'data', 'profile'), {
          myBooks: newMyBooks
      }, { merge: true });
  };

  const updateProgress = async (bookId, qId, resultObj) => {
      if (!currentBook) return;
      const currentBookProgress = userProgress[bookId] || {};
      const updatedBookProgress = {
          ...currentBookProgress,
          [qId]: { ...currentBookProgress[qId], ...resultObj }
      };
      const newFullProgress = {
          ...userProgress,
          [bookId]: updatedBookProgress
      };
      setUserProgress(newFullProgress);
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'data', 'profile'), {
          progress: newFullProgress
      }, { merge: true });
  };

  const handleOpenBook = (book) => {
      if (myBooks.includes(book.id)) {
          const newOrder = [book.id, ...myBooks.filter(id => id !== book.id)];
          if (user) {
              setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'data', 'profile'), {
                  myBooks: newOrder
              }, { merge: true });
          }
      }
      const storedProgress = userProgress[book.id];
      if (storedProgress && storedProgress._version && storedProgress._version < book.version) {
          const emptyProg = { _version: book.version };
           setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'data', 'profile'), {
              progress: { ...userProgress, [book.id]: emptyProg }
          }, { merge: true });
      }
      setCurrentBook(book);
      setView('mode_select');
  };

  if (!user) return <LoginView onLogin={() => {}} />;

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-900">
      {['home', 'find'].includes(view) && (
        <nav className="bg-white shadow sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex justify-between items-center h-16">
               <div className="flex space-x-8">
                  <button onClick={() => setView('home')} className={`flex items-center px-3 py-2 text-sm font-medium border-b-2 ${view === 'home' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><Book className="mr-2" size={20}/> 我的抽背</button>
                  <button onClick={() => setView('find')} className={`flex items-center px-3 py-2 text-sm font-medium border-b-2 ${view === 'find' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><Search className="mr-2" size={20}/> 寻找抽背书</button>
               </div>
               <button onClick={() => auth.signOut()} className="text-gray-400 hover:text-red-500"><LogOut size={20}/></button>
            </div>
          </div>
        </nav>
      )}

      <main className="max-w-6xl mx-auto p-6">
        {view === 'home' && (
          <div className="animate-fade-in">
             <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center"><Book className="mr-2"/> 我的书架</h2>
             {myBooks.length === 0 ? (
               <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-dashed border-gray-300">
                 <p className="text-gray-500 mb-4">书架空空如也</p>
                 <button onClick={() => setView('find')} className="text-indigo-600 font-bold hover:underline">去图书馆看看</button>
               </div>
             ) : (
               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 justify-items-center">
                  {myBooks.map(id => books.find(b => b.id === id)).filter(b => b).map(book => (
                    <div key={book.id} className="relative group">
                        <BookCard book={book} isOwner={book.ownerId === user.uid} onClick={() => handleOpenBook(book)} onEdit={(b) => { setEditTarget(b); setIsEditorOpen(true); }} onDelete={handleDeleteBook} />
                        <button onClick={(e) => { e.stopPropagation(); removeMyBook(book.id); }} className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-xs text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 transition">移除</button>
                    </div>
                  ))}
               </div>
             )}
          </div>
        )}

        {view === 'find' && (
          <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center"><Search className="mr-2"/> 公共图书馆</h2>
              <button onClick={() => { setEditTarget(null); setIsEditorOpen(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-full shadow hover:bg-indigo-700 flex items-center text-sm font-bold transition transform hover:scale-105"><Plus size={18} className="mr-1"/> 新建抽背书</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {books.map(book => {
                const isAdded = myBooks.includes(book.id);
                return (
                  <div key={book.id} className="bg-white p-4 rounded-xl shadow-sm hover:shadow-md transition border border-gray-100 flex justify-between items-center">
                    <div className="flex items-center">
                       <div className={`w-12 h-16 rounded bg-gradient-to-br from-gray-400 to-gray-600 mr-4 shadow-sm`}></div>
                       <div>
                         <h3 className="font-bold text-gray-800">{book.title}</h3>
                         <p className="text-xs text-gray-500">Authored by {book.authorName}</p>
                         <div className="flex gap-2 mt-1"><span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">{book.content?.length || 0} 题</span>{book.password && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded flex items-center"><Zap size={8} className="mr-1"/>加密</span>}</div>
                       </div>
                    </div>
                    {isAdded ? (<span className="text-green-500 text-sm font-bold flex items-center"><CheckCircle size={16} className="mr-1"/> 已添加</span>) : (<button onClick={() => { const pwd = book.password ? prompt("请输入本书密码:") : ""; if(book.password && !pwd) return; addMyBook(book.id, pwd); }} className="text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-indigo-100 transition">获取</button>)}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === 'mode_select' && currentBook && (
          <ModeSelection 
             book={currentBook} 
             userProgress={userProgress[currentBook.id]}
             onBack={() => setView('home')}
             onSelectMode={(mode) => {
                if (mode === 'normal') setView('play_normal');
                if (mode === 'review') setView('play_review');
                if (mode === 'buzz') setView('play_buzz');
                if (mode === 'test') setView('play_test');
                if (mode === 'mistake') setView('play_mistake');
             }}
          />
        )}

        {view === 'play_normal' && <div className="fixed inset-0 bg-gray-100 z-50 p-4 overflow-hidden"><NormalMode book={currentBook} userProgress={userProgress[currentBook.id] || {}} onUpdateProgress={(qId, res) => updateProgress(currentBook.id, qId, res)} onExit={() => setView('mode_select')} /></div>}
        {view === 'play_review' && <div className="fixed inset-0 bg-gray-100 z-50 p-4 overflow-hidden"><ReviewMode book={currentBook} userProgress={userProgress[currentBook.id] || {}} onUpdateProgress={(qId, res) => updateProgress(currentBook.id, qId, res)} onExit={() => setView('mode_select')} /></div>}
        {view === 'play_buzz' && <div className="fixed inset-0 bg-white z-50 p-4 overflow-hidden"><BuzzMode book={currentBook} onExit={() => setView('mode_select')} onUpdateProgress={(qId, res) => updateProgress(currentBook.id, qId, res)} /></div>}
        {view === 'play_test' && <div className="fixed inset-0 bg-white z-50 overflow-y-auto"><TestMode book={currentBook} onExit={() => setView('mode_select')} onUpdateProgress={(qId, res) => updateProgress(currentBook.id, qId, res)} /></div>}
        {view === 'play_mistake' && <div className="fixed inset-0 bg-red-50 z-50 p-4 overflow-hidden"><BookMistakeMode book={currentBook} userProgress={userProgress[currentBook.id] || {}} onUpdateProgress={(qId, res) => updateProgress(currentBook.id, qId, res)} onExit={() => setView('mode_select')} /></div>}

      </main>
      
      {isEditorOpen && <BookEditor onClose={() => { setIsEditorOpen(false); setEditTarget(null); }} onSave={handleCreateBook} initialData={editTarget} />}
    </div>
  );
}