import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '../types';
import { 
  ChevronRight, ChevronLeft, User as UserIcon, Zap, Heart, 
  Activity, Shield, Briefcase, Award, Skull 
} from 'lucide-react';

interface Props {
  user: User;
  onLogout: () => void;
}

export function CharacterHUD({ user, onLogout }: Props) {
  // 默认展开
  const [isExpanded, setIsExpanded] = useState(true);
  const containerRef = useRef(null);

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
              className="bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
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
              <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
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

                <div className="pt-2 border-t border-slate-700">
                  <div className="flex justify-between items-center text-xs text-slate-400 mb-2">
                    <span>资产</span>
                    <span className="text-amber-400 font-mono font-bold">{user.gold} G</span>
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