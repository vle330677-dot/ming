import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '../types';
import { 
  ChevronRight, ChevronLeft, User as UserIcon, Zap, Heart, 
  Activity, Shield, Briefcase, Award, Skull, BookOpen, Trash2, ArrowUpCircle, Package
} from 'lucide-react';

interface Props {
  user: User;
  onLogout: () => void;
}

export function CharacterHUD({ user, onLogout }: Props) {
  // 默认展开
  const [isExpanded, setIsExpanded] = useState(true);
  const [skills, setSkills] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]); // 新增背包状态
  const containerRef = useRef(null);

  // 定期拉取技能或依靠事件触发更新
  const fetchSkills = async () => {
    try {
      const res = await fetch(`/api/users/${user.id}/skills`);
      const data = await res.json();
      if (data.success) setSkills(data.skills);
    } catch (e) {
      console.error("拉取技能失败", e);
    }
  };

  // 新增：拉取背包数据
  const fetchInventory = async () => {
    try {
      const res = await fetch(`/api/users/${user.id}/inventory`);
      const data = await res.json();
      if (data.success) setInventory(data.items);
    } catch (e) {
      console.error("拉取背包失败", e);
    }
  };

  useEffect(() => {
    fetchSkills();
    fetchInventory();
    const timer = setInterval(() => {
      fetchSkills();
      fetchInventory();
    }, 10000); // 每10秒自动刷新一次状态
    return () => clearInterval(timer);
  }, [user.id]);

  // 技能合成
  const handleMergeSkill = async (skillName: string) => {
    try {
      const res = await fetch(`/api/users/${user.id}/skills/merge`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ skillName })
      });
      const data = await res.json();
      alert(data.message);
      if (data.success) fetchSkills();
    } catch (e) {
      console.error(e);
    }
  };

  // 技能遗忘
  const handleForgetSkill = async (skillId: number) => {
    if (!confirm('遗忘后技能将永久消失，且不会返还技能书，确定吗？')) return;
    try {
      await fetch(`/api/users/${user.id}/skills/${skillId}`, { method: 'DELETE' });
      fetchSkills();
    } catch (e) {
      console.error(e);
    }
  };

  // 新增：使用/兑换物品
  const handleUseItem = async (inventoryId: number) => {
    try {
      const res = await fetch('/api/inventory/use', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, inventoryId })
      });
      const data = await res.json();
      alert(data.message);
      if (data.success) {
        fetchInventory(); // 刷新背包
        fetchSkills(); // 如果是技能书，刷新技能列表
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 计算狂暴值颜色
  const furyColor = (user.fury || 0) > 80 ? 'bg-red-600 animate-pulse' : 'bg-purple-600';
  
  // 年龄判断
  const userAge = user.age || 0;
  const isChild = userAge < 16;

  return (
    <>
      {/* 限制拖拽区域的隐形容器 (防止拖出屏幕) */}
      <div ref={containerRef} className="absolute inset-0 pointer-events-none z-50 overflow-hidden" />

      <motion.div
        drag
        dragConstraints={containerRef}
        dragMomentum={false} // 禁止惯性，防止甩飞
        initial={{ x: 20, y: 20 }}
        className="absolute z-50 pointer-events-auto"
      >
        <AnimatePresence mode="wait">
          {isExpanded ? (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, scale: 0.9, width: 60 }}
              animate={{ opacity: 1, scale: 1, width: 280 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
              {/* 头部：拖拽手柄 + 简略信息 */}
              <div className="p-4 bg-slate-800/50 border-b border-slate-700 cursor-move flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-700 overflow-hidden border border-slate-600">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white font-bold">{user.name[0]}</div>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-black text-white text-sm tracking-wide">{user.name}</span>
                    <span className={`text-[10px] font-bold uppercase ${isChild ? 'text-amber-400' : 'text-sky-400'}`}>
                       Lv.{user.age} {isChild ? '未分化' : user.role}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => setIsExpanded(false)}
                  className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>
              </div>

              {/* 详细数据区 */}
              <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                {/* 核心三维 */}
                <div className="space-y-2">
                  <StatBar icon={<Heart size={10} />} label="HP" current={user.hp || 100} max={user.maxHp || 100} color="bg-rose-500" />
                  <StatBar icon={<Zap size={10} />} label="MP" current={user.mp || 100} max={user.maxMp || 100} color="bg-sky-500" />
                  <StatBar icon={<Activity size={10} />} label="FURY" current={user.fury || 0} max={100} color={furyColor} />
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <InfoBox icon={<Briefcase size={12}/>} label="职业" value={user.job || '无'} />
                  <InfoBox icon={<Shield size={12}/>} label="派系" value={user.faction || '无'} />
                  <InfoBox icon={<Award size={12}/>} label="精神" value={user.mentalRank || '-'} highlight />
                  <InfoBox icon={<Award size={12}/>} label="肉体" value={user.physicalRank || '-'} highlight />
                </div>

                {/* 技能面板 */}
                <div className="pt-4 border-t border-slate-700/50">
                  <div className="text-[10px] text-slate-400 uppercase font-black flex justify-between items-center mb-2">
                    <span className="flex items-center gap-1"><BookOpen size={12} /> 已习得派系技能</span>
                  </div>
                  {skills.length === 0 ? (
                    <div className="text-[10px] text-slate-500 text-center py-2 italic border border-slate-800 rounded-lg">暂未领悟任何技能</div>
                  ) : (
                    <div className="space-y-2">
                      {skills.map(s => (
                        <div key={s.id} className="bg-slate-800/80 border border-slate-700 rounded-lg p-2 flex justify-between items-center">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-200">{s.name}</span>
                            <span className="text-[9px] font-black text-sky-400 uppercase mt-0.5">Lv.{s.level}</span>
                          </div>
                          <div className="flex gap-1">
                            <button 
                              onClick={() => handleMergeSkill(s.name)} 
                              className="p-1.5 bg-sky-900/30 text-sky-400 rounded-md hover:bg-sky-600 hover:text-white transition-colors" 
                              title="同等级融合升阶"
                            >
                              <ArrowUpCircle size={14} />
                            </button>
                            <button 
                              onClick={() => handleForgetSkill(s.id)} 
                              className="p-1.5 bg-rose-900/30 text-rose-400 rounded-md hover:bg-rose-600 hover:text-white transition-colors" 
                              title="遗忘删除"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ================= 新增：背包面板 ================= */}
                <div className="pt-4 border-t border-slate-700/50">
                  <div className="text-[10px] text-slate-400 uppercase font-black flex justify-between items-center mb-2">
                    <span className="flex items-center gap-1"><Package size={12} /> 我的背包</span>
                  </div>
                  {inventory.length === 0 ? (
                    <div className="text-[10px] text-slate-500 text-center py-2 italic border border-slate-800 rounded-lg">背包空空如也</div>
                  ) : (
                    <div className="space-y-2 pr-1">
                      {inventory.map(inv => (
                        <div key={inv.id} className="bg-slate-800/80 border border-slate-700 rounded-lg p-2 flex flex-col gap-2">
                          <div className="flex justify-between items-start">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-amber-100">{inv.name}</span>
                              <span className="text-[9px] text-slate-400 mt-0.5">拥有: x{inv.qty}</span>
                            </div>
                            <span className="text-[9px] px-1.5 py-0.5 bg-slate-700 border border-slate-600 text-slate-300 rounded font-black tracking-widest">{inv.itemType || '未知'}</span>
                          </div>
                          
                          {/* 根据不同类型的物品渲染对应颜色的操作按钮 */}
                          <div className="flex justify-end">
                            {inv.itemType === '回复道具' && (
                              <button onClick={() => handleUseItem(inv.id)} className="px-3 py-1 bg-emerald-600/20 text-emerald-400 border border-emerald-500/50 text-[10px] font-black rounded hover:bg-emerald-600 hover:text-white transition-colors">使用恢复</button>
                            )}
                            {inv.itemType === '技能书道具' && (
                              <button onClick={() => handleUseItem(inv.id)} className="px-3 py-1 bg-sky-600/20 text-sky-400 border border-sky-500/50 text-[10px] font-black rounded hover:bg-sky-600 hover:text-white transition-colors">研读领悟</button>
                            )}
                            {inv.itemType === '贵重物品' && (
                              <button onClick={() => handleUseItem(inv.id)} className="px-3 py-1 bg-amber-600/20 text-amber-400 border border-amber-500/50 text-[10px] font-black rounded hover:bg-amber-600 hover:text-white transition-colors">出售换金</button>
                            )}
                            {inv.itemType === '任务道具' && (
                              <span className="text-[9px] text-slate-500 italic">仅限委托任务提交</span>
                            )}
                            {!inv.itemType && (
                              <span className="text-[9px] text-slate-500 italic">无法使用</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* ================================================= */}

                <div className="pt-2 border-t border-slate-700">
                  <div className="flex justify-between items-center text-xs text-slate-400 mb-2">
                    <span>资产</span>
                    <span className="text-amber-400 font-mono font-black text-sm">{user.gold} G</span>
                  </div>
                </div>
                
                {/* 退出按钮 */}
                <button 
                  onClick={onLogout}
                  className="w-full py-2 bg-slate-800 text-slate-400 rounded-lg text-xs font-bold hover:bg-rose-900/30 hover:text-rose-400 transition-colors flex items-center justify-center gap-2"
                >
                  <Skull size={14}/> 断开连接
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="collapsed"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              onClick={() => setIsExpanded(true)}
              className="bg-slate-900/80 backdrop-blur-md border border-slate-600 rounded-full p-1.5 pr-4 flex items-center gap-3 cursor-pointer hover:bg-slate-800 hover:border-sky-500 shadow-xl transition-all group"
            >
              <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden border-2 border-slate-600 group-hover:border-sky-400 transition-colors">
                {user.avatarUrl ? (
                   <img src={user.avatarUrl} className="w-full h-full object-cover" />
                ) : (
                   <div className="w-full h-full flex items-center justify-center text-white font-bold">{user.name[0]}</div>
                )}
              </div>
              <div className="flex flex-col">
                 <span className="text-xs font-black text-white">{user.name}</span>
                 <div className="flex gap-1 h-1 w-12 mt-1">
                    <div className="h-full bg-rose-500 rounded-full" style={{width: `${(user.hp/user.maxHp)*100}%`}}></div>
                    <div className="h-full bg-sky-500 rounded-full" style={{width: `${(user.mp/user.maxMp)*100}%`}}></div>
                 </div>
              </div>
              <ChevronRight size={14} className="text-slate-500" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}

// 子组件
function StatBar({ icon, label, current, max, color }: any) {
  const pct = Math.min(100, Math.max(0, (current / max) * 100));
  return (
    <div>
      <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase mb-0.5 items-center">
        <span className="flex items-center gap-1">{icon} {label}</span>
        <span>{current}/{max}</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          className={`h-full ${color}`} 
        />
      </div>
    </div>
  );
}

function InfoBox({ icon, label, value, highlight }: any) {
  return (
    <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700 flex flex-col items-center justify-center text-center">
      <span className="text-[9px] text-slate-500 uppercase flex items-center gap-1 mb-1">{icon} {label}</span>
      <span className={`font-black ${highlight ? 'text-sky-400' : 'text-slate-200'} truncate w-full`}>{value}</span>
    </div>
  );
}