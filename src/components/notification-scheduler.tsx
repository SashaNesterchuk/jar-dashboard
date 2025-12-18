"use client";

import * as React from "react";
import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { IconPlus, IconX, IconCheck, IconSparkles } from "@tabler/icons-react";
import { toast } from "sonner";

interface NotificationContent {
  title: string;
  bodyShort: string;
  bodyLong: string;
}

const AVAILABLE_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "de", name: "Deutsch" },
  { code: "fr", name: "Français" },
  { code: "pt", name: "Português" },
  { code: "uk", name: "Українська" },
];

const CHARACTER_LIMITS = {
  title: { min: 30, max: 50 },
  bodyShort: { min: 90, max: 120 },
  bodyLong: { min: 180, max: 250 },
};

interface NotificationSchedulerProps {
  onSuccess?: () => void;
}

export function NotificationScheduler({ onSuccess }: NotificationSchedulerProps = {}) {
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [activeLanguages, setActiveLanguages] = useState<string[]>(["en"]);
  const [content, setContent] = useState<Record<string, NotificationContent>>({
    en: { title: "", bodyShort: "", bodyLong: "" },
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  const availableToAdd = AVAILABLE_LANGUAGES.filter(
    (lang) => !activeLanguages.includes(lang.code)
  );

  const addLanguage = (langCode: string) => {
    if (!activeLanguages.includes(langCode)) {
      setActiveLanguages([...activeLanguages, langCode]);
      setContent({
        ...content,
        [langCode]: { title: "", bodyShort: "", bodyLong: "" },
      });
    }
  };

  const removeLanguage = (langCode: string) => {
    if (langCode === "en") return; // Cannot remove English
    setActiveLanguages(activeLanguages.filter((lang) => lang !== langCode));
    const newContent = { ...content };
    delete newContent[langCode];
    setContent(newContent);
  };

  const updateContent = (
    langCode: string,
    field: keyof NotificationContent,
    value: string
  ) => {
    setContent({
      ...content,
      [langCode]: {
        ...content[langCode],
        [field]: value,
      },
    });
  };

  const getCharacterWarning = (text: string, field: keyof typeof CHARACTER_LIMITS) => {
    const length = text.length;
    const limits = CHARACTER_LIMITS[field];
    const isOverLimit = length > limits.max;
    const isUnderMin = length > 0 && length < limits.min;
    
    return {
      isWarning: isOverLimit || isUnderMin,
      color: isOverLimit ? "text-red-500" : isUnderMin ? "text-yellow-500" : "text-muted-foreground",
    };
  };

  const getLangName = (code: string) => {
    return AVAILABLE_LANGUAGES.find((lang) => lang.code === code)?.name || code.toUpperCase();
  };

  const canTranslate =
    content.en.title.length > 0 &&
    content.en.bodyShort.length > 0 &&
    content.en.bodyLong.length > 0;

  const handleAITranslate = async () => {
    if (!canTranslate) return;

    setIsTranslating(true);

    try {
      const response = await fetch("/api/translate-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: content.en.title,
          bodyShort: content.en.bodyShort,
          bodyLong: content.en.bodyLong,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Translation failed");
      }

      const translations = await response.json();

      // Add all translated languages
      const allLangs = ["en", ...Object.keys(translations)];
      setActiveLanguages(allLangs);

      // Merge translations with existing English content
      setContent({
        en: content.en,
        ...translations,
      });

      toast.success("All languages translated successfully!");
    } catch (error: any) {
      console.error("Translation error:", error);
      toast.error(error.message || "Translation failed. Please try again.");
    } finally {
      setIsTranslating(false);
    }
  };

  const validateForm = () => {
    if (!scheduledDate) {
      toast.error("Please select a date");
      return false;
    }
    if (!scheduledTime) {
      toast.error("Please select a time");
      return false;
    }
    if (!content.en.title || !content.en.bodyShort || !content.en.bodyLong) {
      toast.error("Please fill in all English content fields");
      return false;
    }
    return true;
  };

  const resetForm = () => {
    setScheduledDate("");
    setScheduledTime("");
    setActiveLanguages(["en"]);
    setContent({ en: { title: "", bodyShort: "", bodyLong: "" } });
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);

    try {
      // Format content for API
      const notificationContent: Record<string, any> = {};
      activeLanguages.forEach((lang) => {
        if (content[lang] && content[lang].title) {
          notificationContent[lang] = {
            title: content[lang].title,
            bodyShort: content[lang].bodyShort,
            bodyLong: content[lang].bodyLong,
          };
        }
      });

      const payload = {
        date: scheduledDate,
        time: scheduledTime + ":00", // Convert to '20:00:00' format
        content: notificationContent,
      };

      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save notification");
      }

      toast.success("Notification scheduled successfully!");
      resetForm();
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error("Error saving notification:", error);
      toast.error(error.message || "Failed to save notification");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="mx-4 lg:mx-6">
      <CardHeader>
        <CardTitle>Schedule Push Notification</CardTitle>
        <CardDescription>
          Create and schedule push notifications with multi-language support
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Date and Time Section */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="notification-date">Date</Label>
            <Input
              id="notification-date"
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notification-time">Time</Label>
            <Input
              id="notification-time"
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="w-full"
            />
          </div>
        </div>

        {/* Language Management */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Languages</Label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleAITranslate}
                disabled={!canTranslate || isTranslating}
                className="h-8"
              >
                <IconSparkles size={16} className="mr-2" />
                {isTranslating ? "Translating..." : "AI Translate"}
              </Button>
              {availableToAdd.length > 0 && (
                <Select onValueChange={addLanguage}>
                  <SelectTrigger className="w-[180px] h-8">
                    <SelectValue placeholder="Add language" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableToAdd.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Language Tabs */}
          <Tabs defaultValue="en" className="w-full">
            <TabsList className="w-full justify-start flex-wrap h-auto gap-1">
              {activeLanguages.map((langCode) => (
                <div key={langCode} className="relative group">
                  <TabsTrigger value={langCode} className="pr-8">
                    {getLangName(langCode)}
                  </TabsTrigger>
                  {langCode !== "en" && (
                    <button
                      onClick={() => removeLanguage(langCode)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                      title={`Remove ${getLangName(langCode)}`}
                    >
                      <IconX size={14} className="text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </div>
              ))}
            </TabsList>

            {activeLanguages.map((langCode) => {
              const langContent = content[langCode] || { title: "", bodyShort: "", bodyLong: "" };
              const titleWarning = getCharacterWarning(langContent.title, "title");
              const bodyShortWarning = getCharacterWarning(langContent.bodyShort, "bodyShort");
              const bodyLongWarning = getCharacterWarning(langContent.bodyLong, "bodyLong");

              return (
                <TabsContent key={langCode} value={langCode} className="space-y-4 mt-4">
                  {/* Title Input */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`title-${langCode}`}>Title</Label>
                      <span className={`text-xs ${titleWarning.color}`}>
                        {langContent.title.length}/{CHARACTER_LIMITS.title.max}
                        {titleWarning.isWarning && (
                          <span className="ml-1">
                            (recommended: {CHARACTER_LIMITS.title.min}-{CHARACTER_LIMITS.title.max})
                          </span>
                        )}
                      </span>
                    </div>
                    <Input
                      id={`title-${langCode}`}
                      value={langContent.title}
                      onChange={(e) => updateContent(langCode, "title", e.target.value)}
                      placeholder="Enter notification title..."
                      className={titleWarning.isWarning ? "border-yellow-500 focus-visible:ring-yellow-500" : ""}
                    />
                  </div>

                  {/* Body Short Input */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`body-short-${langCode}`}>Body (Collapsed View)</Label>
                      <span className={`text-xs ${bodyShortWarning.color}`}>
                        {langContent.bodyShort.length}/{CHARACTER_LIMITS.bodyShort.max}
                        {bodyShortWarning.isWarning && (
                          <span className="ml-1">
                            (recommended: {CHARACTER_LIMITS.bodyShort.min}-{CHARACTER_LIMITS.bodyShort.max})
                          </span>
                        )}
                      </span>
                    </div>
                    <Input
                      id={`body-short-${langCode}`}
                      value={langContent.bodyShort}
                      onChange={(e) => updateContent(langCode, "bodyShort", e.target.value)}
                      placeholder="Text shown when notification is collapsed..."
                      className={bodyShortWarning.isWarning ? "border-yellow-500 focus-visible:ring-yellow-500" : ""}
                    />
                  </div>

                  {/* Body Long Input */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`body-long-${langCode}`}>Body (Expanded View)</Label>
                      <span className={`text-xs ${bodyLongWarning.color}`}>
                        {langContent.bodyLong.length}/{CHARACTER_LIMITS.bodyLong.max}
                        {bodyLongWarning.isWarning && (
                          <span className="ml-1">
                            (recommended: {CHARACTER_LIMITS.bodyLong.min}-{CHARACTER_LIMITS.bodyLong.max})
                          </span>
                        )}
                      </span>
                    </div>
                    <textarea
                      id={`body-long-${langCode}`}
                      value={langContent.bodyLong}
                      onChange={(e) => updateContent(langCode, "bodyLong", e.target.value)}
                      placeholder="Text shown when notification is expanded (long press)..."
                      rows={3}
                      className={`flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                        bodyLongWarning.isWarning ? "border-yellow-500 focus-visible:ring-yellow-500" : ""
                      }`}
                    />
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </div>

        {/* Actions Section */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {scheduledDate && scheduledTime
              ? `Scheduled for: ${scheduledDate} at ${scheduledTime}`
              : "No date/time selected"}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={resetForm}
              disabled={isSaving}
            >
              Clear
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !scheduledDate || !scheduledTime}
            >
              {isSaving ? (
                <>Saving...</>
              ) : (
                <>
                  <IconCheck size={16} className="mr-2" />
                  Schedule Notification
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

