import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, X, Coins, 
  ScrollText, Gavel, Beer, Store, 
  Users, Tent, AlertTriangle, Home
} from 'lucide-react';
import { User } from '../types';

interface Props {
  user: User;
  onExit: () => void;
  showToast: (msg: string) => void;
  fetchGlobalData: () => void;
}

// 建筑坐标与功能描述
const buildings = [
  { id: 'hall', name: '公会大厅', x: 58, y: 30, icon: <ScrollText/>, desc: '入职评定与接取冒险者委托。' },
  { id: 'market', name: '自由集市', x: 30, y: 60, icon: <Store/>, desc: '出售杂物，交易所需。' },
  { id: 'tavern', name: '冒险者酒馆', x: 22, y: 35, icon: <Beer/>, desc: '打听情报。客房: 回复50%的体力和MP。' },
  { id: 'auction', name: '地下拍卖行', x: 82, y: 40, icon: <Gavel/>, desc: '稀世珍宝与禁忌物品的流通地。' },
];

// --- 职位与门槛常量 ---
const ROLES = {
  MASTER: '公会会长',
  MEMBER: '公会成员',
  ADVENTURER: '冒险者'
};

const RANK_SCORES: Record<string, number> = {
  '无': 0, 'F': 1, 'E': 2, 'D': 3, 'C': 4, 'C+': 5, 'B': 6, 'B+': 7, 
  'A': 8, 'A+': 9, 'S': 10, 'S+': 11, 'SS': 12, 'SS+': 13, 'SSS': 14
};

// 模拟的酒馆流言
const RUMORS = [
  "听说军队最近在边境吃了瘪，全靠我们公会的人去救场。",
  "地下拍卖行下周会有一件来自神使层的‘那东西’流出...",
  "现在的世道，精神力强不如拳头硬，命之塔那帮人根本不懂。",
  "会长最近似乎在和圣所那边接触，不知道在谋划什么。",
  "别去招惹东区的贵族，除非给的钱够多。",
];

export function GuildView({ user, onExit, showToast, fetchGlobalData }: Props) {
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [rumor, setRumor] = useState("");

  // 身份判断
  const isGuildPerson = Object.values(ROLES).includes(user.job || '');
  const getScore = (rank?: string) => RANK_SCORES[rank || '无'] || 0;

  useEffect(() => {
    if (selectedBuilding?.id === 'hall') fetchCommissions();
  }, [selectedBuilding]);

  const fetchCommissions = async () => {
    try {
      const res = await fetch('/api/commissions');
      const data = await res.json();
      if (data.success) setCommissions(data.commissions || []);
    } catch (e) {
      console.error("获取委托失败", e);
    }
  };

  // --- 核心逻辑：资质校验 ---
  const checkQualifications = (targetRank: string) => {
    if ((user.age || 0) < 16) return false; // 必须年满16岁
    
    const pScore = getScore(user.physicalRank);
    const mScore = getScore(user.mentalRank);
    
    if (targetRank === ROLES.ADVENTURER) return true; // 冒险者不限
    if (targetRank === ROLES.MEMBER) return mScore >= RANK_SCORES['C+'] && pScore >= RANK_SCORES['C+'];
    if (targetRank === ROLES.MASTER) return mScore >= RANK_SCORES['S+'] && pScore >= RANK_SCORES['S+'];
    return false;
  };

  // --- 核心逻辑：入职/晋升 ---
  const handleJoinOrPromote = async (targetJobName: string) => {
    let jobName = targetJobName;
    const age = user.age || 0;

    try {
      // 1. 未分化拦截
      if (age < 16) {
        return showToast("未分化者禁止注册公会身份，请先前往圣所或伦敦塔。");
      }

      // 2. 16-19岁学生拦截
      if (age >= 16 && age <= 19) {
        const confirmMessage = "你还没有毕业，真的要加入公会吗？选择【否】前往伦敦塔深造，选择【是】你将只能注册为【冒险者】。";
        if (!window.confirm(confirmMessage)) {
          showToast("理智的选择。");
          onExit();
          return;
        } else {
          // 强制降级逻辑
          if (jobName !== ROLES.ADVENTURER) {
            showToast(`受限于年龄，你目前只能注册为：${ROLES.ADVENTURER}`);
            jobName = ROLES.ADVENTURER;
          }
        }
      }

      // 3. 资质校验
      if (!checkQualifications(jobName)) {
        return showToast(`资质不符！${jobName} 需要更高的等级要求。`);
      }

      // 4. 发送请求
      const res = await fetch('/api/tower/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, jobName })
      });
      
      const data = await res.json();
      if (data.success) {
        showToast(`契约已成，欢迎加入公会，${jobName}。`);
        fetchGlobalData();
      } else {
        showToast(data.message || '操作失败');
      }
    } catch (e) {
      console.error(e);
      showToast('网络连接异常');
    }
  };

  const handleRest = async () => {
    const price = 50;
    if ((user.gold || 0) < price) return showToast(`客房费需要 ${price}G，你的钱不够。`);

    try {
      const res = await fetch('/api/tower/rest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) });
      if (res.ok) {
        showToast(`支付 ${price}G 租借客房，已回复50%的体力和MP。`);
        fetchGlobalData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getRandomRumor = () => {
    const r = RUMORS[Math.floor(Math.random() * RUMORS.length)];
    setRumor(r);
  };

  const handleAcceptCommission = async (commId: string) => {
    if (!isGuildPerson) return showToast("只有公会注册人员 (冒险者及以上) 才能接取委托！");
    
    try {
      const res = await fetch(`/api/commissions/${commId}/accept`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, userName: user.name })
      });
      const data = await res.json();
      if (data.success) {
        showToast("冒险者委托已接取！请务必完成任务。");
        fetchCommissions(); 
        fetchGlobalData();
      } else {
        showToast(data.message);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="absolute inset-0 bg-stone-900 overflow-hidden font-sans select-none text-stone-200">
      {/* 1. 背景层 */}
      <div className="absolute inset-0 z-0">
        <img 
          src="/公会.jpg" 
          className="w-full h-full object-cover opacity-60 sepia-[20%]"
          alt="Guild Hall"
        />
        {/* 混合滤镜：琥珀色调 */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-950/50 via-stone-900/60 to-black/60 mix-blend-multiply pointer-events-none" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay pointer-events-none" />
      </div>

      {/* 2. 顶部导航 */}
      <div className="absolute top-6 left-6 z-50">
        <button 
          onClick={onExit} 
          className="bg-stone-900/90 backdrop-blur-md text-amber-500 border border-amber-600/50 px-5 py-2.5 rounded-xl font-black shadow-lg flex items-center gap-2 hover:bg-stone-800 hover:scale-105 transition-all active:scale-95"
        >
          <ArrowLeft size={20}/> 
          <span className="hidden md:inline">离开公会领地</span>
        </button>
      </div>

      {/* 3. 建筑交互点 */}
      <div className="relative z-10 w-full h-full">
        {buildings.map(b => (
          <div 
            key={b.id} 
            className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 cursor-pointer group touch-manipulation"
            style={{ left: `${b.x}%`, top: `${b.y}%` }}
            onClick={() => setSelectedBuilding(b)}
          >
            <div className="flex flex-col items-center">
              {/* 菱形图标设计 */}
              <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-stone-800 to-stone-900 rotate-45 border-2 border-amber-500 shadow-2xl flex items-center justify-center group-hover:scale-110 transition-all group-hover:border-amber-300 z-10 relative overflow-hidden">
                <div className="-rotate-45 text-amber-500 group-hover:text-amber-300 drop-shadow-md">
                  {React.cloneElement(b.icon as React.ReactElement, { size: 28 })}
                </div>
                {/* 光效 */}
                <div className="absolute inset-0 bg-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="mt-8 bg-black/80 backdrop-blur-md text-amber-500 text-[10px] md:text-xs font-bold px-3 py-1.5 rounded border border-amber-900/50 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
                {b.name}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 4. 建筑详情弹窗 */}
      <AnimatePresence>
        {selectedBuilding && (
          <>
            {/* 遮罩 */}
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedBuilding(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />

            {/* 弹窗本体 */}
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="bg-[#fdfbf7] w-full max-w-2xl shadow-2xl relative border-4 border-stone-800 rounded-lg overflow-hidden flex flex-col max-h-[85vh] pointer-events-auto text-stone-800">
                
                {/* 弹窗头部 */}
                <div className="bg-stone-800 p-6 flex justify-between items-center border-b-4 border-amber-600 shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="text-amber-500 bg-stone-700 p-2 rounded-lg border border-amber-500/30">
                      {React.cloneElement(selectedBuilding.icon, { size: 24 })}
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-amber-50 uppercase tracking-wider">{selectedBuilding.name}</h2>
                      <p className="text-xs text-stone-400 font-bold mt-0.5">{selectedBuilding.desc}</p>
                    </div>
                  </div>
                  <button onClick={() => {setSelectedBuilding(null); setRumor("");}} className="text-stone-500 hover:text-white transition-colors bg-stone-700/50 p-1.5 rounded-full">
                    <X size={24}/>
                  </button>
                </div>

                {/* 内容区域 - 羊皮纸纹理 */}
                <div className="p-6 md:p-8 overflow-y-auto bg-[url('https://www.transparenttextures.com/patterns/aged-paper.png')] bg-amber-50/50 flex-1 custom-scrollbar-dark">
                  
                  {/* === 公会大厅：职位与委托 === */}
                  {selectedBuilding.id === 'hall' && (
                    <div className="space-y-8">
                      {!isGuildPerson && (
                        <div className="bg-white p-6 border-2 border-stone-300 shadow-sm rounded-lg">
                          <h3 className="font-black text-lg mb-4 flex items-center gap-2 text-amber-800">
                            <Users size={20}/> 注册公会身份
                          </h3>
                          <p className="text-sm text-stone-600 mb-6 leading-relaxed">
                            公会不问出身。无论你是想成为受人敬仰的正式成员，还是自由自在的冒险者，只要完成任务，金钱与名声唾手可得。
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <JoinBtn 
                              title="冒险者" sub="无限制 | 自由接单" 
                              qualified={checkQualifications(ROLES.ADVENTURER)}
                              onClick={() => handleJoinOrPromote(ROLES.ADVENTURER)} 
                            />
                            <JoinBtn 
                              title="公会成员" sub="神C+ 体C+ | 享有福利" 
                              qualified={checkQualifications(ROLES.MEMBER)}
                              onClick={() => handleJoinOrPromote(ROLES.MEMBER)} 
                            />
                            <div className="col-span-1 md:col-span-2">
                              <JoinBtn 
                                title="公会会长" sub="神S+ 体S+ | 统领公会" 
                                qualified={checkQualifications(ROLES.MASTER)}
                                onClick={() => handleJoinOrPromote(ROLES.MASTER)} 
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {isGuildPerson && (
                        <div className="mb-4 p-5 bg-white border border-stone-300 shadow-sm rounded-lg flex flex-col md:flex-row justify-between items-center gap-4">
                          <div className="text-center md:text-left">
                            <p className="text-xs text-stone-500 font-bold mb-1 uppercase tracking-wide">Current Rank</p>
                            <p className="text-xl font-black text-amber-800 flex items-center gap-2 justify-center md:justify-start">
                              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"/>
                              {user.job}
                            </p>
                          </div>
                          {user.job !== ROLES.MASTER && (
                            <div className="flex flex-col gap-2 w-full md:w-auto">
                              {user.job === ROLES.ADVENTURER && <button onClick={() => handleJoinOrPromote(ROLES.MEMBER)} className="px-5 py-2.5 bg-stone-800 text-amber-500 font-bold text-xs rounded-lg hover:bg-stone-700 transition-colors shadow-md">申请晋升: 公会成员</button>}
                              {user.job === ROLES.MEMBER && <button onClick={() => handleJoinOrPromote(ROLES.MASTER)} className="px-5 py-2.5 bg-stone-800 text-amber-500 font-bold text-xs rounded-lg hover:bg-stone-700 transition-colors shadow-md">发起挑战: 夺取会长</button>}
                            </div>
                          )}
                        </div>
                      )}

                      <div>
                        <h3 className="font-black text-xl mb-4 flex items-center gap-2 text-stone-800">
                          <SwordsIcon className="text-red-700"/> 冒险者委托板
                        </h3>
                        <div className="grid grid-cols-1 gap-4">
                          {commissions.length === 0 && <div className="text-center py-10 text-stone-400 font-bold bg-stone-100 rounded-lg border border-stone-200">暂无公开委托</div>}
                          {commissions.filter(c => c.status === 'open').map(c => (
                            <div key={c.id} className="relative bg-[#fffefc] p-5 border border-stone-200 shadow-sm rounded-lg group hover:border-amber-500 hover:shadow-md transition-all">
                              {/* 任务等级印章 */}
                              <div className={`absolute top-4 right-4 w-10 h-10 flex items-center justify-center font-black border-2 rounded-full text-sm
                                ${['S', 'A'].includes(c.difficulty) ? 'border-red-600 text-red-600' : 'border-stone-300 text-stone-400'}
                              `}>
                                {c.difficulty || 'C'}
                              </div>
                              
                              <h4 className="font-black text-stone-800 text-lg mb-1 pr-12">{c.title}</h4>
                              <p className="text-xs font-bold text-stone-500 mb-3">发布者: {c.publisherName}</p>
                              <p className="text-sm text-stone-600 mb-5 leading-relaxed font-serif line-clamp-2">{c.content}</p>
                              
                              <div className="flex justify-between items-center border-t border-stone-100 pt-4">
                                <span className="font-black text-amber-600 flex items-center gap-1.5 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
                                  <Coins size={14}/> {c.reward} G
                                </span>
                                <button 
                                  onClick={() => handleAcceptCommission(c.id)}
                                  className="bg-stone-800 text-white px-5 py-2 text-xs font-bold rounded-lg hover:bg-amber-600 transition-colors uppercase tracking-wider shadow-md"
                                >
                                  接取任务
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* === 交易集市 === */}
                  {selectedBuilding.id === 'market' && (
                    <div className="text-center space-y-8 py-4">
                        <p className="text-stone-600 font-serif italic text-lg">
                        “这里没有法律，只有契约。一手交钱，一手交货。”
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <MarketOption icon={<Store size={32}/>} title="购买交易" desc="购买商人的货物或寄售品" onClick={() => showToast("市场功能接入中：请寻找地图上的商人NPC【贾斯汀】")}/>
                         <MarketOption icon={<Tent size={32}/>} title="摆摊出售" desc="将多余的物品换成金币" onClick={() => showToast("出售功能接入中：请前往NPC处打开背包寄售")}/>
                      </div>
                    </div>
                  )}

                  {/* === 酒馆与客房 === */}
                  {selectedBuilding.id === 'tavern' && (
                    <div className="space-y-8">
                      <div className="flex items-start gap-5 p-5 bg-stone-200/50 rounded-xl border border-stone-300/50">
                        <div className="w-16 h-16 bg-stone-300 rounded-full shrink-0 overflow-hidden border-2 border-stone-400 shadow-inner flex items-center justify-center">
                           <Beer size={28} className="text-stone-500"/>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-stone-800 mb-1">酒保 老杰克</p>
                          <p className="text-xs text-stone-600 italic mb-3">"住店还是打听消息？先说好，都不便宜。"</p>
                          
                          {rumor && (
                            <div className="p-4 bg-white border-l-4 border-amber-500 text-sm text-stone-700 font-serif shadow-sm italic rounded-r-lg">
                              “{rumor}”
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button onClick={handleRest} className="p-5 bg-amber-600 text-white rounded-xl shadow-lg hover:bg-amber-700 transition-colors flex flex-col items-center gap-1 group">
                          <span className="font-black text-lg group-hover:scale-105 transition-transform">租借客房 (50G)</span>
                          <span className="text-[10px] opacity-80">回复50%的体力和MP</span>
                        </button>
                        <button onClick={getRandomRumor} className="p-5 bg-stone-700 text-white rounded-xl shadow-lg hover:bg-stone-600 transition-colors flex flex-col items-center gap-1 group">
                          <span className="font-black text-lg group-hover:scale-105 transition-transform">打听小道消息</span>
                          <span className="text-[10px] opacity-80">获取世界情报</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* === 地下拍卖行 === */}
                  {selectedBuilding.id === 'auction' && (
                    <div className="text-center py-12 px-4">
                      <div className="mb-6 relative inline-block">
                        <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-full"></div>
                        <Gavel size={80} className="relative z-10 text-amber-700 drop-shadow-lg"/>
                      </div>
                      <h3 className="text-3xl font-black text-stone-900 mb-3 tracking-tight">地下拍卖行</h3>
                      <p className="text-sm text-stone-500 mb-10 max-w-md mx-auto leading-relaxed">
                        在这里，你可以买到来自世界各地的违禁品、高阶技能书，甚至是稀有的精神体素材。<br/>
                        <span className="text-xs italic opacity-70">(仅限受邀者或公会高层进入)</span>
                      </p>
                      
                      <button onClick={() => showToast("请寻找地图上的商人NPC【贾斯汀】进入地下竞拍场。")} className="px-10 py-4 bg-stone-900 text-amber-500 font-black tracking-widest text-sm rounded-xl hover:bg-stone-800 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1">
                        进入地下竞拍场
                      </button>

                      <div className="mt-12 flex items-center justify-center gap-2 text-xs text-red-600 font-bold bg-red-50 p-3 rounded-full border border-red-100 max-w-fit mx-auto">
                        <AlertTriangle size={14}/> 警告：所有交易概不退换，严禁在场内动武。
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// === 子组件 ===

function JoinBtn({ title, sub, qualified, onClick }: any) {
  return (
    <button 
      onClick={onClick} 
      className={`border-2 p-4 text-left group transition-all relative overflow-hidden w-full rounded-lg flex justify-between items-center
        ${qualified ? 'border-stone-300 hover:border-amber-500 hover:bg-amber-50 bg-white cursor-pointer shadow-sm hover:shadow-md' : 'border-stone-200 bg-stone-100 opacity-60'}
      `}
    >
      <div>
        <div className={`font-black ${qualified ? 'text-stone-800 group-hover:text-amber-800' : 'text-stone-400'}`}>{title}</div>
        <div className="text-xs text-stone-500 mt-1 font-medium">{sub}</div>
      </div>
      {!qualified && <div className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-1 rounded border border-red-100">未达标</div>}
    </button>
  );
}

function MarketOption({ icon, title, desc, onClick }: any) {
  return (
    <button onClick={onClick} className="flex flex-col items-center justify-center p-8 bg-white border-2 border-stone-200 rounded-xl hover:border-amber-500 hover:shadow-xl transition-all group">
      <div className="text-stone-400 group-hover:text-amber-600 transition-colors mb-4 transform group-hover:scale-110 duration-300">{icon}</div>
      <div className="font-black text-lg text-stone-800 group-hover:text-amber-800 transition-colors">{title}</div>
      <div className="text-xs text-stone-500 mt-2 font-medium">{desc}</div>
    </button>
  );
}

function SwordsIcon({ className }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
      <line x1="13" x2="19" y1="19" y2="13" />
      <line x1="16" x2="20" y1="16" y2="20" />
      <line x1="19" x2="21" y1="21" y2="19" />
      <polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5" />
      <line x1="5" x2="9" y1="14" y2="18" />
      <line x1="7" x2="4" y1="17" y2="20" />
      <line x1="3" x2="5" y1="19" y2="21" />
    </svg>
  );
}