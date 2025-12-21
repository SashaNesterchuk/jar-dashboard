"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { journals } from "@/utils/journalEvents";
import { questionsNe } from "@/utils/questions";

type PracticeType = "journaling" | "self-discovery" | "";

type RichTextValue = { question: string; answer?: string };

interface QuizTrait {
  id: string;
  title: string;
  description: string;
}

interface QuestionAnswer {
  questionId: string;
  weights: Record<string, number>;
  label: string;
}

// Helper function to remove HTML tags from text
const stripHtmlTags = (text: string): string => {
  return text.replace(/<[^>]*>/g, "");
};

export default function AITestPage() {
  const [practiceType, setPracticeType] = useState<PracticeType>("");
  const [selectedPractice, setSelectedPractice] = useState<any>(null);
  const [journalAnswers, setJournalAnswers] = useState<RichTextValue[]>([]);
  const [questionAnswers, setQuestionAnswers] = useState<QuestionAnswer[]>([]);
  const [response, setResponse] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const handlePracticeTypeChange = (type: PracticeType) => {
    setPracticeType(type);
    setSelectedPractice(null);
    setJournalAnswers([]);
    setQuestionAnswers([]);
    setResponse("");
    setError("");
  };

  const handlePracticeChange = (practiceId: string) => {
    const practice =
      practiceType === "journaling"
        ? journals.find((j) => j.id === practiceId)
        : questionsNe.find((q) => q.id === practiceId);

    setSelectedPractice(practice);
    setJournalAnswers([]);
    setQuestionAnswers([]);
    setResponse("");
    setError("");
  };

  const handleJournalAnswerChange = (index: number, answer: string) => {
    const newAnswers = [...journalAnswers];
    const templates = selectedPractice.pages?.[0]?.templates || [];
    const question =
      templates.length > 0
        ? stripHtmlTags(templates[index])
        : stripHtmlTags(selectedPractice.title || "Journal Entry");

    newAnswers[index] = {
      question,
      answer,
    };
    setJournalAnswers(newAnswers);
  };

  const handleQuestionAnswerChange = (
    questionId: string,
    weights: Record<string, number>,
    label: string
  ) => {
    // Find which page this question belongs to
    const pageIndex = selectedPractice.pages?.findIndex((page: any) =>
      page.questions?.some((q: any) => q.id === questionId)
    );

    if (pageIndex === -1) return;

    // Get all question IDs from this page
    const pageQuestionIds =
      selectedPractice.pages[pageIndex].questions?.map((q: any) => q.id) || [];

    // Remove any existing answer from this page, then add the new answer
    const newAnswers = questionAnswers.filter(
      (a) => !pageQuestionIds.includes(a.questionId)
    );
    newAnswers.push({ questionId, weights, label });
    setQuestionAnswers(newAnswers);
  };

  const calculateQuizTrait = (): QuizTrait | null => {
    if (!selectedPractice?.traits || questionAnswers.length === 0) return null;

    const scores: Record<string, number> = {};
    selectedPractice.traits.forEach((t: QuizTrait) => (scores[t.id] = 0));

    questionAnswers.forEach((answer) => {
      Object.entries(answer.weights).forEach(([traitId, weight]) => {
        if (scores[traitId] !== undefined) {
          scores[traitId] += weight;
        }
      });
    });

    let maxScore = -Infinity;
    let bestTraitId: string | null = null;

    Object.entries(scores).forEach(([traitId, score]) => {
      if (score > maxScore) {
        maxScore = score;
        bestTraitId = traitId;
      }
    });

    if (bestTraitId) {
      return (
        selectedPractice.traits.find((t: QuizTrait) => t.id === bestTraitId) ||
        null
      );
    }

    return null;
  };

  const handleAnalyze = async () => {
    if (!selectedPractice) {
      setError("Please select a practice");
      return;
    }

    if (practiceType === "journaling" && journalAnswers.length === 0) {
      setError("Please answer at least one question");
      return;
    }

    if (practiceType === "self-discovery" && questionAnswers.length === 0) {
      setError("Please answer at least one question");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setResponse("");

      const userId = `test-user-${Date.now()}`;
      const eventId = `test-event-${Date.now()}`;

      let payload: any = {
        userId,
        eventId,
        testMode: true,
      };

      if (practiceType === "journaling") {
        payload.journalSummary = {
          journal: journalAnswers.filter((a) => a.answer?.trim()),
        };
      } else if (practiceType === "self-discovery") {
        const quizTrait = calculateQuizTrait();
        if (quizTrait) {
          payload.quizSummary = {
            quizEvaluation: quizTrait,
          };
        }
      }

      const res = await fetch("/api/ai-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          function: "generate_ai_summary",
          payload,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Request failed");
        setLoading(false);
        return;
      }

      setResponse(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setError(e.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const renderJournalingForm = () => {
    if (!selectedPractice) return null;

    const templates = selectedPractice.pages?.[0]?.templates || [];

    // If there are no templates, show a single free-form text area
    if (templates.length === 0) {
      return (
        <div className="space-y-2">
          <Label htmlFor="journal-freeform">
            {stripHtmlTags(
              selectedPractice.title || "Write your journal entry"
            )}
          </Label>
          <Textarea
            id="journal-freeform"
            placeholder="Type your journal entry here..."
            value={journalAnswers[0]?.answer || ""}
            onChange={(e) => handleJournalAnswerChange(0, e.target.value)}
            className="min-h-[200px]"
          />
        </div>
      );
    }

    // If there are templates, show a text area for each template question
    return (
      <div className="space-y-4">
        {templates.map((template: string, index: number) => (
          <div key={index} className="space-y-2">
            <Label htmlFor={`journal-${index}`}>
              {stripHtmlTags(template)}
            </Label>
            <Textarea
              id={`journal-${index}`}
              placeholder="Type your answer here..."
              value={journalAnswers[index]?.answer || ""}
              onChange={(e) => handleJournalAnswerChange(index, e.target.value)}
              className="min-h-[100px]"
            />
          </div>
        ))}
      </div>
    );
  };

  const renderSelfDiscoveryForm = () => {
    if (!selectedPractice) return null;

    const questionPages =
      selectedPractice.pages?.filter(
        (page: any) => page.component === "question"
      ) || [];

    return (
      <div className="space-y-6">
        {questionPages.map((page: any, pageIndex: number) => {
          const pageKey = `page-${pageIndex}`;
          const selectedAnswerForPage = questionAnswers.find((a) =>
            page.questions?.some((q: any) => q.id === a.questionId)
          );

          return (
            <div key={pageKey} className="space-y-3 rounded-lg border p-4">
              {page.description && (
                <p className="text-sm font-medium mb-3">
                  {stripHtmlTags(page.description)}
                </p>
              )}
              <RadioGroup
                value={selectedAnswerForPage?.questionId || ""}
                onValueChange={(value) => {
                  const question = page.questions?.find(
                    (q: any) => q.id === value
                  );
                  if (question) {
                    handleQuestionAnswerChange(
                      question.id,
                      question.weights,
                      stripHtmlTags(question.label || question.id)
                    );
                  }
                }}
              >
                <div className="space-y-2">
                  {page.questions?.map((question: any) => (
                    <div
                      key={question.id}
                      className="flex items-center space-x-2"
                    >
                      <RadioGroupItem value={question.id} id={question.id} />
                      <Label
                        htmlFor={question.id}
                        className="cursor-pointer font-normal"
                      >
                        {stripHtmlTags(question.label || question.id)}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">AI Practice Tester</h1>
        <p className="text-muted-foreground">
          Test AI summary generation with journaling and self-discovery
          practices
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle>Practice Setup</CardTitle>
            <CardDescription>
              Select a practice type and fill out the form
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Practice Type Dropdown */}
            <div className="space-y-2">
              <Label htmlFor="practice-type">Practice Type</Label>
              <Select
                value={practiceType}
                onValueChange={handlePracticeTypeChange}
              >
                <SelectTrigger id="practice-type">
                  <SelectValue placeholder="Select practice type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="journaling">Journaling</SelectItem>
                  <SelectItem value="self-discovery">Self-Discovery</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Practice Selection Dropdown */}
            {practiceType && (
              <div className="space-y-2">
                <Label htmlFor="practice">
                  {practiceType === "journaling"
                    ? "Journaling Practice"
                    : "Self-Discovery Practice"}
                </Label>
                <Select
                  value={selectedPractice?.id || ""}
                  onValueChange={handlePracticeChange}
                >
                  <SelectTrigger id="practice">
                    <SelectValue placeholder="Select a practice" />
                  </SelectTrigger>
                  <SelectContent>
                    {practiceType === "journaling"
                      ? journals.map((journal) => (
                          <SelectItem key={journal.id} value={journal.id}>
                            {stripHtmlTags(journal.title)}
                          </SelectItem>
                        ))
                      : questionsNe.map((question) => (
                          <SelectItem key={question.id} value={question.id}>
                            {stripHtmlTags(question.title || question.tKey)}
                          </SelectItem>
                        ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Dynamic Form */}
            {selectedPractice && (
              <div className="space-y-4 max-h-[400px] overflow-y-auto">
                {practiceType === "journaling" && renderJournalingForm()}
                {practiceType === "self-discovery" && renderSelfDiscoveryForm()}
              </div>
            )}

            {/* Analyze Button */}
            <Button
              onClick={handleAnalyze}
              disabled={loading || !selectedPractice}
              className="w-full"
            >
              {loading ? "Analyzing..." : "Analyze with AI"}
            </Button>
          </CardContent>
        </Card>

        {/* Response Section */}
        <Card>
          <CardHeader>
            <CardTitle>AI Response</CardTitle>
            <CardDescription>
              Generated insight, advice, and affirmation
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="rounded-md bg-destructive/10 p-4 text-destructive mb-4">
                <p className="text-sm font-medium">Error</p>
                <p className="text-sm">{error}</p>
              </div>
            )}

            {response && (
              <div className="space-y-2">
                <pre className="rounded-md bg-muted p-4 overflow-auto max-h-[500px] text-sm font-mono">
                  {response}
                </pre>
              </div>
            )}

            {!response && !error && !loading && (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                <p className="text-center">
                  Fill out the practice form and click "Analyze with AI" to see
                  results
                </p>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <p>Processing...</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
