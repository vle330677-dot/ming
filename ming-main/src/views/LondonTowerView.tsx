import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, X, BookOpen, GraduationCap,
  Activity, Shield, Search,
  CheckCircle, FileText, AlertCircle, Sparkles, Zap
} from 'lucide-react';
import { User } from '../types';

interface Props {
  user: User;
  onExit: () => void;
  showToast: (msg: string) => void;
  fetchGlobalData: () => void;
}

const buildings = [
  { id: 'hq', name: '中央行政枢纽', x: 50, y: 30, icon: <Shield />, desc: '伦敦塔的权力中心与教职员工入职处。' },
  { id: 'academy', name: '白塔学院', x: 25, y: 60, icon: <GraduationCap />, desc: '哨兵与向导的最高学府。提供每日技能进修。' },
  { id: 'eval', name: '精神评定中心', x: 75, y: 60, icon: <Activity />, desc: '监测狂暴值与测算哨向契合度的精密实验室。' }
];

const ROLES = {
  TEACHER: '伦敦塔教师',
  STAFF: '伦敦塔职工',
  STUDENT: '伦敦塔学员'
};

// ✅ 修复：补上 D+
const RANK_SCORES: Record<string, number> = {
  无: 0, F: 1, E: 2, D: 3, 'D+': 3.5, C: 4, 'C+': 5, B: 6, 'B+': 7,
  A: 8, 'A+': 9, S: 10, 'S+': 11, SS: 12, 'SS+': 13, SSS: 14
};

export function LondonTowerView({ user, onExit, showToast, fetchGlobalData }: Props) {
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  const [targetUserName, setTargetUserName] = useState('');
  const [compatibility, setCompatibility] = useState<number | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [drawCount, setDrawCount] = useState(0);

  const isTowerMember = Object.values(ROLES).includes(user.job || '');
  const getScore = (rank?: string) => RANK_SCORES[rank || '无'] || 0;

  useEffect(() => {
    if (selectedBuilding?.id === 'eval') {
      fetch('/api/admin/users')
        .then((r) => r.json())
        .then((d) => { if (d.success) setAllUsers(d.users || []); });
    }
  }, [selectedBuilding]);

  const checkQualifications = (targetRank: string) => {
    const age = user.age || 0;
    const mScore = getScore(user.mentalRank);
    const pScore = getScore(user.physicalRank);

    if (targetRank === ROLES.STUDENT) return age >= 16 && age <= 19;
    if (age < 16) return false;
    if (targetRank === ROLES.STAFF) return mScore >= RANK_SCORES['D+'] && pScore >= RANK_SCORES['D+'];
    if (targetRank === ROLES.TEACHER) return mScore >= RANK_SCORES['B+'] && pScore >= RANK_SCORES['D+'];
    return false;
  };

  const handleJoin = async (jobName: string) => {
    if (user.job && user.job !== '无') return showToast(`请先辞去当前职务：${user.job}`);

    if (!checkQualifications(jobName)) {
      if (jobName === ROLES.STUDENT) return showToast('伦敦塔学员仅招收 16 - 19 岁的未毕业人员。');
      return showToast(`资质不符！你需要更高的神体等级，且必须年满 16 岁。`);
    }

    const res = await fetch('/api/tower/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, jobName })
    });

    const data = await res.json();
    if (data.success) {
      showToast(`手续办理完成。欢迎加入伦敦塔，${jobName}。`);
      fetchGlobalData();
    } else {
      showToast(data.message || '入职失败');
    }
  };

  const calculateCompatibility = () => {
    if (!targetUserName.trim()) return showToast('请输入目标玩家的姓名。');
    if (targetUserName === user.name) return showToast('不能与自己测算契合度。');

    const targetUser = allUsers.find((u) => u.name === targetUserName);
    if (!targetUser) return showToast('未在世界数据库中查找到该玩家。');

    const validRoles = ['哨兵', '向导'];
    if (!validRoles.includes(user.role || '') && !validRoles.includes(targetUser.role || '')) {
      return showToast('至少需要一方为哨兵或向导才能进行精神链接测算。');
    }

    setIsCalculating(true);
    setCompatibility(null);

    setTimeout(() => {
      const str = user.name < targetUser.name ? user.name + targetUser.name : targetUser.name + user.name;
      let hash = 0;
      for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
      const result = Math.abs(hash % 101);

      setCompatibility(result);
      setIsCalculating(false);
      showToast(`测算完成：与 ${targetUser.name} 的契合度为 ${result}%`);
    }, 1200);
  };

  const drawSkillBook = async () => {
    if (!isTowerMember) return showToast('非伦敦塔在编人员，无法动用学院资源。');
    if (drawCount >= 3) return showToast('今日学院进修额度已耗尽 (3/3)。');

    setDrawCount((prev) => prev + 1);

    const factions = ['物理系', '元素系', '精神系', '感知系', '信息系', '治疗系', '强化系', '炼金系'];
    const randomFaction = factions[Math.floor(Math.random() * factions.length)];
    const bookName = `[技能书] ${randomFaction}·中阶教材`;

    await fetch(`/api/users/${user.id}/inventory/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: bookName, qty: 1 })
    });

    showToast(`【进修成功】获得：${bookName}`);
    fetchGlobalData();
  };

  return (
    <div className="absolute inset-0 bg-slate-50 overflow-hidden font-sans select-none text-slate-800">
      <div className="absolute inset-0 z-0">
        <img src="/伦敦塔.jpg" className="w-full h-full object-cover opacity-60 contrast-75 brightness-125" alt="London Tower" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-slate-50/50 to-slate-100/90 mix-blend-overlay pointer-events-none" />
        <div className="absolute inset-0 bg-white/30 backdrop-blur-[1px] pointer-events-none" />
      </div>

      <div className="absolute top-6 left-6 z-50">
        <button onClick={onExit} className="bg-white/90 backdrop-blur-md text-sky-700 border border-sky-200 px-5 py-2.5 rounded-xl font-bold shadow-lg flex items-center gap-2 hover:bg-sky-50 transition-all uppercase tracking-widest active:scale-95">
          <ArrowLeft size={18} /> <span className="hidden md:inline">离开伦敦塔</span>
        </button>
      </div>

      <div className="relative z-10 w-full h-full">
        {buildings.map((b) => (
          <div
            key={b.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 cursor-pointer group touch-manipulation"
            style={{ left: `${b.x}%`, top: `${b.y}%` }}
            onClick={() => setSelectedBuilding(b)}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-white/80 backdrop-blur-md border-4 border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex items-center justify-center text-sky-600 group-hover:scale-110 group-hover:bg-sky-500 group-hover:text-white group-hover:border-sky-300 transition-all rounded-3xl z-10 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-sky-100/50 to-transparent opacity-50 group-hover:opacity-0" />
                {React.cloneElement(b.icon as React.ReactElement, { size: 32 })}
              </div>
              <div className="bg-slate-800 text-white text-[10px] md:text-xs font-bold px-4 py-1.5 rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg tracking-wide border border-slate-600">
                {b.name}
              </div>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {selectedBuilding && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedBuilding(null)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40" />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed inset-y-0 right-0 z-50 w-full md:w-[480px] bg-white shadow-2xl border-l border-slate-100 flex flex-col"
            >
              <div className="p-8 bg-sky-50/50 border-b border-sky-100 flex justify-between items-start relative overflow-hidden shrink-0">
                <div className="absolute -right-6 -top-6 text-sky-100/50 rotate-12 pointer-events-none">
                  {React.cloneElement(selectedBuilding.icon, { size: 140 })}
                </div>
                <div className="flex items-center gap-4 relative z-10">
                  <div className="p-3 bg-white rounded-2xl text-sky-600 shadow-sm border border-sky-100">
                    {React.cloneElement(selectedBuilding.icon, { size: 28 })}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">{selectedBuilding.name}</h2>
                    <p className="text-xs text-sky-600 font-bold mt-1 tracking-wider uppercase">{selectedBuilding.desc}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedBuilding(null)} className="text-slate-400 hover:text-sky-600 transition-colors relative z-10 bg-white p-2 rounded-full shadow-sm hover:shadow-md">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 p-6 md:p-8 overflow-y-auto custom-scrollbar space-y-8 bg-slate-50/30">
                {selectedBuilding.id === 'hq' && (
                  <div className="space-y-6">
                    {!isTowerMember ? (
                      <>
                        <div className="p-5 bg-white border-l-4 border-sky-500 shadow-sm rounded-r-xl text-xs text-slate-600 leading-relaxed">
                          <p className="font-bold text-sky-800 text-sm mb-2">欢迎来到伦敦塔。</p>
                          “秩序、理性、服从。这里是教化者与受教者的神圣殿堂。”
                          <div className="mt-3 flex items-center gap-2 text-amber-600 bg-amber-50 p-2 rounded-lg">
                            <AlertCircle size={14} />
                            <span>招生办提示：学员通道仅向 16-19 岁适龄青年开放。</span>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <JobBtn title="伦敦塔学员" sub="16-19岁 | 白塔新生代" qualified={checkQualifications(ROLES.STUDENT)} onClick={() => handleJoin(ROLES.STUDENT)} />
                          <JobBtn title="伦敦塔职工" sub="神D+ 体D+ | 助理/管理" qualified={checkQualifications(ROLES.STAFF)} onClick={() => handleJoin(ROLES.STAFF)} />
                          <JobBtn title="伦敦塔教师" sub="神B+ 体D+ | 传道授业" qualified={checkQualifications(ROLES.TEACHER)} onClick={() => handleJoin(ROLES.TEACHER)} />
                        </div>
                      </>
                    ) : (
                      <div className="text-center p-8 bg-white border border-sky-100 rounded-3xl shadow-sm">
                        <GraduationCap size={56} className="mx-auto text-sky-500 mb-4" />
                        <p className="text-xs text-slate-400 font-bold tracking-widest mb-2 uppercase">Official ID Card</p>
                        <h3 className="text-2xl font-black text-slate-800 mb-8">{user.job}</h3>
                        <button
                          onClick={() => {
                            if (confirm('办理退学/离职手续将扣除违约金，确定吗？')) {
                              fetch('/api/tower/quit', {
                                method: 'POST',
                                body: JSON.stringify({ userId: user.id }),
                                headers: { 'Content-Type': 'application/json' }
                              }).then(() => {
                                showToast('已离开伦敦塔。');
                                fetchGlobalData();
                                setSelectedBuilding(null);
                              });
                            }
                          }}
                          className="w-full py-3 bg-rose-50 text-rose-600 text-xs font-bold rounded-xl border border-rose-100 hover:bg-rose-100 transition-colors"
                        >
                          办理离职 / 退学手续
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {selectedBuilding.id === 'academy' && (
                  <div className="space-y-6 text-center">
                    <div className="bg-white p-8 border border-slate-200 rounded-[32px] shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-sky-50 rounded-bl-[100px] -z-0" />
                      <BookOpen size={64} className="mx-auto text-sky-500 mb-6 relative z-10" />
                      <h3 className="text-xl font-black text-slate-800 mb-2 relative z-10">综合藏书库</h3>
                      <p className="text-xs text-slate-500 mb-8 leading-relaxed px-4 relative z-10">
                        内部人员专享福利。每日可申请调阅各派系卷宗，有概率获得中阶技能书。
                      </p>

                      {isTowerMember ? (
                        <div>
                          <button onClick={drawSkillBook} disabled={drawCount >= 3} className="w-full py-4 bg-slate-800 text-white font-black hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all rounded-2xl shadow-lg shadow-slate-200 flex justify-center items-center gap-2 group">
                            <FileText size={18} className="group-hover:scale-110 transition-transform" />
                            抽取随机教材
                          </button>
                          <div className="mt-4 text-xs font-bold text-slate-500">今日额度：{3 - drawCount} / 3</div>
                        </div>
                      ) : (
                        <div className="p-4 bg-slate-50 border border-slate-200 text-slate-500 text-xs font-bold rounded-2xl flex items-center justify-center gap-2">
                          <Shield size={14} />
                          权限不足：仅限伦敦塔成员访问
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedBuilding.id === 'eval' && (
                  <div className="space-y-6">
                    <div className="bg-white p-8 border border-slate-200 rounded-[32px] shadow-sm">
                      <div className="flex justify-center items-center gap-4 mb-8">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500"><Zap size={24} /></div>
                        <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 border-4 border-white shadow-lg z-10"><Activity size={32} /></div>
                        <div className="w-12 h-12 rounded-2xl bg-sky-50 flex items-center justify-center text-sky-500"><Zap size={24} /></div>
                      </div>

                      <h3 className="text-xl font-black text-center text-slate-800 mb-2">精神链接相性测算</h3>
                      <p className="text-xs text-center text-slate-500 mb-8 px-4">塔内计算机模拟精神图景交融度。</p>

                      <div className="space-y-4">
                        <div className="relative group">
                          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sky-500 transition-colors" />
                          <input
                            type="text"
                            placeholder="输入目标玩家姓名..."
                            value={targetUserName}
                            onChange={(e) => setTargetUserName(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-400 transition-all placeholder:text-slate-400 text-slate-700"
                          />
                        </div>

                        <button onClick={calculateCompatibility} disabled={isCalculating} className="w-full py-4 bg-sky-600 text-white font-black hover:bg-sky-500 disabled:opacity-70 transition-all rounded-2xl shadow-lg shadow-sky-200 flex justify-center items-center gap-2">
                          {isCalculating ? <Activity className="animate-spin" /> : <><Sparkles size={18} /> 启动模拟</>}
                        </button>
                      </div>

                      <AnimatePresence>
                        {compatibility !== null && (
                          <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            className={`mt-8 p-6 rounded-2xl text-center border relative overflow-hidden ${
                              compatibility >= 70 ? 'bg-emerald-50 border-emerald-100' : compatibility >= 30 ? 'bg-amber-50 border-amber-100' : 'bg-rose-50 border-rose-100'
                            }`}
                          >
                            <p className="text-xs font-bold mb-3 opacity-60 uppercase tracking-widest text-slate-600">Compatibility Result</p>
                            <div className="flex items-baseline justify-center gap-1 mb-2">
                              <span className={`text-6xl font-black tracking-tighter ${
                                compatibility >= 70 ? 'text-emerald-600' : compatibility >= 30 ? 'text-amber-500' : 'text-rose-500'
                              }`}>{compatibility}</span>
                              <span className="text-2xl font-bold text-slate-400">%</span>
                            </div>

                            <div className="mt-3 pt-3 border-t border-black/5">
                              {compatibility < 30 && <p className="text-xs text-rose-600 font-bold">⚠️ 相斥反应严重，强制连接极易导致双向损伤。</p>}
                              {compatibility >= 30 && compatibility < 70 && <p className="text-xs text-amber-600 font-bold">⚖️ 常规匹配区间，需后天训练加深连接。</p>}
                              {compatibility >= 70 && compatibility < 90 && <p className="text-xs text-emerald-600 font-bold">✨ 高相性！是优秀搭档。</p>}
                              {compatibility >= 90 && <p className="text-xs text-sky-600 font-bold">💎 天作之合！抚慰效果将达到极致！</p>}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function JobBtn({ title, sub, qualified, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`w-full p-4 flex justify-between items-center transition-all group border rounded-2xl ${
        qualified
          ? 'bg-white border-slate-200 hover:border-sky-400 hover:shadow-md cursor-pointer'
          : 'bg-slate-50 border-slate-100 opacity-60 grayscale cursor-not-allowed'
      }`}
    >
      <div className="text-left">
        <div className={`font-black text-sm ${qualified ? 'text-slate-800 group-hover:text-sky-600' : 'text-slate-500'}`}>{title}</div>
        <div className="text-[10px] text-slate-500 mt-1">{sub}</div>
      </div>
      {qualified ? <CheckCircle size={16} className="text-emerald-500" /> : <AlertCircle size={16} className="text-rose-400" />}
    </button>
  );
}
