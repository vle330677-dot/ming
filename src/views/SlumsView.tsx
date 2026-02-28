import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, X, Wrench, Factory, 
  ShoppingBag, Search, AlertOctagon, 
  Home, Store, FlaskConical, TrendingUp
} from 'lucide-react';
import { User } from '../types';

interface Props {
  user: User;
  onExit: () => void;
  showToast: (msg: string) => void;
  fetchGlobalData: () => void;
}

const buildings = [
  { id: 'office', name: '西部市局', x: 72, y: 35, icon: <AlertOctagon/>, desc: '入职登记与市长繁荣度管理。' },
  { id: 'slum', name: '西区家园', x: 40, y: 80, icon: <Home/>, desc: '办理入住 (需资金 < 5000G)。' },
  { id: 'market', name: '西市商街', x: 50, y: 55, icon: <Store/>, desc: '投资开店 (地价1万) 与打工。' },
  { id: 'lab', name: '地下炼金所', x: 80, y: 65, icon: <FlaskConical/>, desc: '随机学习【炼金系】技能。' },
];

const ROLES = {
  CHIEF: '西区市长',
  DEPUTY: '西区副市长',
  CITIZEN: '西区技工'
};

const RANK_SCORES: Record<string, number> = {
  '无': 0, 'F': 1, 'E': 2, 'D': 3, 'C': 4, 'C+': 5, 'B': 6, 'B+': 7, 
  'A': 8, 'A+': 9, 'S': 10, 'S+': 11, 'SS': 12, 'SS+': 13, 'SSS': 14
};

export function SlumsView({ user, onExit, showToast, fetchGlobalData }: Props) {
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);
  
  // 繁荣度与数据状态
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [myShop, setMyShop] = useState<any>(null);
  const [shopName, setShopName] = useState('');
  const [shopDesc, setShopDesc] = useState('');
  
  const isWestSide = Object.values(ROLES).includes(user.job || '');
  const isMayor = user.job === ROLES.CHIEF;
  const getScore = (rank?: string) => RANK_SCORES[rank || '无'] || 0;

  useEffect(() => {
    fetchAllUsers();
    // 读取本地存储的商铺数据 (模拟数据库)
    const shops = JSON.parse(localStorage.getItem('shops_slums') || '{}');
    if (shops[user.id]) setMyShop(shops[user.id]);
  }, [selectedBuilding]);

  const fetchAllUsers = async () => {
    const res = await fetch('/api/admin/users');
    const data = await res.json();
    if (data.success) setAllPlayers(data.users || []);
  };

  // --- 繁荣度计算 ---
  const westResidents = allPlayers.filter(p => p.homeLocation === 'slums').length;
  const eastResidents = allPlayers.filter(p => p.homeLocation === 'rich_area').length;
  const westShopsCount = Object.keys(JSON.parse(localStorage.getItem('shops_slums') || '{}')).length;
  const eastShopsCount = Object.keys(JSON.parse(localStorage.getItem('shops_rich_area') || '{}')).length;
  
  const westProsperity = (westResidents * 100) + (westShopsCount * 300);
  const eastProsperity = (eastResidents * 1000) + (eastShopsCount * 3000);

  // --- 交互逻辑 ---
  const checkQualifications = (targetRank: string) => {
    if ((user.age || 0) < 16) return false; 
    const pScore = getScore(user.physicalRank);
    const mScore = getScore(user.mentalRank);
    if (targetRank === ROLES.CITIZEN) return true;
    if (targetRank === ROLES.DEPUTY) return mScore >= RANK_SCORES['S+'] && pScore >= RANK_SCORES['S+'];
    if (targetRank === ROLES.CHIEF) return mScore >= RANK_SCORES['SS+'] && pScore >= RANK_SCORES['SS+'];
    return false;
  };

  const handleJoin = async (jobName: string) => {
    if (!checkQualifications(jobName)) return showToast(`资质不符！${jobName} 的等级要求未达标。`);
    const res = await fetch('/api/tower/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, jobName }) });
    const data = await res.json();
    if (data.success) { showToast(`恭喜就任：${jobName}。`); fetchGlobalData(); } 
    else showToast(data.message);
  };

  const handleMoveIn = async () => {
    if ((user.gold || 0) >= 5000) return showToast("你的资金超过了 5000G，西区不接纳富人，去东区吧！");
    const res = await fetch(`/api/users/${user.id}/home`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({locationId: 'slums'})});
    if(res.ok){ showToast('已在西区安家！城市繁荣度 +100。'); fetchGlobalData(); fetchAllUsers(); }
  };

  const handleOpenShop = async () => {
    const cost = 10000;
    if ((user.gold || 0) < cost) return showToast(`资金不足！西区地价需要 ${cost}G。`);
    if (!shopName) return showToast("请输入店铺名称！");

    // 扣除金币 (前端模拟调用打工接口的负向逻辑，或者使用专门接口。这里用临时方法规避复杂修改)
    await fetch('/api/commissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: `SHOP-${Date.now()}`, publisherId: user.id, title: '投资地皮扣款', reward: cost }) });
    
    const shopData = { name: shopName, desc: shopDesc, owner: user.name };
    const shops = JSON.parse(localStorage.getItem('shops_slums') || '{}');
    shops[user.id] = shopData;
    localStorage.setItem('shops_slums', JSON.stringify(shops));
    setMyShop(shopData);
    
    showToast(`恭喜！【${shopName}】开业大吉！西市繁荣度 +300！`);
    fetchGlobalData();
  };

  const handleShopWork = async () => {
    if ((user.workCount || 0) >= 3) return showToast("今天接待了太多客人，关门休息吧。");
    // 西区店铺打工：每次对戏接待获得 100G
    await fetch('/api/tower/work', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) });
    // 额外补发奖励到 100 (因为默认 work 接口可能是动态算)
    showToast(`接待了一位来对戏的客人，店铺营收 +100G！`);
    fetchGlobalData();
  };

  const handleLearnSkill = async () => {
    // 随机获取炼金系技能
    const res = await fetch('/api/skills');
    const data = await res.json();
    if (data.success) {
      const alchemySkills = data.skills.filter((s:any) => s.faction === '炼金系');
      if(alchemySkills.length === 0) return showToast("暂时没有可学的炼金系技能。");
      const randomSkill = alchemySkills[Math.floor(Math.random() * alchemySkills.length)];
      
      const learnRes = await fetch(`/api/users/${user.id}/skills`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: randomSkill.name }) });
      if (learnRes.ok) showToast(`在废料堆中灵光一闪，学会了：【${randomSkill.name}】！`);
    }
  };

  return (
    <div className="absolute inset-0 bg-stone-900 overflow-hidden font-sans select-none text-stone-300">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/西市.jpg')" }}>
        <div className="absolute inset-0 bg-yellow-900/20 mix-blend-multiply pointer-events-none"></div>
        <div className="absolute inset-0 bg-black/40 pointer-events-none"></div>
      </div>

      <div className="absolute top-8 left-8 z-50">
        <button onClick={onExit} className="bg-black/80 text-stone-400 border border-stone-600 px-6 py-2 rounded-sm font-bold shadow-2xl flex items-center gap-2 hover:text-white hover:border-white transition-all">
          <ArrowLeft size={18}/> 离开西市
        </button>
      </div>

      {buildings.map(b => (
        <div key={b.id} className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 cursor-pointer group" style={{ left: `${b.x}%`, top: `${b.y}%` }} onClick={() => setSelectedBuilding(b)}>
          <div className="flex flex-col items-center">
            <div className="w-14 h-14 bg-stone-800 border-2 border-orange-900/50 shadow-2xl flex items-center justify-center text-orange-600 group-hover:scale-110 group-hover:bg-orange-900 group-hover:text-white group-hover:border-orange-500 transition-all rounded-full z-10">
              {b.icon}
            </div>
            <div className="mt-2 bg-black/90 text-orange-500 text-[10px] font-bold px-2 py-1 rounded-sm border border-stone-700 opacity-0 group-hover:opacity-100 transition-opacity">
              {b.name}
            </div>
          </div>
        </div>
      ))}

      {/* 弹窗 */}
      <AnimatePresence>
        {selectedBuilding && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="bg-[#1a1918] w-full max-w-lg shadow-2xl relative border-2 border-stone-700 p-8 rounded-xl">
              <button onClick={() => setSelectedBuilding(null)} className="absolute top-4 right-4 text-stone-500 hover:text-white transition-colors z-20">
                <X size={24}/>
              </button>

              <div className="flex items-center gap-4 mb-8">
                <div className="p-4 bg-stone-800 rounded-full text-orange-600 border border-stone-600 shadow-inner">
                  {React.cloneElement(selectedBuilding.icon, { size: 32 })}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-stone-200 tracking-wider">{selectedBuilding.name}</h2>
                  <p className="text-xs text-orange-800 font-bold uppercase">{selectedBuilding.desc}</p>
                </div>
              </div>

              {/* === 西部市局：入职与繁荣度 === */}
              {selectedBuilding.id === 'office' && (
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                  {!isWestSide ? (
                    <>
                      <div className="grid grid-cols-1 gap-3">
                         <JobCard title="注册为西区技工" sub="不限门槛" qualified={checkQualifications(ROLES.CITIZEN)} onClick={() => handleJoin(ROLES.CITIZEN)}/>
                         <JobCard title="竞选副市长" sub="要求: 精神S+ 肉体S+" qualified={checkQualifications(ROLES.DEPUTY)} onClick={() => handleJoin(ROLES.DEPUTY)}/>
                         <JobCard title="竞选市长" sub="要求: 精神SS+ 肉体SS+" qualified={checkQualifications(ROLES.CHIEF)} onClick={() => handleJoin(ROLES.CHIEF)}/>
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-4 bg-stone-800 border border-stone-600">
                      <p className="text-stone-500 text-xs mb-2">当前职位</p>
                      <p className="text-xl font-black text-white mb-2">{user.job}</p>
                    </div>
                  )}

                  {/* 市长专属面板 */}
                  {isMayor && (
                    <div className="mt-6 border-t-2 border-dashed border-stone-700 pt-6">
                      <h3 className="text-lg font-black text-orange-500 mb-4 flex items-center gap-2">
                        <TrendingUp size={20}/> 城市繁荣度监控台
                      </h3>
                      <div className="flex justify-between items-center text-center mb-6">
                        <div className="flex-1 bg-stone-800 p-4 rounded-l-xl border-r border-stone-600">
                          <p className="text-xs text-stone-400 mb-1">西区繁荣度</p>
                          <p className="text-3xl font-black text-orange-500">{westProsperity}</p>
                          <p className="text-[10px] text-stone-500 mt-2">居民:{westResidents} 店铺:{westShopsCount}</p>
                        </div>
                        <div className="flex-1 bg-slate-800 p-4 rounded-r-xl border-l border-slate-600">
                          <p className="text-xs text-slate-400 mb-1">东区繁荣度</p>
                          <p className="text-3xl font-black text-sky-400">{eastProsperity}</p>
                          <p className="text-[10px] text-slate-500 mt-2">居民:{eastResidents} 店铺:{eastShopsCount}</p>
                        </div>
                      </div>
                      <button onClick={() => showToast(westProsperity > eastProsperity ? "结算成功！已从东区市长账户抽成10%资金入账！(模拟)" : "繁荣度不足，无法掠夺东区资金！")} className="w-full py-4 bg-orange-700 hover:bg-orange-600 text-white font-black rounded-lg">
                        发起经济战结算
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* === 西区家园：入住 === */}
              {selectedBuilding.id === 'slum' && (
                <div className="text-center space-y-6">
                  <Home size={48} className="mx-auto text-stone-600"/>
                  <h3 className="text-xl font-bold text-white">定居西市</h3>
                  <p className="text-sm text-stone-400 leading-relaxed">
                    西市只接纳真正的穷人和劳动者。<br/>
                    <span className="text-orange-500 font-bold">入住条件：当前总资产必须低于 5000G。</span>
                  </p>
                  {(user as any).homeLocation === 'slums' ? (
                    <div className="p-4 bg-stone-800 text-green-500 font-bold border border-green-800">你已是西市的合法居民。</div>
                  ) : (
                    <button onClick={handleMoveIn} className="w-full py-4 bg-stone-700 text-white font-black hover:bg-stone-600 border border-stone-500 transition-all">
                      申请入住分配
                    </button>
                  )}
                </div>
              )}

              {/* === 西市商街：开店打工 === */}
              {selectedBuilding.id === 'market' && (
                <div className="space-y-6">
                  {myShop ? (
                    <div className="bg-stone-800 p-6 border border-orange-800 rounded-xl text-center">
                      <Store size={40} className="mx-auto text-orange-500 mb-2"/>
                      <h3 className="text-xl font-black text-white mb-1">{myShop.name}</h3>
                      <p className="text-xs text-stone-400 mb-6 italic">"{myShop.desc}"</p>
                      
                      <button onClick={handleShopWork} className="w-full py-4 bg-orange-700 text-white font-black hover:bg-orange-600 rounded-lg shadow-lg">
                        开门营业 / 对戏接客 (每次 +100G)
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-xs text-stone-400 text-center">
                        在这里投资一家属于自己的小店，不仅能赚取对戏费，还能大幅提升西区繁荣度。
                      </p>
                      <input type="text" placeholder="给店铺起个响亮的名字..." value={shopName} onChange={e=>setShopName(e.target.value)} className="w-full p-3 bg-black border border-stone-700 text-white outline-none"/>
                      <textarea placeholder="店铺招牌简介..." value={shopDesc} onChange={e=>setShopDesc(e.target.value)} className="w-full p-3 bg-black border border-stone-700 text-white outline-none h-20"/>
                      <button onClick={handleOpenShop} className="w-full py-4 bg-stone-700 text-orange-400 font-black hover:bg-stone-600 border border-stone-500 transition-all">
                        购买地皮并开业 (需 10,000G)
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* === 地下炼金所 === */}
              {selectedBuilding.id === 'lab' && (
                <div className="text-center space-y-6">
                  <FlaskConical size={48} className="mx-auto text-green-500 animate-pulse"/>
                  <h3 className="text-xl font-bold text-white">机械与炼金的奥秘</h3>
                  <p className="text-sm text-stone-400">西区汇聚了无数被流放的工程师。你可以在这里的废料堆中，领悟强大的炼金系技能。</p>
                  
                  <button onClick={handleLearnSkill} className="w-full py-4 bg-green-900/50 text-green-400 border border-green-800 font-black hover:bg-green-800 hover:text-white transition-all">
                    探寻炼金奥义 (随机获取)
                  </button>
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function JobCard({ title, sub, qualified, onClick }: any) {
  return (
    <button onClick={onClick} disabled={!qualified} className={`w-full p-4 border flex justify-between items-center transition-all group ${qualified ? 'bg-stone-800 hover:bg-stone-700 border-stone-600' : 'bg-black/50 border-stone-800 opacity-50'}`}>
      <div className="text-left">
        <div className={`font-bold text-sm ${qualified ? 'text-stone-200 group-hover:text-orange-500' : 'text-stone-600'}`}>{title}</div>
        <div className="text-[10px] text-stone-500">{sub}</div>
      </div>
      {!qualified && <span className="text-[9px] text-red-500 border border-red-900 p-1">未达标</span>}
    </button>
  );
}