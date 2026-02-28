import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, X, BookOpen, GraduationCap, 
  Activity, Users, Shield, Zap, Search, 
  CheckCircle, FileText
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
  { id: 'hq', name: '中央行政枢纽', x: 50, y: 30, icon: <Shield/>, desc: '伦敦塔的权力中心与教职员工入职处。' },
  { id: 'academy', name: '白塔学院', x: 25, y: 60, icon: <GraduationCap/>, desc: '哨兵与向导的最高学府。提供每日技能进修。' },
  { id: 'eval', name: '精神评定中心', x: 75, y: 60, icon: <Activity/>, desc: '监测狂暴值与测算哨向契合度的精密实验室。' },
];

// 职位常量
const ROLES = {
  TEACHER: '伦敦塔教师',
  STAFF: '伦敦塔职工',
  STUDENT: '伦敦塔学员'
};

const RANK_SCORES: Record<string, number> = {
  '无': 0, 'F': 1, 'E': 2, 'D': 3, 'C': 4, 'C+': 5, 'B': 6, 'B+': 7, 
  'A': 8, 'A+': 9, 'S': 10, 'S+': 11, 'SS': 12, 'SS+': 13, 'SSS': 14
};

export function LondonTowerView({ user, onExit, showToast, fetchGlobalData }: Props) {
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  
  // 契合度测算状态
  const [targetUserName, setTargetUserName] = useState('');
  const [compatibility, setCompatibility] = useState<number | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // 技能抽取状态 (前端模拟每日次数限制，后端需配合 user.drawCount)
  const [drawCount, setDrawCount] = useState(0); 

  const isTowerMember = Object.values(ROLES).includes(user.job || '');
  const getScore = (rank?: string) => RANK_SCORES[rank || '无'] || 0;

  // 获取所有用户用于契合度匹配
  useEffect(() => {
    if (selectedBuilding?.id === 'eval') {
      fetch('/api/admin/users').then(r => r.json()).then(d => {
        if (d.success) setAllUsers(d.users || []);
      });
    }
  }, [selectedBuilding]);

  // --- 核心逻辑：入职与资质校验 (严格年龄限制) ---
  const checkQualifications = (targetRank: string) => {
    const age = user.age || 0;
    const mScore = getScore(user.mentalRank);
    const pScore = getScore(user.physicalRank);

    // 1. 学员专属年龄判定 (16-19岁无视属性)
    if (targetRank === ROLES.STUDENT) {
      return age >= 16 && age <= 19;
    }

    // 2. 职工与教师必须大于16岁
    if (age < 16) return false;

    if (targetRank === ROLES.STAFF) return mScore >= RANK_SCORES['D+'] && pScore >= RANK_SCORES['D+'];
    if (targetRank === ROLES.TEACHER) return mScore >= RANK_SCORES['B+'] && pScore >= RANK_SCORES['D+'];
    
    return false;
  };

  const handleJoin = async (jobName: string) => {
    if (user.job && user.job !== '无') return showToast(`请先辞去当前职务：${user.job}`);

    if (!checkQualifications(jobName)) {
      if (jobName === ROLES.STUDENT) return showToast("伦敦塔学员仅招收 16 - 19 岁的未毕业人员。");
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

  // --- 核心逻辑：契合度测算 ---
  const calculateCompatibility = () => {
    if (!targetUserName.trim()) return showToast("请输入目标玩家的姓名。");
    if (targetUserName === user.name) return showToast("不能与自己测算契合度。");

    const targetUser = allUsers.find(u => u.name === targetUserName);
    if (!targetUser) return showToast("未在世界数据库中查找到该玩家。");
    
    // 必须有哨兵/向导参与才能测算
    const validRoles = ['哨兵', '向导'];
    if (!validRoles.includes(user.role || '') && !validRoles.includes(targetUser.role || '')) {
      return showToast("至少需要一方为哨兵或向导才能进行精神链接测算。");
    }

    setIsCalculating(true);
    setCompatibility(null);

    setTimeout(() => {
      // 伪随机算法 (名字ASCII相加取模) 保证两人测出来的数值永远一致
      const str = user.name < targetUser.name ? user.name + targetUser.name : targetUser.name + user.name;
      let hash = 0;
      for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
      const result = Math.abs(hash % 101); // 0 - 100
      
      setCompatibility(result);
      setIsCalculating(false);
      showToast(`测算完成：与 ${targetUser.name} 的契合度为 ${result}%`);
    }, 1500);
  };

  // --- 核心逻辑：每日抽取中阶技能书 ---
  const drawSkillBook = () => {
    if (!isTowerMember) return showToast("非伦敦塔在编人员，无法动用学院资源。");
    if (drawCount >= 3) return showToast("今日学院进修额度已耗尽 (3/3)。");

    // 预留接口，实际需要走后端随机池
    setDrawCount(prev => prev + 1);
    const factions = ['物理系', '元素系', '精神系', '感知系', '信息系', '治疗系', '强化系', '炼金系'];
    const randomFaction = factions[Math.floor(Math.random() * factions.length)];
    
    showToast(`【进修成功】获得一本随机中阶技能书：[${randomFaction}·秘要]！`);
    // 后续在这里对接 /api/users/inventory/add 将技能书放入玩家背包
  };

  return (
    <div className="absolute inset-0 bg-slate-100 overflow-hidden font-sans select-none text-slate-800">
      {/* 伦敦塔背景层 - 清晰的学院风 */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-multiply"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1541339907198-e08756dedf3f?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-slate-100/80 via-white/50 to-slate-200/90 pointer-events-none"></div>
      </div>

      {/* 顶部导航 */}
      <div className="absolute top-8 left-8 z-50">
        <button 
          onClick={onExit} 
          className="bg-white/80 backdrop-blur-md text-sky-700 border border-sky-200 px-6 py-2 rounded-xl font-bold shadow-lg flex items-center gap-2 hover:bg-sky-50 transition-all uppercase tracking-widest"
        >
          <ArrowLeft size={18}/> 离开伦敦塔
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
            <div className="w-20 h-20 bg-white/90 backdrop-blur-md border-4 border-slate-200 shadow-xl flex items-center justify-center text-sky-600 group-hover:scale-110 group-hover:bg-sky-500 group-hover:text-white group-hover:border-sky-300 transition-all rounded-3xl z-10 relative rotate-12 group-hover:rotate-0">
              {React.cloneElement(b.icon, { size: 32 })}
            </div>
            <div className="mt-4 bg-slate-900 text-white text-[11px] font-black px-4 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg tracking-wider">
              {b.name}
            </div>
          </div>
        </div>
      ))}

      {/* 建筑详情弹窗 */}
      <AnimatePresence>
        {selectedBuilding && (
          <motion.div 
            initial={{ opacity: 0, x: -100 }} 
            animate={{ opacity: 1, x: 0 }} 
            exit={{ opacity: 0, x: -100 }}
            className="fixed inset-y-0 left-0 z-[100] w-full max-w-md bg-white shadow-2xl border-r border-slate-200 flex flex-col"
          >
            <div className="p-8 bg-sky-50 border-b border-sky-100 flex justify-between items-start relative overflow-hidden">
              <div className="absolute -right-10 -top-10 text-sky-100 opacity-50 rotate-12">
                {React.cloneElement(selectedBuilding.icon, { size: 150 })}
              </div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="p-3 bg-white rounded-2xl text-sky-600 shadow-sm border border-sky-100">
                  {React.cloneElement(selectedBuilding.icon, { size: 28 })}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight">{selectedBuilding.name}</h2>
                  <p className="text-xs text-sky-600 font-bold mt-1 tracking-wider">{selectedBuilding.desc}</p>
                </div>
              </div>
              <button onClick={() => setSelectedBuilding(null)} className="text-slate-400 hover:text-sky-600 transition-colors relative z-10 bg-white p-2 rounded-full shadow-sm">
                <X size={20}/>
              </button>
            </div>

            <div className="flex-1 p-8 overflow-y-auto space-y-8 custom-scrollbar">

              {/* === 行政枢纽：入职 === */}
              {selectedBuilding.id === 'hq' && (
                <div className="space-y-4">
                  {!isTowerMember ? (
                    <>
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-700 mb-6 leading-relaxed">
                        “秩序、理性、服从。这里是教化者与受教者的神圣殿堂。”<br/><br/>
                        <span className="font-black">招生办提示：</span> 伦敦塔学员通道仅向 16-19 岁的适龄青年开放。
                      </div>
                      
                      <div className="space-y-3">
                         <JobBtn 
                           title="伦敦塔学员" sub="年龄要求: 16-19岁 | 白塔新生代" 
                           qualified={checkQualifications(ROLES.STUDENT)}
                           onClick={() => handleJoin(ROLES.STUDENT)}
                         />
                         <JobBtn 
                           title="伦敦塔职工" sub="精神D+ 肉体D+ | 学士助理与管理人员" 
                           qualified={checkQualifications(ROLES.STAFF)}
                           onClick={() => handleJoin(ROLES.STAFF)}
                         />
                         <JobBtn 
                           title="伦敦塔教师" sub="精神B+ 肉体D+ | 传授知识与控制技巧" 
                           qualified={checkQualifications(ROLES.TEACHER)}
                           onClick={() => handleJoin(ROLES.TEACHER)}
                         />
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-8 bg-sky-50 border border-sky-200 rounded-3xl">
                      <GraduationCap size={48} className="mx-auto text-sky-600 mb-4"/>
                      <p className="text-xs text-sky-700 font-bold tracking-widest mb-1 uppercase">London Tower ID</p>
                      <h3 className="text-2xl font-black text-slate-800 mb-6">{user.job}</h3>
                      <button 
                        onClick={() => { if(confirm("办理退学/离职手续将扣除违约金，确定吗？")) fetch('/api/tower/quit', { method:'POST', body:JSON.stringify({userId:user.id}), headers:{'Content-Type':'application/json'}}).then(() => {showToast("已离开伦敦塔。"); fetchGlobalData(); setSelectedBuilding(null);}) }}
                        className="px-6 py-2 bg-white text-rose-500 text-xs font-bold rounded-full border border-rose-200 hover:bg-rose-50 transition-colors"
                      >
                        办理离职/退学
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* === 白塔学院：技能抽取 === */}
              {selectedBuilding.id === 'academy' && (
                <div className="space-y-6 text-center">
                  <div className="bg-white p-8 border border-slate-200 rounded-[32px] shadow-sm relative overflow-hidden">
                    <BookOpen size={64} className="mx-auto text-sky-500 mb-6"/>
                    <h3 className="text-xl font-black text-slate-800 mb-2">综合藏书库</h3>
                    <p className="text-xs text-slate-500 mb-8 leading-relaxed px-4">
                      内部人员专享福利。每日可向藏书库申请调阅各派系的实战卷宗，有概率获得中阶技能书。
                    </p>
                    
                    {isTowerMember ? (
                      <div>
                        <button 
                          onClick={drawSkillBook}
                          disabled={drawCount >= 3}
                          className="w-full py-4 bg-slate-900 text-white font-black hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all rounded-2xl shadow-lg flex justify-center items-center gap-2"
                        >
                          <FileText size={18}/> 抽取随机中阶技能书
                        </button>
                        <p className="text-xs font-bold text-sky-600 mt-4">今日剩余次数：{3 - drawCount}/3</p>
                      </div>
                    ) : (
                      <div className="p-4 bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold rounded-2xl">
                        访客禁止进入核心资料库。请先办理入学或入职手续。
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* === 精神评定中心：契合度测算 === */}
              {selectedBuilding.id === 'eval' && (
                <div className="space-y-6">
                  <div className="bg-white p-8 border border-slate-200 rounded-[32px] shadow-sm">
                    <div className="flex justify-center items-center gap-4 mb-8">
                       <Zap size={32} className="text-indigo-400"/>
                       <Activity size={48} className="text-rose-400"/>
                       <Zap size={32} className="text-sky-400"/>
                    </div>
                    
                    <h3 className="text-xl font-black text-center text-slate-800 mb-2">精神链接相性测算</h3>
                    <p className="text-xs text-center text-slate-500 mb-8">输入对方的档案名，通过塔内超级计算机模拟精神图景的交融程度。</p>
                    
                    <div className="space-y-4">
                      <div className="relative">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/>
                        <input 
                          type="text" 
                          placeholder="输入目标玩家姓名..." 
                          value={targetUserName}
                          onChange={(e) => setTargetUserName(e.target.value)}
                          className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-sky-500 transition-shadow"
                        />
                      </div>
                      
                      <button 
                        onClick={calculateCompatibility}
                        disabled={isCalculating}
                        className="w-full py-4 bg-sky-600 text-white font-black hover:bg-sky-500 disabled:opacity-50 transition-all rounded-2xl shadow-lg flex justify-center items-center"
                      >
                        {isCalculating ? <Activity className="animate-pulse"/> : '启动深度测算'}
                      </button>
                    </div>

                    {/* 测算结果展示 */}
                    <AnimatePresence>
                      {compatibility !== null && (
                        <motion.div 
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="mt-8 p-6 bg-slate-900 rounded-3xl text-center relative overflow-hidden"
                        >
                          <div className="absolute inset-0 bg-gradient-to-t from-sky-900/40 to-transparent pointer-events-none"></div>
                          <p className="text-xs text-sky-400 font-bold mb-2">【 {user.name} 】 与 【 {targetUserName} 】</p>
                          <div className="flex items-end justify-center gap-1 mb-2">
                            <span className="text-5xl font-black text-white">{compatibility}</span>
                            <span className="text-2xl font-bold text-slate-400 mb-1">%</span>
                          </div>
                          
                          <div className="mt-4 pt-4 border-t border-slate-700/50">
                            {compatibility < 30 && <p className="text-xs text-rose-400 font-bold">相斥反应严重，精神链接极易导致双向损伤。</p>}
                            {compatibility >= 30 && compatibility < 70 && <p className="text-xs text-amber-400 font-bold">常规匹配区间，需通过后天训练加深连接。</p>}
                            {compatibility >= 70 && compatibility < 90 && <p className="text-xs text-emerald-400 font-bold">高相性！精神图景交融顺畅，是优秀的搭档。</p>}
                            {compatibility >= 90 && <p className="text-xs text-sky-300 font-bold">天作之合！宛如灵魂双生，抚慰效果将达到极致！</p>}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; }
      `}</style>
    </div>
  );
}

// 子组件
function JobBtn({ title, sub, qualified, onClick }: any) {
  return (
    <button 
      onClick={onClick} 
      disabled={!qualified}
      className={`w-full p-4 flex flex-col items-start transition-all relative overflow-hidden text-left border rounded-2xl
        ${qualified ? 'bg-white border-slate-200 hover:border-sky-500 hover:shadow-md' : 'bg-slate-50 border-slate-100 opacity-50 cursor-not-allowed'}
      `}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={`font-black text-sm ${qualified ? 'text-slate-800' : 'text-slate-500'}`}>{title}</span>
        {qualified && <CheckCircle size={14} className="text-emerald-500"/>}
      </div>
      <span className="text-[10px] text-slate-500">{sub}</span>
      {!qualified && <span className="absolute top-4 right-4 text-[9px] font-bold text-rose-500 bg-rose-50 px-2 py-1 border border-rose-200 rounded-md">要求未达</span>}
    </button>
  );
}