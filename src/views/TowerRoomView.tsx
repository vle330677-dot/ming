import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Heart, Zap, Briefcase, DoorOpen, Camera, Edit3, 
  UserMinus, CheckCircle, Lock, Download, FileText, 
  Settings, Home, EyeOff
} from 'lucide-react';
import { User } from '../types';

interface SpiritStatus {
  name: string;
  intimacy: number;
  level: number;
  hp: number;
  imageUrl: string;
}

interface Props {
  currentUser: User;       // 当前操作的玩家
  homeOwner: User;         // 房间的主人
  spiritStatus?: SpiritStatus;
  onClose: () => void;
  showToast: (msg: string) => void;
  onUpdateData: () => void;
}

export function TowerRoomView({ currentUser, homeOwner, spiritStatus, onClose, showToast, onUpdateData }: Props) {
  const isOwner = currentUser.id === homeOwner.id;
  const isSentinelOrGuide = homeOwner.role === '哨兵' || homeOwner.role === '向导';

  // --- 状态管理 ---
  const [activeTab, setActiveTab] = useState<'home' | 'spirit' | 'logs' | 'settings'>('home');
  
  // 修改密码的独立UI状态
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  
  // 房间数据与账号设置
  const [roomData, setRoomData] = useState({
    bgImage: (homeOwner as any).roomBgImage || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    description: (homeOwner as any).roomDescription || '这是一个温馨的私人空间。',
    allowVisit: (homeOwner as any).allowVisit !== 0,
    password: (currentUser as any).password || '' 
  });

// 把 rpLogs 替换为 rpArchives
  const [rpArchives, setRpArchives] = useState<any[]>([]);

  useEffect(() => {
    const fetchRoomData = async () => {
      try {
        if (isOwner) {
          // 修改为请求新的归档 API
          const logRes = await fetch(`/api/users/${currentUser.id}/rp_archives`); 
          const logData = await logRes.json();
          if (logData.success) setRpArchives(logData.archives || []);
        }
      } catch (e) {
        console.error("加载房间数据失败");
      }
    };
    fetchRoomData();
  }, [homeOwner.id, isOwner, currentUser.id]);
  const bgImgInputRef = useRef<HTMLInputElement>(null);
  const spiritImgInputRef = useRef<HTMLInputElement>(null);

  // --- 初始化获取数据 ---
  useEffect(() => {
    const fetchRoomData = async () => {
      try {
        if (isOwner) {
          // 获取对戏日志
          const logRes = await fetch(`/api/roleplay/conversation/${currentUser.id}/${currentUser.id}`); 
          const logData = await logRes.json();
          if (logData.success) setRpLogs(logData.messages || []);
        }
      } catch (e) {
        console.error("加载房间数据失败");
      }
    };
    fetchRoomData();
  }, [homeOwner.id, isOwner, currentUser.id]);

  // --- 交互逻辑 ---
  const handleAction = async (endpoint: string, body: any = {}) => {
    const res = await fetch(`/api/tower/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id, ...body })
    });
    const data = await res.json();
    if (data.success) {
      if (data.reward) showToast(`获得奖励: ${data.reward} G`);
      if (data.levelUp) showToast("🎉 精神体升级！精神进度提升 20%");
      if (data.penalty) showToast(`已支付违约金: ${data.penalty} G`);
      onUpdateData();
      if (endpoint === 'quit') onClose();
    } else {
      showToast(data.message);
    }
  };

const exportLogs = (archive?: any) => {
    const targets = archive ? [archive] : rpArchives;
    if (targets.length === 0) return showToast("暂无对戏记录可导出。");
    
    let text = '';
    targets.forEach(arc => {
       text += `========================================\n`;
       text += `【剧目】${arc.title}\n`;
       text += `【地点】${arc.locationName || '未知区域'}\n`;
       text += `【参演】${arc.participantNames}\n`;
       text += `【时间】${new Date(arc.createdAt).toLocaleString()}\n`;
       text += `========================================\n\n`;
       
       arc.messages.forEach((m: any) => {
          if (m.type === 'system') {
              text += `[系统广播]: ${m.content}\n\n`;
          } else {
              text += `[${m.senderName}]:\n${m.content}\n\n`;
          }
       });
       text += `\n`;
    });
    
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = archive ? `剧目_${archive.title}.txt` : `${currentUser.name}_全对戏归档.txt`;
    link.click();
  };

  // 统一保存设置（包含密码和房间信息）
  const saveSettings = async (updatedData = roomData) => {
    const res = await fetch(`/api/users/${currentUser.id}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData)
    });
    if (res.ok) {
      showToast("设置已保存并同步至服务器。");
      onUpdateData();
    } else {
      showToast("保存失败，请稍后重试");
    }
  };

  const confirmChangePassword = () => {
    const newData = { ...roomData, password: tempPassword };
    setRoomData(newData);
    setIsEditingPassword(false);
    saveSettings(newData); // 立即保存密码变更
  };

  // --- 访客拦截 ---
  // 如果当前不是房主，且房主设置了不接待访客，则弹谢绝界面
  if (!isOwner && !roomData.allowVisit) {
    return (
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-slate-900 border border-slate-700 p-10 rounded-3xl text-center max-w-sm">
          <EyeOff size={48} className="mx-auto text-slate-500 mb-4"/>
          <h2 className="text-xl font-black text-white mb-2">闭门谢客</h2>
          <p className="text-sm text-slate-400 mb-6">这里的主人 {homeOwner.name} 目前不欢迎参观。</p>
          <button onClick={onClose} className="px-6 py-2 bg-slate-700 text-white font-bold rounded-full hover:bg-slate-600">离开</button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white rounded-[32px] w-full max-w-3xl h-[80vh] shadow-2xl flex overflow-hidden relative">
        
        {/* 左侧导航 (仅主人可见) */}
        {isOwner && (
          <div className="w-20 bg-slate-900 flex flex-col items-center py-8 gap-6 border-r border-slate-800 z-10">
            <NavBtn icon={<Home/>} active={activeTab==='home'} onClick={() => setActiveTab('home')} label="家园"/>
            {isSentinelOrGuide && <NavBtn icon={<Heart/>} active={activeTab==='spirit'} onClick={() => setActiveTab('spirit')} label="精神体"/>}
            <NavBtn icon={<FileText/>} active={activeTab==='logs'} onClick={() => setActiveTab('logs')} label="回顾"/>
            <NavBtn icon={<Settings/>} active={activeTab==='settings'} onClick={() => setActiveTab('settings')} label="设置"/>
          </div>
        )}

        {/* 核心内容区 */}
        <div className="flex-1 relative bg-slate-50 overflow-y-auto">
          <button onClick={onClose} className="absolute top-6 right-6 z-50 p-2 bg-black/40 backdrop-blur-md text-white rounded-full hover:bg-black/60"><X size={18}/></button>
          
          {/* === 家园/主页 === */}
          {activeTab === 'home' && (
            <div className="relative min-h-full">
              <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${roomData.bgImage})` }}>
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-10 text-white">
                <span className="px-3 py-1 bg-sky-600 text-[10px] font-black uppercase rounded mb-3 inline-block">
                  {homeOwner.job !== '无' ? homeOwner.job : '自由居所'}
                </span>
                <h1 className="text-4xl font-black mb-2">{homeOwner.name} 的房间</h1>
                <p className="text-sm text-slate-300 mb-8 max-w-xl italic">"{roomData.description}"</p>
                
                {isOwner && (
                  <div className="flex gap-4">
                    <button onClick={() => handleAction('rest')} className="px-6 py-3 bg-white text-slate-900 rounded-xl font-black flex items-center gap-2 hover:bg-slate-200">
                      <DoorOpen size={18}/> 躺下休息 (回复全满HP/MP)
                    </button>
                    {homeOwner.job !== '无' && (
                      <button onClick={() => handleAction('checkin')} className="px-6 py-3 bg-sky-600/80 backdrop-blur-sm text-white rounded-xl font-black hover:bg-sky-600">
                        职位签到
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* === 精神体交互 === */}
          {activeTab === 'spirit' && isOwner && spiritStatus && (
            <div className="p-10 min-h-full flex flex-col items-center justify-center">
               <div className="relative w-48 h-48 mx-auto mb-8">
                <div className="w-full h-full bg-slate-100 rounded-[48px] border-4 border-pink-100 overflow-hidden flex items-center justify-center">
                  {spiritStatus.imageUrl ? (
                    <img src={spiritStatus.imageUrl} className="w-full h-full object-cover" />
                  ) : <Zap size={64} className="text-pink-200 animate-pulse" />}
                </div>
                <button onClick={() => spiritImgInputRef.current?.click()} className="absolute -bottom-2 -right-2 bg-white p-3 rounded-full shadow-lg text-pink-500 hover:scale-110">
                  <Camera size={18}/>
                </button>
                <input type="file" ref={spiritImgInputRef} className="hidden" accept="image/*" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if(file) {
                    const r = new FileReader();
                    r.onload = (ev) => handleAction('interact-spirit', { imageUrl: ev.target?.result, intimacyGain: 0 });
                    r.readAsDataURL(file);
                  }
                }}/>
              </div>

              <h3 className="font-black text-3xl text-slate-800 mb-2">{spiritStatus.name || "未命名精神体"}</h3>
              <div className="flex gap-4 text-xs font-black text-pink-500 mb-8">
                <span>等级 {spiritStatus.level}</span> | <span>HP {spiritStatus.hp}/100</span> | <span>契约 {spiritStatus.intimacy}</span>
              </div>

              <div className="flex gap-4">
                <button onClick={() => handleAction('interact-spirit', { intimacyGain: 5 })} className="px-6 py-3 bg-pink-50 text-pink-600 font-black rounded-xl border border-pink-100">摸摸 (+5)</button>
                <button onClick={() => handleAction('interact-spirit', { intimacyGain: 10 })} className="px-6 py-3 bg-amber-50 text-amber-600 font-black rounded-xl border border-amber-100">喂食 (+10)</button>
                <button onClick={() => handleAction('interact-spirit', { intimacyGain: 15 })} className="px-6 py-3 bg-indigo-50 text-indigo-600 font-black rounded-xl border border-indigo-100">训练 (+15)</button>
              </div>
            </div>
          )}

          {/* === 对戏回顾 === */}
          {activeTab === 'logs' && isOwner && (
            <div className="p-10 h-full flex flex-col">
              <div className="flex justify-between items-end mb-6 border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-800">书房 · 剧情回顾</h2>
                  <p className="text-xs text-slate-500 mt-1">你的所有羁绊与剧情都在此被完美封存。</p>
                </div>
                <button onClick={() => exportLogs()} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-xs font-black rounded-lg hover:bg-slate-800">
                  <Download size={14}/> 导出全部归档 (TXT)
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-6 pr-4 custom-scrollbar">
                {rpArchives.length === 0 ? (
                  <p className="text-center text-slate-400 mt-10 text-sm">暂无对戏记录，多出去走走吧！</p>
                ) : (
                  rpArchives.map((arc, idx) => (
                    <div key={idx} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-center">
                        <div>
                          <h4 className="font-black text-slate-800 text-lg">{arc.title}</h4>
                          <div className="text-[10px] text-slate-500 mt-1 flex gap-3">
                            <span><MapPin size={10} className="inline mr-1"/>{arc.locationName || '未知地点'}</span>
                            <span>👥 {arc.participantNames}</span>
                            <span>🕒 {new Date(arc.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                        <button onClick={() => exportLogs(arc)} className="p-2 text-sky-600 bg-sky-50 rounded-lg hover:bg-sky-100 transition-colors" title="单独导出此剧目">
                          <Download size={16}/>
                        </button>
                      </div>
                      
                      {/* 聊天记录框 */}
                      <div className="p-4 bg-slate-100/50 max-h-[300px] overflow-y-auto custom-scrollbar space-y-3">
                        {arc.messages?.map((m: any, mIdx: number) => (
                          m.type === 'system' ? (
                            <div key={mIdx} className="text-center text-[10px] text-slate-400 my-2">— {m.content} —</div>
                          ) : (
                            <div key={mIdx} className={`flex flex-col ${m.senderId === currentUser.id ? 'items-end' : 'items-start'}`}>
                              <span className="text-[10px] text-slate-500 mb-1">{m.senderName}</span>
                              <div className={`p-3 rounded-2xl text-xs leading-relaxed max-w-[85%] ${m.senderId === currentUser.id ? 'bg-sky-600 text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'}`}>
                                {m.content}
                              </div>
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* === 房间与安全设置 === */}
          {activeTab === 'settings' && isOwner && (
            <div className="p-10 h-full overflow-y-auto">
               <h2 className="text-2xl font-black text-slate-800 mb-8 border-b border-slate-200 pb-4">账号设置与家园装扮</h2>
               
               <div className="space-y-8 max-w-lg">
                  {/* 全局安全锁模块 */}
                  <div className="p-5 bg-sky-50 border border-sky-100 rounded-2xl">
                    <h3 className="font-black text-sm text-sky-900 mb-1 flex items-center gap-2">
                      <Lock size={16}/> 全局账号安全锁
                    </h3>
                    <p className="text-[10px] text-sky-700 mb-4">设置密码后，在登录页面输入你的名字将要求验证该密码，有效防盗号。</p>
                    
                    {isEditingPassword ? (
                      <div className="space-y-3">
                        <input 
                          type="text" 
                          placeholder="输入新密码 (留空则代表取消密码)"
                          value={tempPassword}
                          onChange={e => setTempPassword(e.target.value)}
                          className="w-full p-3 bg-white border border-sky-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-500"
                        />
                        <div className="flex gap-2">
                          <button onClick={confirmChangePassword} className="flex-1 py-2 bg-sky-600 text-white font-bold rounded-xl hover:bg-sky-700 text-sm transition-colors">确认修改</button>
                          <button onClick={() => setIsEditingPassword(false)} className="flex-1 py-2 bg-white text-sky-600 font-bold rounded-xl border border-sky-200 hover:bg-sky-50 text-sm transition-colors">取消</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-sky-100">
                        <span className="text-sm font-bold text-slate-500 tracking-widest">
                          {roomData.password ? '••••••••' : '未设置密码'}
                        </span>
                        <button 
                          onClick={() => { setIsEditingPassword(true); setTempPassword(roomData.password); }} 
                          className="px-4 py-1.5 bg-slate-100 text-slate-600 text-xs font-black rounded-lg hover:bg-slate-200 transition-colors"
                        >
                          {roomData.password ? '修改密码' : '设置密码'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 家园自定义模块 */}
                  <div className="space-y-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2">家园背景图</label>
                      <div className="flex gap-4 items-center">
                        <div className="w-32 h-20 rounded-lg bg-cover bg-center border border-slate-200" style={{ backgroundImage: `url(${roomData.bgImage})` }}/>
                        <button onClick={() => bgImgInputRef.current?.click()} className="px-4 py-2 bg-slate-200 text-slate-700 text-xs font-black rounded-lg">更换背景</button>
                        <input type="file" ref={bgImgInputRef} className="hidden" accept="image/*" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const r = new FileReader();
                            r.onload = (ev) => setRoomData({...roomData, bgImage: ev.target?.result as string});
                            r.readAsDataURL(file);
                          }
                        }}/>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2">家园描述语</label>
                      <textarea 
                        value={roomData.description} 
                        onChange={e => setRoomData({...roomData, description: e.target.value})}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-500"
                        rows={3}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl">
                      <div>
                        <p className="font-bold text-sm text-slate-800">允许访客进入</p>
                        <p className="text-[10px] text-slate-500">关闭后其他玩家无法查看你的房间背景和描述</p>
                      </div>
                      <button 
                        onClick={() => setRoomData({...roomData, allowVisit: !roomData.allowVisit})}
                        className={`w-12 h-6 rounded-full transition-colors relative ${roomData.allowVisit ? 'bg-emerald-500' : 'bg-slate-300'}`}
                      >
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${roomData.allowVisit ? 'left-7' : 'left-1'}`}/>
                      </button>
                    </div>
                  </div>

                  <button onClick={() => saveSettings(roomData)} className="w-full py-4 bg-slate-900 text-white font-black rounded-xl hover:bg-slate-800 shadow-xl">
                    保存房间装扮
                  </button>
               </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function NavBtn({ icon, active, onClick, label }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 p-3 w-16 rounded-2xl transition-all ${active ? 'bg-sky-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}>
      {icon}
      <span className="text-[10px] font-black">{label}</span>
    </button>
  );
}