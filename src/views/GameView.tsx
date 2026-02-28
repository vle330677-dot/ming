import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MapPin } from 'lucide-react';
import { User } from '../types';

// ================== 组件导入 ==================
// 1. 导入新的悬浮角色状态栏 (请确保 CharacterHUD.tsx 已创建)
import { CharacterHUD } from './CharacterHUD';

// 2. 导入所有子地图视图
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

// ================== 地图坐标配置 ==================
// 坐标基于 16:9 比例的地图设定 (百分比 left/top)
const LOCATIONS = [
  // 中央核心区
  { id: 'tower_of_life', name: '命之塔', x: 50, y: 48, type: 'safe', description: '世界的绝对中心，神明降下神谕的圣地。新生儿在此接受命运的评定。' },
  { id: 'sanctuary', name: '圣所', x: 42, y: 42, type: 'safe', description: '未分化幼崽的摇篮，充满治愈与宁静的气息。' },
  
  // 右侧区域
  { id: 'london_tower', name: '伦敦塔', x: 67, y: 35, type: 'safe', description: '哨兵与向导的最高学府与管理机构。未成年分化者的庇护所。' },
  { id: 'rich_area', name: '富人区', x: 70, y: 50, type: 'danger', description: '流光溢彩的销金窟，权贵们在此挥霍财富。' },
  
  // 左侧区域
  { id: 'slums', name: '贫民区', x: 25, y: 48, type: 'danger', description: '混乱、肮脏，但充满生机。这里的市长掌控着地下工厂。' },
  { id: 'demon_society', name: '恶魔会', x: 12, y: 20, type: 'danger', description: '混乱之王的狂欢所，充斥着赌局与危险的交易。(位于未知区域深处)' },
  
  // 底部区域
  { id: 'guild', name: '工会', x: 48, y: 78, type: 'danger', description: '鱼龙混杂的地下交易网与冒险者聚集地。' },
  
  // 顶部区域
  { id: 'army', name: '军队', x: 50, y: 18, type: 'danger', description: '人类最坚实的物理防线，对抗域外魔物的铁血堡垒。' },
  { id: 'observers', name: '观察者', x: 65, y: 15, type: 'danger', description: '记录世界历史与真相的隐秘结社，掌控着巨大的图书馆。' },
  
  // 特殊/边缘
  { id: 'paranormal_office', name: '灵异管理所', x: 88, y: 15, type: 'danger', description: '专门处理非自然精神波动的神秘机关，拥有特殊监狱。(位于未知区域)' },
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

  // 基础逻辑：年龄判断
  const userAge = user?.age || 0;
  const isUndifferentiated = userAge < 16;
  const isStudentAge = userAge >= 16 && userAge <= 19;

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

  // 地点交互逻辑
  const handleLocationAction = async (action: 'enter' | 'explore' | 'stay') => {
    if (!selectedLocation) return;

    // 1. 未分化者限制
    if (isUndifferentiated && !SAFE_ZONES.includes(selectedLocation.id)) {
      if (action === 'enter') {
        showToast("【驱逐】这里太危险了，守卫拒绝了你的进入：“未分化的小鬼，回塔里去！”");
        return;
      }
      const headStrong = window.confirm("这里雾蒙蒙的，仿佛有迷雾笼罩，真的要去吗？（未分化者极易遇险）");
      if (!headStrong) return;
    }

    // 2. 16-19岁限制
    if (isStudentAge && action === 'enter' && !SAFE_ZONES.includes(selectedLocation.id)) {
      const choice = window.confirm("你还没有毕业，真的要加入其他阵营吗？\n【取消】去伦敦塔深造 (推荐)\n【确定】强行加入 (仅能获得最低职位)");
      if (!choice) {
        setActiveView('london_tower');
        return;
      }
      showToast("塔认可了你的选择，但你目前的资历仅支持申请该阵营的最低级职位。");
    }

    if (action === 'stay') {
      await fetch(`/api/users/${user.id}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId: selectedLocation.id })
      });
      showToast(`已在 ${selectedLocation.name} 驻足。`);
      fetchGlobalData();
      return;
    }

    if (action === 'enter') {
      setActiveView(selectedLocation.id);
    }
  };

  // 如果有激活的子视图，全屏显示子视图
  if (activeView) {
    const commonProps = { user, onExit: () => setActiveView(null), showToast, fetchGlobalData };
    
    switch (activeView) {
      case 'tower_of_life': return <TowerOfLifeView {...commonProps} />;
      case 'london_tower': return <LondonTowerView {...commonProps} />;
      case 'sanctuary': return <SanctuaryView {...commonProps} />;
      case 'guild': return <GuildView {...commonProps} />;
      case 'army': return <ArmyView {...commonProps} />;
      case 'slums': return <SlumsView {...commonProps} />;
      case 'rich_area': return <RichAreaView {...commonProps} />;
      case 'demon_society': return <DemonSocietyView {...commonProps} />;
      case 'paranormal_office': return <SpiritBureauView {...commonProps} />;
      case 'observers': return <ObserverView {...commonProps} />;
      default: setActiveView(null); break;
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-950 overflow-hidden font-sans select-none text-slate-100 flex items-center justify-center">
      
      {/* 1. 悬浮角色面板 (HUD) */}
      <CharacterHUD user={user} onLogout={onLogout} />

      {/* 2. 响应式地图容器 
          aspect-video 强制 16:9 比例。
          max-w-[177.78vh] 确保在超宽屏下高度不超过视口，保持比例不裁剪。
          pointer-events-auto 确保内部元素可点击。
      */}
      <div className="relative w-full h-full flex items-center justify-center p-0 md:p-4">
        <div className="relative aspect-video w-full max-w-[177.78vh] max-h-full shadow-2xl overflow-hidden rounded-xl bg-slate-900 border border-slate-800">
          
          {/* 背景图片 */}
          <img 
            src="/map_background.jpg" 
            className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-80" 
            alt="World Map" 
          />

          {/* 地点标记层 */}
          <div className="absolute inset-0 z-10">
            {LOCATIONS.map(loc => (
              <div 
                key={loc.id}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
                style={{ left: `${loc.x}%`, top: `${loc.y}%` }}
                onClick={() => setSelectedLocation(loc)}
              >
                {/* 选中时的光圈 */}
                {user.currentLocation === loc.id && (
                  <div className="absolute -inset-6 bg-sky-500/20 rounded-full animate-ping pointer-events-none"></div>
                )}
                
                {/* 标记点 */}
                <div className={`relative w-4 h-4 md:w-6 md:h-6 rounded-full border-2 shadow-[0_0_15px_rgba(0,0,0,0.5)] transition-all duration-300 flex items-center justify-center
                  ${user.currentLocation === loc.id 
                    ? 'bg-sky-500 border-white scale-110 shadow-sky-500/50' 
                    : 'bg-slate-800 border-slate-400/60 hover:bg-white hover:scale-110'
                  }`}
                >
                  {user.currentLocation === loc.id && <MapPin size={10} className="text-white" />}
                </div>

                {/* 悬浮/选中时的地名标签 */}
                <div className={`absolute top-6 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-1 bg-black/70 backdrop-blur-sm rounded text-[10px] md:text-xs font-bold text-white transition-opacity duration-200
                  ${selectedLocation?.id === loc.id ? 'opacity-100 z-20' : 'opacity-0 group-hover:opacity-100'}
                `}>
                  {loc.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. 附近玩家列表 (右上角浮动) */}
      <div className="absolute top-4 right-4 z-40 flex flex-col items-end pointer-events-none">
        {localPlayers.length > 0 && (
          <div className="bg-slate-900/60 backdrop-blur px-3 py-1 rounded-full text-[10px] text-slate-400 mb-2 border border-slate-700/50">
            同区域玩家 ({localPlayers.length})
          </div>
        )}
        <div className="space-y-2 pointer-events-auto max-h-[40vh] overflow-y-auto custom-scrollbar pr-1">
          {localPlayers.map(p => (
            <motion.div 
              key={p.id}
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              onClick={() => setInteractTarget(p)} 
              className="bg-slate-900/80 backdrop-blur border border-slate-700/50 p-1.5 pl-3 rounded-full flex items-center gap-3 cursor-pointer hover:border-sky-500 hover:bg-slate-800 transition-all group shadow-lg"
            >
              <span className="text-[10px] font-bold text-slate-300 max-w-[80px] truncate group-hover:text-white">{p.name}</span>
              <div className="w-8 h-8 rounded-full bg-slate-800 overflow-hidden border border-slate-600 group-hover:border-sky-400">
                {p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs text-white">{p.name[0]}</div>}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* 4. 地点详情弹窗 (底部) */}
      <AnimatePresence>
        {selectedLocation && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            exit={{ y: 100, opacity: 0 }} 
            className="absolute bottom-6 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-[480px] md:bottom-10 bg-slate-900/95 backdrop-blur-xl border border-slate-700 p-6 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] z-30"
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="text-xl font-black text-white mb-2 flex items-center gap-2">
                  {selectedLocation.name}
                  <span className={`text-[10px] px-2 py-0.5 rounded border ${selectedLocation.type === 'safe' ? 'text-emerald-400 border-emerald-900 bg-emerald-900/20' : 'text-rose-400 border-rose-900 bg-rose-900/20'}`}>
                    {selectedLocation.type === 'safe' ? '安全区' : '危险区'}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-6">
                  {isUndifferentiated && !SAFE_ZONES.includes(selectedLocation.id) 
                    ? "⚠️ 警告：前方迷雾笼罩，该区域对于【未分化者】极度危险，建议立即撤离。" 
                    : selectedLocation.description}
                </p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => handleLocationAction('enter')} 
                    className="flex-1 px-6 py-3 bg-white text-slate-950 font-black rounded-xl text-xs hover:bg-slate-200 transition-colors shadow-lg shadow-white/10"
                  >
                    进入区域
                  </button>
                  <button 
                    onClick={() => handleLocationAction('stay')} 
                    className="flex-1 px-6 py-3 bg-slate-800 text-white font-black rounded-xl text-xs hover:bg-slate-700 transition-colors border border-slate-700"
                  >
                    在此驻足
                  </button>
                </div>
              </div>
              <button 
                onClick={() => setSelectedLocation(null)}
                className="p-2 -mr-2 -mt-2 text-slate-500 hover:text-white bg-transparent hover:bg-slate-800 rounded-full transition-colors"
              >
                <X size={20}/>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. 玩家互动弹窗 (居中) */}
      <AnimatePresence>
        {interactTarget && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setInteractTarget(null)}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-slate-900 border border-slate-700 p-8 rounded-[32px] w-full max-w-xs text-center relative shadow-2xl"
            >
              <button onClick={() => setInteractTarget(null)} className="absolute top-6 right-6 text-slate-500 hover:text-white"><X size={20}/></button>
              <div className="w-24 h-24 rounded-3xl bg-slate-800 mx-auto mb-5 border-2 border-slate-700 overflow-hidden shadow-inner">
                {interactTarget.avatarUrl ? <img src={interactTarget.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-4xl text-slate-600">{interactTarget.name[0]}</div>}
              </div>
              <h4 className="text-xl font-black text-white mb-1">{interactTarget.name}</h4>
              <p className="text-xs text-slate-500 mb-8 uppercase tracking-widest font-bold">
                {interactTarget.role || '未知'} · {interactTarget.faction || '无派系'}
              </p>
              
              <div className="grid grid-cols-2 gap-3">
                <button className="py-3 bg-sky-600 text-white rounded-2xl text-xs font-black hover:bg-sky-500 transition-colors shadow-lg shadow-sky-900/20">发起对戏</button>
                <button className="py-3 bg-slate-800 text-white rounded-2xl text-xs font-black hover:bg-slate-700 transition-colors">查看资料</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}