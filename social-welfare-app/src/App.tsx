import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { Button } from "./components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "./components/ui/card";
import { Badge } from "./components/ui/badge";
import { Progress } from "./components/ui/progress";
import "./App.css";

// --- Types ---
interface Question {
  id: number;
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  source_file: string;
  category: string | null;
  exam_year: string | null;
  status: string;
  correct_streak: number;
}

interface CategoryStats {
  category: string;
  total: number;
  mastered: number;
}

interface LearningStats {
  total_questions: number;
  mastered_questions: number;
  category_stats: CategoryStats[];
}

interface ImporterProps {
  importStatus: string;
  elapsedTime: number;
  bulkQueue: string[];
  isBulkProcessing: boolean;
  currentQueueIndex: number;
  setBulkQueue: (q: string[]) => void;
  setImportStatus: (s: string) => void;
  processQueue: (cat: string, year: string) => Promise<void>;
  fetchQuestions: () => Promise<void>;
}

// --- Components ---

// ImporterをAppの外に移動して再レンダリングによる状態消失（フォーカス外れ）を防ぐ
const Importer = ({
  importStatus,
  elapsedTime,
  bulkQueue,
  isBulkProcessing,
  currentQueueIndex,
  setBulkQueue,
  setImportStatus,
  processQueue,
  fetchQuestions
}: ImporterProps) => {
  const [path, setPath] = useState("");
  const [folderPath, setFolderPath] = useState("");
  const [cat, setCat] = useState("社会福祉士");
  const [year, setYear] = useState("令和4年度");

  return (
    <div className="w-full max-w-2xl px-6 py-8 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl bg-white/50 dark:bg-black/20 text-left">
      <h3 className="text-sm font-bold mb-4 uppercase tracking-wider text-muted-foreground">Question Importer (PDF)</h3>
      <p className="text-xs text-center text-primary font-bold h-5 animate-pulse mb-6">
        {importStatus} {elapsedTime > 0 && `(${elapsedTime}s)`}
      </p>

      <div className="flex flex-col gap-8">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-[10px] font-black uppercase text-primary">Option A: Folder Bulk Scan</h4>
          </div>
          <div className="flex gap-2">
            <input
              value={folderPath}
              onChange={e => setFolderPath(e.target.value)}
              placeholder="Folder Path (e.g. C:\Exams)"
              className="flex-1 px-3 py-2 text-xs border rounded bg-background"
              disabled={isBulkProcessing}
            />
            <Button size="sm" variant="secondary" disabled={isBulkProcessing || !folderPath} onClick={async () => {
              try {
                const files = await invoke<string[]>("scan_folder_for_pdfs", { folderPath: folderPath.replace(/"/g, "") });
                setBulkQueue(files);
                setImportStatus(`Found ${files.length} PDFs`);
              } catch (e) { alert(e); }
            }}>Scan</Button>
          </div>
          {bulkQueue.length > 0 && (
            <div className="space-y-3 mt-4 p-4 border rounded-xl bg-muted/20 border-primary/20">
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span>RESOURCES TO PROCESS: {bulkQueue.length}</span>
                {!isBulkProcessing && <Button variant="ghost" size="sm" className="h-4 text-[8px]" onClick={() => setBulkQueue([])}>Cancel</Button>}
              </div>
              <div className="max-h-24 overflow-y-auto text-[9px] space-y-1 font-mono opacity-70">
                {bulkQueue.map((p, idx) => (
                  <div key={idx} className={`truncate ${idx === currentQueueIndex && isBulkProcessing ? 'text-primary font-black animate-pulse' : ''}`}>
                    {idx + 1}. {p.split('\\').pop()}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <input value={cat} onChange={e => setCat(e.target.value)} placeholder="Category" className="px-2 py-1.5 text-[10px] border rounded bg-background" />
                <input value={year} onChange={e => setYear(e.target.value)} placeholder="Year" className="px-2 py-1.5 text-[10px] border rounded bg-background" />
              </div>
              <Button className="w-full bg-primary text-white font-bold" size="sm" disabled={isBulkProcessing} onClick={() => processQueue(cat, year)}>
                {isBulkProcessing ? `Processing Queue...` : "Execute Bulk Import"}
              </Button>
            </div>
          )}
        </div>

        <div className="h-[1px] bg-border w-full opacity-50" />

        <div className="space-y-3">
          <h4 className="text-[10px] font-black uppercase text-primary">Option B: Single File Import</h4>
          <div className="grid grid-cols-2 gap-2">
            <input value={cat} onChange={e => setCat(e.target.value)} placeholder="Category" className="px-3 py-2 text-xs border rounded bg-background" />
            <input value={year} onChange={e => setYear(e.target.value)} placeholder="Year" className="px-3 py-2 text-xs border rounded bg-background" />
          </div>
          <div className="flex gap-2">
            <input value={path} onChange={e => setPath(e.target.value)} placeholder="Full PDF Path..." className="flex-1 px-3 py-2 text-xs border rounded bg-background" disabled={isBulkProcessing} />
            <Button variant="secondary" size="sm" disabled={isBulkProcessing || !path || (!!importStatus && importStatus.includes("Processing"))} onClick={async () => {
              setImportStatus("Processing Single File...");
              try {
                await invoke("import_pdf_questions", { filePath: path.replace(/"/g, ''), category: cat, examYear: year });
                setImportStatus("Import Successful!");
                fetchQuestions();
              } catch (e) { alert(e); setImportStatus("Failed"); }
            }}>Generate</Button>
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t opacity-50">
          <span className="text-[8px] font-bold uppercase">System Diagnosis Tools</span>
          <Button variant="ghost" size="sm" className="text-[8px] h-5" onClick={async () => {
            try { const msg = await invoke("test_connection"); alert("Gemini Live: " + msg); } catch (e) { alert(e); }
          }}>Test Connection</Button>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

function App() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isAnswered, setIsAnswered] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  // Import Status
  const [importStatus, setImportStatus] = useState<string>("");
  const [elapsedTime, setElapsedTime] = useState(0);

  // Modes
  const [reviewMode, setReviewMode] = useState<'today' | 'all'>('today');
  const [viewMode, setViewMode] = useState<'learning' | 'dashboard'>('learning');
  const [stats, setStats] = useState<LearningStats | null>(null);

  const [bulkQueue, setBulkQueue] = useState<string[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);
  const [totalCount, setTotalCount] = useState(0); // DB全体の件数管理用

  // Fetch Stats when entering dashboard
  useEffect(() => {
    if (viewMode === 'dashboard') {
      const loadStats = async () => {
        try {
          const s = await invoke<LearningStats>('get_stats');
          setStats(s);
        } catch (e) {
          console.error(e);
        }
      };
      loadStats();
    }
  }, [viewMode]);

  // 初回ロード時 & モード変更時に問題をフェッチ
  useEffect(() => {
    if (viewMode === 'learning') {
      fetchQuestions();
    }

    let unlisten: UnlistenFn;
    async function setupListener() {
      unlisten = await listen<string>('import-status', (event) => {
        setImportStatus(event.payload);
      });
    }
    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, [reviewMode, viewMode]);

  // Timer for import
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (importStatus && importStatus !== "Done!" && importStatus !== "Error occurred." && !importStatus.includes("Successful")) {
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      setElapsedTime(0);
    }
    return () => clearInterval(interval);
  }, [importStatus]);

  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl && (
          activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          (activeEl as HTMLElement).isContentEditable
        )
      ) {
        return;
      }

      if (loading || questions.length === 0 || isAnswered) return;

      const key = parseInt(e.key);
      if (key >= 1 && key <= 5) {
        const optionIndex = key - 1;
        const currentQuestion = questions[currentIndex];
        if (currentQuestion && optionIndex < currentQuestion.options.length) {
          handleAnswer(currentQuestion.options[optionIndex]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loading, questions, currentIndex, isAnswered]);

  async function fetchQuestions() {
    setLoading(true);
    setCurrentIndex(0);
    setIsAnswered(false);
    setSelectedOption(null);
    setIsCorrect(null);

    try {
      // 現在のモードで使用する問題をフェッチ
      const command = reviewMode === 'today' ? "get_questions" : "get_all_questions";
      const fetched: Question[] = await invoke(command);
      setQuestions(fetched);

      // 同時にDB全件数を取得して「ALL」バッジに反映させる
      const allQuestions: Question[] = await invoke("get_all_questions");
      setTotalCount(allQuestions.length);
    } catch (error) {
      console.error("Failed to fetch questions:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAnswer(option: string) {
    if (questions.length === 0) return;
    setSelectedOption(option);
    setIsAnswered(true);
    const currentQuestion = questions[currentIndex];
    const correct = option === currentQuestion.correct_answer;
    setIsCorrect(correct);

    try {
      await invoke("submit_answer", { id: currentQuestion.id, isCorrect: correct });
    } catch (error) {
      console.error("Failed to submit answer:", error);
    }
  }

  function handleNext() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsAnswered(false);
      setSelectedOption(null);
      setIsCorrect(null);
    } else {
      alert("学習セットが完了しました！");
      fetchQuestions();
    }
  }

  async function processQueue(category: string, year: string) {
    if (bulkQueue.length === 0) return;
    setIsBulkProcessing(true);
    setImportStatus("Bulk processing started...");

    for (let i = 0; i < bulkQueue.length; i++) {
      setCurrentQueueIndex(i);
      const path = bulkQueue[i];
      const fileName = path.split('\\').pop() || path;
      setImportStatus(`[${i + 1}/${bulkQueue.length}] Processing: ${fileName}`);

      try {
        await invoke("import_pdf_questions", {
          filePath: path,
          category,
          examYear: year
        });
        if (i < bulkQueue.length - 1) {
          setImportStatus(`Waiting (5s for rate limit)...`);
          await new Promise(r => setTimeout(r, 5000));
        }
      } catch (e) {
        console.error(`Failed: ${fileName}`, e);
        if (!confirm(`Failed on ${fileName}. Continue?`)) break;
      }
    }

    setIsBulkProcessing(false);
    setBulkQueue([]);
    setImportStatus("Bulk processing complete!");
    alert("Bulk Import Finished!");
    fetchQuestions();
  }

  const importerProps: ImporterProps = {
    importStatus,
    elapsedTime,
    bulkQueue,
    isBulkProcessing,
    currentQueueIndex,
    setBulkQueue,
    setImportStatus,
    processQueue,
    fetchQuestions
  };

  if (viewMode === 'dashboard') {
    return (
      <div className="flex min-h-screen flex-col items-center p-8 bg-gray-100 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 overflow-y-auto">
        <div className="w-full max-w-4xl flex justify-between items-center mb-8">
          <h1 className="text-3xl font-black italic tracking-tighter text-primary">DASHBOARD</h1>
          <Button onClick={() => setViewMode('learning')} variant="outline" className="rounded-full px-6">Back to Learning</Button>
        </div>

        {stats ? (
          <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="border-none shadow-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-sm font-black uppercase opacity-50 tracking-widest">Total Mastery</CardTitle>
              </CardHeader>
              <CardContent className="text-center pb-10">
                <div className="text-7xl font-black mb-4 text-primary tracking-tighter">
                  {Math.round((stats.mastered_questions / (stats.total_questions || 1)) * 100)}%
                </div>
                <Progress value={(stats.mastered_questions / (stats.total_questions || 1)) * 100} className="h-4 mb-4" />
                <p className="text-xs font-bold text-muted-foreground">
                  {stats.mastered_questions} / {stats.total_questions} MASTERY ACHIEVED
                </p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-sm font-black uppercase opacity-50 tracking-widest">By Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6 max-h-[300px] overflow-y-auto pr-4">
                  {stats.category_stats.map((cat) => (
                    <div key={cat.category} className="group">
                      <div className="flex justify-between text-[10px] font-black mb-2 uppercase">
                        <span className="opacity-70 group-hover:text-primary transition-colors">{cat.category}</span>
                        <span className="font-mono">{cat.mastered}/{cat.total}</span>
                      </div>
                      <Progress value={(cat.mastered / (cat.total || 1)) * 100} className="h-1.5" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-20 flex flex-col items-center gap-4">
            <div className="animate-spin text-4xl text-primary">🌀</div>
            <p className="text-sm font-bold opacity-50">Syncing analytics...</p>
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-zinc-950">
        <div className="w-1/3 text-center space-y-4">
          <div className="text-6xl animate-bounce">🧠</div>
          <p className="text-xs font-black tracking-[0.3em] text-primary uppercase">Initializing Session</p>
          <Progress value={33} className="h-1" />
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center space-y-12 bg-gray-50 dark:bg-zinc-950 p-6">
        <div className="text-center space-y-4">
          <h1 className="text-6xl font-black italic tracking-tighter">ZERO DUE.</h1>
          <p className="text-muted-foreground font-bold text-sm tracking-widest">SYSTEM STATUS: OPTIMIZED</p>
        </div>
        <div className="flex gap-4">
          <Button onClick={fetchQuestions} size="lg" className="rounded-full px-8 font-black">RESCAN</Button>
          <Button onClick={() => setReviewMode('all')} variant="outline" size="lg" className="rounded-full px-8 font-black">LIBRARY</Button>
        </div>
        <Importer {...importerProps} />
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-100 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 overflow-y-auto">
      <div className="w-full max-w-2xl mb-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-black tracking-[0.4em] text-primary uppercase opacity-50">Core Knowledge System</span>
            <div className="flex gap-2">
              <Badge variant={reviewMode === 'today' ? "default" : "secondary"} className="cursor-pointer text-[9px] px-3 font-black" onClick={() => setReviewMode('today')}>TODAY</Badge>
              <Badge variant={reviewMode === 'all' ? "default" : "secondary"} className="cursor-pointer text-[9px] px-3 font-black" onClick={() => setReviewMode('all')}>ALL ({totalCount})</Badge>
              <Badge variant="outline" className="cursor-pointer text-[9px] px-3 font-black border-primary text-primary hover:bg-primary/10" onClick={() => setViewMode('dashboard')}>STATS</Badge>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-black italic tracking-tighter text-primary">{currentIndex + 1}</span>
              <span className="text-sm font-black opacity-30">/ {questions.length}</span>
            </div>
          </div>
        </div>
        <Progress value={((currentIndex + 1) / questions.length) * 100} className="h-1" />
      </div>

      <Card className="w-full max-w-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] dark:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] border-none bg-white/90 dark:bg-zinc-900/90 backdrop-blur-2xl rounded-[2rem] overflow-hidden">
        <CardHeader className="p-10 pb-6">
          <Badge className="w-fit mb-6 bg-primary text-white border-none text-[8px] font-black tracking-[0.2em] uppercase">
            {currentQuestion.category || "Uncategorized"}
          </Badge>
          <CardTitle className="text-2xl sm:text-3xl font-bold leading-[1.15] tracking-tight">
            {currentQuestion.question_text}
          </CardTitle>
          <div className="flex gap-2 mt-6">
            {currentQuestion.exam_year && <Badge variant="outline" className="text-[8px] font-black border-zinc-500/20">{currentQuestion.exam_year}</Badge>}
          </div>
        </CardHeader>

        <CardContent className="space-y-4 px-10 pb-12">
          {currentQuestion.options.map((option, index) => {
            let color = "hover:border-primary border-zinc-100 dark:border-zinc-800";
            if (isAnswered) {
              if (option === currentQuestion.correct_answer) color = "bg-green-600 border-none text-white font-bold scale-[1.02]";
              else if (option === selectedOption && !isCorrect) color = "bg-red-500 border-none text-white opacity-80 scale-95";
              else color = "opacity-30 border-transparent bg-zinc-100 dark:bg-zinc-800";
            }
            return (
              <Button key={index} variant="outline" className={`w-full justify-start text-left h-auto py-5 px-6 rounded-2xl border-2 transition-all duration-300 ${color}`}
                onClick={() => !isAnswered && handleAnswer(option)} disabled={isAnswered}>
                <span className={`mr-4 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border font-black text-[10px] ${isAnswered ? 'border-transparent bg-white/20' : ''}`}>
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="text-sm font-medium">{option}</span>
              </Button>
            );
          })}
        </CardContent>

        {isAnswered && (
          <CardFooter className="bg-zinc-50 dark:bg-zinc-800/30 p-10 border-t border-zinc-100 dark:border-zinc-800 flex flex-col gap-6">
            <div className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${isCorrect ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
              {isCorrect ? "Perfect Result" : "Review Required"}
            </div>
            <div className="space-y-6 w-full">
              <div className="bg-white dark:bg-zinc-950 p-6 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary block mb-3 opacity-50">Analysis</span>
                <p className="text-sm font-medium leading-relaxed">{currentQuestion.explanation}</p>
              </div>
              <Button className="w-full h-14 font-black rounded-2xl text-lg shadow-xl shadow-primary/20" onClick={handleNext}>CONTINUE SESSION</Button>
            </div>
          </CardFooter>
        )}
      </Card>

      <div className="mt-16 w-full max-w-2xl">
        <details className="group">
          <summary className="text-[10px] font-black tracking-[0.5em] text-center text-muted-foreground cursor-pointer list-none hover:text-primary transition-all p-4 opacity-30 group-open:opacity-100">
            SYSTEM INFRASTRUCTURE
          </summary>
          <div className="mt-6">
            <Importer {...importerProps} />
          </div>
        </details>
      </div>
    </div>
  );
}

export default App;
