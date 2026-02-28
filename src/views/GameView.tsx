import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MapPin, Settings, Skull, Cross, Send, Trash2, Heart, ArrowLeft, Navigation, Users } from 'lucide-react';
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

// ================== 地图坐标配置 ==================
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
  
  const [isDying, setIsDying] = useState(false);
  const [rescueReqId, setRescueReqId] = useState<number | null>(null);
  
  const [showGraveyard, setShowGraveyard] = useState(false);
  const [tombstones, setTombstones] = useState<any[]>([]);
  const [expandedTombstone, setExpandedTombstone] = useState<number | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');

  // 1. 获取所有在线玩家位置，用于在大地图渲染
  const [allOnlinePlayers, setAllOnlinePlayers] = useState<any[]>([]);
  useEffect(() => {
    const fetchAllPlayers = async () => {
      try {
        const res = await fetch('/api/admin/users'); // 借用管理接口或新建接口获取在线玩家
        const data = await res.json();
        if (data.success) {
          setAllOnlinePlayers(data.users.filter((u: any) => u.currentLocation && u.id !== user.id));
        }
      } catch (e) { console.error(e); }
    };
    fetchAllPlayers();
    const timer = setInterval(fetchAllPlayers, 5000);
    return () => clearInterval(timer);
  }, [user.id]);

  // 2. 轮询当前选定地点的详细玩家列表
  useEffect(() => {
    if (!selectedLocation) return;
    const fetchLocal = async () => {
      try {
        const res = await fetch(`/api/locations/${selectedLocation.id}/players?excludeId=${user.id}`);
        const data = await res.json();
        if (data.success) setLocalPlayers(data.players || []);
      } catch (e) { console.error(e); }
    };
    fetchLocal();
    const timer = setInterval(fetchLocal, 3000);
    return () => clearInterval(timer);
  }, [selectedLocation, user.id]);

  const handleExploreAction = async () => {
    if (Math.random() > 0.5) {
      try {
        const res = await fetch('/api/explore/combat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id })
        });
        const data = await res.json();
        if (data.isWin) {
          showToast(`⚔️ 战斗大捷：${data.message}`, 'success');
        } else {
          showToast(`❌ 探索失败：${data.message}`, 'warn');
          setActiveView(null); 
          fetchGlobalData();
        }
      } catch (e) { showToast("战斗系统连接中断", 'warn'); }
    } else {
      handleExploreItem();
    }
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
      return;
    }
    if (action === 'enter') {
      setActiveView(selectedLocation.id);
      setSelectedLocation(null);
    }
  };

  const handleExploreSkill = async () => {
    if (!selectedLocation) return;
    try {
      const res = await fetch('/api/explore/skill', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, locationId: selectedLocation.id })
      });
      const data = await res.json();
      showToast(data.success ? `🎉 ${data.message}` : `⚠️ ${data.message}`, data.success ? 'success' : 'info');
    } catch (e) { showToast("连接错误", 'warn'); }
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

  const renderActiveView = () => {
    if (!activeView) return null;
    const commonProps = { user, onExit: () => setActiveView(null), showToast, fetchGlobalData };
    const Container = ({ children }: { children: React.ReactNode }) => (
      <div className="w-full h-full min-h-screen overflow-y-auto pt-20 pb-10 px-4 md:px-0 flex justify-center">
        <div className="w-full max-w-6xl relative z-10">
          <button onClick={() => setActiveView(null)} className="mb-4 flex items-center gap-2 px-4 py-2 bg-slate-900/60 backdrop-blur text-white rounded-xl hover:bg-slate-800 border border-slate-700/50 transition-all">
            <ArrowLeft size={18}/> 返回世界地图
          </button>
          {children}
        </div>
      </div>
    );
    switch (activeView) {
      case 'tower_of_life': return <Container><TowerOfLifeView {...commonProps} /></Container>;
      case 'london_tower': return <Container><LondonTowerView {...commonProps} /></Container>;
      case 'sanctuary': return <Container><SanctuaryView {...commonProps} /></Container>;
      case 'guild': return <Container><GuildView {...commonProps} /></Container>;
      case 'army': return <Container><ArmyView {...commonProps} /></Container>;
      case 'slums': return <Container><SlumsView {...commonProps} /></Container>;
      case 'rich_area': return <Container><RichAreaView {...commonProps} /></Container>;
      case 'demon_society': return <Container><DemonSocietyView {...commonProps} /></Container>;
      case 'paranormal_office': return <Container><SpiritBureauView {...commonProps} /></Container>;
      case 'observers': return <Container><ObserverView {...commonProps} /></Container>;
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 overflow-hidden font-sans select-none text-slate-100 bg-slate-950">
      
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

      <AnimatePresence mode="wait">
        {!activeView && (
          <motion.div className="relative w-full h-full flex items-center justify-center p-2 md:p-8 z-10">
            <div className="relative aspect-[16/9] w-full max-w-[1200px] bg-slate-900/50 rounded-2xl md:rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl">
              <img src="/map_background.jpg" className="w-full h-full object-cover opacity-80" />
              
              {LOCATIONS.map(loc => {
                const playersInLoc = allOnlinePlayers.filter(p => p.currentLocation === loc.id);
                return (
                  <div 
                    key={loc.id}
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer touch-manipulation group"
                    style={{ left: `${loc.x}%`, top: `${loc.y}%` }}
                    onClick={() => setSelectedLocation(loc)}
                  >
                    {/* 地点上方的玩家微缩头像 */}
                    {playersInLoc.length > 0 && (
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex -space-x-2 animate-bounce">
                        {playersInLoc.slice(0, 3).map(p => (
                          <div key={p.id} className="w-6 h-6 rounded-full border border-white overflow-hidden bg-slate-800 shadow-lg">
                            <img src={p.avatarUrl || '/map_background.jpg'} className="w-full h-full object-cover" />
                          </div>
                        ))}
                        {playersInLoc.length > 3 && (
                          <div className="w-6 h-6 rounded-full bg-sky-500 text-[8px] flex items-center justify-center border border-white font-bold">
                            +{playersInLoc.length - 3}
                          </div>
                        )}
                      </div>
                    )}

                    <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full border-2 flex items-center justify-center backdrop-blur-sm transition-all
                      ${user.currentLocation === loc.id ? 'bg-sky-500 border-white animate-pulse' : 'bg-slate-900/80 border-slate-400 group-hover:scale-125 group-hover:bg-white group-hover:text-slate-900'}`}>
                      <MapPin size={14} />
                    </div>
                    <div className={`absolute top-8 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/50 rounded-lg text-[10px] md:text-xs font-bold text-slate-200 shadow-xl transition-all
                      ${selectedLocation?.id === loc.id ? 'opacity-100 scale-110 z-20 border-sky-500/50 text-white' : 'opacity-0 group-hover:opacity-100'}
                    `}>
                      {loc.name}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
        
        {activeView && (
          <motion.div key="location-view" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="absolute inset-0 z-20">
            {renderActiveView()}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedLocation && !activeView && (
          <motion.div 
            initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
            className="fixed bottom-0 left-0 right-0 md:bottom-10 md:left-1/2 md:-translate-x-1/2 md:w-[480px] bg-slate-900/95 backdrop-blur-xl p-6 rounded-t-3xl md:rounded-3xl border-t md:border border-white/20 z-50 shadow-2xl overflow-hidden"
          >
             <div className="absolute inset-0 rounded-[2rem] overflow-hidden -z-10 opacity-30">
               <img src={LOCATION_BG_MAP[selectedLocation.id] || '/map_background.jpg'} className="w-full h-full object-cover blur-md scale-110"/>
            </div>

            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h3 className="text-2xl font-black text-white mb-1 flex items-center gap-2">
                  {selectedLocation.name}
                  <span className={`text-[10px] px-2 py-1 rounded-lg border backdrop-blur-sm ${selectedLocation.type === 'safe' ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' : 'text-rose-300 border-rose-500/30 bg-rose-500/10'}`}>
                    {selectedLocation.type === 'safe' ? '安全区' : '危险区'}
                  </span>
                </h3>
              </div>
              <button onClick={() => setSelectedLocation(null)} className="p-2 text-slate-400 hover:text-white bg-slate-800/50 rounded-full"><X size={20}/></button>
            </div>

            {/* 区域内玩家展示列表 */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Users size={14} className="text-sky-400" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">当前区域在线玩家</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                {localPlayers.length === 0 ? (
                  <div className="text-[10px] text-slate-500 italic py-2">这片区域除了你之外似乎空无一人...</div>
                ) : (
                  localPlayers.map(p => (
                    <motion.div 
                      key={p.id} whileHover={{ y: -2 }}
                      onClick={() => setInteractTarget(p)}
                      className="flex-shrink-0 cursor-pointer group flex flex-col items-center"
                    >
                      <div className="w-12 h-12 rounded-xl border-2 border-slate-700 overflow-hidden group-hover:border-sky-500 transition-colors bg-slate-800 shadow-lg">
                        <img src={p.avatarUrl || '/map_background.jpg'} className="w-full h-full object-cover" />
                      </div>
                      <span className="text-[10px] font-bold text-slate-300 mt-1 truncate w-12 text-center">{p.name}</span>
                    </motion.div>
                  ))
                )}
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-6">
              {isUndifferentiated && !SAFE_ZONES.includes(selectedLocation.id) ? "⚠️ 警告：该区域对于【未分化者】极度危险！" : selectedLocation.description}
            </p>
            
            <div className="flex gap-2 mb-3">
              <button onClick={() => handleLocationAction('enter')} className="flex-1 px-4 py-3 bg-white text-slate-950 font-black rounded-xl text-xs hover:bg-slate-200 shadow-lg">进入区域</button>
              <button onClick={() => handleLocationAction('stay')} className="flex-1 px-4 py-3 bg-slate-800 text-white font-black rounded-xl text-xs border border-slate-700 hover:bg-slate-700">在此驻足</button>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <button onClick={handleExploreSkill} className="px-4 py-3 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-bold rounded-xl text-[10px] hover:bg-indigo-500 hover:text-white transition-all">🧠 领悟派系技能</button>
              <button onClick={handleExploreItem} className="px-4 py-3 bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold rounded-xl text-[10px] hover:bg-amber-500 hover:text-white transition-all">📦 搜索区域物资</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {interactTarget && (
          <PlayerInteractionUI 
            currentUser={user}
            targetUser={interactTarget}
            onClose={() => setInteractTarget(null)}
            showToast={showToast}
            onStartRP={(target) => {
               // 触发开始对戏
               fetch('/api/rp/start', {
                 method: 'POST', headers: {'Content-Type': 'application/json'},
                 body: JSON.stringify({ initiator: user, target, locationId: user.currentLocation, locationName: selectedLocation?.name || '未知地点' })
               }).then(res => res.json()).then(data => {
                  if(data.success) {
                    setActiveRPSessionId(data.sessionId);
                    showToast(`与 ${target.name} 的精神连接已建立。`, 'success');
                  }
               });
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeRPSessionId && (
          <RoleplayWindow sessionId={activeRPSessionId} currentUser={user} onClose={() => setActiveRPSessionId(null)} />
        )}
      </AnimatePresence>

      {/* 公墓与谢幕弹窗逻辑保持不变... */}
    </div>
  );
}
