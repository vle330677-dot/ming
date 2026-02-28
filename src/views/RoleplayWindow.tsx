import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Minus, CheckCircle, Shield, AlertTriangle, Save } from 'lucide-react';
import { User } from '../types';

interface Props {
  sessionId: string;
  currentUser: User;
  onClose: () => void; // 彻底结束时调用
}

export function RoleplayWindow({ sessionId, currentUser, onClose }: Props) {
  const [session, setSession] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [showArchivePrompt, setShowArchivePrompt] = useState(false);
  const [archiveTitle, setArchiveTitle] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dragConstraintsRef = useRef(null);

  // 轮询对戏数据 (每2秒获取一次最新消息)
  useEffect(() => {
    const fetchSession = async () => {
      const res = await fetch(`/api/rp/session/${sessionId}`);
      const data = await res.json();
      if (data.success) {
        setSession(data.session);
        setMembers(data.members);
        // 如果消息长度变了，说明有新消息，滚动到底部
        setMessages(prev => {
          if (prev.length !== data.messages.length) {
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
          }
          return data.messages;
        });
      } else {
        // 会话已被销毁（存档完成）
        onClose();
      }
    };

    fetchSession();
    const timer = setInterval(fetchSession, 2000);
    return () => clearInterval(timer);
  }, [sessionId, onClose]);

  const handleSend = async () => {
    if (!inputMsg.trim()) return;
    await fetch(`/api/rp/session/${sessionId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senderId: currentUser.id, senderName: currentUser.name, content: inputMsg })
    });
    setInputMsg('');
  };

  const handleMediate = async () => {
    if (confirm('是否呼叫军队阵营前来评理？（将向全服军队玩家发送坐标）')) {
      await fetch(`/api/rp/session/${sessionId}/mediate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesterName: currentUser.name })
      });
    }
  };

  const handleProposeEnd = async () => {
    // 如果对方已经提议了，那自己点就是同意，弹出存档命名框
    if (session?.endProposedBy && session.endProposedBy !== currentUser.id) {
      setShowArchivePrompt(true);
      return;
    }
    // 否则就是自己先发起
    await fetch(`/api/rp/session/${sessionId}/end`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id })
    });
  };

  const confirmArchiveAndEnd = async () => {
    const title = archiveTitle.trim() || `${session.locationName}的邂逅记录`;
    await fetch(`/api/rp/session/${sessionId}/end`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id, archiveTitle: title })
    });
    onClose();
  };

  if (!session) return null;

  // 如果最小化了，只渲染一个可拖拽的悬浮球
  if (isMinimized) {
    return (
      <motion.div
        drag
        dragMomentum={false}
        className="fixed z-[9999] top-1/4 right-8 bg-sky-900 border border-sky-500 rounded-full p-3 shadow-[0_0_20px_rgba(14,165,233,0.4)] cursor-pointer hover:bg-sky-800 transition-colors"
        onClick={() => setIsMinimized(false)}
      >
        <MessageCircle className="text-white animate-pulse" size={24} />
        <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
          {messages.length}
        </span>
      </motion.div>
    );
  }

  const isEnding = session.status === 'ending';
  const isMediating = session.status === 'mediating';

  return (
    <div ref={dragConstraintsRef} className="fixed inset-0 pointer-events-none z-[9000]">
      <motion.div
        drag
        dragConstraints={dragConstraintsRef}
        dragMomentum={false}
        initial={{ x: window.innerWidth / 2 - 200, y: 100 }}
        className="absolute w-[400px] flex flex-col bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-2xl pointer-events-auto overflow-hidden"
      >
        {/* 标题栏 (按住拖拽) */}
        <div className="bg-slate-800/80 p-3 border-b border-slate-700 cursor-move flex justify-between items-center group">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              <h3 className="text-sm font-black text-white tracking-wider">
                对戏频道: {session.locationName}
              </h3>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">
              参与者: {members.map(m => m.userName).join(', ')}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setIsMinimized(true)} className="p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white rounded-lg transition-colors"><Minus size={14} /></button>
          </div>
        </div>

        {/* 顶部状态提示栏 */}
        {isMediating && (
          <div className="bg-amber-900/50 text-amber-400 text-xs p-2 flex items-center justify-center gap-2 border-b border-amber-900/50">
            <Shield size={14} /> 军队调停介入中，等待处理分歧...
          </div>
        )}
        {isEnding && session.endProposedBy !== currentUser.id && (
          <div className="bg-rose-900/50 text-rose-300 text-xs p-2 flex items-center justify-center gap-2 border-b border-rose-900/50">
            <AlertTriangle size={14} /> 对方请求结束对戏，并保存文档，是否同意？
          </div>
        )}

        {/* 消息列表 */}
        <div className="h-80 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-950/50">
          {messages.map(msg => (
            <div key={msg.id} className={`flex flex-col ${msg.type === 'system' ? 'items-center' : msg.senderId === currentUser.id ? 'items-end' : 'items-start'}`}>
              
              {/* 系统消息 */}
              {msg.type === 'system' && (
                <span className="bg-slate-800/50 text-slate-400 px-3 py-1 rounded-full text-[10px] font-bold border border-slate-700">
                  {msg.content}
                </span>
              )}

              {/* 玩家消息 */}
              {msg.type === 'text' && (
                <div className={`max-w-[85%] flex flex-col ${msg.senderId === currentUser.id ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-slate-500 mb-1 ml-1">{msg.senderName}</span>
                  <div className={`p-3 rounded-2xl text-sm leading-relaxed ${
                    msg.senderId === currentUser.id 
                      ? 'bg-sky-600 text-white rounded-tr-sm' 
                      : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-sm'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* 底部操作区 */}
        <div className="p-3 bg-slate-900 border-t border-slate-700">
          <div className="flex gap-2 mb-3">
            <button 
              onClick={handleMediate}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 text-amber-500 rounded-lg text-[10px] font-black hover:bg-slate-700 transition-colors border border-slate-700"
            >
              <Shield size={12}/> 申请评理
            </button>
            <div className="flex-1"></div>
            <button 
              onClick={handleProposeEnd}
              className={`flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs font-black transition-colors ${
                session.endProposedBy === currentUser.id 
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : session.endProposedBy 
                    ? 'bg-emerald-600 text-white shadow-lg hover:bg-emerald-500 animate-pulse'
                    : 'bg-rose-900/50 text-rose-400 hover:bg-rose-900 hover:text-rose-300'
              }`}
            >
              <CheckCircle size={14}/> 
              {session.endProposedBy === currentUser.id ? '等待对方同意' : session.endProposedBy ? '同意结束并存档' : '离开 (结束对戏)'}
            </button>
          </div>

          <div className="flex gap-2">
            <input 
              type="text"
              value={inputMsg}
              onChange={e => setInputMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="描写你的动作与台词..."
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-200 outline-none focus:border-sky-500/50"
            />
            <button 
              onClick={handleSend}
              className="w-10 h-10 bg-sky-600 text-white rounded-xl flex items-center justify-center hover:bg-sky-500 transition-colors shadow-lg"
            >
              <Send size={16} className="-ml-1" />
            </button>
          </div>
        </div>

        {/* 存档命名弹窗 (绝对居中覆盖) */}
        <AnimatePresence>
          {showArchivePrompt && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            >
              <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full text-center shadow-2xl">
                <Save className="text-emerald-500 mx-auto mb-3" size={32} />
                <h4 className="text-lg font-black text-white mb-2">为本次对戏命名</h4>
                <p className="text-xs text-slate-400 mb-4">结束对戏后，剧情将永久封存至您的个人书房数据库中。</p>
                <input 
                  type="text" value={archiveTitle} onChange={e => setArchiveTitle(e.target.value)}
                  placeholder={`${session.locationName}的邂逅记录`}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-emerald-500 mb-4 text-center"
                />
                <button 
                  onClick={confirmArchiveAndEnd}
                  className="w-full py-3 bg-emerald-600 text-white rounded-xl font-black hover:bg-emerald-500 shadow-lg"
                >
                  封存档案并断开连接
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>
    </div>
  );
}