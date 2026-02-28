import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MapPin, Settings, Skull, Cross, Send, Trash2, Heart, ArrowLeft, Navigation } from 'lucide-react';
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
// 将地点ID映射到 public 文件夹下的图片
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
  showToast: (msg: string) => void;
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
  
  // 濒死急救系统
  const [isDying, setIsDying] = useState(false);
  const [rescueReqId, setRescueReqId] = useState<number | null>(null);
  
  // 公墓系统
  const [showGraveyard, setShowGraveyard] = useState(false);
  const [tombstones, setTombstones] = useState<any[]>([]);
  const [expandedTombstone, setExpandedTombstone] = useState<number | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');

  // 计算当前背景图
  const currentBackgroundImage = useMemo(() => {
    if (activeView && LOCATION_BG_MAP[activeView]) {
      return LOCATION_BG_MAP[activeView];
    }
    return '/map_background.jpg'; // 默认大地图背景
  }, [activeView]);

  // 监听 HP 变化触发濒死
  useEffect(() => {
    if ((user.hp || 0) <= 0 && user.status === 'approved') {
      setIsDying(true);
    } else {
      setIsDying(false);
    }
  }, [user.hp, user.status]);

  // 轮询自身发出的急救请求状态
  useEffect(() => {
    if (!isDying || !rescueReqId) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/rescue/check/${user.id}`);
        const data = await res.json();
        if (data.outgoing) {
          if (data.outgoing.status === 'accepted') {
            await fetch('/api/rescue/confirm', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ patientId: user.id }) });
            showToast('一位医疗向导将你从死亡边缘拉了回来！');
            setIsDying(false);
            setRescueReqId(null);
            fetchGlobalData();
          } else if (data.outgoing.status === 'rejected') {
            showToast('你的求救被拒绝了，生机断绝...');
            setRescueReqId(null);
          }
        }
      } catch (e) {
        console.error(e);
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [isDying, rescueReqId, user.id]);

  // 轮询同地图玩家
  useEffect(() => {
    if (!user.currentLocation) return;
    const fetchPlayers = async () => {
      try {
        const res = await fetch(`/api/locations/${user.currentLocation}/players?excludeId=${user.id}`);
        const data = await res.json();
        if (data.success) setLocalPlayers(data.players || []);
      } catch (e) { console.error(e); }
    };
    fetchPlayers();
    const timer = setInterval(fetchPlayers, 5000);
    return () => clearInterval(timer);
  }, [user.currentLocation, user.id]);

  // 基础逻辑：年龄判断
  const userAge = user?.age || 0;
  const isUndifferentiated = userAge < 16;
  const isStudentAge = userAge >= 16 && userAge <= 19;

  // 探索交互逻辑
  const handleExploreAction = async () => {
    if (Math.random() > 0.5) {
      try {
        const res = await fetch('/api/explore/combat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id })
        });
        const data = await res.json();
        if (data.isWin) {
          showToast(`⚔️ 战斗大捷：${data.message}`);
        } else {
          alert(`❌ 探索失败：${data.message}`);
          setActiveView(null); 
          fetchGlobalData();
        }
      } catch (e) { showToast("战斗系统连接中断"); }
    } else {
      handleExploreItem();
    }
  };

  const handleLocationAction = async (action: 'enter' | 'stay') => {
    if (!selectedLocation) return;
    if (isUndifferentiated && !SAFE_ZONES.includes(selectedLocation.id)) {
      if (action === 'enter') {
        showToast("【驱逐】这里太危险了，守卫拒绝了你的进入！");
        return;
      }
      if (!window.confirm("这里极度危险，真的要驻足吗？")) return;
    }
    if (isStudentAge && action === 'enter' && !SAFE_ZONES.includes(selectedLocation.id)) {
      if (!window.confirm("你还没有毕业，强行加入仅能获得最低职位。确定吗？")) {
        setActiveView('london_tower');
        return;
      }
    }
    if (action === 'stay') {
      await fetch(`/api/users/${user.id}/location`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId: selectedLocation.id })
      });
      showToast(`已在 ${selectedLocation.name} 驻足。`);
      fetchGlobalData();
      return;
    }
    if (action === 'enter') {
      setActiveView(selectedLocation.id);
      setSelectedLocation(null); // 关闭弹窗
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
      showToast(data.success ? `🎉 ${data.message}` : `⚠️ ${data.message}`);
    } catch (e) { showToast("错误！"); }
  };

  const handleExploreItem = async () => {
    if (!selectedLocation && !activeView) return;
    // 如果在activeView中探索，使用当前view id，如果在地图弹窗，使用selectedLocation
    const locId = activeView || selectedLocation?.id;
    try {
      const res = await fetch('/api/explore/item', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, locationId: locId })
      });
      const data = await res.json();
      showToast(data.success ? `🎉 ${data.message}` : `⚠️ ${data.message}`);
    } catch (e) { showToast("错误！"); }
  };

  const handleStruggle = async () => {
    try {
      const res = await fetch('/api/rescue/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: user.id, healerId: 0 })
      });
      if ((await res.json()).success) {
        setRescueReqId(Date.now()); 
        showToast('求救信号已发出...');
      }
    } catch (e) { showToast('求救发送失败'); }
  };

  const handleSubmitDeath = async () => {
    if (!deathText.trim()) return showToast('必须填写谢幕词');
    await fetch(`/api/users/${user.id}/submit-death`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: showDeathForm === 'death' ? 'pending_death' : 'pending_ghost', text: deathText })
    });
    showToast('申请已提交...');
    setShowDeathForm(null);
    fetchGlobalData();
  };

  const fetchGraveyard = async () => {
    const res = await fetch('/api/graveyard');
    const data = await res.json();
    if (data.success) {
      setTombstones(data.tombstones);
      setShowGraveyard(true);
    }
  };

  const loadComments = async (tombstoneId: number) => {
    if (expandedTombstone === tombstoneId) {
      setExpandedTombstone(null);
      return;
    }
    const res = await fetch(`/api/graveyard/${tombstoneId}/comments`);
    const data = await res.json();
    if (data.success) {
      setComments(data.comments);
      setExpandedTombstone(tombstoneId);
    }
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

  // 渲染具体地点的子视图
  const renderActiveView = () => {
    if (!activeView) return null;
    const commonProps = { user, onExit: () => setActiveView(null), showToast, fetchGlobalData };
    
    // 使用一个通用的容器来包裹子视图，确保背景图可见
    const Container = ({ children }: { children: React.ReactNode }) => (
      <div className="w-full h-full min-h-screen overflow-y-auto pt-20 pb-10 px-4 md:px-0 flex justify-center">
        <div className="w-full max-w-6xl relative z-10">
          <button 
            onClick={() => setActiveView(null)}
            className="mb-4 flex items-center gap-2 px-4 py-2 bg-slate-900/60 backdrop-blur text-white rounded-xl hover:bg-slate-800 transition-colors border border-slate-700/50"
          >
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
      
      {/* 1. 动态背景层： public 目录图片 */}
      <div className="absolute inset-0 z-0">
         <motion.div
            key={activeView || 'world_map'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-cover bg-center transition-all duration-700"
            style={{ 
              backgroundImage: `url(${activeView ? LOCATION_BG_MAP[activeView] : '/map_background.jpg'})`,
              filter: activeView ? 'brightness(0.4) blur(4px)' : 'brightness(0.6)'
            }}
         />
      </div>

      {/* 2. HUD：适配移动端可折叠 */}
      <CharacterHUD user={user} onLogout={onLogout} />

      {/* 3. 地图容器：手机端保持比例，电脑端居中 */}
      <AnimatePresence mode="wait">
        {!activeView && (
          <motion.div 
            className="relative w-full h-full flex items-center justify-center p-2 md:p-8 z-10"
          >
            <div className="relative aspect-[16/9] w-full max-w-[1200px] bg-slate-900/50 rounded-2xl md:rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl">
              <img src="/map_background.jpg" className="w-full h-full object-cover opacity-80" />
              
              {/* 地点标记：手机端增大点击热区 */}
              {LOCATIONS.map(loc => (
                <div 
                  key={loc.id}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer touch-manipulation"
                  style={{ left: `${loc.x}%`, top: `${loc.y}%` }}
                  onClick={() => setSelectedLocation(loc)}
                >
                  <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full border-2 flex items-center justify-center backdrop-blur-sm transition-all
                    ${user.currentLocation === loc.id ? 'bg-sky-500 border-white animate-pulse' : 'bg-slate-900/80 border-slate-400'}`}>
                    <MapPin size={14} />
                  </div>
                  {/* 地名标签 */}
                  <div className={`absolute top-8 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/50 rounded-lg text-[10px] md:text-xs font-bold text-slate-200 transition-all duration-300 shadow-xl
                    ${selectedLocation?.id === loc.id ? 'opacity-100 scale-110 z-20 border-sky-500/50 text-white' : 'opacity-0 hover:opacity-100 translate-y-2 hover:translate-y-0'}
                  `}>
                    {loc.name}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
        
        {/* === 模式B: 具体地点视图 (Small Map UI) === */}
        {activeView && (
          <motion.div
            key="location-view"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 z-20"
          >
            {renderActiveView()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. 详情弹窗：手机端置底，电脑端居中 */}
      <AnimatePresence>
        {selectedLocation && !activeView && (
          <motion.div 
            initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
            className="fixed bottom-0 left-0 right-0 md:bottom-10 md:left-1/2 md:-translate-x-1/2 md:w-[450px] bg-slate-900/95 backdrop-blur-xl p-6 rounded-t-3xl md:rounded-3xl border-t md:border border-white/20 z-50 shadow-2xl"
          >
             {/* 弹窗背景图模糊映射 */}
             <div className="absolute inset-0 rounded-[2rem] overflow-hidden -z-10 opacity-30">
               <img src={LOCATION_BG_MAP[selectedLocation.id] || '/map_background.jpg'} className="w-full h-full object-cover blur-md scale-110"/>
            </div>

            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="text-2xl font-black text-white mb-2 flex items-center gap-2">
                  {selectedLocation.name}
                  <span className={`text-[10px] px-2 py-1 rounded-lg border backdrop-blur-sm ${selectedLocation.type === 'safe' ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' : 'text-rose-300 border-rose-500/30 bg-rose-500/10'}`}>
                    {selectedLocation.type === 'safe' ? '安全区' : '危险区'}
                  </span>
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed mb-6 font-medium">
                  {isUndifferentiated && !SAFE_ZONES.includes(selectedLocation.id) 
                    ? "⚠️ 警告：前方迷雾笼罩，该区域对于【未分化者】极度危险，建议立即撤离。" 
                    : selectedLocation.description}
                </p>
                
                <div className="flex gap-3">
                  <button 
                    onClick={() => handleLocationAction('enter')} 
                    className="flex-1 px-6 py-3.5 bg-white text-slate-950 font-black rounded-xl text-sm hover:bg-slate-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                  >
                    进入区域
                  </button>
                  <button 
                    onClick={() => handleLocationAction('stay')} 
                    className="flex-1 px-6 py-3.5 bg-slate-800/80 text-white font-black rounded-xl text-sm hover:bg-slate-700 transition-colors border border-slate-600"
                  >
                    在此驻足
                  </button>
                </div>
                
                {/* 搜刮掉落按钮 */}
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button onClick={handleExploreSkill} className="w-full px-4 py-3 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold rounded-xl text-xs hover:bg-indigo-500 hover:text-white transition-all">
                    🧠 领悟派系技能
                  </button>
                  <button onClick={handleExploreItem} className="w-full px-4 py-3 bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold rounded-xl text-xs hover:bg-amber-500 hover:text-white transition-all">
                    📦 搜索区域物资
                  </button>
                </div>
                
                {/* 新增：战斗探索按钮 (仅危险区显示) */}
                {selectedLocation.type === 'danger' && (
                  <button onClick={handleExploreAction} className="w-full mt-2 px-4 py-3 bg-rose-600/20 text-rose-300 border border-rose-500/30 font-black rounded-xl text-xs hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center gap-2">
                    <Skull size={14}/> 探索遭遇战 (风险)
                  </button>
                )}
              </div>
              <button 
                onClick={() => setSelectedLocation(null)}
                className="p-2 -mr-2 -mt-2 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700 rounded-full transition-colors backdrop-blur-sm"
              >
                <X size={20}/>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. 交互与系统弹窗 (保持原样) */}
      <AnimatePresence>
        {interactTarget && (
          <PlayerInteractionUI 
            currentUser={user}
            targetUser={interactTarget}
            onClose={() => setInteractTarget(null)}
            showToast={showToast}
            onStartRP={(target) => { showToast(`正在与 ${target.name} 建立精神连接...`); }}
          />
        )}
      </AnimatePresence>

      {(user.status === 'pending_death' || user.status === 'pending_ghost') && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center backdrop-blur-md">
          <Skull size={64} className="text-slate-600 mb-6 animate-pulse" />
          <h1 className="text-3xl font-black text-white mb-4 tracking-widest">命运审视中</h1>
          <p className="text-slate-400 font-bold max-w-md leading-relaxed">
            您的谢幕戏正在递交至「塔」的最高议会。<br/>
            在获得批准前，您的灵魂被锁定于此。
          </p>
        </div>
      )}

      <AnimatePresence>
        {isDying && user.status === 'approved' && (
          <div className="fixed inset-0 z-[9999] bg-red-950/90 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }}
              className="bg-black border border-red-900 p-8 rounded-[32px] w-full max-w-md text-center shadow-[0_0_100px_rgba(220,38,38,0.3)]"
            >
              <Heart size={48} className="text-red-600 mx-auto mb-4 animate-pulse" />
              <h2 className="text-2xl font-black text-red-500 mb-2">生命体征已消失</h2>
              <p className="text-slate-400 text-sm mb-8">黑暗正在吞噬你的意识...</p>
              
              <div className="space-y-3">
                <button 
                  onClick={handleStruggle} 
                  disabled={rescueReqId !== null}
                  className="w-full py-4 bg-red-600 text-white rounded-2xl font-black hover:bg-red-500 transition-colors disabled:opacity-50"
                >
                  {rescueReqId ? '正在等待向导回应...' : '挣扎 (向区域内治疗向导求救)'}
                </button>
                <button 
                  onClick={() => { setIsDying(false); setShowDeathForm('death'); }} 
                  className="w-full py-4 bg-slate-900 text-slate-400 rounded-2xl font-bold hover:bg-slate-800 transition-colors"
                >
                  拥抱死亡 (生成墓碑)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
        <button onClick={fetchGraveyard} className="p-3.5 bg-slate-900/80 backdrop-blur-md border border-slate-600 text-slate-300 rounded-full hover:text-white hover:bg-sky-600 hover:border-sky-400 hover:scale-110 transition-all shadow-lg group relative">
          <Cross size={20} />
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-black text-white text-[10px] rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">世界公墓</span>
        </button>
        <button onClick={() => setShowSettings(!showSettings)} className="p-3.5 bg-slate-900/80 backdrop-blur-md border border-slate-600 text-slate-300 rounded-full hover:text-white hover:bg-slate-700 hover:scale-110 transition-all shadow-lg group relative">
          <Settings size={20} />
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-black text-white text-[10px] rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">设置/谢幕</span>
        </button>
      </div>

      {/* 设置与公墓弹窗 (保持逻辑不变，仅微调样式) */}
      <AnimatePresence>
        {showSettings && !showDeathForm && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
            className="fixed bottom-24 right-6 w-64 bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-2xl p-4 shadow-2xl z-50"
          >
            <h4 className="text-xs font-black text-slate-400 uppercase mb-3 px-2">命运抉择</h4>
            <div className="space-y-2">
              <button onClick={() => setShowDeathForm('death')} className="w-full flex items-center gap-3 p-3 text-sm font-bold text-rose-400 bg-rose-500/10 rounded-xl hover:bg-rose-500/20 transition-colors">
                <Skull size={16}/> 申请谢幕 (死亡)
              </button>
              {user.role !== '鬼魂' && (
                <button onClick={() => setShowDeathForm('ghost')} className="w-full flex items-center gap-3 p-3 text-sm font-bold text-violet-400 bg-violet-500/10 rounded-xl hover:bg-violet-500/20 transition-colors">
                  <Skull size={16} className="opacity-50"/> 转化鬼魂 (换皮)
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 公墓弹窗 */}
      <AnimatePresence>
        {showGraveyard && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="bg-slate-900 border border-slate-700 rounded-[32px] w-full max-w-3xl h-[80vh] flex flex-col shadow-2xl overflow-hidden">
               {/* 头部 */}
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <h2 className="text-2xl font-black text-white flex items-center gap-3"><Cross className="text-slate-500"/> 世界公墓</h2>
                <button onClick={() => setShowGraveyard(false)} className="text-slate-500 hover:text-white"><X size={24}/></button>
              </div>
              
              {/* 内容区域 */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-950">
                {tombstones.length === 0 ? (
                  <div className="text-center py-20 text-slate-600 font-bold tracking-widest">目前无人长眠于此</div>
                ) : (
                  tombstones.map(t => (
                    <div key={t.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 transition-all hover:border-slate-700">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-black text-slate-200">{t.name} 的墓碑</h3>
                          <div className="text-[10px] uppercase font-bold text-slate-500 mt-1 space-x-2">
                            <span>生前: {t.role}</span>
                            <span>{t.mentalRank}/{t.physicalRank}</span>
                            {t.spiritName && <span>精神体: {t.spiritName}</span>}
                          </div>
                        </div>
                        <button onClick={() => loadComments(t.id)} className="text-xs font-bold text-sky-500 bg-sky-500/10 px-3 py-1.5 rounded-lg hover:bg-sky-500/20">
                          {expandedTombstone === t.id ? '收起留言' : '献花/留言'}
                        </button>
                      </div>
                      
                      <p className="text-sm text-slate-400 bg-slate-950 p-4 rounded-xl border border-slate-800/50 italic">
                        "{t.deathDescription}"
                      </p>

                      <AnimatePresence>
                        {expandedTombstone === t.id && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <div className="mt-4 pt-4 border-t border-slate-800">
                              <div className="space-y-2 mb-4 max-h-40 overflow-y-auto custom-scrollbar">
                                {comments.length === 0 && <div className="text-xs text-slate-600">还没有人留下只言片语...</div>}
                                {comments.map(c => (
                                  <div key={c.id} className="group flex justify-between items-start p-2 bg-slate-950/50 rounded-lg">
                                    <div className="text-xs">
                                      <span className="font-bold text-sky-400 mr-2">{c.userName}:</span>
                                      <span className="text-slate-300">{c.content}</span>
                                    </div>
                                    {c.userId === user.id && (
                                      <button onClick={() => deleteComment(c.id, t.id)} className="text-rose-500/50 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12}/></button>
                                    )}
                                  </div>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <input 
                                  type="text" value={newComment} onChange={e => setNewComment(e.target.value)}
                                  placeholder="写下你的悼词..."
                                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-sky-500"
                                />
                                <button onClick={() => addComment(t.id)} className="bg-sky-600 text-white p-2 rounded-lg hover:bg-sky-500 transition-colors"><Send size={14}/></button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeRPSessionId && (
          <RoleplayWindow 
            sessionId={activeRPSessionId} 
            currentUser={user} 
            onClose={() => setActiveRPSessionId(null)} 
          />
        )}
      </AnimatePresence>
      
      {showDeathForm && (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-slate-900 border border-slate-700 p-8 rounded-3xl w-full max-w-lg shadow-2xl">
              <h2 className="text-2xl font-black text-white mb-2">{showDeathForm === 'death' ? '谢幕与墓志铭' : '化鬼契约'}</h2>
              <p className="text-sm text-slate-400 mb-6">
                {showDeathForm === 'death' ? '写下你的死因与墓志铭，提交后将生成世界墓碑，数据将被剥夺。' : '放弃肉身与精神体，以灵体状态游荡于世。'}
              </p>
              <textarea
                value={deathText}
                onChange={e => setDeathText(e.target.value)}
                placeholder="在此书写你的落幕之辞..."
                className="w-full h-32 p-4 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 outline-none focus:border-sky-500/50 mb-6 text-sm resize-none"
              />
              <div className="flex gap-3">
                <button onClick={() => setShowDeathForm(null)} className="flex-1 py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700">取消</button>
                <button onClick={handleSubmitDeath} className="flex-[2] py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-500 shadow-lg">提交审核</button>
              </div>
            </motion.div>
          </div>
        )}
    </div>
  );
}