import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import "./App.css";

// Rust側のモデルと合わせる
interface Question {
  id: number;
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  source_file: string;
  status: string;
  correct_streak: number;
}

function App() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isAnswered, setIsAnswered] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  // 初回ロード時に問題をフェッチ
  useEffect(() => {
    fetchQuestions();
  }, []);

  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (loading || questions.length === 0 || isAnswered) return;

      const key = parseInt(e.key);
      if (key >= 1 && key <= 5) {
        const optionIndex = key - 1;
        const currentQuestion = questions[currentIndex];
        if (optionIndex < currentQuestion.options.length) {
          handleAnswer(currentQuestion.options[optionIndex]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loading, questions, currentIndex, isAnswered]);

  async function fetchQuestions() {
    setLoading(true);
    try {
      const fetched: Question[] = await invoke("get_questions");
      setQuestions(fetched);
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

    // Rustへ結果を送信 (非同期でOK)
    try {
      await invoke("submit_answer", { id: currentQuestion.id, isCorrect: correct });
    } catch (error) {
      console.error("Failed to submit answer:", error);
    }

    // 正解なら自動で次へ（オプションで変更可能にするのが理想だが、まずは決め打ち）
    if (correct) {
      setTimeout(() => {
        handleNext();
      }, 1000); // 1秒余韻
    }
  }

  function handleNext() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsAnswered(false);
      setSelectedOption(null);
      setIsCorrect(null);
    } else {
      // 全問終了時
      alert("今日の学習は完了です！お疲れ様でした！");
      // リロードして新しいセットを取得するか、完了画面を出す
      window.location.reload();
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-zinc-900">
        <div className="w-1/3 text-center">
          <p className="mb-2 text-lg font-medium">Loading your daily questions...</p>
          <Progress value={33} />
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center space-y-4 bg-gray-50 dark:bg-zinc-900 overflow-y-auto">
        <h1 className="text-2xl font-bold">No questions for today! 🎉</h1>
        <p className="text-muted-foreground">You are all caught up.</p>
        <Button onClick={fetchQuestions}>Check again</Button>

        {/* Import Section (Available even when no questions) */}
        <div className="mt-12 w-full max-w-lg px-6">
          <div className="p-6 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-center bg-white/50 dark:bg-black/20">
            <h3 className="text-sm font-semibold mb-2">管理モード: 問題の追加</h3>
            <p className="text-xs text-muted-foreground mb-4">PDFパスを入力して生成</p>

            <form
              className="flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const input = (form.elements.namedItem('path') as HTMLInputElement);
                const btn = (form.querySelector('button[type="submit"]') as HTMLButtonElement);
                if (!input.value) return;

                const originalText = btn.innerText;
                btn.innerText = "Generating...";
                btn.disabled = true;

                try {
                  await invoke("import_pdf_questions", { filePath: input.value.replace(/"/g, "") });
                  alert("生成完了！データベースに保存されました。");
                  window.location.reload();
                } catch (err) {
                  alert("エラー: " + err);
                } finally {
                  btn.innerText = originalText;
                  btn.disabled = false;
                }
              }}
            >
              <input
                type="text"
                name="path"
                placeholder="File Path (e.g. C:\Users\u\doc.pdf)"
                className="flex-1 px-3 py-2 text-sm border rounded bg-background"
              />
              <Button type="submit" size="sm">Generate</Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-100 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 transition-colors duration-300 overflow-y-auto">

      {/* Header / Progress */}
      <div className="w-full max-w-2xl mb-6 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-sm text-muted-foreground font-semibold tracking-wider uppercase">Social Welfare Exam</span>
          <span className="text-xs text-muted-foreground">Day {new Date().getDate()} - Streak: {currentQuestion.correct_streak}🔥</span>
        </div>
        <div className="text-right">
          <span className="text-xl font-bold font-mono">{currentIndex + 1}</span>
          <span className="text-sm text-muted-foreground mx-1">/</span>
          <span className="text-sm text-muted-foreground">{questions.length}</span>
        </div>
      </div>

      <Card className="w-full max-w-2xl shadow-xl border-t-4 border-t-primary animate-in fade-in zoom-in duration-300">
        <CardHeader>
          <CardTitle className="text-xl leading-relaxed">
            {currentQuestion.question_text}
          </CardTitle>
          {currentQuestion.source_file !== "dummy_data" && (
            <CardDescription>Source: {currentQuestion.source_file}</CardDescription>
          )}
        </CardHeader>

        <CardContent className="space-y-3">
          {currentQuestion.options.map((option, index) => {
            let variant: "default" | "secondary" | "destructive" | "outline" | "ghost" = "outline";

            if (isAnswered) {
              if (option === currentQuestion.correct_answer) {
                variant = "default"; // Green logic via class
              } else if (option === selectedOption && !isCorrect) {
                variant = "destructive";
              } else {
                variant = "ghost";
              }
            } else {
              variant = "outline";
            }

            return (
              <Button
                key={index}
                variant={variant}
                className={`w-full justify-start text-left h-auto py-4 px-6 text-base transition-all
                  ${isAnswered && option === currentQuestion.correct_answer ? 'bg-green-600 hover:bg-green-700 text-white border-transparent' : ''}
                  ${!isAnswered ? 'hover:border-primary hover:bg-accent' : ''}
                `}
                onClick={() => !isAnswered && handleAnswer(option)}
                disabled={isAnswered}
              >
                <span className="mr-4 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium opacity-50">
                  {index + 1}
                </span>
                {option}
              </Button>
            );
          })}
        </CardContent>

        {isAnswered && (
          <CardFooter className="flex flex-col items-start bg-muted/50 p-6 rounded-b-xl animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2 mb-2 w-full">
              {isCorrect ? (
                <Badge className="bg-green-600 hover:bg-green-700 text-base px-3 py-1">Correct! ⭕️</Badge>
              ) : (
                <Badge variant="destructive" className="text-base px-3 py-1">Incorrect ❌</Badge>
              )}
            </div>

            <div className="mt-2 text-sm leading-relaxed text-muted-foreground w-full">
              <span className="font-bold text-foreground block mb-1">解説:</span>
              {currentQuestion.explanation}
            </div>

            <Button className="w-full mt-6" size="lg" onClick={handleNext}>
              Next Question
            </Button>
          </CardFooter>
        )}
      </Card>

      {/* Import Section (Always visible at bottom for easy access during learning too? Maybe a bit distracting. Let's keep it minimal or put in a collapsible) - For now, simple implementation at bottom */}
      <div className="mt-12 w-full max-w-2xl px-6 opacity-30 hover:opacity-100 transition-opacity">
        <details className="w-full">
          <summary className="text-xs text-center cursor-pointer mb-2">Manage / Add Questions</summary>
          <div className="p-4 border border-dashed rounded-lg bg-white/50 dark:bg-black/20">
            <form
              className="flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const input = (form.elements.namedItem('path') as HTMLInputElement);
                const btn = (form.querySelector('button[type="submit"]') as HTMLButtonElement);
                if (!input.value) return;

                const originalText = btn.innerText;
                btn.innerText = "Generating...";
                btn.disabled = true;

                try {
                  await invoke("import_pdf_questions", { filePath: input.value.replace(/"/g, "") });
                  alert("SUCCESS: Generated and saved!");
                  window.location.reload();
                } catch (err) {
                  alert("ERROR: " + err);
                } finally {
                  btn.innerText = originalText;
                  btn.disabled = false;
                }
              }}
            >
              <input
                type="text"
                name="path"
                placeholder="Full Path to PDF..."
                className="flex-1 px-3 py-2 text-xs border rounded"
              />
              <Button type="submit" size="sm" variant="secondary">Generate</Button>
            </form>
          </div>
        </details>
      </div>

      <div className="mt-8 text-center text-xs text-muted-foreground opacity-50 pb-8">
        Press <kbd className="border rounded px-1">1</kbd>-<kbd className="border rounded px-1">5</kbd> to answer
      </div>
    </div>
  );
}

export default App;
