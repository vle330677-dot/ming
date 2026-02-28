import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, X, Gem, 
  Landmark, ShoppingBag, 
  Crown, Home, TrendingUp, ShieldAlert, Coins
} from 'lucide-react';
import { User } from '../types';

interface Props {
  user: User;
  onExit: () => void;
  showToast: (msg: string) => void;
  fetchGlobalData: () => void;
}

const buildings = [
  { id: 'city_hall', name: '东部市局', x: 50, y: 35, icon: <Landmark/>, desc: '权力巅峰与市长繁荣度管理。' },
  { id: 'estate', name: '贵族庄园', x: 25, y: 25, icon: <Home/>, desc: '办理入住 (需资金 > 10,000G)。' },
  { id: 'mall', name: '黄金商业街', x: 35, y: 60, icon: <ShoppingBag/>, desc: '投资商铺 (地价10万) 与高薪打工。' },
  { id: 'club', name: '精英强化会所', x: 75, y: 20, icon: <ShieldAlert/>, desc: '随机学习【强化系】技能。' },
];

const ROLES = {
  CHIEF: '东区市长',
  DEPUTY: '东区副市长',
  NOBLE: '东区贵族'
};

const RANK_SCORES: Record<string, number> = {
  '无': 0, 'F': 1, 'E': 2, 'D': 3, 'C': 4, 'C+': 5, 'B': 6, 'B+': 7, 
  'A': 8, 'A+': 9, 'S': 10, 'S+': 11, 'SS': 12, 'SS+': 13, 'SSS': 14
};

export function RichAreaView({ user, onExit, showToast, fetchGlobalData }: Props) {
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);
  
  // 繁荣度与数据状态
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [myShop, setMyShop] = useState<any>(null);
  const [shopName, setShopName] = useState('');
  const [shopDesc, setShopDesc] = useState('');

  const isEastSide = Object.values(ROLES).includes(user.job || '');
  const isMayor = user.job === ROLES.CHIEF;
  const getScore = (rank?: string) => RANK_SCORES[rank || '无'] || 0;

  useEffect(() => {
    if (selectedBuilding?.id === 'city_hall' || selectedBuilding?.id === 'mall') {
      fetchAllUsers();
      // 安全读取本地存储
      try {
        const shops = JSON.parse(localStorage.getItem('shops_rich_area') || '{}');
        if (shops && shops[user.id]) setMyShop(shops[user.id]);
      } catch (e) { console.error("读取店铺数据失败", e); }
    }
  }, [selectedBuilding]);

  const fetchAllUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.success) setAllPlayers(data.users || []);
    } catch (e) { console.error(e); }
  };

  // --- 繁荣度计算 ---
  const westResidents = allPlayers.filter(p => p.homeLocation === 'slums').length;
  const eastResidents = allPlayers.filter(p => p.homeLocation === 'rich_area').length;
  
  // 安全解析本地存储数据
  const getShopsCount = (key: string) => {
    try {
      return Object.keys(JSON.parse(localStorage.getItem(key) || '{}')).length;
    } catch { return 0; }
  };
  const westShopsCount = getShopsCount('shops_slums');
  const eastShopsCount = getShopsCount('shops_rich_area');
  
  const westProsperity = (westResidents * 100) + (westShopsCount * 300);
  const eastProsperity = (eastResidents * 1000) + (eastShopsCount * 3000);

  // --- 交互逻辑 ---
  const checkQualifications = (targetRank: string) => {
    if ((user.age || 0) < 16) return false; 
    const pScore = getScore(user.physicalRank);
    const mScore = getScore(user.mentalRank);
    if (targetRank === ROLES.NOBLE) return true;
    if (targetRank === ROLES.DEPUTY) return mScore >= RANK_SCORES['S+'] && pScore >= RANK_SCORES['S+'];
    if (targetRank === ROLES.CHIEF) return mScore >= RANK_SCORES['SS+'] && pScore >= RANK_SCORES['SS+'];
    return false;
  };

  const handleJoin = async (jobName: string) => {
    if ((user.age || 0) < 16) return showToast("未成年人禁止涉足政坛，请回学校读书。");
    if (!checkQualifications(jobName)) return showToast(`资质不符！你的等级不足以胜任 ${jobName}。`);
    
    const res = await fetch('/api/tower/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, jobName }) });
    const data = await res.json();
    if (data.success) { showToast(`跻身上流社会，就任：${jobName}。`); fetchGlobalData(); } 
    else showToast(data.message);
  };

  const handleMoveIn = async () => {
    if ((user.gold || 0) < 10000) return showToast("门卫：抱歉，您的资产不足 10,000G，无法在东区置办房产。");
    const res = await fetch(`/api/users/${user.id}/home`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({locationId: 'rich_area'})});
    if(res.ok){ showToast('已成功买下东区庄园！城市繁荣度大幅提升 (+1000)。'); fetchGlobalData(); fetchAllUsers(); }
  };

  const handleOpenShop = async () => {
    const cost = 100000; // 地价 10万
    if ((user.gold || 0) < cost) return showToast(`资金不足！东区寸土寸金，地价需要 ${cost}G。`);
    if (!shopName) return showToast("请输入店铺名称！");

    // 扣费模拟
    await fetch('/api/commissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: `SHOP-${Date.now()}`, publisherId: user.id, title: '投资高档商铺扣款', reward: cost }) });
    
    const shopData = { name: shopName, desc: shopDesc, owner: user.name };
    const shops = JSON.parse(localStorage.getItem('shops_rich_area') || '{}');
    shops[user.id] = shopData;
    localStorage.setItem('shops_rich_area', JSON.stringify(shops));
    setMyShop(shopData);
    
    showToast(`【${shopName}】盛大开业！东市繁荣度暴涨 (+3000)！`);
    fetchGlobalData();
  };

  const handleShopWork = async () => {
    if ((user.workCount || 0) >= 3) return showToast("高净值客户已经接待完毕，今天到此为止。");
    // 东区打工：一次对戏获得 1000G
    await fetch('/api/tower/work', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) });
    showToast(`成功完成了一笔上流对戏订单，店铺营收暴涨 +1000G！`);
    fetchGlobalData();
  };

  const handleLearnSkill = async () => {
    try {
      const res = await fetch('/api/skills/available/' + user.id);
      const data = await res.json();
      if (data.success) {
        const enhanceSkills = data.skills.filter((s:any) => s.faction === '强化系');
        if(enhanceSkills.length === 0) return showToast("会所暂未引进新的强化系项目。");
        const randomSkill = enhanceSkills[Math.floor(Math.random() * enhanceSkills.length)];
        
        const learnRes = await fetch(`/api/users/${user.id}/skills`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: randomSkill.name }) });
        if (learnRes.ok) showToast(`经过昂贵的私教培训，你学会了：【${randomSkill.name}】！`);
      }
    } catch (e) { console.error(e); }
  };

  return (
    <div className="absolute inset-0 bg-slate-50 overflow-hidden font-serif select-none text-slate-800">
      
      {/* 1. 背景层：统一 public 图片 */}
      <div className="absolute inset-0 z-0">
        <img 
          src="/东市.jpg" 
          className="w-full h-full object-cover opacity-80 contrast-110 brightness-110" 
          alt="Rich Area"
        />
        {/* 混合滤镜：暖金色光晕 */}
        <div className="absolute inset-0 bg-gradient-to-tr from-amber-100/40 via-white/20 to-emerald-100/30 mix-blend-overlay pointer-events-none"></div>
      </div>

      {/* 2. 顶部导航 */}
      <div className="absolute top-6 left-6 z-50">
        <button 
          onClick={onExit} 
          className="bg-white/90 backdrop-blur-md text-emerald-800 border border-emerald-200/50 px-5 py-2.5 rounded-full font-bold shadow-xl flex items-center gap-2 hover:bg-emerald-50 hover:scale-105 transition-all active:scale-95"
        >
          <ArrowLeft size={18}/> <span className="hidden md:inline">离开富人区</span>
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
              <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-yellow-50 to-amber-100 border-2 border-amber-300 shadow-[0_10px_30px_rgba(245,158,11,0.3)] flex items-center justify-center text-amber-600 group-hover:scale-110 group-hover:border-amber-500 transition-all rounded-full z-10 relative overflow-hidden">
                <div className="absolute inset-0 bg-white/50 opacity-0 group-hover:opacity-100 transition-opacity blur-md"/>
                {React.cloneElement(b.icon, { size: 32 })}
              </div>
              <div className="mt-2 bg-white/95 backdrop-blur-md text-emerald-900 text-[10px] md:text-xs font-bold px-3 py-1.5 rounded-full border border-emerald-100 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shadow-md whitespace-nowrap">
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
              className="fixed inset-0 bg-emerald-900/20 backdrop-blur-md z-40"
            />

            {/* 弹窗本体 */}
            <motion.div 
              initial={{ y: 50, opacity: 0, scale: 0.95 }} 
              animate={{ y: 0, opacity: 1, scale: 1 }} 
              exit={{ y: 50, opacity: 0, scale: 0.95 }} 
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="bg-white w-full max-w-lg shadow-2xl relative rounded-[32px] border-t-8 border-amber-400 p-8 flex flex-col max-h-[85vh] pointer-events-auto">
                
                <button onClick={() => setSelectedBuilding(null)} className="absolute top-6 right-6 p-2 bg-slate-50 rounded-full hover:bg-slate-100 transition-colors z-20">
                  <X size={20} className="text-slate-500"/>
                </button>

                <div className="flex items-center gap-5 mb-8 border-b border-slate-100 pb-6 mt-2 shrink-0">
                  <div className="p-4 bg-amber-50 rounded-2xl text-amber-600 border border-amber-200 shadow-inner">
                    {React.cloneElement(selectedBuilding.icon, { size: 32 })}
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">{selectedBuilding.name}</h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">{selectedBuilding.desc}</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">

                  {/* === 东部市局 === */}
                  {selectedBuilding.id === 'city_hall' && (
                    <div className="space-y-6">
                      {!isEastSide ? (
                        <>
                          <div className="p-5 bg-sky-50 border border-sky-100 text-sky-900 text-sm italic rounded-2xl shadow-sm">
                            “欢迎来到文明世界。在这里，能力、血统与财富定义了一切。”
                          </div>
                          <div className="grid grid-cols-1 gap-3">
                             <EliteCard title="注册为东区贵族" sub="无特殊限制" qualified={checkQualifications(ROLES.NOBLE)} onClick={() => handleJoin(ROLES.NOBLE)}/>
                             <EliteCard title="竞选副市长" sub="要求: 精神S+ 肉体S+" qualified={checkQualifications(ROLES.DEPUTY)} onClick={() => handleJoin(ROLES.DEPUTY)}/>
                             <EliteCard title="登顶东区市长" sub="要求: 精神SS+ 肉体SS+" qualified={checkQualifications(ROLES.CHIEF)} onClick={() => handleJoin(ROLES.CHIEF)}/>
                          </div>
                        </>
                      ) : (
                        <div className="text-center p-8 bg-slate-50 border border-slate-200 rounded-3xl shadow-inner">
                          <Crown size={48} className="mx-auto text-amber-500 mb-2 drop-shadow-md"/>
                          <p className="text-xs text-slate-400 uppercase tracking-widest mb-2 font-bold">Current Position</p>
                          <h3 className="text-3xl font-black text-slate-800 mb-6">{user.job}</h3>
                        </div>
                      )}

                      {/* 市长专属面板 */}
                      {isMayor && (
                        <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl">
                          <h3 className="text-lg font-black text-sky-600 mb-4 flex items-center gap-2">
                            <TrendingUp size={20}/> 城市繁荣度掌控
                          </h3>
                          <div className="flex justify-between items-center text-center mb-6 bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                            <div className="flex-1 border-r border-slate-100 pr-4">
                              <p className="text-xs text-slate-500 mb-1">东区繁荣度</p>
                              <p className="text-2xl font-black text-sky-500">{eastProsperity}</p>
                              <p className="text-[10px] text-slate-400 mt-1">Pop: {eastResidents}</p>
                            </div>
                            <div className="flex-1 pl-4">
                              <p className="text-xs text-stone-500 mb-1">西区繁荣度</p>
                              <p className="text-2xl font-black text-orange-400">{westProsperity}</p>
                              <p className="text-[10px] text-stone-400 mt-1">Pop: {westResidents}</p>
                            </div>
                          </div>
                          <button onClick={() => showToast(eastProsperity > westProsperity ? "制裁成功！已向西区市长征收10%的高额税赋！(模拟)" : "我们的繁荣度居然落后了，赶紧招商引资！")} className="w-full py-4 bg-sky-600 hover:bg-sky-700 text-white font-black rounded-xl shadow-lg transition-colors text-sm">
                            向西区发起经济制裁
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* === 贵族庄园：入住 === */}
                  {selectedBuilding.id === 'estate' && (
                    <div className="text-center space-y-8 py-4">
                      <div className="relative inline-block">
                         <div className="absolute inset-0 bg-emerald-100 rounded-full blur-xl opacity-50"></div>
                         <Home size={64} className="mx-auto text-emerald-600 relative z-10"/>
                      </div>
                      
                      <div>
                        <h3 className="text-2xl font-black text-slate-800 mb-2">购置顶级庄园</h3>
                        <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">
                          东区只为真正的财富拥有者敞开大门。<br/>
                          <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded">入住验资条件：资产 &gt; 10,000G</span>
                        </p>
                      </div>

                      {(user as any).homeLocation === 'rich_area' ? (
                        <div className="p-5 bg-emerald-50 text-emerald-800 font-bold border border-emerald-200 rounded-2xl flex items-center justify-center gap-2 shadow-sm">
                          <Crown size={18}/> 您已是尊贵的东区户主
                        </div>
                      ) : (
                        <button onClick={handleMoveIn} className="w-full py-4 bg-emerald-600 text-white font-black hover:bg-emerald-700 rounded-2xl shadow-xl shadow-emerald-100 transition-all text-lg tracking-wide">
                          出示资产并办理入住
                        </button>
                      )}
                    </div>
                  )}

                  {/* === 商业街：开店 === */}
                  {selectedBuilding.id === 'mall' && (
                    <div className="space-y-6">
                      {myShop ? (
                        <div className="bg-gradient-to-br from-amber-50 to-white p-8 border border-amber-200 rounded-3xl text-center shadow-sm">
                          <Gem size={48} className="mx-auto text-amber-500 mb-4 drop-shadow-md"/>
                          <h3 className="text-2xl font-black text-amber-900 mb-2">{myShop.name}</h3>
                          <p className="text-xs text-amber-700/80 mb-8 italic font-medium">"{myShop.desc}"</p>
                          
                          <button onClick={handleShopWork} className="w-full py-4 bg-amber-500 text-white font-black hover:bg-amber-600 rounded-2xl shadow-lg shadow-amber-200 transition-all flex items-center justify-center gap-2">
                            <Coins size={18}/> 商业剪彩 / 对戏接客 (+1000G)
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-5">
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                             <p className="text-xs text-slate-500 font-bold">
                               购买黄金地段的商铺，赚取百倍于平民的利润，同时大幅拉升东区繁荣指数。
                             </p>
                          </div>
                          
                          <div className="space-y-3">
                            <input type="text" placeholder="输入奢侈品牌名称..." value={shopName} onChange={e=>setShopName(e.target.value)} className="w-full p-4 bg-white border border-slate-200 rounded-xl outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-50 transition-all font-bold"/>
                            <textarea placeholder="品牌格调简介..." value={shopDesc} onChange={e=>setShopDesc(e.target.value)} className="w-full p-4 bg-white border border-slate-200 rounded-xl outline-none h-24 focus:border-amber-400 focus:ring-4 focus:ring-amber-50 transition-all resize-none text-sm"/>
                          </div>
                          
                          <button onClick={handleOpenShop} className="w-full py-4 bg-slate-900 text-amber-400 font-black hover:bg-slate-800 rounded-2xl shadow-xl transition-all flex justify-center items-center gap-2">
                            <Gem size={18}/> 全款买下地皮 (需 100,000G)
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* === 精英强化会所 === */}
                  {selectedBuilding.id === 'club' && (
                    <div className="text-center space-y-8 py-6">
                      <div className="relative inline-block">
                         <div className="absolute inset-0 bg-sky-100 rounded-full blur-xl opacity-60"></div>
                         <ShieldAlert size={64} className="mx-auto text-sky-600 relative z-10"/>
                      </div>
                      
                      <div>
                        <h3 className="text-2xl font-black text-slate-800 mb-2">顶级肉体强化</h3>
                        <p className="text-sm text-slate-500 max-w-xs mx-auto">东区从不依靠蛮力，我们使用最先进的科技仪器进行机能刺激。</p>
                      </div>
                      
                      <button onClick={handleLearnSkill} className="w-full py-5 bg-sky-50 text-sky-700 font-black hover:bg-sky-100 rounded-2xl border border-sky-200 transition-all text-sm uppercase tracking-wider">
                        申请高级强化课程 (随机获取)
                      </button>
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

function EliteCard({ title, sub, qualified, onClick }: any) {
  return (
    <button onClick={onClick} disabled={!qualified} className={`w-full p-5 border rounded-2xl flex justify-between items-center group transition-all 
      ${qualified 
        ? 'bg-white border-slate-200 hover:border-amber-400 hover:shadow-lg cursor-pointer' 
        : 'bg-slate-50 border-slate-100 opacity-60 grayscale cursor-not-allowed'
      }`}>
      <div className="text-left">
        <div className={`font-black text-sm ${qualified ? 'text-slate-800 group-hover:text-amber-700' : 'text-slate-500'}`}>{title}</div>
        <div className="text-[10px] text-slate-400 font-serif italic mt-1">{sub}</div>
      </div>
      {!qualified && <span className="text-[10px] text-red-500 bg-red-50 px-2 py-1 rounded-lg font-bold border border-red-100">等级不够</span>}
    </button>
  );
}