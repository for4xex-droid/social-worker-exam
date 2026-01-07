import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { Button } from "./components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "./components/ui/card";
import { Badge } from "./components/ui/badge";
import { Progress } from "./components/ui/progress";
import { Area, AreaChart, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Cloud, CloudDownload, CloudUpload, RefreshCw } from "lucide-react";
import "./App.css";

// --- Types ---
interface Question {
  id: number;
  question_text: string;
  options: string[];
  correct_answer: string[];
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

interface User {
  id: number;
  name: string;
}

interface LearningStats {
  total_questions: number;
  mastered_questions: number;
  category_stats: CategoryStats[];
  studyHistory?: { date: string; count: number }[];
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
  updateCountsOnly: () => Promise<void>;
  auditStatus: string;
  setAuditStatus: (s: string) => void;
}

// --- Components ---

const Importer = ({
  importStatus,
  elapsedTime,
  bulkQueue,
  isBulkProcessing,
  currentQueueIndex,
  setBulkQueue,
  setImportStatus,
  processQueue,
  updateCountsOnly,
  auditStatus,
  setAuditStatus
}: ImporterProps) => {
  const [path, setPath] = useState("");
  const [folderPath, setFolderPath] = useState("");
  const [cat, setCat] = useState("過去問（社会）");
  const [year, setYear] = useState("令和4年度");

  return (
    <div className="w-full px-6 py-8 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl bg-white/50 dark:bg-black/20 text-left">
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
              setImportStatus("Analyzing & Splitting PDF...");
              try {
                await invoke("split_pdf_and_import", { filePath: path.replace(/"/g, ''), category: cat, examYear: year });
                setImportStatus("Import Successful!");
              } catch (e) { alert(e); setImportStatus("Failed"); }
            }}>Generate (Split Mode)</Button>
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t opacity-50">
          <span className="text-[8px] font-bold uppercase">System Diagnosis Tools</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="text-[8px] h-5" onClick={async () => {
              try { const count = await invoke("cleanup_duplicates"); alert(`Cleaned up ${count} duplicated questions.`); } catch (e) { alert(e); }
            }}>Clean Duplicates</Button>
            <Button variant="ghost" size="sm" className="text-[8px] h-5" onClick={async () => {
              try { const msg = await invoke("test_connection"); alert("Gemini Live: " + msg); } catch (e) { alert(e); }
            }}>Test Connection</Button>
            <div className="h-4 w-[1px] bg-border mx-1" />
            <Button variant="ghost" size="sm" className="text-[8px] h-5 text-primary font-black" onClick={async () => {
              try {
                const data = await invoke<string>("export_questions");
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `question-pack-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
              } catch (e) { alert(e); }
            }}>Share Questions</Button>
            <Button variant="ghost" size="sm" className="text-[8px] h-5 text-primary font-black scale-110" onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.json';
              input.onchange = async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) {
                  const text = await file.text();
                  try {
                    const count = await invoke<number>("import_questions", { jsonData: text });
                    alert(`Successfully imported ${count} new questions to your library!`);
                    updateCountsOnly();
                  } catch (err) { alert("Failed to load pack: " + err); }
                }
              };
              input.click();
            }}>Load Shared Pack</Button>
          </div>
        </div>

        {auditStatus && (
          <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-xl text-center">
            <p className="text-[10px] font-black text-primary uppercase animate-pulse mb-2">{auditStatus}</p>
            <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1 rounded-full overflow-hidden">
              <div className="bg-primary h-full animate-progress-indeterminate" style={{ width: '100%', animationDuration: '2s' }}></div>
            </div>
          </div>
        )}

        <div className="mt-6 pt-4 border-t flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-col gap-1">
            <h5 className="text-[9px] font-black uppercase opacity-40">Administrative Master Polish</h5>
            <Button
              variant="outline"
              size="sm"
              className="text-[9px] h-8 bg-black text-white hover:bg-zinc-800 border-none font-bold tracking-tighter"
              disabled={!!auditStatus}
              onClick={async () => {
                if (!confirm("データベース内の全問題をAI（Gemini）が精査し、解説のブラッシュアップや不備の修正を行います。これには時間がかかり、APIコストが発生する場合があります。開始しますか？")) return;
                setAuditStatus("Preparing audit...");
                try {
                  const count = await invoke<number>("audit_and_polish_questions");
                  alert(`AI Audit Complete. Polished ${count} questions.`);
                  setAuditStatus("");
                  updateCountsOnly();
                } catch (e) {
                  alert(e);
                  setAuditStatus("");
                }
              }}
            >
              ✨ RUN AI AUDIT & POLISH DATABASE
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

function App() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isAnswered, setIsAnswered] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);

  // Import Status
  const [importStatus, setImportStatus] = useState<string>("");
  const [elapsedTime, setElapsedTime] = useState(0);

  // Modes
  const [reviewMode, setReviewMode] = useState<'today' | 'Mistakes' | 'all' | '共通' | '専門（社会）' | '専門（精神）' | '過去問（社会）' | '過去問（精神）'>('today');
  const [viewMode, setViewMode] = useState<'learning' | 'dashboard'>('learning');
  const [stats, setStats] = useState<LearningStats | null>(null);

  // Bulk Import States
  const [bulkQueue, setBulkQueue] = useState<string[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Multi-User States
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [newUserName, setNewUserName] = useState("");
  const [isUserSelectionOpen, setIsUserSelectionOpen] = useState(true);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Cloud Sync States
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncUrl, setSyncUrl] = useState(""); // URL placeholder for future cloud providers
  const [auditStatus, setAuditStatus] = useState("");

  // Accordion control
  const [isImporterOpen, setIsImporterOpen] = useState(false);

  // Load users on mount
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const u = await invoke<User[]>("get_users");
        setUsers(u);
        if (u.length === 1) {
          setCurrentUser(u[0]);
          setIsUserSelectionOpen(false);
        }
      } catch (e) { console.error(e); }
    };
    loadUsers();
  }, []);

  const handleCreateUser = async () => {
    if (!newUserName) return;
    try {
      const id = await invoke<number>("create_user", { name: newUserName });
      const newUser = { id, name: newUserName };
      setUsers(prev => [...prev, newUser]);
      setCurrentUser(newUser);
      setNewUserName("");
      setIsUserSelectionOpen(false);
    } catch (e) { alert(e); }
  };

  // Auto-save session position
  useEffect(() => {
    if (currentUser && questions.length > 0 && questions[currentIndex]?.id) {
      invoke("save_session", {
        userId: currentUser.id,
        mode: reviewMode,
        questionId: questions[currentIndex].id
      }).catch(e => console.error("Session auto-save failed", e));
    }
  }, [currentIndex, questions, currentUser, reviewMode]);

  // fetchQuestions function defined using useCallback to be stable
  const fetchQuestions = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      let fetched: Question[];
      if (reviewMode === 'today') {
        fetched = await invoke("get_questions", { userId: currentUser.id });
      } else if (reviewMode === 'all') {
        fetched = await invoke("get_all_questions", { userId: currentUser.id });
      } else if (reviewMode === 'Mistakes') {
        fetched = await invoke("get_wrong_questions", { userId: currentUser.id });
      } else {
        // 特定のカテゴリによるフィルタリング
        const categoryMap: Record<string, string> = {
          '過去問（社会）': '社会福祉士',
          '過去問（精神）': '精神保健福祉士',
        };
        const searchCategory = categoryMap[reviewMode] || reviewMode;
        fetched = await invoke("get_questions_by_category", { category: searchCategory, userId: currentUser.id });
      }
      setQuestions(fetched);

      const all: Question[] = await invoke("get_all_questions", { userId: currentUser.id });
      setTotalCount(all.length);

      // Restore session index if exists
      const lastId = await invoke<number | null>("get_session_last_id", { userId: currentUser.id, mode: reviewMode });
      if (lastId) {
        const index = fetched.findIndex(q => q.id === lastId);
        setCurrentIndex(index !== -1 ? index : 0);
      } else {
        setCurrentIndex(0);
      }

      setIsAnswered(false);
      setSelectedOptions([]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [reviewMode, currentUser]);

  const updateCountsOnly = async () => {
    if (!currentUser) return;
    try {
      const all: Question[] = await invoke("get_all_questions", { userId: currentUser.id });
      setTotalCount(all.length);
    } catch (e) { console.error(e); }
  };

  const fetchStats = useCallback(async () => {
    if (!currentUser) return;
    try {
      const s = await invoke<LearningStats>('get_stats', { userId: currentUser.id });
      const historyArr = await invoke<[string, number][]>('get_study_history', { userId: currentUser.id });
      const studyHistory = historyArr.map(([date, count]) => ({
        date: date.split('-').slice(1).join('/'), // simplify date for axis
        count
      })).reverse();
      setStats({ ...s, studyHistory });
    } catch (e) {
      console.error("Failed to fetch stats:", e);
    }
  }, [currentUser]);

  const handleCloudSync = async () => {
    if (!currentUser || !syncUrl) {
      alert("Please enter a Sync URL (Placeholder for custom integration)");
      return;
    }
    setIsSyncing(true);
    try {
      const data = await invoke<string>("export_user_data", { userId: currentUser.id });
      // Generic POST to syncUrl
      const res = await fetch(syncUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, name: currentUser.name, data })
      });
      if (res.ok) alert("Sync Successful!");
      else alert("Sync Failed: " + res.statusText);
    } catch (e) { alert("Sync Error: " + e); }
    finally { setIsSyncing(false); }
  };

  // Fetch Stats when entering dashboard
  useEffect(() => {
    if (viewMode === 'dashboard') {
      fetchStats();
    }
  }, [viewMode, fetchStats]);

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

    let unlistenAudit: UnlistenFn;
    async function setupAuditListener() {
      unlistenAudit = await listen<string>('audit-status', (event) => {
        setAuditStatus(event.payload);
      });
    }
    setupAuditListener();

    return () => {
      if (unlisten) unlisten();
      if (unlistenAudit) unlistenAudit();
    };
  }, [reviewMode, viewMode, fetchQuestions]);

  // Timer for import
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (importStatus && !["Done!", "Failed", "Successful", "complete"].some(s => importStatus.includes(s))) {
      interval = setInterval(() => setElapsedTime(prev => prev + 1), 1000);
    } else { setElapsedTime(0); }
    return () => clearInterval(interval);
  }, [importStatus]);

  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || (activeEl as HTMLElement).isContentEditable)) return;
      if (loading || questions.length === 0 || isAnswered) return;
      const key = parseInt(e.key);
      if (key >= 1 && key <= 5) {
        const optionIndex = key - 1;
        const currentQuestion = questions[currentIndex];
        if (currentQuestion && optionIndex < currentQuestion.options.length) {
          if (currentQuestion.correct_answer.length === 1) {
            handleOptionClick(currentQuestion.options[optionIndex]);
          } else {
            // Multiple choice keyboard support is complex, skip for now or implement toggle
            handleOptionClick(currentQuestion.options[optionIndex]);
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loading, questions, currentIndex, isAnswered]);

  async function handleOptionClick(option: string) {
    if (isAnswered) return;
    const currentQuestion = questions[currentIndex];
    const isMultiple = currentQuestion.correct_answer.length > 1;

    if (isMultiple) {
      setSelectedOptions(prev =>
        prev.includes(option) ? prev.filter(o => o !== option) : [...prev, option]
      );
    } else {
      submitAnswer([option]);
    }
  }

  async function submitAnswer(finalOptions: string[]) {
    if (questions.length === 0 || finalOptions.length === 0) return;
    const currentQuestion = questions[currentIndex];
    setSelectedOptions(finalOptions);
    setIsAnswered(true);

    const isCorrect = finalOptions.length === currentQuestion.correct_answer.length &&
      finalOptions.every(o => currentQuestion.correct_answer.includes(o));

    // Update local state to reflect change immediately
    const updatedQuestions = [...questions];
    const q = updatedQuestions[currentIndex];
    if (isCorrect) {
      q.correct_streak = (q.correct_streak || 0) + 1;
      if (q.correct_streak >= 5) q.status = 'mastered';
      else q.status = 'learning';
    } else {
      q.correct_streak = 0;
      q.status = 'learning';
    }
    setQuestions(updatedQuestions);

    try {
      await invoke("submit_answer", { id: currentQuestion.id, userId: currentUser?.id || 1, isCorrect: isCorrect });
      // Update dashboard stats in background
      fetchStats();
    } catch (error) {
      console.error(error);
    }
  }

  function handleNext() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsAnswered(false);
      setSelectedOptions([]);
    } else {
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
        await invoke("import_pdf_questions", { filePath: path, category, examYear: year });
        await updateCountsOnly(); // ここで件数だけ更新し、クイズ状態は変えない
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
    updateCountsOnly,
    auditStatus,
    setAuditStatus
  };

  if (viewMode === 'dashboard') {
    return (
      <div className="flex min-h-screen flex-col items-center p-8 bg-gray-100 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 overflow-y-auto text-left">
        <div className="w-full max-w-5xl flex justify-between items-center mb-10">
          <div className="flex flex-col">
            <span className="text-[10px] font-black tracking-[0.4em] text-primary uppercase opacity-60">Performance Intelligence</span>
            <h1 className="text-4xl font-black italic tracking-tighter">EXAM DASHBOARD</h1>
          </div>
          <Button onClick={() => setViewMode('learning')} variant="outline" className="rounded-2xl px-8 h-12 font-black border-2 border-primary/20 hover:bg-primary hover:text-white transition-all">BACK TO ARENA</Button>
        </div>

        {stats ? (
          <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Card className="lg:col-span-4 border-none shadow-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-[2.5rem]">
              <CardHeader><CardTitle className="text-[10px] font-black uppercase opacity-40 tracking-widest text-left">Total Mastery</CardTitle></CardHeader>
              <CardContent className="text-center pb-10">
                <div className="text-8xl font-black mb-4 text-primary tracking-tighter italic">{Math.round((stats.mastered_questions / (stats.total_questions || 1)) * 100)}%</div>
                <Progress value={(stats.mastered_questions / (stats.total_questions || 1)) * 100} className="h-4 mb-4" />
                <p className="text-[10px] font-black opacity-30 uppercase tracking-[0.2em]">{stats.mastered_questions} / {stats.total_questions} MASTERY ACHIEVED</p>
              </CardContent>
            </Card>

            <Card className="lg:col-span-8 border-none shadow-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-[2.5rem] overflow-hidden">
              <CardHeader className="flex flex-row justify-between items-center">
                <CardTitle className="text-[10px] font-black uppercase opacity-40 tracking-widest text-left">Study Activity (14 Days)</CardTitle>
                <Badge variant="outline" className="text-[8px] font-black opacity-40 border-primary/20">LIVE DATA</Badge>
              </CardHeader>
              <CardContent className="h-[250px] p-0 pr-6">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.studyHistory || []} margin={{ top: 20, right: 0, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, opacity: 0.4 }} />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', fontSize: '10px', fontWeight: 900 }}
                      cursor={{ stroke: 'var(--primary)', strokeWidth: 1, strokeDasharray: '4 4' }}
                    />
                    <Area type="monotone" dataKey="count" stroke="var(--primary)" strokeWidth={4} fillOpacity={1} fill="url(#colorCount)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-8 border-none shadow-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-[2.5rem]">
              <CardHeader><CardTitle className="text-[10px] font-black uppercase opacity-40 tracking-widest text-left">By Category Breakdown</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 max-h-[400px] overflow-y-auto pr-4">
                  {stats.category_stats.map((cat) => (
                    <div key={cat.category} className="group text-left">
                      <div className="flex justify-between text-[9px] font-black mb-2 uppercase opacity-60"><span>{cat.category}</span><span>{Math.round((cat.mastered / (cat.total || 1)) * 100)}%</span></div>
                      <Progress value={(cat.mastered / (cat.total || 1)) * 100} className="h-1.5" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-4 border-none shadow-2xl bg-primary text-white rounded-[2.5rem] relative overflow-hidden">
              <div className="absolute top-[-20px] right-[-20px] opacity-10">
                <Cloud size={160} strokeWidth={3} />
              </div>
              <CardHeader>
                <CardTitle className="text-[10px] font-black uppercase opacity-60 tracking-widest text-left">Cloud Sync Intelligence</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-[11px] leading-relaxed font-bold opacity-80">
                  現在の進捗データをセキュアにクラウド転送。他のデバイスと実績を同期できます。
                </p>
                <div className="space-y-2">
                  <input
                    value={syncUrl}
                    onChange={e => setSyncUrl(e.target.value)}
                    placeholder="https://your-sync-endpoint.com"
                    className="w-full bg-white/10 border-white/20 text-white text-[10px] px-4 py-3 rounded-xl placeholder:text-white/30 focus:outline-none focus:ring-2 ring-white/30 transition-all font-mono"
                  />
                  <Button
                    onClick={handleCloudSync}
                    disabled={isSyncing}
                    className="w-full h-12 bg-white text-primary rounded-xl font-black italic tracking-widest border-none hover:bg-zinc-100 transition-all shadow-xl active:scale-95"
                  >
                    {isSyncing ? <RefreshCw className="animate-spin mr-2" size={16} /> : <CloudUpload className="mr-2" size={16} />}
                    {isSyncing ? "SYNCING..." : "PUSH TO CLOUD"}
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="flex-1 text-[8px] font-black uppercase text-white hover:bg-white/10" onClick={async () => {
                      const data = await invoke<string>("export_user_data", { userId: currentUser!.id });
                      const blob = new Blob([data], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `backup-${currentUser!.name}-${new Date().toISOString().split('T')[0]}.json`;
                      a.click();
                    }}>
                      <CloudDownload className="mr-1" size={10} /> Export Local
                    </Button>
                    <Button variant="ghost" size="sm" className="flex-1 text-[8px] font-black uppercase text-white hover:bg-white/10" onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = '.json';
                      input.onchange = async (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) {
                          const text = await file.text();
                          try {
                            await invoke("import_user_data", { userId: currentUser!.id, data: text });
                            alert("Import successful! Reloading...");
                            fetchStats();
                          } catch (err) { alert("Failed: " + err); }
                        }
                      };
                      input.click();
                    }}>
                      <CloudUpload className="mr-1" size={10} /> Import Local
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 opacity-20">
            <RefreshCw className="animate-spin mb-4" size={48} />
            <p className="text-xs font-black uppercase tracking-[0.5em]">Calculating Statistics...</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-100 dark:bg-zinc-950 font-sans text-right">
      {/* User Selection Overlay */}
      {isUserSelectionOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/80 backdrop-blur-xl p-6">
          <Card className="w-full max-w-md border-none shadow-2xl bg-white dark:bg-zinc-900 overflow-hidden rounded-[2rem]">
            <CardHeader className="p-8 text-center">
              <span className="text-[10px] font-black tracking-[0.3em] text-primary uppercase opacity-60 mb-2 block">Identity Manager</span>
              <h2 className="text-3xl font-black italic tracking-tighter">WHO IS LEARNING?</h2>
            </CardHeader>
            <CardContent className="p-8 pt-0 space-y-4">
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2">
                {users.map(u => (
                  <Button key={u.id} variant="outline" className="justify-start h-14 px-6 rounded-xl font-bold border-2 hover:border-primary hover:bg-primary/5 transition-all"
                    onClick={() => { setCurrentUser(u); setIsUserSelectionOpen(false); }}>
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center mr-3 text-[10px] uppercase font-black">{u.name[0]}</div>
                    {u.name}
                  </Button>
                ))}
              </div>
              <div className="pt-4 border-t border-dashed space-y-3">
                <p className="text-[10px] font-black opacity-30 uppercase">Create New User Profile</p>
                <div className="flex gap-2">
                  <input
                    value={newUserName}
                    onChange={e => setNewUserName(e.target.value)}
                    placeholder="Enter Name..."
                    className="flex-1 px-4 py-2 border rounded-xl bg-muted/30 text-sm font-medium"
                    onKeyDown={e => { if (e.key === 'Enter' && newUserName) handleCreateUser(); }}
                  />
                  <Button disabled={!newUserName} onClick={handleCreateUser} className="rounded-xl font-bold">ADD</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Help Overlay (Guide) */}
      {isHelpOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-zinc-950/90 backdrop-blur-2xl p-6">
          <Card className="w-full max-w-2xl border-none shadow-2xl bg-white dark:bg-zinc-900 overflow-hidden rounded-[2.5rem]">
            <CardHeader className="p-10 pb-4 text-center">
              <span className="text-[10px] font-black tracking-[0.4em] text-primary uppercase opacity-60 mb-2 block">Instruction Manual</span>
              <h2 className="text-4xl font-black italic tracking-tighter">HOW TO DOMINATE</h2>
            </CardHeader>
            <CardContent className="p-10 pt-4 space-y-8 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Badge className="bg-primary/10 text-primary border-none text-[8px] font-black italic">STEP 01</Badge>
                  <h4 className="font-black text-sm uppercase">Create Profile</h4>
                  <p className="text-xs leading-relaxed opacity-60">ユーザーを切り替えて自分専用の実績を積み上げましょう。友人や家族と進捗を分けることができます。</p>
                </div>
                <div className="space-y-3">
                  <Badge className="bg-primary/10 text-primary border-none text-[8px] font-black italic">STEP 02</Badge>
                  <h4 className="font-black text-sm uppercase">Import PDF</h4>
                  <p className="text-xs leading-relaxed opacity-60">試験の過去問PDFを読み込むと、Gemini AIが自動的に30〜50問の問題を生成します。一気読み込み（Bulk）も可能です。</p>
                </div>
                <div className="space-y-3">
                  <Badge className="bg-primary/10 text-primary border-none text-[8px] font-black italic">STEP 03</Badge>
                  <h4 className="font-black text-sm uppercase">Answer & Learn</h4>
                  <p className="text-xs leading-relaxed opacity-60">キーボードの 1〜5 キーでも解答可能。解説を読み、根拠を理解することが合格への近道です。</p>
                </div>
                <div className="space-y-3">
                  <Badge className="bg-primary/10 text-primary border-none text-[8px] font-black italic">STEP 04</Badge>
                  <h4 className="font-black text-sm uppercase">Mastery System</h4>
                  <p className="text-xs leading-relaxed opacity-60">同じ問題を5回連続で正解すると「習得済み（Mastered）」となります。苦手な問題は「WRONG」モードで集中特訓！</p>
                </div>
              </div>

              <div className="bg-zinc-100 dark:bg-zinc-800/50 p-6 rounded-2xl border border-dashed">
                <h4 className="text-[10px] font-black uppercase opacity-40 mb-3 tracking-widest">Keyboard Shortcuts</h4>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <kbd className="px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-700 font-mono text-xs">1-5</kbd>
                    <span className="text-[10px] font-bold opacity-60">Answer Select</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <kbd className="px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-700 font-mono text-xs">ENTER</kbd>
                    <span className="text-[10px] font-bold opacity-60">Next Question</span>
                  </div>
                </div>
              </div>

              <Button onClick={() => setIsHelpOpen(false)} className="w-full h-14 rounded-2xl font-black text-lg tracking-widest italic group overflow-hidden relative">
                <span className="relative z-10 transition-transform group-hover:scale-110">UNDERSTOOD, LET'S START</span>
                <div className="absolute inset-0 bg-primary/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="w-full max-w-2xl text-left">
        {/* 固定ヘッダー: モード切替と全件数 */}
        <div className="flex flex-col gap-5 mb-10">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <span className="text-[9px] font-black tracking-[0.3em] text-primary uppercase opacity-40">Core Knowledge System</span>
                {currentUser && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="cursor-pointer text-[8px] border-primary/20 opacity-60 hover:opacity-100 transition-opacity" onClick={() => setIsUserSelectionOpen(true)}>
                      USER: {currentUser.name}
                    </Badge>
                    <Button variant="ghost" size="sm" className="w-6 h-6 p-0 rounded-full border border-primary/10 text-[10px] opacity-40 hover:opacity-100 hover:bg-primary/10 transition-all font-black"
                      onClick={() => setIsHelpOpen(true)}>?</Button>
                  </div>
                )}
              </div>
              <div className="h-[2px] w-8 bg-primary/30 rounded-full" />
            </div>
            {questions.length > 0 && !loading && (
              <div className="flex items-baseline gap-1 opacity-80">
                <span className="text-4xl font-black italic tracking-tighter text-primary">{currentIndex + 1}</span>
                <span className="text-xs font-black opacity-20">/ {questions.length}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 bg-white/40 dark:bg-white/5 p-4 rounded-2xl border border-white/20 backdrop-blur-md shadow-sm">
            <div className="flex items-center gap-2 pr-3 border-r border-primary/10">
              <Badge variant={reviewMode === 'today' ? "default" : "secondary"} className="cursor-pointer text-[10px] px-4 py-1.5 font-bold transition-all hover:scale-105 active:scale-95 shadow-sm" onClick={() => setReviewMode('today')}>TODAY</Badge>
              <Badge variant={reviewMode === 'Mistakes' ? "default" : "secondary"} className="cursor-pointer text-[10px] px-4 py-1.5 font-bold transition-all hover:scale-105 active:scale-95 shadow-sm border-red-500/50 text-red-500 hover:bg-red-500/10" onClick={() => setReviewMode('Mistakes')}>WRONG</Badge>
              <Badge variant={reviewMode === 'all' ? "default" : "secondary"} className="cursor-pointer text-[10px] px-4 py-1.5 font-bold transition-all hover:scale-105 active:scale-95 shadow-sm" onClick={() => setReviewMode('all')}>ALL ({totalCount})</Badge>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={reviewMode === '共通' ? "default" : "secondary"} className="cursor-pointer text-[10px] px-4 py-1.5 font-medium transition-all hover:bg-primary/10" onClick={() => setReviewMode('共通')}>共通</Badge>
              <Badge variant={reviewMode === '専門（社会）' ? "default" : "secondary"} className="cursor-pointer text-[10px] px-4 py-1.5 font-medium transition-all hover:bg-primary/10" onClick={() => setReviewMode('専門（社会）')}>専門（社会）</Badge>
              <Badge variant={reviewMode === '専門（精神）' ? "default" : "secondary"} className="cursor-pointer text-[10px] px-4 py-1.5 font-medium transition-all hover:bg-primary/10" onClick={() => setReviewMode('専門（精神）')}>専門（精神）</Badge>
              <Badge variant={reviewMode === '過去問（社会）' ? "default" : "secondary"} className="cursor-pointer text-[10px] px-4 py-1.5 font-medium transition-all hover:bg-primary/10" onClick={() => setReviewMode('過去問（社会）')}>過去問（社会）</Badge>
              <Badge variant={reviewMode === '過去問（精神）' ? "default" : "secondary"} className="cursor-pointer text-[10px] px-4 py-1.5 font-medium transition-all hover:bg-primary/10" onClick={() => setReviewMode('過去問（精神）')}>過去問（精神）</Badge>
            </div>

            <Badge variant="outline" className="cursor-pointer text-[10px] px-4 py-1.5 font-black border-primary/30 text-primary hover:bg-primary/10 ml-auto transition-colors" onClick={() => setViewMode('dashboard')}>STATS</Badge>
          </div>
        </div>

        {/* メインエリア: インポーターかクイズか */}
        <div className="space-y-12">
          {/* インポーター（手動で閉じるまで表示され続ける） */}
          <div className={`transition-all duration-500 overflow-hidden ${isImporterOpen ? 'opacity-100 mb-12' : 'max-h-0 opacity-0 pointer-events-none'}`}>
            <div className="relative">
              <Importer
                {...importerProps}
                auditStatus={auditStatus}
                setAuditStatus={setAuditStatus}
              />
              <Button variant="ghost" size="sm" className="absolute top-2 right-2 text-[8px] font-bold uppercase opacity-30 hover:opacity-100"
                onClick={() => setIsImporterOpen(false)}>Close Panel</Button>
            </div>
            {!isBulkProcessing && questions.length > 0 && (
              <div className="mt-4 text-center">
                <Button variant="link" size="sm" className="text-[10px] font-bold text-primary" onClick={() => setIsImporterOpen(false)}>Start Review Now →</Button>
              </div>
            )}
          </div>

          {!isImporterOpen && (
            <div className="flex justify-center mb-8">
              <Button variant="outline" className="text-[9px] font-black tracking-widest uppercase opacity-30 hover:opacity-100 rounded-full h-8"
                onClick={() => setIsImporterOpen(true)}>Open Question Importer</Button>
            </div>
          )}

          {/* クイズ表示（インポート完了後、インポーターを閉じた後にメインとなる） */}
          {!isImporterOpen && (
            loading ? (
              <div className="py-20 text-center animate-pulse"><p className="text-xs font-black uppercase tracking-widest opacity-30">Synchronizing...</p></div>
            ) : questions.length === 0 ? (
              <div className="py-20 text-center space-y-4">
                <h1 className="text-6xl font-black italic tracking-tighter opacity-10">ZERO DUE</h1>
                <Button onClick={fetchQuestions} variant="secondary" className="rounded-full px-8 font-black">RESCAN DATABASE</Button>
              </div>
            ) : (
              <Card className="shadow-2xl border-none bg-white/90 dark:bg-zinc-900/90 backdrop-blur-2xl rounded-[2rem] overflow-hidden">
                <CardHeader className="p-10 pb-6">
                  <div className="flex justify-between items-start mb-6">
                    <Badge className="bg-primary text-white border-none text-[8px] font-black uppercase tracking-[0.2em]">{questions[currentIndex].category || "GENERAL"}</Badge>
                    <div className="flex gap-2">
                      {questions[currentIndex].correct_streak > 0 && (
                        <Badge variant="outline" className="text-[10px] font-black border-orange-500 text-orange-500">🔥 {questions[currentIndex].correct_streak}</Badge>
                      )}
                      <Badge variant="outline" className={`text-[8px] font-black uppercase tracking-widest ${questions[currentIndex].status === 'mastered' ? 'border-green-500 text-green-500' : 'opacity-40'}`}>
                        {questions[currentIndex].status || 'NEW'}
                      </Badge>
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold leading-snug break-words whitespace-normal">{questions[currentIndex].question_text}</h2>
                  {questions[currentIndex].exam_year && <Badge variant="outline" className="mt-4 text-[8px] opacity-50">{questions[currentIndex].exam_year}</Badge>}
                </CardHeader>
                <CardContent className="p-10 pt-0 space-y-3">
                  {questions[currentIndex].options.map((opt, i) => {
                    let style = "border-zinc-100 dark:border-zinc-800 hover:border-primary";
                    const isSelected = selectedOptions.includes(opt);

                    if (isAnswered) {
                      const isCorrectAnswer = questions[currentIndex].correct_answer.includes(opt);
                      if (isCorrectAnswer) style = "bg-green-600 border-none text-white font-bold";
                      else if (isSelected) style = "bg-red-500 border-none text-white opacity-80";
                      else style = "opacity-20 pointer-events-none";
                    } else if (isSelected) {
                      style = "border-primary bg-primary/10 shadow-inner scale-[0.98]";
                    }

                    return (
                      <Button key={i} variant="outline" className={`w-full justify-start text-left h-auto py-5 px-6 rounded-xl border-2 transition-all whitespace-normal break-words flex items-start gap-4 ${style}`}
                        onClick={() => handleOptionClick(opt)} disabled={isAnswered}>
                        <span className="shrink-0 text-[10px] font-black opacity-30 mt-1">{String.fromCharCode(65 + i)}</span>
                        <span className="text-sm md:text-base font-medium leading-relaxed">{opt}</span>
                      </Button>
                    )
                  })}

                  {!isAnswered && questions[currentIndex].correct_answer.length > 1 && (
                    <Button
                      className="w-full h-14 font-black rounded-xl text-lg mt-6 bg-primary text-white shadow-xl active:scale-95 transition-all"
                      disabled={selectedOptions.length === 0}
                      onClick={() => submitAnswer(selectedOptions)}
                    >
                      SUBMIT {selectedOptions.length} ANSWERS
                    </Button>
                  )}
                </CardContent>
                {isAnswered && (
                  <CardFooter className="p-10 bg-zinc-50 dark:bg-zinc-800/20 border-t flex flex-col gap-6">
                    <div className="bg-white dark:bg-zinc-950 p-6 rounded-xl border">
                      <span className="text-[10px] font-black uppercase text-primary mb-2 block">Solution Analysis</span>
                      <p className="text-sm leading-relaxed">{questions[currentIndex].explanation}</p>
                    </div>
                    <Button className="w-full h-14 font-black rounded-xl text-lg" onClick={handleNext}>NEXT QUESTION</Button>
                  </CardFooter>
                )}
              </Card>
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
