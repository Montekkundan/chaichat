'use client';

import React, { useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useChat } from '@ai-sdk/react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { MessageList } from '~/components/message-list';
import { PromptInputBox } from '~/components/prompt-input';
import type { Id } from '@/convex/_generated/dataModel';

export default function ChatPage() {
  const { chatId } = useParams();
  const { user } = useUser();
  const searchParams = useSearchParams();

  const chatIdString = Array.isArray(chatId) ? chatId[0] : chatId;
  const chatIdConvex = chatIdString as Id<'chats'>;

  const convexMessages = useQuery(
    api.chat.getMessages,
    chatIdConvex ? { chatId: chatIdConvex } : 'skip'
  );
  const addMessage = useMutation(api.chat.addMessage);

  const lastAssistantRef = useRef<string | null>(null);

  const {
    messages,
    input,
    setInput,
    append,
    isLoading,
    setMessages,
  } = useChat({
    api: '/api/chat',
    initialMessages:
      convexMessages?.map((m) => ({
        id: m._id,
        role: m.role,
        content: m.content,
      })) ?? [],
  });

  const pendingInput = searchParams.get("q");
  const hasAppendedPending = useRef(false);

  const handleSend = async (input: string) => {
    if (!input.trim() || !user) return;
    await addMessage({
      chatId: chatIdConvex,
      userId: user.id,
      role: 'user',
      content: input,
    });
    await append({ content: input, role: 'user' });
    setInput('');
  };

  useEffect(() => {
    if (!messages.length || !user) return;
    const last = messages[messages.length - 1];
    if (
      last &&
      last.role === 'assistant' &&
      !isLoading &&
      last.content &&
      (typeof last.content === 'string'
        ? last.content !== lastAssistantRef.current
        : Array.isArray(last.content)
        ? (last.content as string[]).join('') !== lastAssistantRef.current
        : false)
    ) {
      const assistantContent =
        typeof last.content === 'string'
          ? last.content
          : Array.isArray(last.content)
          ? (last.content as string[]).join('')
          : '';
      addMessage({
        chatId: chatIdConvex,
        userId: 'assistant',
        role: 'assistant',
        content: assistantContent,
      });
      lastAssistantRef.current = assistantContent;
    }
  }, [messages, isLoading, addMessage, chatIdConvex, user]);

  useEffect(() => {
    if (convexMessages && messages.length === 0) {
      setMessages(
        convexMessages.map((m) => ({
          id: m._id,
          role: m.role,
          content: m.content,
        }))
      );
    }
  }, [convexMessages, messages.length, setMessages]);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      pendingInput &&
      user &&
      !hasAppendedPending.current
    ) {
      const last = messages[messages.length - 1];
      if (!last || last.content !== pendingInput) {
        append({ content: pendingInput, role: "user" });
        setInput("");
        hasAppendedPending.current = true;
        // Remove the query param from the URL after appending
        const url = new URL(window.location.href);
        url.searchParams.delete("q");
        window.history.replaceState({}, "", url.pathname + url.search);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInput, user, messages, append, setInput]);

  const mappedMessages = messages.map((m, idx) => ({
    id: m.id ?? String(idx),
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  return (
    <div className="flex min-h-[60vh] flex-col p-4">
      <MessageList messages={mappedMessages} />
      <PromptInputBox
        value={input}
        onValueChange={setInput}
        onSubmit={handleSend}
        position="bottom"
        isLoading={isLoading}
      />
    </div>
  );
}
