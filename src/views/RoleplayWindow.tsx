import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, DoorOpen } from 'lucide-react';
import { User } from '../types';

interface Props {
  sessionId: string;
  currentUser: User;
  onClose: () => void; // 仅关闭窗口
}

interface RPMessage {
  id: number | string;
  sessionId: string;
  senderId: number | null;
  senderName: string;
  content: string;
  type: 'user' | 'system' | 'text';
  createdAt: string;
}

interface RPSession {
  sessionId: string;
  userAId: number;
  userAName: string;
  userBId: number;
  userBName: string;
  locationId: string;
  locationName: string;
  status: 'active' | 'closed';
  createdAt: string | null;
  updatedAt: string | null;
}

export function RoleplayWindow({ sessionId, currentUser, onClose }: Props) {
  const [session, setSession] = useState<RPSession | null>(null);
  const [messages, setMessages] = useState<RPMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [hint, setHint] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const title = useMemo(() => {
    if (!session) return '对戏频道';
    return `${session.locationName || '未知地点'} · 对戏`;
  }, [session]);

  const fetchSessionData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch(`/api/rp/session/${encodeURIComponent(sessionId)}/messages`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        if (!silent) setHint(data?.message || '拉取会话失败');
        return;
      }

      setSession(data.session || null);
      setMessages(data.messages || []);

      if (data.session?.status === 'closed') {
        setHint('该对戏已结束并归档');
      }
    } catch {
      if (!silent) setHint('网络异常，拉取失败');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionData(false);
    const timer = setInterval(() => fetchSessionData(true), 1200);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || sending) return;

    setSending(true);
    try {
      const res = await fetch(`/api/rp/session/${encodeURIComponent(sessionId)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId: currentUser.id, senderName: currentUser.name, content })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.success === false) {
        setHint(data.message || '发送失败');
        return;
      }

      setInput('');
      await fetchSessionData(true);
    } catch {
      setHint('网络异常，发送失败');
    } finally {
      setSending(false);
    }
  };

  const handleLeave = async () => {
    if (leaving) return;
    setLeaving(true);

    try {
      const res = await fetch(`/api/rp/session/${encodeURIComponent(sessionId)}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, userName: currentUser.name })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.success === false) {
        setHint(data.message || '离开失败');
        return;
      }

      if (data.closed) setHint('双方均已离开，对戏已归档');
      else setHint('你已离开，等待对方离开后归档');

      await fetchSessionData(true);
    } catch {
      setHint('网络异常，离开失败');
    } finally {
      setLeaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      className="fixed right-4 bottom-24 z-[260] w-[420px] h-[68vh] bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden flex flex-col shadow-2xl"
    >
      {/* 顶栏 */}
      <div className="px-4 py-3 border-b border-slate-700 bg-slate-900/90 flex items-center justify-between">
        <div>
          <h3 className="text-white font-black text-sm">{title}</h3>
          <p className="text-[10px] text-slate-400">Session: {sessionId}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleLeave}
            disabled={leaving}
            className="px-2.5 py-1 text-[11px] bg-rose-600/20 text-rose-300 border border-rose-500/30 rounded hover:bg-rose-600/30 disabled:opacity-50 flex items-center gap-1"
          >
            <DoorOpen size={12} />
            {leaving ? '处理中' : '离开'}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800"
            title="关闭窗口（不离开会话）"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* 消息区 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-950 custom-scrollbar">
        {loading ? (
          <div className="text-slate-500 text-xs">加载中...</div>
        ) : (
          <>
            {messages.length === 0 && (
              <div className="text-slate-500 text-xs text-center py-6">还没有消息，开始第一句吧。</div>
            )}

            {messages.map((m) => {
              const mine = m.senderId === currentUser.id;
              const isSystem = m.type === 'system';

              if (isSystem) {
                return (
                  <div key={m.id} className="text-center text-[10px] text-slate-500">
                    —— {m.content} ——
                  </div>
                );
              }

              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-lg p-2 border ${
                      mine
                        ? 'bg-sky-600/20 border-sky-500/30 text-sky-100'
                        : 'bg-slate-800 border-slate-700 text-slate-100'
                    }`}
                  >
                    <div className="text-[10px] opacity-70 mb-1">
                      {m.senderName} · {new Date(m.createdAt).toLocaleTimeString()}
                    </div>
                    <div className="text-xs whitespace-pre-wrap break-words">{m.content}</div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* 输入 */}
      <div className="p-2.5 border-t border-slate-700 bg-slate-900">
        <AnimatePresence>
          {hint && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-[10px] text-amber-400 mb-1.5"
            >
              {hint}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入对戏内容..."
            className="flex-1 h-16 resize-none rounded-lg bg-slate-950 border border-slate-700 text-slate-100 p-2 text-xs outline-none focus:border-sky-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <button
            onClick={sendMessage}
            disabled={sending || !input.trim()}
            className="px-3 rounded-lg bg-sky-600 text-white text-xs font-bold hover:bg-sky-500 disabled:opacity-50 flex items-center gap-1"
          >
            <Send size={12} />
            发送
          </button>
        </div>
      </div>
    </motion.div>
  );
}
