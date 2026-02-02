"use client";

import { useToast } from "@/hooks/use-toast";
import { X, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "flex items-start gap-3 rounded-lg border p-4 shadow-lg transition-all",
            "bg-background animate-in slide-in-from-bottom-2",
            toast.variant === "destructive"
              ? "border-red-200 bg-red-50 text-red-900"
              : "border-border"
          )}
        >
          {toast.variant === "destructive" ? (
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          ) : (
            <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
          )}
          <div className="flex-1 space-y-1">
            {toast.title && (
              <p className="text-sm font-semibold">{toast.title}</p>
            )}
            {toast.description && (
              <p className="text-sm opacity-90">{toast.description}</p>
            )}
          </div>
          <button
            onClick={() => dismiss(toast.id)}
            className="shrink-0 rounded-md p-1 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
