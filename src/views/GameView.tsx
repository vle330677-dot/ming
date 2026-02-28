import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MapPin, Settings, Skull, Cross, Send, Trash2, Heart, ArrowLeft, Users } from 'lucide-react';
import { User } from '../types';

// ================== 组件导入 ==================
import { PlayerInteractionUI } from './PlayerInteractionUI';
import { CharacterHUD } from './CharacterHUD';
import { RoleplayWindow } from './RoleplayWindow';

import { TowerOfLifeView } from './TowerOfLifeView';
import { LondonTowerView } from './LondonTowerView';
import { SanctuaryView } from './SanctuaryView';
import { GuildView } from './GuildView';
import { ArmyView } from './ArmyView';
import { SlumsView } from './SlumsView';
import { RichAreaView } from './RichAreaView';
import { DemonSocietyView } from './DemonSocietyView';
import { SpiritBureauView } from './SpiritBureauView';
import { ObserverView } from './ObserverView';

// ================== 资源映射配置 ==================
const LOCATION_BG_MAP: Record<string, string> = {
  'tower_of_life': '/命之塔.jpg',
  'london_tower': '/伦敦塔.jpg',
  'sanctuary': '/圣所.jpg',
  'guild': '/公会.jpg',
  'army': '/军队.jpg',
  'rich_area': '/东市.jpg',
  'slums': '/西市.jpg',
  'demon_society': '/恶魔会.jpg',
  'paranormal_office': '/灵异管理所.jpg',
  'observers': '/观察者.jpg',
};

const LOCATIONS = [
  { id: 'tower_of_life', name: '命之塔', x: 50, y: 48, type: 'safe', description: '世界的绝对中心，神明降下神谕的圣地。' },
  { id: 'sanctuary', name: '圣所', x: 42, y: 42, type: 'safe', description: '未分化幼崽的摇篮，充满治愈与宁静的气息。' },
  { id: 'london_tower', name: '伦敦塔', x: 67, y: 35, type: 'safe', description: '哨兵与向导的最高学府与管理机构。' },
  { id: 'rich_area', name: '富人区', x: 70, y: 50, type: 'danger', description: '流光溢彩的销金窟，权贵们在此挥霍财富。' },
  { id: 'slums', name: '贫民区', x: 25, y: 48, type: 'danger', description: '混乱、肮脏，但充满生机。' },
  { id: 'demon_society', name: '恶魔会', x: 12, y: 20, type: 'danger', description: '混乱之王的狂欢所。(未知区域)' },
  { id: 'guild', name: '工会', x: 48, y: 78, type: 'danger', description: '鱼龙混杂的地下交易网与冒险者聚集地。' },
  { id: 'army', name: '军队', x: 50, y: 18, type: 'danger', description: '人类最坚实的物理防线。' },
  { id: 'observers', name: '观察者', x: 65, y: 15, type: 'danger', description: '记录世界历史与真相的隐秘结社。' },
  { id: 'paranormal_office', name: '灵异管理所', x: 88, y: 15, type: 'danger', description: '专门处理非自然精神波动的神秘机关。' },
];

const SAFE_ZONES = ['tower_of_life', 'sanctuary', 'london_tower'];

interface Props {
  user: User;
  onLogout: () => void;
  showToast: (msg: string, type?: 'info' | 'success' | 'warn') => void;
  fetchGlobalData: () => void;
}

export function GameView({ user, onLogout, showToast, fetchGlobalData }: Props) {
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [activeView, setActiveView] = useState<string | null>(null);
  const [localPlayers, setLocalPlayers] = useState<any[]>([]);
  const [interactTarget, setInteractTarget] = useState<any>(null);
  const [activeRPSessionId, setActiveRPSessionId] = useState<string | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [showDeathForm, setShowDeathForm] = useState<'death' | 'ghost' | null>(null);
  const [deathText, setDeathText] = useState('');
  
  // 濒死与公墓相关状态
  const [isDying, setIsDying] = useState(false);
  const [rescueReqId, setRescueReqId] = useState<number | null>(null);
  const [showGraveyard, setShowGraveyard] = useState(false);
  const [tombstones, setTombstones] = useState<any[]>([]);
  const [expandedTombstone, setExpandedTombstone] = useState<number | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [allOnlinePlayers, setAllOnlinePlayers] = useState<any[]>([]);

  // 1. 同步在线玩家数据
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const res = await fetch('/api/admin/users');
        const data = await res.json();
        if (data.success) setAllOnlinePlayers(data.users.filter((u: any) => u.currentLocation && u.id !== user.id));
      } catch (e) { console.error(e); }
    };
    fetchAll();
    const timer = setInterval(fetchAll, 8000);
    return () => clearInterval(timer);
  }, [user.id]);

  // 2. 监测生命体征
  useEffect(() => {
    if ((user.hp || 0) <= 0 && user.status === 'approved') setIsDying(true);
    else setIsDying(false);
  }, [user.hp, user.status]);

  // 3. 探索逻辑
  const handleExploreAction = async () => {
    if (Math.random() > 0.5) {
      try {
        const res = await fetch('/api/explore/combat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id })
        });
        const data = await res.json();
        data.isWin ? showToast(`⚔️ 战斗大捷：${data.message}`, 'success') : showToast(`❌ 探索失败：${data.message}`, 'warn');
        fetchGlobalData();
      } catch (e) { showToast("战斗系统连接中断", 'warn'); }
    } else {
      handleExploreItem();
    }
  };

  const handleExploreItem = async () => {
    const locId = activeView || selectedLocation?.id;
    if (!locId) return;
    try {
      const res = await fetch('/api/explore/item', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, locationId: locId })
      });
      const data = await res.json();
      showToast(data.success ? `📦 ${data.message}` : `⚠️ ${data.message}`, data.success ? 'success' : 'info');
    } catch (e) { showToast("探索失败", 'warn'); }
  };

  const handleExploreSkill = async () => {
    if (!selectedLocation) return;
    try {
      const res = await fetch('/api/explore/skill', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, locationId: selectedLocation.id })
      });
      const data = await res.json();
      showToast(data.success ? `🧠 ${data.message}` : `⚠️ ${data.message}`, data.success ? 'success' : 'info');
    } catch (e) { showToast("连接错误", 'warn'); }
  };

  const handleLocationAction = async (action: 'enter' | 'stay') => {
    if (!selectedLocation) return;
    if (action === 'stay') {
      await fetch(`/api/users/${user.id}/location`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId: selectedLocation.id })
      });
      showToast(`已在 ${selectedLocation.name} 驻足。`, 'success');
      fetchGlobalData();
    } else {
      setActiveView(selectedLocation.id);
      setSelectedLocation(null);
    }
  };

  // 4. 公墓与谢幕核心逻辑
  const fetchGraveyard = async () => {
    const res = await fetch('/api/graveyard');
    const data = await res.json();
    if (data.success) { setTombstones(data.tombstones); setShowGraveyard(true); }
  };

  const loadComments = async (tombstoneId: number) => {
    if (expandedTombstone === tombstoneId) { setExpandedTombstone(null); return; }
    const res = await fetch(`/api/graveyard/${tombstoneId}/comments`);
    const data = await res.json();
    if (data.success) { setComments(data.comments); setExpandedTombstone(tombstoneId); }
  };

  const addComment = async (tombstoneId: number) => {
    if(!newComment.trim()) return;
    await fetch(`/api/graveyard/${tombstoneId}/comments`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ userId: user.id, userName: user.name, content: newComment })
    });
    setNewComment('');
    loadComments(tombstoneId);
  };

  const deleteComment = async (commentId: number, tombstoneId: number) => {
    await fetch(`/api/graveyard/comments/${commentId}`, {
      method: 'DELETE', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ userId: user.id })
    });
    loadComments(tombstoneId);
  };

  const handleSubmitDeath = async () => {
    if (!deathText.trim()) return showToast('必须填写谢幕词', 'warn');
    await fetch(`/api/users/${user.id}/submit-death`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: showDeathForm === 'death' ? 'pending_death' : 'pending_ghost', text: deathText })
    });
    showToast('谢幕申请已提交至塔区议会。', 'success');
    setShowDeathForm(null);
    fetchGlobalData();
  };

  const renderActiveView = () => {
    if (!activeView) return null;
    const commonProps = { user, onExit: () => setActiveView(null), showToast, fetchGlobalData };
    return (
      <div className="w-full h-full min-h-screen overflow-y-auto pt-20 pb-10 px-4 md:px-0 flex justify-center">
        <div className="w-full max-w-6xl relative z-10">
          <button onClick={() => setActiveView(null)} className="mb-4 flex items-center gap-2 px-4 py-2 bg-slate-900/60 backdrop-blur text-white rounded-xl hover:bg-slate-800 border border-slate-700/50 transition-all shadow-xl">
            <ArrowLeft size={18}/> 返回世界地图
          </button>
          {activeView === 'tower_of_life' && <TowerOfLifeView {...commonProps} />}
          {activeView === 'london_tower' && <LondonTowerView {...commonProps} />}
          {activeView === 'sanctuary' && <SanctuaryView {...commonProps} />}
          {activeView === 'guild' && <GuildView {...commonProps} />}
          {activeView === 'army' && <ArmyView {...commonProps} />}
          {activeView === 'slums' && <SlumsView {...commonProps} />}
          {activeView === 'rich_area' && <RichAreaView {...commonProps} />}
          {activeView === 'demon_society' && <DemonSocietyView {...commonProps} />}
          {activeView === 'paranormal_office' && <SpiritBureauView {...commonProps} />}
          {activeView === 'observers' && <ObserverView {...commonProps} />}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 overflow-hidden font-sans select-none text-slate-100 bg-slate-950">
      
      {/* 动态背景 */}
      <div className="absolute inset-0 z-0">
         <motion.div
            key={activeView || 'world_map'}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="absolute inset-0 bg-cover bg-center transition-all duration-700"
            style={{ 
              backgroundImage: `url(${activeView ? LOCATION_BG_MAP[activeView] : '/map_background.jpg'})`,
              filter: activeView ? 'brightness(0.4) blur(4px)' : 'brightness(0.6)'
            }}
         />
      </div>

      <CharacterHUD user={user} onLogout={onLogout} />

      {/* 大地图视图 */}
      <AnimatePresence mode="wait">
        {!activeView && (
          <motion.div className="relative w-full h-full flex items-center justify-center p-2 md:p-8 z-10">
            <div className="relative aspect-[16/9] w-full max-w-[1200px] bg-slate-900/50 rounded-2xl md:rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl">
              <img src="/map_background.jpg" className="w-full h-full object-cover opacity-80" />
              {LOCATIONS.map(loc => {
                const playersInLoc = allOnlinePlayers.filter(p => p.currentLocation === loc.id);
                return (
                  <div key={loc.id} className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer touch-manipulation group" style={{ left: `${loc.x}%`, top: `${loc.y}%` }} onClick={() => setSelectedLocation(loc)}>
                    {playersInLoc.length > 0 && (
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex -space-x-2 animate-bounce">
                        {playersInLoc.slice(0, 3).map(p => (
                          <div key={p.id} className="w-6 h-6 rounded-full border border-white overflow-hidden shadow-lg bg-slate-800">
                            <img src={p.avatarUrl || '/map_background.jpg'} className="w-full h-full object-cover" />
                          </div>
                        ))}
                        {playersInLoc.length > 3 && <div className="w-6 h-6 rounded-full bg-sky-500 text-[8px] flex items-center justify-center border border-white font-bold">+{playersInLoc.length - 3}</div>}
                      </div>
                    )}
                    <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full border-2 flex items-center justify-center backdrop-blur-sm transition-all ${user.currentLocation === loc.id ? 'bg-sky-500 border-white animate-pulse' : 'bg-slate-900/80 border-slate-400 group-hover:scale-125'}`}><MapPin size={14} /></div>
                    <div className={`absolute top-8 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/50 rounded-lg text-[10px] md:text-xs font-bold text-slate-200 shadow-xl transition-all ${selectedLocation?.id === loc.id ? 'opacity-100 scale-110 z-20 border-sky-500/50' : 'opacity-0'}`}>{loc.name}</div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
        {activeView && renderActiveView()}
      </AnimatePresence>

      {/* 地点详情面板 */}
      <AnimatePresence>
        {selectedLocation && !activeView && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="fixed bottom-0 left-0 right-0 md:bottom-10 md:left-1/2 md:-translate-x-1/2 md:w-[480px] bg-slate-900/95 backdrop-blur-xl p-6 rounded-t-3xl md:rounded-3xl border-t md:border border-white/20 z-50 shadow-2xl">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-2xl font-black text-white">{selectedLocation.name} <span className="text-[10px] px-2 py-1 rounded-lg border bg-white/5 ml-2">{selectedLocation.type === 'safe' ? '安全区' : '危险区'}</span></h3>
              <button onClick={() => setSelectedLocation(null)} className="p-2 text-slate-400 hover:text-white bg-white/5 rounded-full"><X size={20}/></button>
            </div>
            
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3 text-sky-400"><Users size={14}/><span className="text-[10px] font-black uppercase tracking-widest">驻足玩家</span></div>
              <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                {allOnlinePlayers.filter(p => p.currentLocation === selectedLocation.id).length === 0 ? <div className="text-[10px] text-slate-500 italic">暂无玩家停留</div> : 
                  allOnlinePlayers.filter(p => p.currentLocation === selectedLocation.id).map(p => (
                    <div key={p.id} onClick={() => setInteractTarget(p)} className="flex-shrink-0 cursor-pointer group flex flex-col items-center">
                      <div className="w-12 h-12 rounded-xl border-2 border-slate-700 overflow-hidden group-hover:border-sky-500 shadow-lg bg-slate-800"><img src={p.avatarUrl || '/map_background.jpg'} className="w-full h-full object-cover" /></div>
                      <span className="text-[10px] font-bold text-slate-300 mt-1 truncate w-12 text-center">{p.name}</span>
                    </div>
                  ))
                }
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-6">{selectedLocation.description}</p>
            <div className="flex gap-2 mb-3">
              <button onClick={() => handleLocationAction('enter')} className="flex-1 py-3 bg-white text-slate-950 font-black rounded-xl text-xs hover:bg-slate-200">进入区域</button>
              <button onClick={() => handleLocationAction('stay')} className="flex-1 py-3 bg-slate-800 text-white font-black rounded-xl text-xs border border-slate-700">在此驻足</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={handleExploreSkill} className="py-3 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-bold rounded-xl text-[10px] hover:bg-indigo-500 hover:text-white">🧠 领悟派系技能</button>
              <button onClick={handleExploreItem} className="py-3 bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold rounded-xl text-[10px] hover:bg-amber-500 hover:text-white">📦 搜索区域物资</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 玩家交互弹窗 */}
      <AnimatePresence>
        {interactTarget && (
          <PlayerInteractionUI currentUser={user} targetUser={interactTarget} onClose={() => setInteractTarget(null)} showToast={showToast} onStartRP={(target) => {
               fetch('/api/rp/start', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ initiator: user, target, locationId: user.currentLocation, locationName: selectedLocation?.name || '未知地点' }) })
               .then(res => res.json()).then(data => { if(data.success) { setActiveRPSessionId(data.sessionId); showToast(`与 ${target.name} 的精神连接已建立。`, 'success'); } });
          }} />
        )}
      </AnimatePresence>

      {/* 状态锁定层 (审核中) */}
      {(user.status === 'pending_death' || user.status === 'pending_ghost') && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center backdrop-blur-md">
          <Skull size={64} className="text-slate-600 mb-6 animate-pulse" />
          <h1 className="text-3xl font-black text-white mb-4 tracking-widest">命运审视中</h1>
          <p className="text-slate-400 font-bold max-w-md leading-relaxed italic">您的谢幕戏正在递交至「塔」的最高议会。<br/>在获得批准前，您的灵魂被暂时锁定于此。</p>
        </div>
      )}

      {/* 底部功能按钮 */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
        <button onClick={fetchGraveyard} className="p-3.5 bg-slate-900/80 backdrop-blur-md border border-slate-600 text-slate-300 rounded-full hover:text-white hover:bg-sky-600 shadow-lg group relative transition-all">
          <Cross size={20} /><span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-black text-white text-[10px] rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">世界公墓</span>
        </button>
        <button onClick={() => setShowSettings(!showSettings)} className="p-3.5 bg-slate-900/80 backdrop-blur-md border border-slate-600 text-slate-300 rounded-full hover:text-white hover:bg-slate-700 shadow-lg group relative transition-all">
          <Settings size={20} /><span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-black text-white text-[10px] rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">设置/谢幕</span>
        </button>
      </div>

      {/* 设置与公墓弹窗组件 */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed bottom-24 right-6 w-64 bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-2xl p-4 shadow-2xl z-50">
            <h4 className="text-xs font-black text-slate-400 uppercase mb-3 px-2 tracking-widest">落幕抉择</h4>
            <div className="space-y-2">
              <button onClick={() => setShowDeathForm('death')} className="w-full flex items-center gap-3 p-3 text-sm font-bold text-rose-400 bg-rose-500/10 rounded-xl hover:bg-rose-500/20 transition-all"><Skull size={16}/> 申请谢幕 (死亡)</button>
              {user.role !== '鬼魂' && <button onClick={() => setShowDeathForm('ghost')} className="w-full flex items-center gap-3 p-3 text-sm font-bold text-violet-400 bg-violet-500/10 rounded-xl hover:bg-violet-500/20 transition-all"><Skull size={16} className="opacity-50"/> 转化鬼魂 (换皮)</button>}
            </div>
          </motion.div>
        )}
        
        {showGraveyard && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={() => setShowGraveyard(false)}>
            <motion.div onClick={e => e.stopPropagation()} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-slate-900 border border-slate-700 rounded-[32px] w-full max-w-3xl h-[80vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <h2 className="text-2xl font-black text-white flex items-center gap-3"><Cross className="text-slate-500"/> 世界公墓</h2>
                <button onClick={() => setShowGraveyard(false)} className="text-slate-500 hover:text-white transition-colors"><X size={24}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-950">
                {tombstones.length === 0 ? <div className="text-center py-20 text-slate-600 font-bold tracking-widest uppercase">万籁俱寂 · 目前无人长眠于此</div> : 
                  tombstones.map(t => (
                    <div key={t.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-all">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-black text-slate-200">{t.name} 的墓碑</h3>
                          <div className="text-[10px] uppercase font-bold text-slate-500 mt-1 space-x-2"><span>生前: {t.role}</span><span>{t.mentalRank}/{t.physicalRank}</span>{t.spiritName && <span>精神体: {t.spiritName}</span>}</div>
                        </div>
                        <button onClick={() => loadComments(t.id)} className="text-xs font-bold text-sky-500 bg-sky-500/10 px-3 py-1.5 rounded-lg hover:bg-sky-500/20 transition-all">{expandedTombstone === t.id ? '收起留言' : '献花/留言'}</button>
                      </div>
                      <p className="text-sm text-slate-400 bg-slate-950 p-4 rounded-xl border border-slate-800/50 italic leading-relaxed">"{t.deathDescription}"</p>
                      <AnimatePresence>{expandedTombstone === t.id && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="mt-4 pt-4 border-t border-slate-800">
                            <div className="space-y-2 mb-4 max-h-40 overflow-y-auto custom-scrollbar">
                              {comments.map(c => (
                                <div key={c.id} className="group flex justify-between items-start p-2 bg-slate-950/50 rounded-lg">
                                  <div className="text-xs"><span className="font-bold text-sky-400 mr-2">{c.userName}:</span><span className="text-slate-300">{c.content}</span></div>
                                  {c.userId === user.id && <button onClick={() => deleteComment(c.id, t.id)} className="text-rose-500/50 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={12}/></button>}
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="献上一束白花或一段悼词..." className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-sky-500 transition-all"/>
                              <button onClick={() => addComment(t.id)} className="bg-sky-600 text-white p-2 rounded-lg hover:bg-sky-500 shadow-lg transition-all"><Send size={14}/></button>
                            </div>
                          </div>
                        </motion.div>
                      )}</AnimatePresence>
                    </div>
                  ))
                }
              </div>
            </motion.div>
          </div>
        )}

        {showDeathForm && (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-slate-900 border border-slate-700 p-8 rounded-3xl w-full max-w-lg shadow-2xl">
              <h2 className="text-2xl font-black text-white mb-2">{showDeathForm === 'death' ? '谢幕与墓志铭' : '化鬼契约'}</h2>
              <p className="text-sm text-slate-400 mb-6">{showDeathForm === 'death' ? '写下您的落幕之辞。提交后数据将被暂时封锁，通过后您将长眠于公墓。' : '放弃肉身，以灵体状态游荡于世。通过后将重塑为鬼魂职业。'}</p>
              <textarea value={deathText} onChange={e => setDeathText(e.target.value)} placeholder="在此书写您的最后遗言..." className="w-full h-32 p-4 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 outline-none focus:border-sky-500/50 mb-6 text-sm resize-none transition-all"/>
              <div className="flex gap-3">
                <button onClick={() => setShowDeathForm(null)} className="flex-1 py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition-all">取消</button>
                <button onClick={handleSubmitDeath} className="flex-[2] py-3 bg-rose-600 text-white rounded-xl font-black hover:bg-rose-500 shadow-lg transition-all">提交塔区审核</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 对戏窗口容器 */}
      <AnimatePresence>
        {activeRPSessionId && <RoleplayWindow sessionId={activeRPSessionId} currentUser={user} onClose={() => setActiveRPSessionId(null)} />}
      </AnimatePresence>
    </div>
  );
}
