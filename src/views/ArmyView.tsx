import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, X, ShieldAlert, Target, 
  Warehouse, Medal, Skull, Swords, 
  Scale, Zap, RefreshCcw, Home
} from 'lucide-react';
import { User } from '../types';
import { TowerRoomView } from './TowerRoomView';

interface Props {
  user: User;
  onExit: () => void;
  showToast: (msg: string) => void;
  fetchGlobalData: () => void;
}

const buildings = [
  { id: 'hq', name: '军事指挥部', x: 50, y: 40, icon: <Medal/>, desc: '入伍、晋升考核与蒜鸟评理中心。' },
  { id: 'expedition', name: '域外战场', x: 82, y: 15, icon: <Skull/>, desc: '【日常】前往域外击倒魔物获得工资。' },
  { id: 'drill', name: '练兵场', x: 40, y: 65, icon: <Swords/>, desc: '【特训】小游戏提升肉体强度。' },
  { id: 'armory', name: '战技研究所', x: 75, y: 55, icon: <Zap/>, desc: '研习军队专属物理系战技。' },
  { id: 'barracks', name: '军营宿舍区', x: 20, y: 75, icon: <Warehouse/>, desc: '查看对应职位住所，拜访家园或回自己房间。' },
];

const RANKS = {
  SOLDIER: '军队士兵',
  LIEUTENANT: '军队尉官',
  COLONEL: '军队校官',
  GENERAL: '军队将官'
};

const RANK_SCORES: Record<string, number> = {
  '无': 0, 'F': 1, 'E': 2, 'D': 3, 'C': 4, 'C+': 5, 'B': 6, 'B+': 7, 
  'A': 8, 'A+': 9, 'S': 10, 'S+': 11, 'SS': 12, 'SS+': 13, 'SSS': 14
};

export function ArmyView({ user, onExit, showToast, fetchGlobalData }: Props) {
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);
  const [isPatrolling, setIsPatrolling] = useState(false);
  
  const [disputes, setDisputes] = useState<any[]>([]);
  const [physicalSkills, setPhysicalSkills] = useState<any[]>([]);
  const [miniGame, setMiniGame] = useState({ active: false, clicks: 0, timeLeft: 10 });
  
  // 宿舍拜访相关状态
  const [armyPlayers, setArmyPlayers] = useState<any[]>([]);
  const [targetHomeOwner, setTargetHomeOwner] = useState<User | null>(null);

  const isArmy = Object.values(RANKS).includes(user.job || '');
  const getScore = (rank?: string) => RANK_SCORES[rank || '无'] || 0;

  useEffect(() => {
    if (selectedBuilding?.id === 'hq' && isArmy) fetchDisputes();
    if (selectedBuilding?.id === 'armory') fetchSkills();
    if (selectedBuilding?.id === 'barracks') fetchArmyPlayers();
  }, [selectedBuilding, isArmy]);

  // --- 小游戏逻辑 ---
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

  // --- 获取所有军队玩家 ---
  const fetchArmyPlayers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.success) {
        const armyStaff = data.users.filter((u: any) => u.job && u.job.startsWith('军队'));
        setArmyPlayers(armyStaff);
      }
    } catch (e) {
      console.error("无法获取军队名单");
    }
  };

  // --- 资质校验 ---
  const checkQualifications = (targetRank: string) => {
    if ((user.age || 0) < 16) return false; // 年龄必须大于16岁
    const pScore = getScore(user.physicalRank);
    const mScore = getScore(user.mentalRank);
    
    if (targetRank === RANKS.SOLDIER) return pScore >= RANK_SCORES['B+'];
    if (targetRank === RANKS.LIEUTENANT) return mScore >= RANK_SCORES['A+'] && pScore >= RANK_SCORES['A+'];
    if (targetRank === RANKS.COLONEL) return mScore >= RANK_SCORES['S+'] && pScore >= RANK_SCORES['S+'];
    if (targetRank === RANKS.GENERAL) return mScore >= RANK_SCORES['SS+'] && pScore >= RANK_SCORES['SS+'];
    return false;
  };

 // 在 handleJoin 函数中替换原有逻辑
const handleJoinOrPromote = async (targetJobName: string) => {
  let jobName = targetJobName;
  const age = user.age || 0;

  try {
    // 1. 未分化者彻底拦截
    if (age < 16) {
      return showToast("未分化者禁止加入该阵营，请先前往圣所或伦敦塔。");
    }

    // 2. 16-19岁“未毕业”拦截与降级逻辑
    if (age >= 16 && age <= 19) {
      const confirmMessage =
        "你还没有毕业，真的要加入其他阵营吗？选择【否】将引导你前往伦敦塔成为学生，选择【是】你将只能担任该阵营的最低等级职业。";

      if (!window.confirm(confirmMessage)) {
        showToast("正在为你导航至伦敦塔...");
        onExit(); // 退出当前阵营界面
        return;
      } else {
        const lowestJob = "军队士兵";
        if (jobName !== lowestJob) {
          showToast(`受限于年龄，你被分配到了基层职位：${lowestJob}`);
          jobName = lowestJob;
        }
      }
    }

    // 3. 资质校验
    if (!checkQualifications(jobName)) {
      return showToast(`资质不符！加入 ${jobName} 需要满足相应的精神/肉体等级要求。`);
    }

    // 4. 发送请求
    const res = await fetch('/api/tower/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, jobName })
    });

    const data = await res.json();
    if (data.success) {
      showToast(`欢迎加入，${jobName}。以阵营之名，履行你的职责。`);
      fetchGlobalData();
    } else {
      showToast(data.message || '加入/晋升失败');
    }
  } catch (e) {
    console.error(e);
    showToast('加入/晋升请求失败，请稍后重试');
  }
};


  // 3. 19岁以上或已确认降级的 16-19岁玩家
  if (!checkQualifications(jobName)) {
    return showToast(`资质不符！加入 ${jobName} 需要满足相应的精神/肉体等级要求。`);
  }

  // 发送请求至后端
  const res = await fetch('/api/tower/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: user.id, jobName })
  });
  
  const data = await res.json();
  if (data.success) {
    showToast(`欢迎加入，${jobName}。以阵营之名，履行你的职责。`);
    fetchGlobalData();
  }
};
  // --- 蒜鸟评理 ---
  const fetchDisputes = async () => {
    const res = await fetch('/api/commissions');
    const data = await res.json();
    if (data.success) setDisputes(data.commissions.filter((c: any) => c.difficulty === 'DISPUTE'));
  };

  const acceptDispute = async (id: string) => {
    const res = await fetch(`/api/commissions/${id}/accept`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, userName: user.name })
    });
    if (res.ok) {
      showToast("已介入该对戏纠纷，请前往私聊窗口调解。");
      fetchDisputes();
    }
  };

  const releaseDispute = async (id: string) => {
    await fetch(`/api/commissions/${id}/release`, { method: 'PUT' });
    showToast("你已放弃介入，委托重新开放给其他军官。");
    fetchDisputes();
  };

  const resolveDispute = async (id: string) => {
    await fetch(`/api/commissions/${id}/resolve-dispute`, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ userId: user.id }) 
    });
    showToast("纠纷解决！战时津贴 +1000G 已入账。");
    fetchDisputes();
    fetchGlobalData();
  };

  // --- 练兵场小游戏 ---
  const startMiniGame = () => {
    if ((user.trainCount || 0) >= 3) return showToast("今日训练次数已耗尽，请注意肌肉劳损！");
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
        showToast(`训练达标！肉体强度得到锤炼。`); 
        fetchGlobalData(); 
      }
    } else {
      showToast(`训练失败，仅完成 ${miniGame.clicks}/30 次，没吃饭吗士兵？`);
    }
  };

  // --- 物理技能学习 ---
  const fetchSkills = async () => {
    const res = await fetch(`/api/skills/available/${user.id}`);
    const data = await res.json();
    if (data.success) setPhysicalSkills(data.skills.filter((s:any) => s.faction === '物理系'));
  };

  const learnSkill = async (skillName: string) => {
    const res = await fetch(`/api/users/${user.id}/skills`, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ name: skillName }) 
    });
    if (res.ok) showToast(`成功习得战技：${skillName}`);
  };

  return (
    <div className="absolute inset-0 bg-slate-900 overflow-hidden font-sans select-none">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/军队.jpg')" }}>
        <div className="absolute inset-0 bg-blue-900/30 mix-blend-overlay"></div>
      </div>

      <div className="absolute top-8 left-8 z-50">
        <button onClick={onExit} className="bg-slate-900/90 text-slate-200 border border-slate-600 px-6 py-2 rounded-sm font-black shadow-2xl flex items-center gap-2 hover:bg-slate-800 transition-all uppercase">
          <ArrowLeft size={18}/> 撤离防区
        </button>
      </div>

      {buildings.map(b => (
        <div key={b.id} className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 cursor-pointer group" style={{ left: `${b.x}%`, top: `${b.y}%` }} onClick={() => !isPatrolling && setSelectedBuilding(b)}>
          <div className="flex flex-col items-center">
            <div className="w-14 h-14 bg-slate-800 border-2 border-slate-400 shadow-2xl flex items-center justify-center text-slate-200 group-hover:scale-110 group-hover:bg-red-900 group-hover:border-red-500 transition-all rounded-sm z-10">
              {b.icon}
            </div>
            <div className="mt-2 bg-black/80 text-white text-[10px] font-bold px-2 py-1 rounded-sm border border-slate-600 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {b.name}
            </div>
          </div>
        </div>
      ))}

      {/* 域外战斗动画 */}
      <AnimatePresence>
        {isPatrolling && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 flex items-center justify-center bg-red-900/50 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4">
              <Target size={80} className="text-red-500 animate-ping"/>
              <h2 className="text-4xl font-black text-white uppercase tracking-widest">域外厮杀中</h2>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedBuilding && (
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="fixed inset-y-0 right-0 z-[80] w-full max-w-md bg-slate-900/95 border-l-4 border-slate-600 shadow-2xl backdrop-blur-md flex flex-col">
            <div className="p-8 border-b border-slate-700 bg-slate-800 flex justify-between items-start">
              <div>
                <h2 className="text-3xl font-black text-white uppercase">{selectedBuilding.name}</h2>
                <p className="text-sm text-slate-400 mt-1">{selectedBuilding.desc}</p>
              </div>
              <button onClick={() => setSelectedBuilding(null)} className="text-slate-500 hover:text-white"><X size={24}/></button>
            </div>

            <div className="flex-1 p-8 overflow-y-auto space-y-8">
              
              {/* === 指挥部 === */}
              {selectedBuilding.id === 'hq' && (
                <>
                  <div className="space-y-4">
                    <h3 className="text-white font-black flex items-center gap-2"><ShieldAlert size={18}/> 职务管理</h3>
                    {!isArmy ? (
                      <div className="space-y-3">
                        <p className="text-xs text-slate-400">命之塔的安宁由我们守护。根据你的个人档案（年龄: {user.age || '未知'}, 精神: {user.mentalRank || '无'}, 肉体: {user.physicalRank || '无'}），你可以申请以下职位：</p>
                        <div className="space-y-2">
                          {[
                            { rank: RANKS.GENERAL, req: '精神 SS+, 肉体 SS+' },
                            { rank: RANKS.COLONEL, req: '精神 S+, 肉体 S+' },
                            { rank: RANKS.LIEUTENANT, req: '精神 A+, 肉体 A+' },
                            { rank: RANKS.SOLDIER, req: '肉体 B+' }
                          ].map(job => {
                            const isQualified = checkQualifications(job.rank);
                            return (
                              <button 
                                key={job.rank}
                                onClick={() => handleJoinOrPromote(job.rank)}
                                disabled={!isQualified}
                                className={`w-full p-4 border flex justify-between items-center transition-all ${
                                  isQualified 
                                    ? 'bg-slate-800 border-emerald-500/50 hover:bg-slate-700 hover:border-emerald-500 cursor-pointer' 
                                    : 'bg-slate-900/50 border-slate-700 opacity-50 cursor-not-allowed'
                                }`}
                              >
                                <div className="flex flex-col items-start">
                                  <span className={`font-black text-sm ${isQualified ? 'text-emerald-400' : 'text-slate-500'}`}>{job.rank}</span>
                                  <span className="text-[10px] text-slate-400">要求: {job.req} (且满16岁)</span>
                                </div>
                                <div>
                                  {isQualified ? (
                                    <span className="text-xs font-bold text-white bg-emerald-600 px-3 py-1 rounded">点击就职</span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-800 px-2 py-1 rounded">资质不符</span>
                                  )}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="p-3 bg-slate-800 border border-slate-600 flex justify-between text-sm">
                          <span className="text-slate-400">当前军衔</span>
                          <span className="text-white font-bold">{user.job}</span>
                        </div>
                        {user.job !== RANKS.GENERAL && (
                          <div className="grid grid-cols-1 gap-2 mt-2">
                            {user.job === RANKS.SOLDIER && <button onClick={() => handleJoinOrPromote(RANKS.LIEUTENANT)} className="p-3 bg-slate-700 text-white font-bold text-xs hover:bg-slate-600">晋升尉官 (神A+ 体A+)</button>}
                            {user.job === RANKS.LIEUTENANT && <button onClick={() => handleJoinOrPromote(RANKS.COLONEL)} className="p-3 bg-slate-700 text-white font-bold text-xs hover:bg-slate-600">晋升校官 (神S+ 体S+)</button>}
                            {user.job === RANKS.COLONEL && <button onClick={() => handleJoinOrPromote(RANKS.GENERAL)} className="p-3 bg-slate-700 text-white font-bold text-xs hover:bg-slate-600">晋升将官 (神SS+ 体SS+)</button>}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {isArmy && (
                    <div className="space-y-3 pt-6 border-t border-slate-700">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-amber-500 font-black flex items-center gap-2"><Scale size={18}/> 蒜鸟评理中心</h3>
                        <button onClick={fetchDisputes} className="text-slate-400 hover:text-white"><RefreshCcw size={14}/></button>
                      </div>
                      {disputes.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center">当前军营内外太平，无纠纷上报。</p>
                      ) : (
                        disputes.map(d => (
                          <div key={d.id} className="p-4 bg-slate-800 border border-amber-900/50 rounded-lg">
                            <p className="font-bold text-slate-200 text-sm mb-1">{d.title}</p>
                            <p className="text-xs text-slate-400 mb-3">{d.content}</p>
                            
                            {d.acceptedById === user.id ? (
                              <div className="flex gap-2">
                                <button onClick={() => resolveDispute(d.id)} className="flex-1 py-2 bg-emerald-600 text-white text-xs font-black rounded hover:bg-emerald-500">纠纷已解决领赏金</button>
                                <button onClick={() => releaseDispute(d.id)} className="flex-1 py-2 bg-slate-600 text-white text-xs font-black rounded hover:bg-slate-500">我搞不定给别人吧</button>
                              </div>
                            ) : d.status === 'accepted' ? (
                              <p className="text-xs text-amber-600 font-bold text-center bg-amber-900/20 py-2">已被军官 {d.acceptedByName} 接手调解</p>
                            ) : (
                              <button onClick={() => acceptDispute(d.id)} className="w-full py-2 bg-amber-600 text-white text-xs font-black rounded hover:bg-amber-500">介入调解</button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}

              {/* === 域外战场 === */}
              {selectedBuilding.id === 'expedition' && (
                <div className="text-center space-y-6">
                  <Skull size={48} className="mx-auto text-red-500"/>
                  <p className="text-xs text-slate-400">每日前往域外击倒魔物，获取军队工资。危险，但值得。</p>
                  <button 
                    onClick={() => {
                      if ((user.workCount || 0) >= 3) return showToast("今日已无力再战！");
                      setIsPatrolling(true);
                      setTimeout(async () => {
                        setIsPatrolling(false);
                        const res = await fetch('/api/tower/work', { 
                          method: 'POST', 
                          headers: { 'Content-Type': 'application/json' }, 
                          body: JSON.stringify({ userId: user.id }) 
                        });
                        const data = await res.json();
                        if (data.success) { showToast(`击倒魔物！获得工资 ${data.reward}G`); fetchGlobalData(); }
                      }, 2500);
                    }}
                    className="w-full py-4 bg-red-700 text-white font-black tracking-widest hover:bg-red-600"
                  >
                    出发猎杀
                  </button>
                </div>
              )}

              {/* === 练兵场 === */}
              {selectedBuilding.id === 'drill' && (
                <div className="space-y-6 text-center">
                  <Swords size={48} className="mx-auto text-slate-400"/>
                  <p className="text-xs text-slate-400">通过极限负重训练提升肉体强度。需在10秒内狂点30次！</p>
                  
                  {!miniGame.active ? (
                    <button onClick={startMiniGame} className="w-full py-4 bg-slate-700 text-white font-black hover:bg-slate-600">
                      开始负重训练
                    </button>
                  ) : (
                    <div className="p-6 border-2 border-red-500 rounded-xl bg-red-900/20">
                      <p className="text-2xl font-black text-white mb-2">{miniGame.timeLeft}s</p>
                      <p className="text-sm text-red-300 mb-4">已完成: {miniGame.clicks}/30 次</p>
                      <button 
                        onClick={() => setMiniGame(p => ({ ...p, clicks: p.clicks + 1 }))} 
                        className="w-full py-8 bg-red-600 active:bg-red-400 text-white font-black text-xl rounded-lg shadow-[0_4px_0_rgb(153,27,27)] active:shadow-[0_0px_0_rgb(153,27,27)] active:translate-y-1 transition-all"
                      >
                        举起杠铃！
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* === 战技研究所 === */}
              {selectedBuilding.id === 'armory' && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-400 mb-4">军队专属战技（物理系），强化你的近战杀伤力。</p>
                  {physicalSkills.length === 0 ? (
                    <p className="text-sm text-slate-500">目前没有可供学习的物理战技。</p>
                  ) : (
                    physicalSkills.map(skill => (
                      <div key={skill.id} className="p-4 bg-slate-800 border border-slate-600 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-slate-200">{skill.name}</p>
                          <p className="text-[10px] text-slate-500">{skill.description}</p>
                        </div>
                        <button onClick={() => learnSkill(skill.name)} className="px-3 py-1 bg-sky-600 text-white text-xs font-bold rounded hover:bg-sky-500 transition-colors">
                          学习
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* === 军营宿舍区 === */}
              {selectedBuilding.id === 'barracks' && (
                <div className="space-y-6">
                  {isArmy && (
                    <button onClick={() => setTargetHomeOwner(user)} className="w-full py-4 mb-4 bg-sky-700 text-white font-black rounded-xl hover:bg-sky-600 flex items-center justify-center gap-2 shadow-lg">
                      <Home size={18}/> 回到我的房间
                    </button>
                  )}
                  
                  <div className="space-y-6">
                    {Object.values(RANKS).reverse().map(rank => {
                      const residents = armyPlayers.filter(p => p.job === rank);
                      return (
                        <div key={rank} className="border border-slate-700 bg-slate-800/50 rounded-xl overflow-hidden">
                          <div className="bg-slate-800 px-4 py-2 border-b border-slate-700">
                            <h4 className="text-xs font-black text-slate-300">{rank} 专属住所 ({residents.length}人)</h4>
                          </div>
                          <div className="p-4 grid grid-cols-4 gap-4">
                            {residents.map(p => (
                              <button key={p.id} onClick={() => setTargetHomeOwner(p)} className="flex flex-col items-center group">
                                <div className="w-12 h-12 rounded-full border-2 border-slate-600 overflow-hidden bg-slate-700 group-hover:border-amber-500 transition-colors mb-2">
                                  {p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover"/> : <span className="text-slate-400 font-black text-xs h-full flex items-center justify-center">{p.name[0]}</span>}
                                </div>
                                <span className="text-[10px] text-slate-300 font-bold truncate w-full text-center group-hover:text-amber-500">{p.name}</span>
                              </button>
                            ))}
                            {residents.length === 0 && <div className="col-span-4 text-center text-[10px] text-slate-500 py-2">暂无人员入住</div>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 挂载独立的房间系统 */}
      <AnimatePresence>
        {targetHomeOwner && (
          <TowerRoomView
            currentUser={user}
            homeOwner={targetHomeOwner}
            onClose={() => setTargetHomeOwner(null)}
            showToast={showToast}
            onUpdateData={fetchGlobalData}
          />
        )}
      </AnimatePresence>

    </div>
  );
}