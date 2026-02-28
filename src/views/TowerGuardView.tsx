import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, X, Shield, Book, 
  Gavel, Lock, Sun, Eye, 
  Scroll, Cross, Heart, ShieldAlert
} from 'lucide-react';
import { User } from '../types';

interface Props {
  user: User;
  onExit: () => void;
  showToast: (msg: string) => void;
  fetchGlobalData: () => void;
}

// 建筑坐标
const buildings = [
  { id: 'hq', name: '守塔会总部', x: 60, y: 30, icon: <Shield/>, desc: '入职审批与高层政务中心。' },
  { id: 'church', name: '圣光大教堂', x: 25, y: 45, icon: <Sun/>, desc: '外人可进入冥想或赎罪。' },
  { id: 'prison', name: '异端重造所', x: 82, y: 45, icon: <Lock/>, desc: '关押罪犯与思想洗礼。' },
  { id: 'training', name: '惩戒训练场', x: 80, y: 70, icon: <Gavel/>, desc: '为了守护塔而锻炼身心。' },
];

// 职位常量
const ROLES = {
  CHIEF: '守塔会会长',
  MEMBER: '守塔会成员'
};

const RANK_SCORES: Record<string, number> = {
  '无': 0, 'F': 1, 'E': 2, 'D': 3, 'C': 4, 'C+': 5, 'B': 6, 'B+': 7, 
  'A': 8, 'A+': 9, 'S': 10, 'S+': 11, 'SS': 12, 'SS+': 13, 'SSS': 14
};

export function TowerGuardView({ user, onExit, showToast, fetchGlobalData }: Props) {
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);
  const [isWorking, setIsWorking] = useState(false);

  // 身份判断
  const isGuard = Object.values(ROLES).includes(user.job || '');
  const getScore = (rank?: string) => RANK_SCORES[rank || '无'] || 0;

  // --- 核心逻辑：入职与资质校验 ---
  const checkQualifications = (targetRank: string) => {
    if ((user.age || 0) < 16) return false; // 必须满16岁
    
    const pScore = getScore(user.physicalRank);
    const mScore = getScore(user.mentalRank);
    
    if (targetRank === ROLES.MEMBER) return mScore >= RANK_SCORES['C+'] && pScore >= RANK_SCORES['C+'];
    if (targetRank === ROLES.CHIEF) return mScore >= RANK_SCORES['S+'] && pScore >= RANK_SCORES['S+'];
    
    return false;
  };

  const handleJoin = async (jobName: string) => {
    if (user.job && user.job !== '无') return showToast(`加入前请先辞去当前职务：${user.job}`);

    if (!checkQualifications(jobName)) {
      return showToast(`资质不符！${jobName} 需要对应的神体双修等级，且必须年满16岁。`);
    }

    const res = await fetch('/api/tower/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, jobName })
    });
    
    const data = await res.json();
    if (data.success) {
      showToast(`宣誓完毕。以塔之名，欢迎加入我们，${jobName}。`);
      fetchGlobalData();
    } else {
      showToast(data.message || '入职失败');
    }
  };

  // --- 核心逻辑：冥想与赎罪 (教堂交互) ---
  const handleChurchAction = async (type: 'meditate' | 'atonement') => {
    setIsWorking(true);
    setTimeout(() => {
      setIsWorking(false);
      if (type === 'meditate') {
        // 模拟恢复 30% MP
        showToast("在圣光的沐浴下闭目冥想，MP 恢复了 30%。");
      } else if (type === 'atonement') {
        if (user.role === '哨兵') {
          showToast("聆听教诲进行赎罪，躁动的精神得到安抚，狂暴值降低了 10%。");
        } else {
          showToast("虔诚地赎罪，剥离了世俗的杂念，MP 恢复了 30%。");
        }
      }
      fetchGlobalData();
    }, 2000);
  };

  // --- 核心逻辑：打工 (维护治安) ---
  const handleWork = async () => {
    if (!isGuard) return showToast("平民禁止参与守塔会的内部执法行动。");
    if ((user.workCount || 0) >= 3) return showToast("今日巡逻任务已达上限，去休息吧。");

    const res = await fetch('/api/tower/work', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ userId: user.id })
    });
    const data = await res.json();

    if (data.success) {
      setIsWorking(true);
      setTimeout(() => setIsWorking(false), 2000);
      showToast(`成功镇压了一场异端骚乱！获取行动津贴 +${data.reward}G`);
      fetchGlobalData();
    }
  };

  return (
    <div className="absolute inset-0 bg-zinc-950 overflow-hidden font-sans select-none text-zinc-300">
      {/* 背景层 */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-50 grayscale-[50%]"
        style={{ backgroundImage: "url('/守塔会.jpg')" }}
      >
        <div className="absolute inset-0 bg-zinc-900/30 mix-blend-multiply pointer-events-none"></div>
      </div>

      {/* 顶部导航 */}
      <div className="absolute top-8 left-8 z-50">
        <button 
          onClick={onExit} 
          className="bg-zinc-900/90 text-yellow-500 border border-yellow-700/50 px-6 py-2 rounded-sm font-bold shadow-[0_0_15px_rgba(234,179,8,0.2)] flex items-center gap-2 hover:bg-zinc-800 transition-all uppercase tracking-widest"
        >
          <ArrowLeft size={18}/> 离开圣域
        </button>
      </div>

      {/* 建筑交互点 */}
      {buildings.map(b => (
        <div 
          key={b.id} 
          className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 cursor-pointer group"
          style={{ left: `${b.x}%`, top: `${b.y}%` }}
          onClick={() => setSelectedBuilding(b)}
        >
          <div className="flex flex-col items-center">
            {/* 庄严风格图标 */}
            <div className="w-16 h-16 bg-zinc-900/90 border-2 border-yellow-600/50 shadow-[0_0_20px_rgba(234,179,8,0.2)] flex items-center justify-center text-yellow-500 group-hover:scale-110 group-hover:bg-yellow-900/40 group-hover:text-yellow-400 group-hover:border-yellow-400 transition-all rounded-sm z-10 relative transform rotate-45">
              <div className="-rotate-45">
                {b.icon}
              </div>
            </div>
            <div className="mt-6 bg-zinc-950/90 text-yellow-500 text-[10px] font-bold px-3 py-1 border border-yellow-700/50 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {b.name}
            </div>
          </div>
        </div>
      ))}

      {/* 交互特效 */}
      <AnimatePresence>
        {isWorking && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-950/70 backdrop-blur-sm"
          >
            <div className="text-center">
               <Sun size={80} className="mx-auto text-yellow-500 animate-[spin_4s_linear_infinite] mb-6"/>
               <p className="text-yellow-400 text-2xl font-black tracking-[0.3em] font-serif">
                 MAY THE TOWER GUIDE US
               </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 建筑详情弹窗 */}
      <AnimatePresence>
        {selectedBuilding && (
          <motion.div 
            initial={{ opacity: 0, x: 100 }} 
            animate={{ opacity: 1, x: 0 }} 
            exit={{ opacity: 0, x: 100 }}
            className="fixed inset-y-0 right-0 z-[100] w-full max-w-md bg-zinc-900 shadow-2xl border-l-4 border-yellow-600 flex flex-col"
          >
            <div className="p-8 bg-zinc-950 border-b border-zinc-800 flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-zinc-900 rounded text-yellow-500 border border-yellow-700/50">
                  {React.cloneElement(selectedBuilding.icon, { size: 28 })}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-zinc-100 font-serif">{selectedBuilding.name}</h2>
                  <p className="text-xs text-yellow-600 font-bold mt-1 tracking-wider">{selectedBuilding.desc}</p>
                </div>
              </div>
              <button onClick={() => setSelectedBuilding(null)} className="text-zinc-500 hover:text-yellow-500 transition-colors">
                <X size={24}/>
              </button>
            </div>

            <div className="flex-1 p-8 overflow-y-auto bg-zinc-900 space-y-8">

              {/* === 总部：入职 === */}
              {selectedBuilding.id === 'hq' && (
                <div className="space-y-4">
                  {!isGuard ? (
                    <>
                      <div className="p-4 bg-zinc-800 border-l-4 border-yellow-600 text-xs text-zinc-400 mb-6 leading-relaxed">
                        “塔的意志高于一切。抛弃软弱，展现力量。”<br/><br/>
                        <span className="text-yellow-500 font-bold">警告：所有守卫必须年满16岁，且需经过严苛的神体双重测验。</span>
                      </div>
                      
                      <div className="space-y-3">
                         <JobBtn 
                           title="守塔会成员" sub="精神C+ 肉体C+ | 基层执法者" 
                           qualified={checkQualifications(ROLES.MEMBER)}
                           onClick={() => handleJoin(ROLES.MEMBER)}
                         />
                         <JobBtn 
                           title="守塔会会长" sub="神S+ 体S+ | 塔的最高代行者" 
                           qualified={checkQualifications(ROLES.CHIEF)}
                           onClick={() => handleJoin(ROLES.CHIEF)}
                         />
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-6 bg-zinc-800 border border-yellow-700/50 rounded-sm">
                      <ShieldAlert size={40} className="mx-auto text-yellow-600 mb-2"/>
                      <p className="text-xs text-yellow-700 font-bold tracking-widest mb-1 uppercase">Holy Vanguard</p>
                      <h3 className="text-2xl font-black text-yellow-500 mb-6">{user.job}</h3>
                      <button 
                        onClick={() => { if(confirm("你要背弃塔的荣耀吗？离职将注销你的守卫档案。")) fetch('/api/tower/quit', { method:'POST', body:JSON.stringify({userId:user.id}), headers:{'Content-Type':'application/json'}}).then(() => {showToast("已摘下徽章。"); fetchGlobalData(); setSelectedBuilding(null);}) }}
                        className="text-xs text-red-500 hover:text-red-400 underline"
                      >
                        摘下徽章并离职
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* === 大教堂：冥想与赎罪 === */}
              {selectedBuilding.id === 'church' && (
                <div className="space-y-8">
                  <div className="text-center bg-zinc-950 p-8 border border-zinc-800 rounded-t-full shadow-inner relative overflow-hidden">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-yellow-500/10 blur-3xl rounded-full pointer-events-none"></div>
                    
                    <Sun size={64} className="mx-auto text-yellow-500 mb-6 relative z-10"/>
                    <h3 className="text-xl font-bold text-zinc-200 mb-2 relative z-10 font-serif">圣光祈祷室</h3>
                    <p className="text-xs text-zinc-500 mb-8 relative z-10">
                      任何人皆可踏入此地，洗净灵魂的污浊与精神的疲惫。
                    </p>
                    
                    <div className="space-y-3 relative z-10">
                      <button 
                        onClick={() => handleChurchAction('meditate')}
                        className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-yellow-500 border border-zinc-700 hover:border-yellow-600 transition-colors font-bold tracking-widest flex justify-between px-6 items-center"
                      >
                        <span>闭目冥想</span>
                        <span className="text-[10px] bg-zinc-900 px-2 py-1 rounded">MP 恢复 30%</span>
                      </button>
                      
                      <button 
                        onClick={() => handleChurchAction('atonement')}
                        className="w-full py-4 bg-yellow-900/20 hover:bg-yellow-900/40 text-yellow-400 border border-yellow-800 hover:border-yellow-500 transition-colors font-bold tracking-widest flex justify-between px-6 items-center"
                      >
                        <span>虔诚赎罪</span>
                        <span className="text-[10px] bg-yellow-950 px-2 py-1 rounded text-yellow-500 border border-yellow-900">
                          {user.role === '哨兵' ? '狂暴值 -10%' : 'MP 恢复 30%'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* === 重造所：打工巡逻 === */}
              {selectedBuilding.id === 'prison' && (
                <div className="text-center space-y-4">
                  <div className="bg-zinc-950 p-8 border border-zinc-800 relative overflow-hidden">
                    <Lock size={48} className="mx-auto text-zinc-600 mb-4"/>
                    <h3 className="text-lg font-bold text-zinc-300">异端重造所</h3>
                    <p className="text-xs text-zinc-500 mt-2 mb-8">
                      “不要去听牢房里传来的惨叫，那只是灵魂在被净化时的杂音。”
                    </p>
                    
                    {isGuard ? (
                      <button 
                        onClick={handleWork}
                        disabled={(user.workCount || 0) >= 3}
                        className="w-full py-4 bg-zinc-800 text-zinc-300 font-black hover:bg-zinc-700 hover:text-white disabled:opacity-50 transition-colors border border-zinc-700"
                      >
                        巡逻牢房 / 镇压异端 ({3 - (user.workCount || 0)}/3)
                      </button>
                    ) : (
                      <div className="p-3 bg-red-950/30 border border-red-900 text-red-500 text-xs font-bold">
                        平民严禁靠近军事重地。
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* === 惩戒训练场 === */}
              {selectedBuilding.id === 'training' && (
                <div className="text-center">
                  <Gavel size={48} className="mx-auto text-zinc-500 mb-4"/>
                  <h3 className="text-lg font-bold text-zinc-300 mb-2">力量即是正义</h3>
                  <p className="text-sm text-zinc-500 mb-6">
                    除了依靠塔的庇佑，我们更相信手中的剑。
                  </p>
                  <div className="p-4 bg-zinc-800 text-xs text-zinc-400 border border-zinc-700 italic">
                    (体能小游戏模块待教官布置)
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// 子组件
function JobBtn({ title, sub, qualified, onClick }: any) {
  return (
    <button 
      onClick={onClick} 
      disabled={!qualified}
      className={`w-full p-4 flex flex-col items-start transition-all relative overflow-hidden text-left border
        ${qualified ? 'bg-zinc-800 border-zinc-600 hover:border-yellow-500 hover:bg-zinc-700' : 'bg-zinc-950 border-zinc-900 opacity-50 cursor-not-allowed'}
      `}
    >
      <span className={`font-black text-sm font-serif ${qualified ? 'text-yellow-500' : 'text-zinc-600'}`}>{title}</span>
      <span className="text-[10px] text-zinc-400 mt-1">{sub}</span>
      {!qualified && <span className="absolute top-4 right-4 text-[9px] font-bold text-red-600 bg-red-950/50 px-2 py-1 border border-red-900">阶级不符</span>}
    </button>
  );
}