import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Map as MapIcon, Users, Settings as SettingsIcon, LogOut, 
  MapPin, MessageSquare, ShieldAlert, Zap, Ghost, Heart, Search, Book, Swords, EyeOff
} from 'lucide-react';
import { User } from '../types';

// 导入所有子地图组件
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

const LOCATIONS = [
  { id: 'tower_of_life', name: '命之塔', x: 50, y: 50, type: 'safe', description: '世界的绝对中心，神明降下神谕的圣地。新生儿在此接受命运的评定。' },
  { id: 'london_tower', name: '伦敦塔', x: 30, y: 40, type: 'safe', description: '哨兵与向导的最高学府与管理机构。未成年分化者的庇护所。' },
  { id: 'sanctuary', name: '圣所', x: 70, y: 40, type: 'safe', description: '未分化幼崽的摇篮，充满治愈与宁静的气息。' },
  { id: 'guild', name: '公会', x: 20, y: 70, type: 'danger', description: '鱼龙混杂的地下交易网与冒险者聚集地。' },
  { id: 'army', name: '军队', x: 80, y: 70, type: 'danger', description: '人类最坚实的物理防线，对抗域外魔物的铁血堡垒。' },
  { id: 'slums', name: '贫民区 (西市)', x: 30, y: 85, type: 'danger', description: '混乱、肮脏，但充满生机。这里的市长掌控着地下工厂。' },
  { id: 'rich_area', name: '富人区 (东市)', x: 70, y: 85, type: 'danger', description: '流光溢彩的销金窟，权贵们在此挥霍财富。' },
  { id: 'demon_society', name: '恶魔会', x: 15, y: 25, type: 'danger', description: '混乱之王的狂欢所，充斥着赌局与危险的交易。' },
  { id: 'paranormal_office', name: '灵异管理所', x: 85, y: 25, type: 'danger', description: '专门处理非自然精神波动的神秘机关，拥有特殊监狱。' },
  { id: 'observers', name: '观察者', x: 50, y: 15, type: 'danger', description: '记录世界历史与真相的隐秘结社，掌控着巨大的图书馆。' },
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

  const userAge = user?.age || 0;
  const isUndifferentiated = userAge < 16;
  const isStudentAge = userAge >= 16 && userAge <= 19;

  useEffect(() => {
    if (!user.currentLocation) return;
    const fetchPlayers = async () => {
      const res = await fetch(`/api/locations/${user.currentLocation}/players?excludeId=${user.id}`);
      const data = await res.json();
      if (data.success) setLocalPlayers(data.players || []);
    };
    fetchPlayers();
    const timer = setInterval(fetchPlayers, 5000);
    return () => clearInterval(timer);
  }, [user.currentLocation, user.id]);

  // ================== 核心：年龄与区域拦截逻辑 ==================
  const handleLocationAction = async (action: 'enter' | 'explore' | 'stay') => {
    if (!selectedLocation) return;

    // 1. 未分化者限制 (年龄 < 16)
    if (isUndifferentiated && !SAFE_ZONES.includes(selectedLocation.id)) {
      if (action === 'enter') {
        showToast("【驱逐】这里太危险了，守卫拒绝了你的进入：“未分化的小鬼，回塔里去！”");
        return;
      }
      const headStrong = window.confirm("这里雾蒙蒙的，仿佛有迷雾笼罩，真的要去吗？（未分化者极易遇险）");
      if (!headStrong) return;
    }

    // 2. 16-19岁 跨阵营警告
    if (isStudentAge && action === 'enter' && !SAFE_ZONES.includes(selectedLocation.id)) {
      const choice = window.confirm("你还没有毕业，真的要加入其他阵营吗？\n【取消】去伦敦塔深造 (推荐)\n【确定】强行加入 (仅能获得最低职位)");
      if (!choice) {
        setActiveView('london_tower'); // 引导至伦敦塔
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

  return (
    <div className="min-h-screen bg-slate-950 flex relative overflow-hidden font-sans">
      {/* 左侧状态栏 */}
      <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col z-10">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden">
              {user.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-700 flex items-center justify-center text-white font-bold">{user.name[0]}</div>}
            </div>
            <div>
              <h2 className="text-sm font-black text-white">{user.name}</h2>
              <p className="text-[10px] text-sky-400 font-bold uppercase">{userAge < 16 ? '未分化者' : user.role}</p>
            </div>
          </div>
          <StatBar label="体力" current={user.hp || 100} max={user.maxHp || 100} color="bg-rose-500" />
          <StatBar label="精神" current={user.mp || 100} max={user.maxMp || 100} color="bg-sky-500" />
        </div>
        <div className="p-4 flex-1 space-y-4 overflow-y-auto">
          <InfoRow label="年龄" value={`${userAge} 岁`} color={userAge < 16 ? "text-amber-400" : "text-emerald-400"} />
          <InfoRow label="职业" value={user.job || '平民'} />
          <InfoRow label="阵营" value={user.faction || '无'} />
          <InfoRow label="金币" value={`${user.gold} G`} />
        </div>
        <button onClick={onLogout} className="m-4 py-3 bg-slate-800 text-slate-400 rounded-xl hover:bg-rose-900/20 hover:text-rose-400 transition-all font-bold text-xs flex items-center justify-center gap-2">
          <LogOut size={14}/> 登出
        </button>
      </div>

      {/* 大地图 */}
      <div className="flex-1 relative">
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #334155 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
        {LOCATIONS.map(loc => (
          <div 
            key={loc.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
            style={{ left: `${loc.x}%`, top: `${loc.y}%` }}
            onClick={() => setSelectedLocation(loc)}
          >
            <div className={`w-3 h-3 rounded-full border-2 transition-all ${user.currentLocation === loc.id ? 'bg-sky-400 border-white scale-150 shadow-[0_0_15px_#38bdf8]' : 'bg-slate-700 border-slate-500 group-hover:bg-white'}`}></div>
            <span className="absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-black text-slate-500 group-hover:text-white uppercase tracking-tighter transition-colors">{loc.name}</span>
          </div>
        ))}

        {/* 详情面板 */}
        <AnimatePresence>
          {selectedLocation && (
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="absolute bottom-8 left-8 right-8 bg-slate-900/90 backdrop-blur-xl border border-slate-700 p-6 rounded-3xl shadow-2xl z-20">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-black text-white mb-2">{selectedLocation.name}</h3>
                  <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                    {isUndifferentiated && !SAFE_ZONES.includes(selectedLocation.id) 
                      ? "这里雾蒙蒙的，仿佛有迷雾笼罩，真的要去吗？" 
                      : selectedLocation.description}
                  </p>
                  <div className="flex gap-3 mt-6">
                    <button onClick={() => handleLocationAction('enter')} className="px-5 py-2.5 bg-white text-slate-950 font-black rounded-xl text-xs hover:bg-slate-200">进入</button>
                    <button onClick={() => handleLocationAction('stay')} className="px-5 py-2.5 bg-slate-800 text-white font-black rounded-xl text-xs hover:bg-slate-700">驻足</button>
                  </div>
                </div>
                <button onClick={() => setSelectedLocation(null)}><X className="text-slate-500 hover:text-white" size={20}/></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 同图玩家 */}
        <div className="absolute top-8 right-8 w-48 space-y-2">
          {localPlayers.map(p => (
            <div key={p.id} onClick={() => setInteractTarget(p)} className="bg-slate-900/80 backdrop-blur border border-slate-800 p-2 rounded-xl flex items-center gap-3 cursor-pointer hover:border-sky-500 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-slate-800 overflow-hidden">{p.avatarUrl && <img src={p.avatarUrl} className="w-full h-full object-cover" />}</div>
              <span className="text-[10px] font-bold text-white truncate">{p.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 玩家互动弹窗 */}
      <AnimatePresence>
        {interactTarget && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-slate-900 border border-slate-700 p-8 rounded-[32px] w-full max-w-xs text-center relative">
              <button onClick={() => setInteractTarget(null)} className="absolute top-6 right-6 text-slate-500 hover:text-white"><X size={20}/></button>
              <div className="w-20 h-20 rounded-2xl bg-slate-800 mx-auto mb-4 border border-slate-600 overflow-hidden">
                {interactTarget.avatarUrl && <img src={interactTarget.avatarUrl} className="w-full h-full object-cover" />}
              </div>
              <h4 className="text-lg font-black text-white mb-1">{interactTarget.name}</h4>
              <p className="text-[10px] text-slate-500 mb-6 uppercase">{interactTarget.role}</p>
              
              <div className="grid grid-cols-1 gap-2">
                <button className="py-3 bg-sky-600 text-white rounded-xl text-xs font-black">发起对戏</button>
                <button className="py-3 bg-slate-800 text-white rounded-xl text-xs font-black">查看资料</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 子地图条件渲染 */}
      {activeView === 'tower_of_life' && <TowerOfLifeView user={user} onExit={() => setActiveView(null)} showToast={showToast} fetchGlobalData={fetchGlobalData}/>}
      {activeView === 'london_tower' && <LondonTowerView user={user} onExit={() => setActiveView(null)} showToast={showToast} fetchGlobalData={fetchGlobalData}/>}
      {activeView === 'sanctuary' && <SanctuaryView user={user} onExit={() => setActiveView(null)} showToast={showToast} fetchGlobalData={fetchGlobalData}/>}
      {/* 其他阵营视图请按照此格式补充 */}
    </div>
  );
}

function StatBar({ label, current, max, color }: any) {
  const pct = Math.min(100, Math.max(0, (current / max) * 100));
  return (
    <div className="mb-3">
      <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase mb-1"><span>{label}</span><span>{current}/{max}</span></div>
      <div className="h-1 bg-slate-800 rounded-full overflow-hidden"><div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }}></div></div>
    </div>
  );
}

function InfoRow({ label, value, color = "text-white" }: any) {
  return (
    <div className="flex justify-between items-center text-[10px]">
      <span className="font-bold text-slate-500 uppercase">{label}</span>
      <span className={`font-black ${color}`}>{value}</span>
    </div>
  );
}