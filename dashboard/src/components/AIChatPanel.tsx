import React, { useState, useRef, useEffect, Component } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Bot, Loader2, BrainCircuit, ChevronDown, ChevronRight, X } from 'lucide-react';

class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return <div className="text-red-500 text-xs p-2">MD Err: {this.state.error?.message}</div>;
    }
    return this.props.children;
  }
}

interface Message {
  role: 'model' | 'user';
  content: string;
  thoughts?: string;
  suggestions?: string[];
}

export function AIChatPanel({ isOpen, onClose, contextText }: { isOpen: boolean; onClose: () => void; contextText?: string }) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', content: "Hi! Ask me any questions about the data." }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedThoughts, setExpandedThoughts] = useState<Record<number, boolean>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = Math.min(scrollHeight, 112) + 'px';
      textareaRef.current.style.overflowY = scrollHeight > 112 ? 'auto' : 'hidden';
    }
  }, [input]);

  const toggleThought = (idx: number) => {
    setExpandedThoughts(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const handleSend = async (e?: React.FormEvent | React.KeyboardEvent, overrideText?: string | null) => {
    e?.preventDefault();
    const textToSend = overrideText || input;
    if (!textToSend.trim() || isLoading) return;

    if (!overrideText) setInput('');
    setIsLoading(true);

    const currentMessages: Message[] = [...messages, { role: 'user', content: textToSend.trim() }];

    const nextIdx = currentMessages.length;
    let thinking = '';
    let reply = '';
    const suggestions: string[] = [];

    setMessages([...currentMessages, { role: 'model', content: '', thoughts: '', suggestions: [] }]);

    try {
      // Use Firebase function URL if in prod, or emulator in dev
      // For Vite, assuming there's a proxy set up, or absolute path. Let's use relative if it's served together,
      // but usually functions run on a different port. We'll use the API endpoint.
      // E.g. process.env.VITE_API_URL or similar.
      // If we are developing locally, assuming we can reach it via a proxy in vite.config.ts, or direct URL.
      // I'll assume we can use the cloud function pattern or it's proxied.
      const functionUrl = import.meta.env.VITE_FIREBASE_FUNCTIONS_URL || 'http://localhost:5001/sai-shuddhi-moolam/us-central1/chatEndpoint_dev';
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: contextText ? `[Context: ${contextText}] ${textToSend.trim()}` : textToSend.trim(),
          history: currentMessages.slice(0, -1)
        })
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        setIsLoading(false); 
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; 

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();
            if (dataStr === '[DONE]') break;
            if (dataStr) {
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.type === 'THOUGHT') {
                  thinking += parsed.content + '\n';
                } else if (parsed.type === 'SUGGESTION') {
                  suggestions.push(parsed.content);
                } else {
                  reply += parsed.content;
                }

                setMessages(prev => {
                  const updated = [...prev];
                  updated[nextIdx] = {
                    role: 'model',
                    content: reply,
                    thoughts: thinking,
                    suggestions: suggestions
                  };
                  return updated;
                });
              } catch (err) {
                console.error('JSON parse fail:', dataStr);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => {
        const updated = [...prev];
        updated[nextIdx] = { role: 'model', content: `⚠️ Error connecting to server.` };
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`fixed top-0 right-0 h-full w-full sm:w-[400px] z-50 bg-white dark:bg-zinc-900 shadow-2xl flex flex-col transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Bot className="w-5 h-5 text-blue-600" /> AI Analytics Chat
        </div>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
          <X className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${m.role === 'model' ? 'bg-zinc-100 dark:bg-zinc-800' : 'bg-blue-600'}`}>
              {m.role === 'model' ? <Bot className="w-4 h-4 text-zinc-600 dark:text-zinc-300" /> : <span className="text-white text-xs font-semibold">U</span>}
            </div>
            <div className="max-w-[85%] flex flex-col gap-2">

              {m.role === 'model' && m.thoughts && m.thoughts.trim().length > 0 && (
                <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm">
                  <button
                    onClick={() => toggleThought(i)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 transition-colors"
                  >
                    {expandedThoughts[i] ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />}
                    <BrainCircuit className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                    <span className="truncate text-left">
                      {(() => {
                        if (m.content && m.content.length > 0) return "View reasoning process";
                        const lines = m.thoughts.split('\n').filter(l => l.trim().length > 0);
                        return lines.length > 0 ? lines[lines.length - 1] : "Analyzing context...";
                      })()}
                    </span>
                  </button>
                  {expandedThoughts[i] && (
                    <div className="px-3 pb-3 pt-3 border-t border-zinc-200 dark:border-zinc-700 max-h-[250px] overflow-y-auto bg-zinc-100 dark:bg-zinc-900/50 text-[11px] font-mono leading-relaxed text-zinc-600 dark:text-zinc-400 flex flex-col gap-2">
                      {m.thoughts.split('\n').filter(l => l.trim().length > 0).map((line, idx) => (
                        <div key={idx} className="flex gap-2 items-start">
                          <div className="text-zinc-400 dark:text-zinc-600 mt-[2px]">›</div>
                          <div className="break-words whitespace-pre-wrap">{line}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {m.role === 'model' && !m.content && !expandedThoughts[i] && (
                <div className="flex items-center gap-2 text-xs text-zinc-500 italic ml-1 mb-1 p-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> {m.thoughts ? 'Thinking...' : 'Gathering insights...'}
                </div>
              )}

              {m.content && (
                <div className={`p-3 rounded-2xl text-sm leading-relaxed ${m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-tl-none border border-zinc-200 dark:border-zinc-700 shadow-sm'}`}>
                  {m.role === 'model' ? (
                    <ErrorBoundary>
                      <div className="prose prose-sm prose-zinc dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-zinc-200 dark:prose-pre:bg-zinc-900 prose-pre:text-zinc-800 dark:prose-pre:text-zinc-200">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {m.content}
                        </ReactMarkdown>
                      </div>
                    </ErrorBoundary>
                  ) : (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  )}
                </div>
              )}

              {m.role === 'model' && m.suggestions && m.suggestions.length > 0 && (
                <div className="flex flex-col gap-1.5 mt-2">
                  {m.suggestions.slice(0, 3).map((s, idx) => (
                    <button
                      key={idx} onClick={() => handleSend(undefined, s)} disabled={isLoading}
                      className="text-left text-xs bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-800/40 text-blue-700 dark:text-blue-300 p-2 rounded-lg border border-blue-200 dark:border-blue-800/30 transition-colors"
                    >{s}</button>
                  ))}
                </div>
              )}

            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex items-end bg-zinc-50 dark:bg-zinc-900 relative">
        <textarea
          ref={textareaRef}
          value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} disabled={isLoading}
          placeholder="Ask a question..."
          rows={1}
          className="w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 dark:placeholder-zinc-400 resize-none overscroll-contain transition-shadow"
        />
        <button type="submit" disabled={!input.trim() || isLoading} className="absolute right-6 bottom-6 p-2 bg-blue-600 hover:bg-blue-700 rounded-full text-white transition-colors disabled:opacity-50 shadow-sm">
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
