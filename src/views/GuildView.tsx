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
  { id: 'hall', name: '公会大厅 / 任务处', x: 58, y: 30, icon: <ScrollText/>, desc: '入职评定与接取冒险者委托。' },
  { id: 'market', name: '自由交易集市', x: 30, y: 60, icon: <Store/>, desc: '出售杂物，交易所需。' },
  { id: 'tavern', name: '冒险者酒馆 / 客房', x: 22, y: 35, icon: <Beer/>, desc: '打听情报。客房: 回复50%的体力和MP。' },
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
    const res = await fetch('/api/commissions');
    const data = await res.json();
    if (data.success) setCommissions(data.commissions || []);
  };

  // --- 核心逻辑：入职与资质校验 ---
  const checkQualifications = (targetRank: string) => {
    if ((user.age || 0) < 16) return false; // 必须年满16岁
    
    const pScore = getScore(user.physicalRank);
    const mScore = getScore(user.mentalRank);
    
    if (targetRank === ROLES.ADVENTURER) return true; // 冒险者不限
    if (targetRank === ROLES.MEMBER) return mScore >= RANK_SCORES['C+'] && pScore >= RANK_SCORES['C+'];
    if (targetRank === ROLES.MASTER) return mScore >= RANK_SCORES['S+'] && pScore >= RANK_SCORES['S+'];
    return false;
  };

  const handleJoinOrPromote = async (targetRank: string) => {
    if (!checkQualifications(targetRank)) {
      return showToast(`资质不符！${targetRank} 对应等级要求未达标，或未满16岁。`);
    }

    const res = await fetch('/api/tower/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, jobName: targetRank })
    });
    
    const data = await res.json();
    if (data.success) {
      showToast(`契约已成，欢迎加入公会，${targetRank}。家园已自动迁至公会。`);
      fetchGlobalData();
    } else {
      showToast(data.message || '操作失败');
    }
  };

  const handleRest = async () => {
    const price = 50;
    if ((user.gold || 0) < price) return showToast(`客房费需要 ${price}G，你的钱不够。`);

    // 调用休息接口 (如果后端后续更新了半血恢复逻辑，这里直接请求即可)
    const res = await fetch('/api/tower/rest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) });
    if (res.ok) {
      showToast(`支付 ${price}G 租借客房，已回复50%的体力和MP。`);
      fetchGlobalData();
    }
  };

  const getRandomRumor = () => {
    const r = RUMORS[Math.floor(Math.random() * RUMORS.length)];
    setRumor(r);
  };

  const handleAcceptCommission = async (commId: string) => {
    if (!isGuildPerson) return showToast("只有公会注册人员 (冒险者及以上) 才能接取委托！");
    
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
  };

  return (
    <div className="absolute inset-0 bg-stone-900 overflow-hidden font-sans select-none">
      {/* 背景层 */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/公会.jpg')" }}
      >
        <div className="absolute inset-0 bg-yellow-900/10 mix-blend-overlay"></div>
      </div>

      {/* 顶部导航 */}
      <div className="absolute top-8 left-8 z-50">
        <button 
          onClick={onExit} 
          className="bg-stone-900/90 text-amber-500 border border-amber-600 px-6 py-2 rounded-xl font-black shadow-2xl flex items-center gap-2 hover:scale-105 transition-all"
        >
          <ArrowLeft size={20}/> 离开公会领地
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
            {/* 菱形图标设计，体现公会的尖锐与富有 */}
            <div className="w-16 h-16 bg-gradient-to-br from-stone-800 to-stone-900 rotate-45 border-2 border-amber-500 shadow-2xl flex items-center justify-center group-hover:scale-110 transition-all group-hover:border-amber-300 z-10">
              <div className="-rotate-45 text-amber-500 group-hover:text-amber-300">
                {b.icon}
              </div>
            </div>
            <div className="mt-8 bg-black/80 text-amber-500 text-[10px] font-bold px-2 py-1 rounded border border-amber-900/50 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {b.name}
            </div>
          </div>
        </div>
      ))}

      {/* 建筑弹窗 */}
      <AnimatePresence>
        {selectedBuilding && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <div className="bg-stone-100 rounded-[4px] p-0 w-full max-w-2xl shadow-2xl relative border-4 border-stone-800 overflow-hidden flex flex-col max-h-[80vh]">
              
              {/* 弹窗头部 */}
              <div className="bg-stone-800 p-6 flex justify-between items-center border-b-4 border-amber-600">
                <div className="flex items-center gap-3">
                  <div className="text-amber-500">{selectedBuilding.icon}</div>
                  <div>
                    <h2 className="text-2xl font-black text-amber-50 uppercase tracking-wider">{selectedBuilding.name}</h2>
                    <p className="text-xs text-stone-400 font-bold">{selectedBuilding.desc}</p>
                  </div>
                </div>
                <button onClick={() => {setSelectedBuilding(null); setRumor("");}} className="text-stone-500 hover:text-white transition-colors">
                  <X size={24}/>
                </button>
              </div>

              <div className="p-8 overflow-y-auto bg-[url('https://www.transparenttextures.com/patterns/aged-paper.png')] bg-amber-50/50 flex-1">
                
                {/* === 公会大厅：职位与委托 === */}
                {selectedBuilding.id === 'hall' && (
                  <div className="space-y-6">
                    {!isGuildPerson && (
                      <div className="bg-white p-6 border-2 border-stone-300 shadow-sm">
                        <h3 className="font-black text-lg mb-4 flex items-center gap-2">
                          <Users size={18}/> 注册公会身份
                        </h3>
                        <p className="text-sm text-stone-600 mb-4">
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
                      <div className="text-center mb-4 p-4 bg-white border border-stone-300 shadow-sm flex justify-between items-center">
                        <div className="text-left">
                          <p className="text-xs text-stone-500 font-bold mb-1">当前身份</p>
                          <p className="text-lg font-black text-amber-800">{user.job}</p>
                        </div>
                        {user.job !== ROLES.MASTER && (
                          <div className="space-y-2">
                            {user.job === ROLES.ADVENTURER && <button onClick={() => handleJoinOrPromote(ROLES.MEMBER)} className="px-4 py-2 bg-stone-800 text-amber-500 font-bold text-xs hover:bg-stone-700 transition-colors">申请晋升: 公会成员 (神C+ 体C+)</button>}
                            {user.job === ROLES.MEMBER && <button onClick={() => handleJoinOrPromote(ROLES.MASTER)} className="px-4 py-2 bg-stone-800 text-amber-500 font-bold text-xs hover:bg-stone-700 transition-colors">发起挑战: 夺取公会会长 (神S+ 体S+)</button>}
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <h3 className="font-black text-xl mb-4 flex items-center gap-2 text-stone-800">
                        <SwordsIcon className="text-red-700"/> 冒险者委托板
                      </h3>
                      <div className="grid grid-cols-1 gap-3">
                        {commissions.length === 0 && <div className="text-center py-8 text-stone-400 font-bold">暂无公开委托</div>}
                        {commissions.filter(c => c.status === 'open').map(c => (
                          <div key={c.id} className="relative bg-[#fdfbf7] p-4 border border-stone-300 shadow-md group hover:border-amber-500 transition-colors">
                            {/* 任务等级印章 */}
                            <div className={`absolute top-2 right-2 w-8 h-8 flex items-center justify-center font-black border-2 rounded-full text-xs
                              ${['S', 'A'].includes(c.difficulty) ? 'border-red-600 text-red-600' : 'border-stone-400 text-stone-400'}
                            `}>
                              {c.difficulty || 'C'}
                            </div>
                            
                            <h4 className="font-black text-stone-800 text-lg mb-1">{c.title}</h4>
                            <p className="text-xs font-bold text-stone-500 mb-2">发布者: {c.publisherName}</p>
                            <p className="text-sm text-stone-700 mb-4 leading-relaxed font-serif">{c.content}</p>
                            
                            <div className="flex justify-between items-center border-t border-stone-100 pt-3">
                              <span className="font-black text-amber-600 flex items-center gap-1">
                                <Coins size={14}/> {c.reward} G
                              </span>
                              <button 
                                onClick={() => handleAcceptCommission(c.id)}
                                className="bg-stone-800 text-white px-4 py-1.5 text-xs font-bold hover:bg-amber-600 transition-colors uppercase tracking-wider"
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
                  <div className="text-center space-y-4">
                     <p className="text-stone-600 font-serif italic mb-6">
                      “这里没有法律，只有契约。一手交钱，一手交货。”
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                       <MarketOption icon={<Store/>} title="购买交易" desc="购买商人的货物或寄售品" onClick={() => showToast("市场功能接入中：请寻找地图上的商人NPC【贾斯汀】")}/>
                       <MarketOption icon={<Tent/>} title="摆摊出售" desc="将多余的物品换成金币" onClick={() => showToast("出售功能接入中：请前往NPC处打开背包寄售")}/>
                    </div>
                  </div>
                )}

                {/* === 酒馆与客房 === */}
                {selectedBuilding.id === 'tavern' && (
                  <div className="space-y-6">
                    <div className="flex items-start gap-4 p-4 bg-stone-200/50 rounded-lg">
                      <div className="w-16 h-16 bg-stone-300 rounded-full shrink-0 overflow-hidden border-2 border-stone-400">
                         <div className="w-full h-full flex items-center justify-center font-black text-stone-500">BAR</div>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-stone-800 mb-1">酒保 老杰克</p>
                        <p className="text-xs text-stone-600 italic">"住店还是打听消息？先说好，都不便宜。"</p>
                        
                        {rumor && (
                          <div className="mt-3 p-3 bg-white border-l-4 border-amber-500 text-xs text-stone-700 font-serif">
                            {rumor}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <button onClick={handleRest} className="p-4 bg-amber-600 text-white font-black hover:bg-amber-700 transition-colors shadow-lg">
                        租借客房 (50G)
                        <span className="block text-[10px] font-normal opacity-90 mt-1">回复50%的体力和MP</span>
                      </button>
                      <button onClick={getRandomRumor} className="p-4 bg-stone-700 text-white font-black hover:bg-stone-600 transition-colors shadow-lg">
                        打听小道消息
                        <span className="block text-[10px] font-normal opacity-80 mt-1">获取世界情报</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* === 地下拍卖行 === */}
                {selectedBuilding.id === 'auction' && (
                  <div className="text-center py-10">
                    <Gavel size={64} className="mx-auto text-amber-600 mb-4"/>
                    <h3 className="text-2xl font-black text-stone-900 mb-2">地下拍卖行</h3>
                    <p className="text-sm text-stone-500 mb-8 max-w-sm mx-auto">
                      在这里，你可以买到来自世界各地的违禁品、高阶技能书，甚至是稀有的精神体素材。
                    </p>
                    
                    <button onClick={() => showToast("请寻找地图上的商人NPC【贾斯汀】进入地下竞拍场。")} className="px-8 py-3 bg-stone-900 text-amber-500 font-black tracking-widest hover:bg-stone-800 transition-colors shadow-xl border border-stone-700">
                      进入地下竞拍场
                    </button>

                    <div className="mt-8 text-xs text-red-600 font-bold border border-red-200 bg-red-50 p-3 inline-block rounded">
                      <AlertTriangle size={14} className="inline mr-1 -mt-0.5"/> 警告：所有交易概不退换，严禁在场内动武。
                    </div>
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

// === 子组件 ===

function JoinBtn({ title, sub, qualified, onClick }: any) {
  return (
    <button 
      onClick={onClick} 
      disabled={!qualified}
      className={`border-2 p-4 text-left group transition-all relative overflow-hidden
        ${qualified ? 'border-stone-300 hover:border-amber-500 hover:bg-amber-50 bg-white' : 'border-stone-200 bg-stone-100 opacity-60 cursor-not-allowed'}
      `}
    >
      <div className={`font-black ${qualified ? 'text-stone-800 group-hover:text-amber-700' : 'text-stone-500'}`}>{title}</div>
      <div className="text-xs text-stone-500 mt-1">{sub}</div>
      {!qualified && <div className="absolute top-2 right-2 text-[10px] font-bold text-red-500 bg-red-100 px-1 rounded">不合规</div>}
    </button>
  );
}

function MarketOption({ icon, title, desc, onClick }: any) {
  return (
    <button onClick={onClick} className="flex flex-col items-center justify-center p-6 bg-white border-2 border-stone-200 hover:border-amber-500 hover:shadow-lg transition-all group">
      <div className="text-stone-400 group-hover:text-amber-600 transition-colors mb-3 scale-110">{icon}</div>
      <div className="font-black text-stone-800 group-hover:text-amber-700 transition-colors">{title}</div>
      <div className="text-[10px] text-stone-500 mt-2">{desc}</div>
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