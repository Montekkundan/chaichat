"use client";

import { useEffect, useRef } from "react";
import { Playground } from "~/components/playground/playground";
import { usePlayground } from "~/lib/providers/playground-provider";
import { useRouter } from "next/navigation";

export function TemplateForkOnUse({ isTemplate }: { isTemplate: boolean }) {
  const { columns } = usePlayground();
  const router = useRouter();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (!isTemplate || hasRedirected.current) return;
    const hasUserInput = columns.some((col) => col.input.trim() || col.messages.length > 0);
    const hasExtraColumn = columns.length > 2;
    if (hasUserInput || hasExtraColumn) {
      const newId = `playground-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      if (typeof window !== "undefined") {
        const payload = {
          columns,
          sharedInput: "",
          currentPlaygroundId: newId,
          createdAt: Date.now(),
        } as const;
        localStorage.setItem(`chaichat_playground_${newId}`, JSON.stringify(payload));
        let list = [] as string[];
        try {
          list = JSON.parse(localStorage.getItem("chaichat_playground_list") || "[]");
        } catch {}
        if (!list.includes(newId)) {
          list.unshift(newId);
          if (list.length > 10) list = list.slice(0, 10);
          localStorage.setItem("chaichat_playground_list", JSON.stringify(list));
        }
      }
      hasRedirected.current = true;
      router.replace(`/playground/${newId}`);
    }
  }, [isTemplate, columns, router]);

  return <Playground />;
}


