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

const AI_FUNCTIONS = [
  {
    value: "generate_ai_chat",
    label: "AI Chat",
    description: "Generate AI chat responses",
  },
  {
    value: "generate_ai_summary",
    label: "AI Summary",
    description: "Generate check-in summaries",
  },
  {
    value: "generate_ai_tags",
    label: "AI Tags",
    description: "Generate emotion and tag suggestions",
  },
  {
    value: "generate_ai_events",
    label: "AI Events",
    description: "Generate practice suggestions (todos)",
  },
  {
    value: "generate_ai_ny_summary",
    label: "AI NY Summary",
    description: "Generate New Year reflection summaries",
  },
  {
    value: "generate_ai_review",
    label: "AI Review",
    description: "Generate comprehensive review with insights",
  },
];

export default function AITestPage() {
  const [selectedFunction, setSelectedFunction] = useState<string>("");
  const [payload, setPayload] = useState<string>("");
  const [response, setResponse] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const handleSubmit = async () => {
    if (!selectedFunction) {
      setError("Please select a function");
      return;
    }

    if (!payload.trim()) {
      setError("Please enter a payload");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setResponse("");

      // Parse JSON to validate
      let parsedPayload;
      try {
        parsedPayload = JSON.parse(payload);
      } catch (e) {
        setError("Invalid JSON payload");
        setLoading(false);
        return;
      }

      // Call API
      const res = await fetch("/api/ai-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          function: selectedFunction,
          payload: parsedPayload,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Request failed");
        setLoading(false);
        return;
      }

      // Pretty print response
      setResponse(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setError(e.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">AI Function Tester</h1>
        <p className="text-muted-foreground">
          Test AI functions without saving to the database
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle>Input</CardTitle>
            <CardDescription>
              Select a function and provide a JSON payload
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="function">AI Function</Label>
              <Select value={selectedFunction} onValueChange={setSelectedFunction}>
                <SelectTrigger id="function">
                  <SelectValue placeholder="Select a function" />
                </SelectTrigger>
                <SelectContent>
                  {AI_FUNCTIONS.map((func) => (
                    <SelectItem key={func.value} value={func.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{func.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {func.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payload">JSON Payload</Label>
              <Textarea
                id="payload"
                placeholder='{"userId": "test-user", "eventId": "test-event", ...}'
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
                className="font-mono text-sm min-h-[300px]"
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={loading || !selectedFunction}
              className="w-full"
            >
              {loading ? "Sending..." : "Send Request"}
            </Button>
          </CardContent>
        </Card>

        {/* Response Section */}
        <Card>
          <CardHeader>
            <CardTitle>Response</CardTitle>
            <CardDescription>AI function response</CardDescription>
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
                No response yet
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

