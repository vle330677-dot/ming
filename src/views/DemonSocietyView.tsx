import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, X, Skull, Flame, 
  Ghost, Tent, Flag, Ban, Dices, Zap
} from 'lucide-react';
import { User } from '../types';

interface Props {
  user: User;
  onExit: () => void;
  showToast: (msg: string) => void;
  fetchGlobalData: () => void;
}

// 基于图片设定的建筑坐标
const buildings = [
  { id: 'hall', name: '自由大厅/集会所', x: 50, y: 35, icon: <Skull/>, desc: '加入狂欢，或者滚蛋。' },
  { id: 'casino', name: '狂欢赌场 / 黑市', x: 70, y: 60, icon: <Dices/>, desc: '【小游戏】玩命对赌，以及学习信息系技能。' },
  { id: 'strategy', name: '搞事据点', x: 30, y: 50, icon: <Flag/>, desc: '策划下一次针对守塔会的破坏行动。' },
  { id: 'cave', name: '幽魂休憩地', x: 80, y: 30, icon: <Ghost/>, desc: '鬼魂们的乐园，生人勿近（除非你不怕冷）。' },
];

// --- 职位与门槛常量 ---
const ROLES = {
  MASTER: '恶魔会会长',
  MEMBER: '恶魔会成员'
};

const RANK_SCORES: Record<string, number> = {
  '无': 0, 'F': 1, 'E': 2, 'D': 3, 'C': 4, 'C+': 5, 'B': 6, 'B+': 7, 
  'A': 8, 'A+': 9, 'S': 10, 'S+': 11, 'SS': 12, 'SS+': 13, 'SSS': 14
};

export function DemonSocietyView({ user, onExit, showToast, fetchGlobalData }: Props) {
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);
  const [isRioting, setIsRioting] = useState(false);
  
  // 赌场小游戏状态
  const [miniGame, setMiniGame] = useState({ active: false, clicks: 0, timeLeft: 10 });
  const [infoSkills, setInfoSkills] = useState<any[]>([]);

  // 身份判断
  const isDemon = Object.values(ROLES).includes(user.job || '');
  const getScore = (rank?: string) => RANK_SCORES[rank || '无'] || 0;

  useEffect(() => {
    if (selectedBuilding?.id === 'casino') fetchSkills();
  }, [selectedBuilding]);

  // --- 小游戏计时器 ---
  useEffect(() => {
    let timer: any;
    if (miniGame.active && miniGame.timeLeft > 0) {
      timer = setInterval(() => setMiniGame(prev => ({ ...prev, timeLeft: prev.timeLeft - 1 })), 1000);
    } else if (miniGame.active && miniGame.timeLeft <= 0) {
      handleMiniGameOver();
    }
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miniGame.active, miniGame.timeLeft]);

  // --- 核心逻辑：入职与资质校验 ---
  const checkQualifications = (targetRank: string) => {
    if ((user.age || 0) < 16) return false; // 必须满16岁
    
    const pScore = getScore(user.physicalRank);
    const mScore = getScore(user.mentalRank);
    
    if (targetRank === ROLES.MEMBER) return true; // 成员不限
    if (targetRank === ROLES.MASTER) return mScore >= RANK_SCORES['S+'] && pScore >= RANK_SCORES['S+'];
    return false;
  };

  const handleJoinOrPromote = async (targetRank: string) => {
    if (!checkQualifications(targetRank)) {
      return showToast(`资质不符！${targetRank} 需要更高的等级，或你未满16岁。`);
    }

    const res = await fetch('/api/tower/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, jobName: targetRank })
    });
    
    const data = await res.json();
    if (data.success) {
      showToast(`哈哈！欢迎加入狂欢，${targetRank}！去给守塔会那帮人一点颜色瞧瞧！`);
      fetchGlobalData();
    } else {
      showToast(data.message || '操作失败');
    }
  };

  // --- 核心逻辑：捣乱打工 ---
  const handleRiot = async () => {
    if ((user.workCount || 0) >= 3) return showToast("闹够了，稍微歇会儿，明天继续！");

    const res = await fetch('/api/tower/work', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ userId: user.id })
    });
    const data = await res.json();

    if (data.success) {
      setIsRioting(true);
      setTimeout(() => setIsRioting(false), 2000);

      const events = [
        "在守塔会的墙上画了个巨大的鬼脸。",
        "偷走了行政中心的一箱文件（虽然看不懂）。",
        "在广场上放了一把火，看着他们手忙脚乱。",
        "无意中帮命之塔清理了一只异鬼（虽然本意只是想炸山）。"
      ];
      const evt = events[Math.floor(Math.random() * events.length)];
      
      showToast(`${evt} (战利品 +${data.reward}G)`);
      fetchGlobalData();
    }
  };

  // --- 核心逻辑：赌场小游戏 ---
  const startMiniGame = () => {
    if ((user.trainCount || 0) >= 3) return showToast("今天输得够多了，精神已到极限！");
    setMiniGame({ active: true, clicks: 0, timeLeft: 10 });
  };

  const handleMiniGameOver = async () => {
    setMiniGame(prev => ({ ...prev, active: false }));
    if (miniGame.clicks >= 30) {
      const res = await fetch('/api/training/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      if (res.ok) {
        showToast(`对赌胜利！抗压能力提升，精神力得到锻炼。`);
        fetchGlobalData();
      }
    } else {
      showToast(`对赌失败，仅狂点 ${miniGame.clicks}/30 次，底裤都输光了！`);
    }
  };

  // --- 核心逻辑：信息系技能学习 ---
  const fetchSkills = async () => {
    const res = await fetch(`/api/skills/available/${user.id}`);
    const data = await res.json();
    if (data.success) setInfoSkills(data.skills.filter((s:any) => s.faction === '信息系'));
  };

  const learnSkill = async (skillName: string) => {
    const res = await fetch(`/api/users/${user.id}/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: skillName })
    });
    if (res.ok) showToast(`成功窃取情报网权限：${skillName}`);
  };

  // --- 鬼魂休息 ---
  const handleGhostRest = async () => {
    if (user.status !== 'ghost' && !isDemon) return showToast("阴气太重，你受不了的。");
    const res = await fetch('/api/tower/rest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) });
    if (res.ok) {
      showToast("在阴冷的洞穴里睡了一觉，精神百倍。");
      fetchGlobalData();
    }
  };

  return (
    <div className="absolute inset-0 bg-stone-900 overflow-hidden font-sans select-none text-stone-300">
      {/* 背景层 */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/恶魔会.jpg')" }}
      >
        {/* 混乱滤镜：红色调 */}
        <div className="absolute inset-0 bg-red-900/10 mix-blend-overlay pointer-events-none"></div>
      </div>

      {/* 顶部导航 */}
      <div className="absolute top-8 left-8 z-50">
        <button 
          onClick={onExit} 
          className="bg-black/80 text-red-500 border-2 border-red-800 px-6 py-2 rounded-sm font-black shadow-2xl flex items-center gap-2 hover:bg-red-900/20 transition-all -skew-x-12"
        >
          <ArrowLeft size={18}/> 溜了溜了
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
            {/* 涂鸦风格图标 */}
            <div className="w-16 h-16 bg-stone-800 border-4 border-stone-600 shadow-2xl flex items-center justify-center text-stone-400 group-hover:scale-110 group-hover:border-red-600 group-hover:text-red-500 transition-all rounded-full z-10 relative">
               {/* 装饰性涂鸦 */}
               <div className="absolute -top-2 -right-2 text-red-600 opacity-0 group-hover:opacity-100 font-black text-xs rotate-12 transition-opacity">XXX</div>
              {b.icon}
            </div>
            <div className="mt-2 bg-black/90 text-red-500 text-[10px] font-black px-2 py-1 transform -rotate-2 border border-red-900 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {b.name}
            </div>
          </div>
        </div>
      ))}

      {/* 搞事特效 */}
      <AnimatePresence>
        {isRioting && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
             <div className="text-center transform rotate-6">
                <Flame size={100} className="mx-auto text-red-600 animate-pulse"/>
                <h2 className="text-6xl font-black text-red-500 stroke-black drop-shadow-xl" style={{ WebkitTextStroke: '2px black' }}>
                  ANARCHY!!
                </h2>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 建筑详情弹窗 */}
      <AnimatePresence>
        {selectedBuilding && (
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            exit={{ scale: 0.95, opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <div className="bg-[#1c1917] w-full max-w-lg shadow-2xl relative border-4 border-red-900/50 p-2 transform -rotate-1 flex flex-col max-h-[85vh]">
              {/* 胶带效果 */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-32 h-6 bg-stone-300/20 rotate-1"></div>
              
              <button onClick={() => setSelectedBuilding(null)} className="absolute top-4 right-4 text-stone-500 hover:text-red-500 transition-colors z-20">
                <X size={28} strokeWidth={3}/>
              </button>

              <div className="p-8 bg-[url('https://www.transparenttextures.com/patterns/black-felt.png')] overflow-y-auto custom-scrollbar flex-1">
                <div className="flex items-center gap-5 mb-8 border-b-2 border-dashed border-stone-700 pb-6">
                  <div className="p-4 bg-stone-800 rounded-full text-red-600 border-2 border-stone-600">
                    {React.cloneElement(selectedBuilding.icon, { size: 36 })}
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-red-600 uppercase tracking-tighter" style={{ textShadow: '2px 2px 0px black' }}>
                      {selectedBuilding.name}
                    </h2>
                    <p className="text-xs text-stone-400 font-bold mt-1 font-mono">{selectedBuilding.desc}</p>
                  </div>
                </div>

                {/* === 集会所：入职/晋升 === */}
                {selectedBuilding.id === 'hall' && (
                  <div className="space-y-6">
                    {!isDemon ? (
                      <>
                        <div className="p-4 bg-red-950/30 border border-red-900 text-sm text-red-400 font-bold transform rotate-1 mb-6">
                          “受够了守塔会那帮伪君子？来这里！我们才不管什么规矩，只要你敢闹，我们就是兄弟！”
                        </div>
                        <div className="space-y-3">
                          <JoinBtn 
                            title="加入恶魔会 (成员)" sub="只要满16岁，够胆你就来" 
                            qualified={checkQualifications(ROLES.MEMBER)}
                            onClick={() => handleJoinOrPromote(ROLES.MEMBER)}
                          />
                          <JoinBtn 
                            title="篡位夺权 (会长)" sub="需 神S+ 体S+ 碾压一切" 
                            qualified={checkQualifications(ROLES.MASTER)}
                            onClick={() => handleJoinOrPromote(ROLES.MASTER)}
                          />
                        </div>
                      </>
                    ) : (
                      <div className="text-center p-6 border border-red-900/50 bg-black/40">
                         <h3 className="text-xl font-black text-stone-200 mb-2">当前身份：<span className="text-red-500">{user.job}</span></h3>
                         <p className="text-stone-500 text-sm mb-6">
                           今天打算去哪里捣乱？记得别被抓进监狱重造了。
                         </p>

                         {user.job === ROLES.MEMBER && (
                           <button onClick={() => handleJoinOrPromote(ROLES.MASTER)} className="w-full py-3 mb-4 bg-red-900/40 text-red-400 font-bold border border-red-800 hover:bg-red-800 hover:text-white transition-colors">
                             篡位夺取会长之位 (神S+ 体S+)
                           </button>
                         )}

                         <button 
                           onClick={() => { if(confirm("这就怂了？想退会？")) fetch('/api/tower/quit', { method:'POST', body:JSON.stringify({userId:user.id}), headers:{'Content-Type':'application/json'}}).then(() => {showToast("切，胆小鬼。"); fetchGlobalData(); setSelectedBuilding(null);}) }}
                           className="text-xs text-stone-600 hover:text-stone-400 underline"
                         >
                           我不玩了 / 退出恶魔会
                         </button>
                      </div>
                    )}
                  </div>
                )}

                {/* === 狂欢赌场 & 信息系技能 === */}
                {selectedBuilding.id === 'casino' && (
                  <div className="space-y-8">
                    <div className="text-center bg-stone-900/50 p-6 border border-stone-700 rounded-xl">
                      <Dices size={48} className="mx-auto text-yellow-600 mb-4"/>
                      <h3 className="text-xl font-black text-stone-200 mb-2">恶魔对赌 (精神特训)</h3>
                      <p className="text-xs text-stone-400 mb-6">
                        把灵魂放在赌桌上！在10秒内狂点30次摇骰子，撑过高压就能提升精神力！
                      </p>
                      
                      {!miniGame.active ? (
                        <button onClick={startMiniGame} className="w-full py-4 bg-yellow-700 text-stone-900 font-black text-lg hover:bg-yellow-600 transition-all skew-x-[-5deg]">
                          开始狂欢赌局！
                        </button>
                      ) : (
                        <div className="p-6 border-2 border-yellow-600 bg-yellow-900/20">
                          <p className="text-3xl font-black text-yellow-500 mb-2">{miniGame.timeLeft}s</p>
                          <p className="text-sm text-yellow-200 mb-4">已摇骰: {miniGame.clicks}/30 次</p>
                          <button 
                            onClick={() => setMiniGame(p => ({ ...p, clicks: p.clicks + 1 }))} 
                            className="w-full py-8 bg-yellow-600 active:bg-yellow-400 text-stone-900 font-black text-2xl shadow-[0_6px_0_rgb(161,98,7)] active:shadow-none active:translate-y-[6px] transition-all"
                          >
                            疯狂摇骰！
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="border-t-2 border-dashed border-stone-700 pt-6">
                      <h4 className="text-sm font-black text-sky-500 mb-4 flex items-center gap-2">
                        <Zap size={18}/> 黑市情报网 (信息系技能)
                      </h4>
                      <p className="text-xs text-stone-500 mb-4">恶魔会掌控着塔外最隐秘的情报网络，加入我们，你就能触及真相。</p>
                      {infoSkills.length === 0 ? (
                        <div className="text-center py-4 bg-stone-900/50 text-stone-600 font-bold text-xs border border-stone-800">当前没有流通的信息系技能书。</div>
                      ) : (
                        <div className="space-y-2">
                          {infoSkills.map(skill => (
                            <div key={skill.id} className="flex justify-between items-center p-4 bg-stone-800 border border-stone-700 hover:border-sky-900 transition-colors">
                              <div>
                                <p className="font-bold text-stone-200 text-sm">{skill.name}</p>
                                <p className="text-[10px] text-stone-500 mt-1">{skill.description}</p>
                              </div>
                              <button onClick={() => learnSkill(skill.name)} className="bg-sky-900/50 text-sky-400 border border-sky-800 px-4 py-1.5 text-xs font-bold hover:bg-sky-800 hover:text-white transition-colors">
                                窃取
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* === 策划室：搞事 === */}
                {selectedBuilding.id === 'strategy' && (
                  <div className="text-center space-y-4">
                    <div className="relative inline-block">
                       <Flag size={48} className="text-stone-500 mb-2"/>
                       <Ban size={24} className="absolute -bottom-1 -right-1 text-red-600"/>
                    </div>
                    <h3 className="text-lg font-black text-stone-200">推翻守塔会计划书 (草稿)</h3>
                    
                    {isDemon ? (
                      <button 
                        onClick={handleRiot}
                        disabled={(user.workCount || 0) >= 3}
                        className="w-full py-4 bg-stone-800 text-red-500 font-black hover:bg-stone-700 disabled:bg-stone-900 disabled:text-stone-700 transition-all border-2 border-stone-700 hover:border-red-600"
                      >
                        执行捣乱计划 (打工)
                      </button>
                    ) : (
                      <div className="text-stone-600 text-xs font-mono border border-stone-800 p-3 bg-black/50">
                        * 你看到一群人在地图上画满了叉，但他们不让你靠近。 *
                      </div>
                    )}
                  </div>
                )}

                {/* === 幽魂休憩地 === */}
                {selectedBuilding.id === 'cave' && (
                  <div className="space-y-4">
                    <p className="text-xs text-blue-300/80 text-center italic mb-6">
                      这里阴冷刺骨，但对于那些没有实体的灵魂来说，这里是唯一的家。
                    </p>
                    
                    {user.status === 'ghost' ? (
                       <button onClick={handleGhostRest} className="w-full py-5 bg-blue-900/40 text-blue-300 font-bold border border-blue-800 hover:bg-blue-900/60 transition-all text-lg tracking-widest">
                         吸收阴气 (鬼魂回复)
                       </button>
                    ) : (
                       <button onClick={handleGhostRest} className="w-full py-4 bg-stone-800 text-stone-400 font-bold hover:text-stone-200 transition-all border border-stone-700">
                         在此休息 (可能会感冒)
                       </button>
                    )}
                  </div>
                )}

              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// 子组件
function JoinBtn({ title, sub, qualified, onClick }: any) {
  return (
    <button 
      onClick={onClick} 
      disabled={!qualified}
      className={`border-2 p-4 text-left group transition-all relative overflow-hidden w-full
        ${qualified ? 'border-stone-600 hover:border-red-600 bg-stone-800 hover:bg-stone-900' : 'border-stone-800 bg-black/50 opacity-60 cursor-not-allowed'}
      `}
    >
      <div className={`font-black text-lg ${qualified ? 'text-stone-300 group-hover:text-red-500' : 'text-stone-600'}`}>{title}</div>
      <div className="text-xs text-stone-500 mt-1 font-mono">{sub}</div>
      {!qualified && <div className="absolute top-2 right-2 text-[10px] font-bold text-red-500 bg-red-950 px-2 py-0.5 border border-red-900 transform rotate-12">未达标</div>}
    </button>
  );
}