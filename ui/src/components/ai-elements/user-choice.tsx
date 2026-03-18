"use client";

import { memo, useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { HelpCircleIcon, CheckCircleIcon, SendIcon } from "lucide-react";

interface Question {
  id: string;
  question: string;
  options: Array<{ label: string; description?: string }>;
}

export const UserChoice = memo(({
  questions,
  submitted,
  onSubmit,
}: {
  questions: Question[];
  submitted?: boolean;
  onSubmit?: (answers: Record<string, string>) => void;
}) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(submitted || false);

  const allAnswered = questions.every((q) => answers[q.id]);

  const handleSelect = (questionId: string, label: string) => {
    if (isSubmitted) return;
    setAnswers((prev) => ({ ...prev, [questionId]: label }));
  };

  const handleSubmit = () => {
    if (!allAnswered || isSubmitted) return;
    setIsSubmitted(true);
    onSubmit?.(answers);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-3 rounded-lg border border-accent/30 bg-accent/5 overflow-hidden"
    >
      {questions.map((q, qi) => (
        <div key={q.id} className={cn(qi > 0 && "border-t border-accent/10")}>
          {/* Question header */}
          <div className="flex items-center gap-2 px-3 py-2.5">
            <div className={cn(
              "flex items-center justify-center size-5 rounded-full text-[10px] font-bold flex-shrink-0",
              answers[q.id] ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
            )}>
              {answers[q.id] ? <CheckCircleIcon className="size-3" /> : qi + 1}
            </div>
            <span className="text-sm font-medium text-foreground">{q.question}</span>
          </div>

          {/* Options */}
          <div className="px-2 pb-2 flex flex-wrap gap-1.5">
            {q.options.map((opt, i) => {
              const isSelected = answers[q.id] === opt.label;
              return (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: qi * 0.1 + i * 0.03 }}
                  onClick={() => handleSelect(q.id, opt.label)}
                  disabled={isSubmitted}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                    isSelected
                      ? "bg-accent text-accent-foreground border-accent"
                      : "bg-transparent text-muted-foreground border-border hover:border-accent/50 hover:text-foreground",
                    isSubmitted && !isSelected && "opacity-30",
                    !isSubmitted && "cursor-pointer"
                  )}
                  title={opt.description}
                >
                  {opt.label}
                </motion.button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Submit button */}
      {!isSubmitted && (
        <div className="px-3 pb-3 pt-1">
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: allAnswered ? 1 : 0.4 }}
            onClick={handleSubmit}
            disabled={!allAnswered}
            className={cn(
              "w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
              allAnswered
                ? "bg-accent text-accent-foreground hover:bg-accent/90 cursor-pointer"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            <SendIcon className="size-3.5" />
            {allAnswered ? "Continue" : `Answer all ${questions.length} questions`}
          </motion.button>
        </div>
      )}

      {/* Submitted state */}
      {isSubmitted && (
        <div className="px-3 pb-2">
          <p className="text-xs text-muted-foreground">
            {Object.values(answers).join(" · ")}
          </p>
        </div>
      )}
    </motion.div>
  );
});
UserChoice.displayName = "UserChoice";
