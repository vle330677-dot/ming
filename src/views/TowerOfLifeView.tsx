import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MiniGameView } from './MiniGameView';
import { ExtractorView } from './ExtractorView';
import { 
  ArrowLeft, X, Crown, Sparkles, 
  ArrowUp, Trophy, Megaphone, 
  BookOpen, Zap, Users, Gamepad2, PenTool
} from 'lucide-react';
import { User } from '../types';

interface Props {
  user: User;
  onExit: () => void;
  showToast: (msg: string) => void;
  fetchGlobalData: () => void;
}

// 塔内核心设施坐标
const buildings = [
  { id: 'eval', name: '命运评定所', x: 50, y: 75, icon: <Sparkles/>, desc: '未分化者 roll 点与获取身份的起点。' },
  { id: 'hq', name: '神谕大厅', x: 50, y: 35, icon: <Megaphone/>, desc: '世界公告栏与塔内职务分封。' },
  { id: 'library', name: '精神秘殿', x: 25, y: 55, icon: <BookOpen/>, desc: '研习【精神系】至高法门。' },
  { id: 'training', name: '精神力训练营', x: 75, y: 55, icon: <ArrowUp/>, desc: '磨炼精神意志的试炼场。' },
  { id: 'leaderboard', name: '荣光石碑', x: 50, y: 15, icon: <Trophy/>, desc: '镌刻着全塔最强者与灾厄先驱。' },
];

// 职位常量
const ROLES = {
  HOLY: '圣子/圣女',
  CANDIDATE: '候选者',
  ATTENDANT: '侍奉者',
  SERVANT: '仆从'
};

// 分数映射
const RANK_SCORES: Record<string, number> = {
  '无': 0, 'F': 1, 'E': 2, 'D': 3, 'C': 4, 'C+': 5, 'B': 6, 'B+': 7, 
  'A': 8, 'A+': 9, 'S': 10, 'S+': 11, 'SS': 12, 'SS+': 13, 'SSS': 14
};

// 各阵营最高职位标识（用于排行榜匹配）
const TOP_JOBS = [
  '圣子/圣女', '伦敦塔教师', '公会会长', '军队将官', 
  '西区市长', '东区市长', '守塔会会长', '恶魔会会长', 
  '灵异所所长', '观察者首领'
];

export function TowerOfLifeView({ user, onExit, showToast, fetchGlobalData }: Props) {
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);
  
  // 子系统弹窗状态
  const [showExtractor, setShowExtractor] = useState(false);
  const [showMiniGame, setShowMiniGame] = useState(false);
  
  // 数据状态
  const [mentalSkills, setMentalSkills] = useState<any[]>([]);
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [leaderboardTab, setLeaderboardTab] = useState<'faction' | 'designer' | 'player'>('faction');

  const isTowerStaff = Object.values(ROLES).includes(user.job || '');
  const getScore = (rank?: string) => RANK_SCORES[rank || '无'] || 0;

  useEffect(() => {
    if (selectedBuilding?.id === 'library') fetchSkills();
    if (selectedBuilding?.id === 'leaderboard') fetchAllUsers();
  }, [selectedBuilding]);

  // --- 核心逻辑：获取玩家列表 (用于排行榜) ---
  const fetchAllUsers = async () => {
    const res = await fetch('/api/admin/users');
    const data = await res.json();
    if (data.success) setAllPlayers(data.users || []);
  };

  // --- 核心逻辑：精神系技能学习 ---
  const fetchSkills = async () => {
    const res = await fetch(`/api/skills/available/${user.id}`);
    const data = await res.json();
    if (data.success) {
      setMentalSkills(data.skills.filter((s:any) => s.faction === '精神系'));
    }
  };

  const learnSkill = async (skillName: string) => {
    const res = await fetch(`/api/users/${user.id}/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: skillName })
    });
    if (res.ok) showToast(`在神谕的指引下，你领悟了：${skillName}`);
  };

  // --- 核心逻辑：入职与资质校验 ---
  const checkQualifications = (targetRank: string) => {
    if ((user.age || 0) < 16) return false; // 任职须满16岁
    const mScore = getScore(user.mentalRank);
    
    // 命之塔只看精神力，肉体不限
    if (targetRank === ROLES.SERVANT) return mScore >= RANK_SCORES['C+'];
    if (targetRank === ROLES.ATTENDANT) return mScore >= RANK_SCORES['B+'];
    if (targetRank === ROLES.CANDIDATE) return mScore >= RANK_SCORES['S+'];
    if (targetRank === ROLES.HOLY) return mScore >= RANK_SCORES['SS+'];
    
    return false;
  };

  const handleJoin = async (jobName: string) => {
    if (user.job && user.job !== '无') return showToast(`侍奉神明需要纯粹，请先辞去当前职务：${user.job}`);

    if (!checkQualifications(jobName)) {
      return showToast(`资质不符！${jobName} 需要极高的精神力等级。`);
    }

    const res = await fetch('/api/tower/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, jobName })
    });
    
    const data = await res.json();
    if (data.success) {
      showToast(`神明注视着你。欢迎就职：${jobName}。`);
      fetchGlobalData();
    } else {
      showToast(data.message || '操作失败');
    }
  };

  const handleExtractionComplete = (view: any) => {
    setShowExtractor(false);
    fetchGlobalData();
    showToast("身份抽取完毕！你的命运已在此定格。");
  };

  const handleGameComplete = (newProgress: number) => {
    setShowMiniGame(false);
    showToast(`训练完成！精神进度提升至 ${newProgress}%`);
    fetchGlobalData();
  };

  return (
    <div className="absolute inset-0 bg-slate-900 overflow-hidden font-sans select-none text-slate-200">
      {/* 背景层 */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-80"
        style={{ backgroundImage: "url('/命之塔.jpg')" }}
      >
        <div className="absolute inset-0 bg-yellow-900/20 mix-blend-overlay pointer-events-none"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none"></div>
      </div>

      {/* 顶部导航 */}
      <div className="absolute top-8 left-8 z-50">
        <button 
          onClick={onExit} 
          className="bg-white/10 backdrop-blur-md text-amber-400 border border-amber-600/50 px-6 py-2 rounded-full font-bold shadow-[0_0_15px_rgba(245,158,11,0.2)] flex items-center gap-2 hover:bg-white/20 transition-all"
        >
          <ArrowLeft size={18}/> 离开核心区
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
            <div className="w-16 h-16 bg-black/60 backdrop-blur-md border-2 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.3)] flex items-center justify-center text-amber-400 group-hover:scale-110 group-hover:bg-amber-900/40 group-hover:text-amber-300 group-hover:border-amber-400 transition-all rounded-full z-10 relative">
              {b.icon}
            </div>
            <div className="mt-2 bg-black/80 text-amber-400 text-[10px] font-bold px-3 py-1 border border-amber-600/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {b.name}
            </div>
          </div>
        </div>
      ))}

      {/* 建筑详情弹窗 */}
      <AnimatePresence>
        {selectedBuilding && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
          >
            <div className="bg-slate-900 w-full max-w-2xl shadow-2xl border border-amber-700/50 rounded-[32px] flex flex-col max-h-[85vh] overflow-hidden">
              <div className="p-8 bg-black/40 border-b border-amber-900/30 flex justify-between items-start relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-50"></div>
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-amber-950/50 rounded-full text-amber-500 border border-amber-700/50 shadow-inner">
                    {React.cloneElement(selectedBuilding.icon, { size: 32 })}
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-200 to-amber-600 tracking-wider font-serif">{selectedBuilding.name}</h2>
                    <p className="text-xs text-amber-600/80 font-bold mt-1 tracking-widest uppercase">{selectedBuilding.desc}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedBuilding(null)} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-amber-500 transition-colors">
                  <X size={20}/>
                </button>
              </div>

              <div className="flex-1 p-8 overflow-y-auto bg-slate-900/50 space-y-8 custom-scrollbar">

                {/* === 命运评定所 (未分化者抽卡) === */}
                {selectedBuilding.id === 'eval' && (
                  <div className="text-center space-y-6">
                    <Sparkles size={64} className="mx-auto text-sky-400 animate-pulse mb-4"/>
                    <h3 className="text-xl font-bold text-slate-200">命运纺车</h3>
                    <p className="text-sm text-slate-400 leading-relaxed max-w-md mx-auto">
                      所有未分化者在此聆听神谕，决定他们将成为哨兵、向导，还是平庸的普通人。
                    </p>
                    
                    {user.status === 'pending' || !user.role || user.role === '未分化' ? (
                      <button 
                        onClick={() => setShowExtractor(true)}
                        className="w-full py-5 bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-black hover:from-sky-500 hover:to-indigo-500 transition-all rounded-2xl shadow-[0_0_20px_rgba(56,189,248,0.4)] text-lg tracking-widest"
                      >
                        启动分化仪式 (Roll 点)
                      </button>
                    ) : (
                      <div className="p-4 bg-slate-800 border border-slate-700 text-slate-400 text-sm font-bold rounded-xl">
                        你已完成了分化仪式。你的身份是：<span className="text-amber-500">{user.role}</span>。
                      </div>
                    )}
                  </div>
                )}

                {/* === 神谕大厅 (公告与职务) === */}
                {selectedBuilding.id === 'hq' && (
                  <div className="space-y-8">
                    {/* 系统公告板 */}
                    <div className="bg-amber-950/30 border border-amber-900/50 p-6 rounded-2xl">
                      <h4 className="text-amber-500 font-black flex items-center gap-2 mb-4">
                        <Megaphone size={18}/> 世界系统公告
                      </h4>
                      <div className="space-y-3 text-sm text-amber-100/80 font-serif">
                        <p>1. 欢迎来到命之塔。这里是世界的中心，一切秩序的源头。</p>
                        <p>2. 各地市长竞选火热进行中，繁荣度将决定城市的财富归属。</p>
                        <p>3. 灾厄游戏副本暂未开启，请玩家抓紧提升神体双修等级。</p>
                      </div>
                    </div>

                    {/* 塔内职务分封 */}
                    <div>
                      <h4 className="text-amber-500 font-black mb-4 flex items-center gap-2"><Crown size={18}/> 神职分封</h4>
                      {!isTowerStaff ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                           <TowerJobBtn title="仆从" sub="精神C+ | 侍奉杂役" qualified={checkQualifications(ROLES.SERVANT)} onClick={() => handleJoin(ROLES.SERVANT)}/>
                           <TowerJobBtn title="侍奉者" sub="精神B+ | 神明近侍" qualified={checkQualifications(ROLES.ATTENDANT)} onClick={() => handleJoin(ROLES.ATTENDANT)}/>
                           <TowerJobBtn title="候选者" sub="精神S+ | 预备神使" qualified={checkQualifications(ROLES.CANDIDATE)} onClick={() => handleJoin(ROLES.CANDIDATE)}/>
                           <TowerJobBtn title="圣子 / 圣女" sub="精神SS+ | 塔之主宰" qualified={checkQualifications(ROLES.HOLY)} onClick={() => handleJoin(ROLES.HOLY)}/>
                        </div>
                      ) : (
                        <div className="text-center p-6 bg-slate-800 border border-amber-900/50 rounded-2xl">
                          <Crown size={32} className="mx-auto text-amber-500 mb-2"/>
                          <p className="text-xs text-slate-500 mb-2">你在塔内的尊讳</p>
                          <p className="text-2xl font-black text-amber-400 mb-6">{user.job}</p>
                          <button 
                            onClick={() => { if(confirm("卸下神职将失去光环，确定吗？")) fetch('/api/tower/quit', { method:'POST', body:JSON.stringify({userId:user.id}), headers:{'Content-Type':'application/json'}}).then(() => {showToast("已卸任。"); fetchGlobalData(); setSelectedBuilding(null);}) }}
                            className="text-xs text-rose-500 hover:text-rose-400 underline"
                          >
                            卸下神职 (离职)
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* === 精神秘殿 (精神系技能) === */}
                {selectedBuilding.id === 'library' && (
                  <div className="space-y-6">
                    <div className="text-center bg-indigo-950/40 p-6 rounded-2xl border border-indigo-900/50 mb-6">
                      <BookOpen size={48} className="mx-auto text-indigo-400 mb-2"/>
                      <h3 className="text-xl font-bold text-indigo-200">精神海的具象化</h3>
                      <p className="text-xs text-indigo-400/80 mt-2">在这里，你可以接触到控制心智与灵魂的最强法门。</p>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-black text-indigo-300 mb-4 flex items-center gap-2">
                        <Zap size={18}/> 精神系专属技能
                      </h4>
                      {mentalSkills.length === 0 ? (
                        <div className="text-center py-4 bg-slate-800 text-slate-500 font-bold text-xs rounded-xl">秘殿暂未收录更多精神系奥义。</div>
                      ) : (
                        <div className="space-y-3">
                          {mentalSkills.map(skill => (
                            <div key={skill.id} className="flex justify-between items-center p-4 bg-slate-800 border border-slate-700 rounded-xl hover:border-indigo-500 transition-colors">
                              <div>
                                <p className="font-bold text-indigo-100 text-sm">{skill.name}</p>
                                <p className="text-[10px] text-slate-400 mt-1">{skill.description}</p>
                              </div>
                              <button onClick={() => learnSkill(skill.name)} className="bg-indigo-900/50 text-indigo-300 border border-indigo-700 px-4 py-1.5 text-xs font-bold hover:bg-indigo-600 hover:text-white transition-colors rounded-lg">
                                研习
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* === 训练场 (游戏入口) === */}
                {selectedBuilding.id === 'training' && (
                  <div className="text-center space-y-6">
                    <ArrowUp size={64} className="mx-auto text-emerald-500 mb-4"/>
                    <h3 className="text-xl font-bold text-slate-200">精神力试炼空间</h3>
                    <p className="text-sm text-slate-400 mb-8 max-w-sm mx-auto">
                      通过模拟对抗环境，强化你的精神韧性。<br/>（每日限3次）
                    </p>
                    <button 
                      onClick={() => setShowMiniGame(true)}
                      className="w-full py-5 bg-emerald-600 text-white font-black hover:bg-emerald-500 transition-all rounded-2xl shadow-lg"
                    >
                      进入特训空间
                    </button>
                  </div>
                )}

                {/* === 荣光石碑 (排行榜) === */}
                {selectedBuilding.id === 'leaderboard' && (
                  <div className="space-y-6">
                    <div className="flex bg-slate-800 rounded-xl p-1 border border-slate-700">
                      <BoardTab active={leaderboardTab==='faction'} onClick={() => setLeaderboardTab('faction')} icon={<Users size={14}/>} label="阵营巅峰" />
                      <BoardTab active={leaderboardTab==='designer'} onClick={() => setLeaderboardTab('designer')} icon={<PenTool size={14}/>} label="灾厄设计者" />
                      <BoardTab active={leaderboardTab==='player'} onClick={() => setLeaderboardTab('player')} icon={<Gamepad2 size={14}/>} label="灾厄生还者" />
                    </div>

                    <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 min-h-[300px]">
                      {/* 1. 各个阵营目前最高位者的名字 */}
                      {leaderboardTab === 'faction' && (
                        <div className="space-y-2">
                          {TOP_JOBS.map((topJob, idx) => {
                            // 查找持有该最高职位的玩家，如果有多个取第一个
                            const leader = allPlayers.find(p => p.job === topJob);
                            return (
                              <div key={idx} className="flex justify-between items-center p-3 border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                                <span className="text-sm font-bold text-amber-500">{topJob}</span>
                                {leader ? (
                                  <span className="text-sm font-black text-white">{leader.name}</span>
                                ) : (
                                  <span className="text-xs text-slate-500 italic">虚位以待</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* 2. 灾厄游戏设计者排行 (占位) */}
                      {leaderboardTab === 'designer' && (
                        <div className="text-center py-20 opacity-50">
                          <PenTool size={48} className="mx-auto mb-4 text-slate-500"/>
                          <p className="text-sm text-slate-400">灾厄纪元尚未降临，设计者榜单暂无数据。</p>
                        </div>
                      )}

                      {/* 3. 灾厄游戏玩家排行 (占位) */}
                      {leaderboardTab === 'player' && (
                        <div className="text-center py-20 opacity-50">
                          <Gamepad2 size={48} className="mx-auto mb-4 text-slate-500"/>
                          <p className="text-sm text-slate-400">尚未有人在灾厄游戏中获取生存积分。</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 抽取器弹窗 (全屏覆盖) */}
      {showExtractor && (
        <div className="fixed inset-0 z-[200] bg-white overflow-y-auto">
          <div className="absolute top-4 left-4 z-50">
             <button onClick={() => setShowExtractor(false)} className="px-4 py-2 bg-slate-100 rounded-lg text-slate-600 font-bold hover:bg-slate-200">
               &lt; 中断仪式返回
             </button>
          </div>
          <ExtractorView userName={user.name} onNavigate={handleExtractionComplete} />
        </div>
      )}

      {/* 精神力训练小游戏 */}
      {showMiniGame && (
        <MiniGameView 
          rank={user.mentalRank || 'D'}
          onComplete={handleGameComplete}
          onClose={() => setShowMiniGame(false)}
        />
      )}
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #78350f; border-radius: 20px; }
      `}</style>
    </div>
  );
}

// 辅助组件
function TowerJobBtn({ title, sub, qualified, onClick }: any) {
  return (
    <button 
      onClick={onClick} 
      disabled={!qualified}
      className={`w-full p-4 flex flex-col items-start transition-all relative overflow-hidden text-left rounded-xl border
        ${qualified ? 'bg-slate-800 border-amber-700/50 hover:border-amber-400 hover:bg-slate-700' : 'bg-slate-900 border-slate-800 opacity-50 cursor-not-allowed'}
      `}
    >
      <span className={`font-black text-sm font-serif ${qualified ? 'text-amber-400' : 'text-slate-500'}`}>{title}</span>
      <span className="text-[10px] text-slate-400 mt-1">{sub}</span>
      {!qualified && <span className="absolute top-4 right-4 text-[9px] font-bold text-red-600 bg-red-950/50 px-2 py-1 border border-red-900 rounded">要求未达</span>}
    </button>
  );
}

function BoardTab({ active, onClick, icon, label }: any) {
  return (
    <button 
      onClick={onClick}
      className={`flex-1 py-2.5 flex items-center justify-center gap-2 rounded-lg transition-colors text-xs font-bold
        ${active ? 'bg-slate-700 text-amber-400 shadow-sm' : 'bg-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}
      `}
    >
      {icon} {label}
    </button>
  );
}