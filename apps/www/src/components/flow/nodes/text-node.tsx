"use client";

import { useCallback, useState, useEffect } from 'react';
import type { NodeProps } from '@xyflow/react';
import { useFlow } from '~/lib/providers/flow-provider';
import { BaseNode, BaseNodeHeader, BaseNodeHeaderTitle, BaseNodeContent, BaseNodeFooter } from '../base-node';
import { NodeAppendix } from '../node-appendix';
import { BaseHandle } from '../base-handle';
import { ButtonHandle } from '../button-handle';
import { useConnection, Position, type ConnectionState } from '@xyflow/react';
import { ModelSelector } from '~/components/chat-input/model-selector';
import { Button } from '~/components/ui/button';
import { Textarea } from '~/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { ApiKeyManager } from '~/components/api-key-manager';
import { getAllKeys } from '~/lib/local-keys';
import type { UIMessage } from 'ai';
import { Conversation, ConversationContent } from '~/components/ai-elements/conversation';
import { Message, MessageContent } from '~/components/ai-elements/message';
import { Response } from '~/components/ai-elements/response';
import { Loader } from '~/components/ai-elements/loader';

type TextNodeData = {
  title?: string;
  messages?: UIMessage[];
  modelId?: string;
};

export function TextNode({ id, data }: NodeProps) {
  const { setNodes, getAncestorMessages, isDragging } = useFlow();
  const connectionInProgress = useConnection((c: ConnectionState) => c.inProgress);

  const updateNodeData = useCallback((nodeId: string, newData: Partial<TextNodeData>) => {
    setNodes((prevNodes) => {
      if (!Array.isArray(prevNodes)) {
        console.error('prevNodes is not an array:', prevNodes);
        return [];
      }
      return prevNodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...newData } }
          : node
      );
    });
  }, [setNodes]);

  const d = (data as TextNodeData) ?? { title: 'Text', messages: [], modelId: 'openai/gpt-4o-mini' };
  const [input, setInput] = useState('');
  const [modelId, setModelId] = useState(d.modelId || 'openai/gpt-4o-mini');
  const [isLoading, setIsLoading] = useState(false);
  const [showKeyDialog, setShowKeyDialog] = useState(false);

  // Get messages from data, defaulting to empty array
  const messages = d.messages || [];

  // Gateway state management (similar to chat.tsx)
  const [gateway, setGateway] = useState<"llm-gateway" | "vercel-ai-gateway">("llm-gateway");

  useEffect(() => {
    const read = () => {
      try {
        const src = window.localStorage.getItem("chaichat_models_source");
        setGateway(src === "aigateway" ? "vercel-ai-gateway" : "llm-gateway");
      } catch {
        setGateway("llm-gateway");
      }
    };
    read();
    const handler = () => read();
    window.addEventListener("modelsSourceChanged", handler as EventListener);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("modelsSourceChanged", handler as EventListener);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const send = useCallback(async () => {
    if (!input.trim()) return;
    setIsLoading(true);

    // Get the input value before clearing it
    const userInput = input.trim();

    // Create user message
    const userMessage: UIMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      parts: [{ type: 'text', text: userInput }],
    };

    // Create assistant message placeholder
    const assistantMessage: UIMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      parts: [{ type: 'text', text: '' }],
    };

    // Add both messages to the array
    const newMessages = [...messages, userMessage, assistantMessage];
    updateNodeData(id, { messages: newMessages });

    // Clear input immediately for better UX
    setInput('');
    try {
      // Read BYOK keys (anonymous users)
      let userApiKeys: { llmGatewayApiKey?: string; aiGatewayApiKey?: string } = {};
      try {
        userApiKeys = await getAllKeys();
      } catch {}

      console.log('API keys loaded:', {
        hasLlmKey: !!userApiKeys.llmGatewayApiKey,
        hasAiKey: !!userApiKeys.aiGatewayApiKey,
        gateway,
        modelId
      });

      console.log('Sending request to /api/chat:', { model: modelId, gateway, input: userInput });

      // Validate required data before making request
      if (!modelId || !userInput) {
        throw new Error('Model ID and input are required');
      }

      // Combine upstream context from connected parent nodes and this node's prior messages
      let history: UIMessage[] = [];
      try {
        const upstream = getAncestorMessages(id) || [];
        const selfHistory = Array.isArray(messages) ? (messages as UIMessage[]) : [];
        history = [...upstream, ...selfHistory];
      } catch {}
      const requestBody = {
        model: modelId,
        gateway,
        userApiKeys,
        messages: [
          ...history,
          {
            role: 'user' as const,
            parts: [{ type: 'text' as const, text: userInput }],
          },
        ],
      };

      // Validate message structure
      console.log('Message validation:', {
        hasMessages: !!requestBody.messages,
        messagesLength: requestBody.messages?.length,
        firstMessage: requestBody.messages?.[0],
        firstMessageRole: requestBody.messages?.[0]?.role,
        firstMessageParts: requestBody.messages?.[0]?.parts,
      });

      console.log('Request body:', requestBody);

      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      console.log('Response status:', resp.status, resp.headers.get('content-type'));
      console.log('Response headers:', Object.fromEntries(resp.headers.entries()));

      if (!resp.ok) {
        try {
          const err = await resp.json();
          console.error('API Error:', err);

          if (!err || typeof err !== 'object') {
            updateNodeData(id, {
              messages: [...newMessages.slice(0, -1), {
                ...assistantMessage,
                parts: [{ type: 'text', text: `Request failed (${resp.status})` }]
              }]
            });
            setIsLoading(false);
            return;
          }

          if (err?.code === 'NO_API_KEY') {
            setShowKeyDialog(true);
            updateNodeData(id, {
              messages: [...newMessages.slice(0, -1), {
                ...assistantMessage,
                parts: [{ type: 'text', text: err.error || 'Missing API key' }]
              }]
            });
            setIsLoading(false);
            return;
          }

          updateNodeData(id, {
            messages: [...newMessages.slice(0, -1), {
              ...assistantMessage,
              parts: [{ type: 'text', text: err?.error || `Request failed (${resp.status})` }]
            }]
          });
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
          try {
            const text = await resp.text();
            updateNodeData(id, {
              messages: [...newMessages.slice(0, -1), {
                ...assistantMessage,
                parts: [{ type: 'text', text: text || `Request failed (${resp.status})` }]
              }]
            });
          } catch {
            updateNodeData(id, {
              messages: [...newMessages.slice(0, -1), {
                ...assistantMessage,
                parts: [{ type: 'text', text: `Request failed (${resp.status})` }]
              }]
            });
          }
        }
        setIsLoading(false);
        return;
      }

      const contentType = resp.headers.get('content-type') || '';
      console.log('Response content type:', contentType);

      if (!contentType.includes('text/event-stream')) {
        try {
          const text = await resp.text();
          console.log('Non-streaming response:', text);
          updateNodeData(id, {
            messages: [...newMessages.slice(0, -1), {
              ...assistantMessage,
              parts: [{ type: 'text', text }]
            }]
          });
        } catch (textError) {
          console.error('Error reading response text:', textError);
          updateNodeData(id, {
            messages: [...newMessages.slice(0, -1), {
              ...assistantMessage,

              parts: [{ type: 'text', text: 'Error reading response' }]
            }]
          });
        }
        setIsLoading(false);
        return;
      }

      const body = resp.body;
      if (!body) {
        try {
          const text = await resp.text();
          console.log('No body, response text:', text);
          updateNodeData(id, {
            messages: [...newMessages.slice(0, -1), {
              ...assistantMessage,

              parts: [{ type: 'text', text }]
            }]
          });
        } catch (textError) {
          console.error('Error reading response text:', textError);
          updateNodeData(id, {
            messages: [...newMessages.slice(0, -1), {
              ...assistantMessage,

              parts: [{ type: 'text', text: 'Error reading response' }]
            }]
          });
        }
        setIsLoading(false);
        return;
      }
      try {
        const reader = body.getReader();
        const decoder = new TextDecoder();
        let accText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          console.log('Received chunk:', chunk);

          for (const line of chunk.split('\n')) {
            if (line.startsWith('data: ')) {
              const payload = line.slice(6);
              if (payload === '[DONE]') {
                console.log('Stream finished');
                continue;
              }

              try {
                const dataObj = JSON.parse(payload);
                console.log('Parsed streaming data:', dataObj);

                if (dataObj?.type === 'text-delta' && typeof dataObj.delta === 'string') {
                  accText += dataObj.delta;
                  console.log('Updating with text-delta, accText:', accText);
                  updateNodeData(id, {
                    messages: [...newMessages.slice(0, -1), {
                      ...assistantMessage,
                      parts: [{ type: 'text', text: accText }]
                    }]
                  });
                } else if (dataObj?.type === 'text' && typeof dataObj.text === 'string') {
                  accText = dataObj.text;
                  console.log('Updating with text, accText:', accText);
                  updateNodeData(id, {
                    messages: [...newMessages.slice(0, -1), {
                      ...assistantMessage,
                      parts: [{ type: 'text', text: accText }]
                    }]
                  });
                } else {
                  console.log('Unknown data type:', dataObj?.type, dataObj);
                }
              } catch (parseError) {
                console.error('Error parsing streaming data:', parseError, 'Payload:', payload);
              }
            }
          }
        }
      } catch (streamError) {
        console.error('Error reading streaming response:', streamError);
        updateNodeData(id, {
          messages: [...newMessages.slice(0, -1), {
            ...assistantMessage,
            
            parts: [{ type: 'text', text: 'Error reading streaming response' }]
          }]
        });
      }
    } catch (error) {
      console.error('Send error:', error);
      updateNodeData(id, {
        messages: [...newMessages.slice(0, -1), {
          ...assistantMessage,
          parts: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        }]
      });
    } finally {
      setIsLoading(false);
    }
  }, [id, input, modelId, gateway, updateNodeData, messages, getAncestorMessages]);
  

  return (
    <>
      <BaseNode className="w-96">
        <BaseNodeHeader className="node-drag-handle cursor-move">
          <BaseNodeHeaderTitle>{d.title ?? 'Text'}</BaseNodeHeaderTitle>
        </BaseNodeHeader>
        <BaseNodeContent className="p-0">
          {/* Circular handles on left/right for connect/branch */}
          <BaseHandle id="in" type="target" position={Position.Left} />
          <ButtonHandle id="out" type="source" position={Position.Right} showButton={!connectionInProgress}>
            <button
              type="button"
              className="nodrag pointer-events-auto inline-flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow"
              onClick={(e) => {
                // open AddBlockDropdown anchored to this button
                const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                const clientX = rect.left + rect.width / 2;
                const clientY = rect.top + rect.height / 2;
                try {
                  window.dispatchEvent(new CustomEvent('flow:add-dropdown', { detail: { clientX, clientY, sourceId: id } }));
                } catch {}
              }}
            >
              +
            </button>
          </ButtonHandle>
          <div className="h-48 overflow-hidden">
            {messages.length > 0 ? (
              <Conversation className="h-full">
                <ConversationContent className="p-2">
                  {messages.map((message) => (
                    <Message from={message.role} key={message.id}>
                      <MessageContent>
                        {message.role === 'assistant' && isLoading && message.id === messages[messages.length - 1]?.id ? (
                          <Loader />
                        ) : (
                          <Response>
                            {Array.isArray(message.parts) && message.parts.length > 0
                              ? message.parts
                                  .filter(part => part.type === 'text')
                                  .map(part => part.text)
                                  .join('')
                              : 'No content'}
                          </Response>
                        )}
                      </MessageContent>
                    </Message>
                  ))}
                </ConversationContent>
              </Conversation>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                Result will appear here...
              </div>
            )}
          </div>
        </BaseNodeContent>
        <BaseNodeFooter>
          <div className="flex w-full items-end gap-2">
            <Textarea
              className="min-h-10 flex-1 nodrag"
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type message..."
              value={input}
            />
            <Button
              className="nodrag"
              disabled={isLoading || !input.trim()}
              onClick={send}
              size="sm"
              type="button"
            >
              {isLoading ? '...' : 'Send'}
            </Button>
          </div>
          {!isDragging && (
          <NodeAppendix position="bottom">
                      <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Model</span>
            <ModelSelector
              selectedModelId={modelId}
              setSelectedModelId={setModelId}
              source={gateway === "vercel-ai-gateway" ? "aigateway" : "llmgateway"}
              onSourceChange={(src) => {
                const newGateway = src === "aigateway" ? "vercel-ai-gateway" : "llm-gateway";
                setGateway(newGateway);
                try {
                  window.localStorage.setItem(
                    "chaichat_models_source",
                    src === "aigateway" ? "aigateway" : "llmgateway"
                  );
                  window.dispatchEvent(new CustomEvent("modelsSourceChanged"));
                } catch {}
              }}
            />
          </div>
          </NodeAppendix>
          )}
        </BaseNodeFooter>
      </BaseNode>

      <Dialog open={showKeyDialog} onOpenChange={setShowKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure API Key</DialogTitle>
          </DialogHeader>
          <ApiKeyManager />
        </DialogContent>
      </Dialog>
    </>
  );
}
