import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  MessageSquare,
  Package,
  Zap,
  User as UserIcon,
  Trash2,
  MapPin,
  CheckCircle,
  XCircle,
  Edit3,
  ShieldAlert,
  Users,
  Filter,
  Download,
  Shield,
  KeyRound,
  UserCheck,
  Megaphone,
  LogOut,
  RefreshCw
} from 'lucide-react';

type AdminTab = 'users' | 'logs' | 'items' | 'skills' | 'security' | 'announcements';

type UserStatus =
  | 'pending'
  | 'approved'
  | 'dead'
  | 'ghost'
  | 'rejected'
  | 'pending_death'
  | 'pending_ghost';

interface AdminUser {
  id: number;
  name: string;
  age?: number;
  role?: string;
  faction?: string;
  mentalRank?: string;
  physicalRank?: string;
  ability?: string;
  spiritName?: string;
  profileText?: string;
  currentLocation?: string;
  status: UserStatus;
  deathDescription?: string;
  password?: string;
}

interface UserSkill {
  id: number;
  name: string;
  level: number;
}

interface RPArchive {
  id: string;
  title: string;
  locationName: string;
  participantNames: string;
  createdAt: string;
  messages: any[];
}

interface GlobalItem {
  id: number;
  name: string;
  description?: string;
  locationTag?: string;
  npcId?: string;
  price?: number;
  faction?: string;
  tier?: string;
  itemType?: string;
  effectValue?: number;
}

interface GlobalSkill {
  id: number;
  name: string;
  faction?: string;
  tier?: string;
  description?: string;
  npcId?: string;
}

interface AdminWhitelistItem {
  id?: number;
  name: string;
  code_name?: string | null;
  enabled?: number;
  createdAt?: string;
}

interface OnlineAdmin {
  userId: number;
  userName: string;
  lastSeenAt: string;
  adminAvatarUrl?: string | null;
}

interface AdminActionLog {
  id: number;
  adminName: string;
  action: string;
  targetType?: string;
  targetId?: string;
  detail?: string;
  createdAt: string;
}

const FACTIONS = ['物理系', '元素系', '精神系', '感知系', '信息系', '治疗系', '强化系', '炼金系', '圣所', '普通人', '通用'];
const TIERS = ['低阶', '中阶', '高阶'];
const ITEM_TYPES = ['回复道具', '任务道具', '技能书道具', '贵重物品'];

const ADMIN_TOKEN_KEY = 'ADMIN_TOKEN';
const ADMIN_NAME_KEY = 'ADMIN_NAME';
const FIXED_ADMIN_NAME = '塔';

export function AdminView() {
  // ---------------- 管理员登录态 ----------------
  const [authStep, setAuthStep] = useState<'code' | 'name' | 'done'>('code');
  const [entryCode, setEntryCode] = useState('');
  const [adminNameInput, setAdminNameInput] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminToken, setAdminToken] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // ---------------- 页面状态 ----------------
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState('');
  const [error, setError] = useState('');

  // ---------------- 数据 ----------------
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [items, setItems] = useState<GlobalItem[]>([]);
  const [skills, setSkills] = useState<GlobalSkill[]>([]);
  const [archives, setArchives] = useState<RPArchive[]>([]);
  const [archiveSearch, setArchiveSearch] = useState('');
  const [adminLogs, setAdminLogs] = useState<AdminActionLog[]>([]);

  // ---------------- 管理员安全相关 ----------------
  const [whitelist, setWhitelist] = useState<AdminWhitelistItem[]>([]);
  const [onlineAdmins, setOnlineAdmins] = useState<OnlineAdmin[]>([]);
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminCodeName, setNewAdminCodeName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  // ---------------- 编辑用户 ----------------
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editingUserSkills, setEditingUserSkills] = useState<UserSkill[]>([]);

  // ---------------- 技能筛选 ----------------
  const [skillFactionFilter, setSkillFactionFilter] = useState('ALL');

  const [deletingArchiveId, setDeletingArchiveId] = useState<string | null>(null);

const handleDeleteArchive = async (arc: RPArchive) => {
  if (!confirm(`确定删除存档《${arc.title}》吗？此操作不可恢复。`)) return;
  try {
    setDeletingArchiveId(arc.id);
    const data = await authedFetch(`/api/admin/rp_archives/${encodeURIComponent(arc.id)}`, {
      method: 'DELETE'
    });
    setArchives(prev => prev.filter(x => x.id !== arc.id));
    showOk(data.message || `已删除存档 ${arc.id}`);
  } catch (e: any) {
    alert(e.message || '删除失败');
  } finally {
    setDeletingArchiveId(null);
  }
};


  // ---------------- 新增物品/技能/公告 ----------------
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    locationTag: '',
    price: 0,
    faction: '通用',
    tier: '低阶',
    itemType: '回复道具',
    effectValue: 0
  });

  const [newSkill, setNewSkill] = useState({
    name: '',
    faction: '物理系',
    tier: '低阶',
    description: '',
    npcId: ''
  });

  const [newAnnouncement, setNewAnnouncement] = useState({
    type: 'system',
    title: '',
    content: ''
  });

  // ---------------- 工具 ----------------
  const authedFetch = async (url: string, init?: RequestInit) => {
    const res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: adminToken ? `Bearer ${adminToken}` : '',
        ...(init?.headers || {})
      }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.message || `请求失败: ${res.status}`);
    }
    return data;
  };

  const showOk = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(''), 2600);
  };

  // ---------------- 初始化管理员会话 ----------------
  useEffect(() => {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY) || '';
    const name = localStorage.getItem(ADMIN_NAME_KEY) || '';
    if (token) {
      setAdminToken(token);
      setAdminName(name || '');
      setAuthStep('done');
    }
  }, []);

  // ---------------- 拉数据 ----------------
  useEffect(() => {
    if (authStep !== 'done') return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, authStep]);

  useEffect(() => {
    if (editingUser) {
      fetchUserSkills(editingUser.id);
    } else {
      setEditingUserSkills([]);
    }
  }, [editingUser]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'users') {
        const data = await authedFetch('/api/admin/users');
        setUsers(data.users || []);
      } else if (activeTab === 'logs') {
        const data = await authedFetch('/api/admin/rp_archives');
        setArchives(data.archives || []);
      } else if (activeTab === 'items') {
        const data = await authedFetch('/api/items');
        setItems(data.items || []);
      } else if (activeTab === 'skills') {
        const data = await authedFetch('/api/skills');
        setSkills(data.skills || []);
      } else if (activeTab === 'security') {
        await Promise.all([fetchWhitelist(), fetchOnlineAdmins(), fetchAdminLogs()]);
      } else if (activeTab === 'announcements') {
        await fetchAdminLogs();
      }
    } catch (e: any) {
      setError(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserSkills = async (userId: number) => {
    try {
      const data = await authedFetch(`/api/users/${userId}/skills`);
      if (data.success) setEditingUserSkills(data.skills || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchWhitelist = async () => {
    try {
      const data = await authedFetch('/api/admin/whitelist');
      setWhitelist(data.rows || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchOnlineAdmins = async () => {
    try {
      const data = await authedFetch('/api/admin/online');
      setOnlineAdmins(data.admins || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAdminLogs = async () => {
    try {
      const data = await authedFetch('/api/admin/action-logs');
      setAdminLogs(data.logs || []);
    } catch (e) {
      console.error(e);
    }
  };

  // ---------------- 登录流程 ----------------
  const submitCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryCode.trim()) {
      setError('请输入管理员入口代码');
      return;
    }
    setError('');
    setAuthStep('name');
  };

  const submitAdminName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminNameInput.trim()) {
      setError('请输入管理员名字');
      return;
    }
    setAuthLoading(true);
    setError('');
    try {
      const data = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryCode: entryCode.trim(), adminName: adminNameInput.trim() })
      }).then(r => r.json());

      if (!data?.success || !data?.token) {
        throw new Error(data?.message || '管理员验证失败');
      }

      localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
      localStorage.setItem(ADMIN_NAME_KEY, data.adminName || adminNameInput.trim());
      setAdminToken(data.token);
      setAdminName(data.adminName || adminNameInput.trim());
      setAuthStep('done');
      showOk(`欢迎回来，管理员 ${data.adminName || adminNameInput.trim()}`);
      setActiveTab('users');
    } catch (e: any) {
      setError(e.message || '登录失败');
    } finally {
      setAuthLoading(false);
    }
  };

  const logoutAdmin = () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_NAME_KEY);
    setAdminToken('');
    setAdminName('');
    setEntryCode('');
    setAdminNameInput('');
    setAuthStep('code');
    setUsers([]);
    setItems([]);
    setSkills([]);
    setArchives([]);
    setWhitelist([]);
    setOnlineAdmins([]);
    setAdminLogs([]);
    setFlash('');
    setError('');
  };

  // ---------------- 安全与名单管理 ----------------
  const mergedWhitelist = useMemo(() => {
    const map = new Map<string, AdminWhitelistItem>();
    whitelist.forEach(w => map.set(w.name, w));
    if (!map.has(FIXED_ADMIN_NAME)) {
      map.set(FIXED_ADMIN_NAME, { name: FIXED_ADMIN_NAME, code_name: '固定管理员', enabled: 1 });
    }
    return Array.from(map.values());
  }, [whitelist]);

  const addWhitelistAdmin = async () => {
    if (!newAdminName.trim()) return alert('请输入管理员名字');
    try {
      const data = await authedFetch('/api/admin/whitelist', {
        method: 'POST',
        body: JSON.stringify({
          name: newAdminName.trim(),
          codeName: newAdminCodeName.trim() || null
        })
      });
      await fetchWhitelist();
      await fetchAdminLogs();
      setNewAdminName('');
      setNewAdminCodeName('');
      showOk(data.message || `管理员 ${adminName} 编辑了管理员名单：新增 ${newAdminName.trim()}`);
    } catch (e: any) {
      alert(e.message || '添加失败');
    }
  };

  const removeWhitelistAdmin = async (name: string) => {
    if (name === FIXED_ADMIN_NAME) return alert(`固定管理员【${FIXED_ADMIN_NAME}】不可删除`);
    if (!confirm(`确定删除管理员 ${name} 吗？`)) return;
    try {
      const data = await authedFetch(`/api/admin/whitelist/${encodeURIComponent(name)}`, {
        method: 'DELETE'
      });
      await fetchWhitelist();
      await fetchAdminLogs();
      showOk(data.message || `管理员 ${adminName} 编辑了管理员名单：删除 ${name}`);
    } catch (e: any) {
      alert(e.message || '删除失败');
    }
  };

  const updateAdminAvatar = async () => {
    try {
      const data = await authedFetch('/api/admin/profile/avatar', {
        method: 'PUT',
        body: JSON.stringify({ avatarUrl: avatarUrl.trim() || null })
      });
      await fetchOnlineAdmins();
      await fetchAdminLogs();
      showOk(data.message || `管理员 ${adminName} 编辑了头像`);
    } catch (e: any) {
      alert(e.message || '头像更新失败');
    }
  };

  // ---------------- 归档过滤与导出 ----------------
  const filteredArchives = useMemo(() => {
    if (!archiveSearch.trim()) return archives;
    const term = archiveSearch.toLowerCase();
    return archives.filter(
      a =>
        (a.title && a.title.toLowerCase().includes(term)) ||
        (a.locationName && a.locationName.toLowerCase().includes(term)) ||
        (a.participantNames && a.participantNames.toLowerCase().includes(term))
    );
  }, [archives, archiveSearch]);

  const exportFilteredArchives = () => {
    if (filteredArchives.length === 0) return alert('没有可导出的数据');
    let text = `===== 塔区全域对戏档案库 (共 ${filteredArchives.length} 卷) =====\n\n`;

    filteredArchives.forEach(arc => {
      text += `========================================\n`;
      text += `【归档号】${arc.id}\n`;
      text += `【剧  目】${arc.title}\n`;
      text += `【地  点】${arc.locationName || '未知'}\n`;
      text += `【参演者】${arc.participantNames}\n`;
      text += `【时  间】${new Date(arc.createdAt).toLocaleString()}\n`;
      text += `========================================\n\n`;
      arc.messages?.forEach((m: any) => {
        if (m.type === 'system') text += `[系统]: ${m.content}\n\n`;
        else text += `[${m.senderName}]:\n${m.content}\n\n`;
      });
      text += `\n`;
    });

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `世界对戏归档库_导出.txt`;
    link.click();
  };

  // ---------------- 用户管理 ----------------
  const handleStatusChange = async (id: number, status: UserStatus, userObj?: AdminUser) => {
    try {
      if (status === 'approved' && userObj?.status === 'pending_ghost') {
        await authedFetch(`/api/admin/users/${id}`, {
          method: 'PUT',
          body: JSON.stringify({
            ...userObj,
            role: '鬼魂',
            physicalRank: '无',
            status: 'approved'
          })
        });
        await fetchData();
        return;
      }

      await authedFetch(`/api/admin/users/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status })
      });
      await fetchData();
      showOk(`管理员 ${adminName} 编辑了玩家状态`);
    } catch (e: any) {
      alert(e.message || '状态更新失败');
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('⚠️ 警告：确定要彻底删除该角色吗？此操作不可恢复。')) return;
    try {
      await authedFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      fetchData();
      showOk(`管理员 ${adminName} 删除了玩家 #${id}`);
    } catch (e: any) {
      alert(e.message || '删除失败');
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    try {
      await authedFetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        body: JSON.stringify(editingUser)
      });
      setEditingUser(null);
      showOk(`管理员 ${adminName} 编辑了玩家 ${editingUser.name}`);
      fetchData();
    } catch (e: any) {
      alert(e.message || '更新失败');
    }
  };

  const handleDeleteUserSkill = async (skillId: number) => {
    if (!editingUser) return;
    if (!confirm('确定要遗忘该技能吗？')) return;
    try {
      await authedFetch(`/api/users/${editingUser.id}/skills/${skillId}`, { method: 'DELETE' });
      fetchUserSkills(editingUser.id);
    } catch (e) {
      alert('删除失败');
    }
  };

  // ---------------- 物品与技能 ----------------
  const addItem = async () => {
    if (!newItem.name.trim() || !newItem.locationTag.trim()) {
      alert('请填写物品名称和地点Tag');
      return;
    }
    try {
      const data = await authedFetch('/api/admin/items', {
        method: 'POST',
        body: JSON.stringify(newItem)
      });
      setNewItem({
        name: '',
        description: '',
        locationTag: '',
        price: 0,
        faction: '通用',
        tier: '低阶',
        itemType: '回复道具',
        effectValue: 0
      });
      fetchData();
      showOk(data.message || `管理员 ${adminName} 编辑了物品 ${newItem.name}`);
    } catch (e: any) {
      alert(e.message || '新增失败');
    }
  };

  const addSkill = async () => {
    if (!newSkill.name.trim()) {
      alert('请填写技能名称');
      return;
    }
    try {
      const data = await authedFetch('/api/admin/skills', {
        method: 'POST',
        body: JSON.stringify(newSkill)
      });
      setNewSkill({ name: '', faction: '物理系', tier: '低阶', description: '', npcId: '' });
      fetchData();
      showOk(data.message || `管理员 ${adminName} 编辑了技能 ${newSkill.name}`);
    } catch (e: any) {
      alert(e.message || '新增失败');
    }
  };

  const filteredSkills = useMemo(() => {
    if (skillFactionFilter === 'ALL') return skills;
    return skills.filter(s => s.faction === skillFactionFilter);
  }, [skills, skillFactionFilter]);

  // ---------------- 公告 ----------------
  const publishAnnouncement = async () => {
    if (!newAnnouncement.title.trim() || !newAnnouncement.content.trim()) {
      alert('请填写公告标题与内容');
      return;
    }
    try {
      const data = await authedFetch('/api/admin/announcements', {
        method: 'POST',
        body: JSON.stringify(newAnnouncement)
      });
      setNewAnnouncement({ type: 'system', title: '', content: '' });
      await fetchAdminLogs();
      showOk(data.message || `管理员 ${adminName} 编辑了公告 ${newAnnouncement.title}`);
    } catch (e: any) {
      alert(e.message || '发布失败');
    }
  };

  // ---------------- 登录UI：代码步骤 ----------------
  if (authStep === 'code') {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
          <h2 className="text-2xl font-black mb-2 flex items-center gap-2">
            <Shield className="text-sky-600" size={22} />
            管理员入口
          </h2>
          <p className="text-sm text-slate-500 mb-6">第一步：输入管理员入口代码</p>

          <form onSubmit={submitCode} className="space-y-3">
            <input
              type="password"
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500/20 font-bold"
              placeholder="请输入代码"
              value={entryCode}
              onChange={e => setEntryCode(e.target.value)}
              autoFocus
            />
            <button className="w-full py-3 rounded-2xl bg-slate-900 text-white font-black hover:bg-slate-800">
              下一步
            </button>
          </form>

          {error && <p className="text-rose-500 text-sm mt-3 font-bold">{error}</p>}
        </div>
      </div>
    );
  }

  // ---------------- 登录UI：名字步骤 ----------------
  if (authStep === 'name') {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
          <h2 className="text-2xl font-black mb-2 flex items-center gap-2">
            <UserCheck className="text-indigo-600" size={22} />
            管理员身份确认
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            第二步：输入管理员名字
          </p>

          <form onSubmit={submitAdminName} className="space-y-3">
            <input
              type="text"
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500/20 font-bold"
              placeholder="请输入管理员名字"
              value={adminNameInput}
              onChange={e => setAdminNameInput(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAuthStep('code')}
                className="w-1/3 py-3 rounded-2xl bg-slate-100 text-slate-600 font-black"
              >
                返回
              </button>
              <button
                type="submit"
                disabled={authLoading}
                className="flex-1 py-3 rounded-2xl bg-slate-900 text-white font-black hover:bg-slate-800 disabled:opacity-60"
              >
                {authLoading ? '验证中...' : '进入后台'}
              </button>
            </div>
          </form>

          {error && <p className="text-rose-500 text-sm mt-3 font-bold">{error}</p>}
        </div>
      </div>
    );
  }

  // ---------------- 后台主界面 ----------------
  return (
    <div className="min-h-screen bg-[#f8fafc] p-8 font-sans text-slate-800">
      <div className="max-w-[1450px] mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <h1 className="text-3xl font-black tracking-tighter flex items-center gap-3">
            命之塔 <span className="text-sky-600 bg-sky-50 px-3 py-1 rounded-xl text-xl">ADMIN</span>
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-2 rounded-xl bg-white border border-slate-200 font-bold text-slate-600">
              当前管理员：{adminName || '-'}
            </span>
            <button
              onClick={fetchData}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              title="刷新"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={logoutAdmin}
              className="px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 flex items-center gap-1"
            >
              <LogOut size={14} /> 退出
            </button>
          </div>
        </header>

        <nav className="flex flex-wrap bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 mb-6">
          <TabBtn active={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={<UserIcon size={18} />} label="角色审核与管理" />
          <TabBtn active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon={<MessageSquare size={18} />} label="对戏区域归档" />
          <TabBtn active={activeTab === 'items'} onClick={() => setActiveTab('items')} icon={<Package size={18} />} label="世界物品库" />
          <TabBtn active={activeTab === 'skills'} onClick={() => setActiveTab('skills')} icon={<Zap size={18} />} label="派系技能库" />
          <TabBtn active={activeTab === 'announcements'} onClick={() => setActiveTab('announcements')} icon={<Megaphone size={18} />} label="公告管理" />
          <TabBtn active={activeTab === 'security'} onClick={() => setActiveTab('security')} icon={<KeyRound size={18} />} label="管理员安全" />
        </nav>

        {loading && <div className="mb-4 text-xs text-slate-500 font-bold">加载中...</div>}
        {flash && <div className="mb-4 text-sm px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">{flash}</div>}
        {error && <div className="mb-4 text-sm px-4 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-bold">{error}</div>}

        <AnimatePresence mode="wait">
          {/* 1) 用户 */}
          {activeTab === 'users' && (
            <motion.div key="users" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap">
                  <thead className="bg-slate-50 border-b text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="p-6">角色档案 / 年龄</th>
                      <th className="p-6">归属派系 / 等级</th>
                      <th className="p-6">当前位置</th>
                      <th className="p-6">塔区许可状态</th>
                      <th className="p-6 text-right">管理操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-6">
                          <div className="font-black text-slate-900 text-base mb-1">{u.name}</div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black ${(u.age ?? 0) < 16 ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-500'}`}>
                              {(u.age ?? 0)} 岁
                            </span>
                            <span className="text-xs text-slate-400 font-medium">{(u.age ?? 0) < 16 ? '未分化幼崽' : (u.role || '未分化')}</span>
                          </div>
                        </td>

                        <td className="p-6">
                          <div className="text-xs font-black text-sky-600 uppercase tracking-widest mb-1">{u.faction || '—'}</div>
                          <div className="text-[11px] font-mono font-bold text-slate-500">
                            神: <span className="text-sky-500">{u.mentalRank || '—'}</span> / 体: <span className="text-rose-500">{u.physicalRank || '—'}</span>
                          </div>
                        </td>

                        <td className="p-6 text-slate-500 text-xs font-medium flex items-center gap-1 mt-3">
                          <MapPin size={14} className="text-slate-300" /> {u.currentLocation || '暂未登录'}
                        </td>

                        <td className="p-6">
                          {u.status === 'pending' && <Badge cls="bg-amber-50 text-amber-600 border-amber-200" text="待审核" />}
                          {u.status === 'approved' && <Badge cls="bg-emerald-50 text-emerald-600 border-emerald-200" text="已过审" />}
                          {u.status === 'rejected' && <Badge cls="bg-rose-50 text-rose-600 border-rose-200" text="已驳回" />}
                          {u.status === 'dead' && <Badge cls="bg-slate-100 text-slate-600 border-slate-200" text="已死亡" />}
                          {u.status === 'ghost' && <Badge cls="bg-violet-50 text-violet-700 border-violet-200" text="鬼魂" />}
                          {u.status === 'pending_death' && <Badge cls="bg-rose-600 text-white border-rose-600" text="死亡待审" />}
                          {u.status === 'pending_ghost' && <Badge cls="bg-violet-600 text-white border-violet-600" text="化鬼待审" />}
                        </td>

                        <td className="p-6">
                          <div className="flex items-center justify-end gap-3">
                            {u.status === 'pending' && (
                              <div className="flex gap-2 mr-4 border-r pr-4">
                                <button onClick={() => handleStatusChange(u.id, 'approved')} className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-500 hover:text-white transition-colors" title="通过">
                                  <CheckCircle size={18} />
                                </button>
                                <button onClick={() => handleStatusChange(u.id, 'rejected')} className="p-1.5 bg-rose-100 text-rose-600 rounded-lg hover:bg-rose-500 hover:text-white transition-colors" title="驳回">
                                  <XCircle size={18} />
                                </button>
                              </div>
                            )}

                            {(u.status === 'pending_death' || u.status === 'pending_ghost') && (
                              <div className="flex gap-2 mr-4 border-r pr-4">
                                <button
                                  onClick={() => alert(`【玩家谢幕戏文本】\n${u.deathDescription || '无内容'}`)}
                                  className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 text-xs font-black"
                                >
                                  查看谢幕戏
                                </button>

                                {u.status === 'pending_death' && (
                                  <button
                                    onClick={() => handleStatusChange(u.id, 'dead', u)}
                                    className="p-1.5 bg-rose-100 text-rose-600 rounded-lg hover:bg-rose-500 hover:text-white transition-colors"
                                    title="准许死亡"
                                  >
                                    <CheckCircle size={18} />
                                  </button>
                                )}

                                {u.status === 'pending_ghost' && (
                                  <button
                                    onClick={() => handleStatusChange(u.id, 'approved', u)}
                                    className="p-1.5 bg-violet-100 text-violet-600 rounded-lg hover:bg-violet-500 hover:text-white transition-colors"
                                    title="准许化鬼"
                                  >
                                    <CheckCircle size={18} />
                                  </button>
                                )}

                                <button
                                  onClick={() => handleStatusChange(u.id, 'rejected', u)}
                                  className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-300 transition-colors"
                                  title="驳回"
                                >
                                  <XCircle size={18} />
                                </button>
                              </div>
                            )}

                            <button onClick={() => setEditingUser(u)} className="flex items-center gap-1 text-sky-600 text-xs font-bold hover:bg-sky-50 px-3 py-1.5 rounded-lg transition-colors">
                              <Edit3 size={14} /> 编辑
                            </button>
                            <button onClick={() => handleDeleteUser(u.id)} className="flex items-center gap-1 text-rose-500 text-xs font-bold hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-colors">
                              <Trash2 size={14} /> 删除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-10 text-center text-slate-400">
                          暂无玩家数据
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* 2) 对戏归档 */}
          {activeTab === 'logs' && (
            <motion.div key="logs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
                <div className="flex-1 w-full relative">
                  <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={archiveSearch}
                    onChange={e => setArchiveSearch(e.target.value)}
                    placeholder="输入玩家名字、剧目标题或地点名称进行检索..."
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-sky-500/20 text-sm font-bold text-slate-700"
                  />
                </div>
                <button onClick={exportFilteredArchives} className="w-full md:w-auto flex justify-center items-center gap-2 px-6 py-3 bg-slate-900 text-white font-black rounded-xl hover:bg-slate-800 transition-colors shadow-lg whitespace-nowrap">
                  <Download size={16} /> 导出当前结果 (TXT)
                </button>
              </div>

              {filteredArchives.length === 0 ? (
                <div className="text-center py-20 text-slate-400 font-bold bg-white rounded-3xl border border-slate-200">没有找到匹配的归档记录。</div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {filteredArchives.map(arc => (
                    <div key={arc.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                      <div className="bg-slate-50 p-5 border-b border-slate-100">
                        <div className="flex items-start justify-between gap-3 mb-2">
  <h3 className="text-lg font-black text-slate-900">{arc.title}</h3>
  <button
    onClick={() => handleDeleteArchive(arc)}
    disabled={deletingArchiveId === arc.id}
    className="text-xs px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:opacity-60"
  >
    {deletingArchiveId === arc.id ? '删除中...' : '删除存档'}
  </button>
</div>

                        <div className="flex flex-wrap gap-2 text-xs font-bold">
                          <span className="px-2 py-1 bg-sky-100 text-sky-700 rounded-md flex items-center gap-1"><MapPin size={12} /> {arc.locationName || '未知'}</span>
                          <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-md flex items-center gap-1"><Users size={12} /> {arc.participantNames}</span>
                          <span className="px-2 py-1 bg-slate-200 text-slate-600 rounded-md ml-auto">{new Date(arc.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="p-5 flex-1 max-h-[350px] overflow-y-auto custom-scrollbar bg-slate-50/50 space-y-4">
                        {arc.messages?.map((m, idx) => (
                          m.type === 'system' ? (
                            <div key={idx} className="text-center text-[10px] font-bold text-slate-400 my-2">— {m.content} —</div>
                          ) : (
                            <div key={idx} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                              <span className="text-[10px] font-black text-sky-600 block mb-1">{m.senderName}</span>
                              <p className="text-sm text-slate-700 whitespace-pre-wrap">{m.content}</p>
                            </div>
                          )
                        ))}
                        {(!arc.messages || arc.messages.length === 0) && <p className="text-slate-400 text-xs text-center">空档案：该会话没有产生任何聊天记录。</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* 3) 物品 */}
          {activeTab === 'items' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm h-fit sticky top-8">
                <h3 className="font-black text-lg mb-6 flex items-center gap-2">
                  <Package size={20} className="text-amber-500" /> 部署新物品
                </h3>
                <div className="space-y-4">
                  <Input label="物品名称" value={newItem.name} onChange={(v: string) => setNewItem({ ...newItem, name: v })} />
                  <Input label="归属地图Tag (如 slums 或 all)" value={newItem.locationTag} onChange={(v: string) => setNewItem({ ...newItem, locationTag: v })} />

                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">专属阵营</label>
                      <select className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-sky-500/20 text-sm font-bold" value={newItem.faction} onChange={(e) => setNewItem({ ...newItem, faction: e.target.value })}>
                        {FACTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">道具品阶</label>
                      <select className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-sky-500/20 text-sm font-bold" value={newItem.tier} onChange={(e) => setNewItem({ ...newItem, tier: e.target.value })}>
                        {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">道具类型</label>
                      <select className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-sky-500/20 text-sm font-bold" value={newItem.itemType} onChange={(e) => setNewItem({ ...newItem, itemType: e.target.value })}>
                        {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <Input label="效果数值/回收金" type="number" value={String(newItem.effectValue)} onChange={(v: string) => setNewItem({ ...newItem, effectValue: parseInt(v, 10) || 0 })} />
                  </div>

                  <textarea
                    placeholder="物品效果描述..."
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500/20 text-sm h-20"
                    value={newItem.description}
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  />
                  <button onClick={addItem} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition-all shadow-lg mt-2">
                    上传至世界数据库
                  </button>
                </div>
              </div>

              <div className="lg:col-span-2 bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b text-[11px] font-bold text-slate-400 uppercase">
                    <tr>
                      <th className="p-6">物品信息</th>
                      <th className="p-6">类别/属性</th>
                      <th className="p-6 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((i: any) => (
                      <tr key={i.id} className="hover:bg-slate-50/50">
                        <td className="p-6">
                          <div className="font-bold text-slate-900">{i.name}</div>
                          <div className="text-xs text-slate-400 mt-1 max-w-xs truncate">{i.description || '无描述'}</div>
                          <div className="text-[10px] font-mono text-amber-600 mt-1">价值: {i.price || 0} G</div>
                        </td>
                        <td className="p-6">
                          <div className="flex gap-1 mb-1">
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px] font-black">{i.tier || '低阶'}</span>
                            <span className="px-2 py-0.5 bg-sky-50 text-sky-700 rounded text-[10px] font-black">{i.itemType || '未知'}</span>
                          </div>
                          <div className="text-[10px] text-slate-400">效用值: <span className="font-bold">{i.effectValue || 0}</span></div>
                        </td>
                        <td className="p-6 text-right">
                          <button
                            onClick={async () => {
                              if (!confirm('确定删除该物品？')) return;
                              await authedFetch(`/api/admin/items/${i.id}`, { method: 'DELETE' });
                              fetchData();
                              showOk(`管理员 ${adminName} 编辑了物品库：删除 ${i.name}`);
                            }}
                            className="text-slate-300 hover:text-rose-500 p-2"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr>
                        <td colSpan={3} className="p-10 text-center text-slate-400">
                          暂无物品数据
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4) 技能 */}
          {activeTab === 'skills' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm h-fit sticky top-8">
                <h3 className="font-black text-lg mb-6 flex items-center gap-2">
                  <Zap size={20} className="text-sky-500" /> 录入派系奥义
                </h3>
                <div className="space-y-4">
                  <Input label="技能名称" value={newSkill.name} onChange={(v: string) => setNewSkill({ ...newSkill, name: v })} />
                  <div className="flex gap-2">
                    <div className="flex-1 flex flex-col gap-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">专属派系限制</label>
                      <select className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500/20 text-sm font-bold" value={newSkill.faction} onChange={(e) => setNewSkill({ ...newSkill, faction: e.target.value })}>
                        {FACTIONS.map((f) => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1 flex flex-col gap-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">阶级分类</label>
                      <select className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500/20 text-sm font-bold" value={newSkill.tier} onChange={(e) => setNewSkill({ ...newSkill, tier: e.target.value })}>
                        {TIERS.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <Input label="NPC ID (可选)" value={newSkill.npcId} onChange={(v: string) => setNewSkill({ ...newSkill, npcId: v })} />
                  <textarea
                    placeholder="技能效果详细描述..."
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500/20 text-sm h-32"
                    value={newSkill.description}
                    onChange={(e) => setNewSkill({ ...newSkill, description: e.target.value })}
                  />
                  <button onClick={addSkill} className="w-full py-4 bg-sky-600 text-white rounded-2xl font-black hover:bg-sky-700 transition-all shadow-lg mt-2">
                    发布技能模板
                  </button>
                </div>
              </div>

              <div className="lg:col-span-2 space-y-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-4 shadow-sm">
                  <Filter size={16} className="text-slate-400" />
                  <span className="text-xs font-bold text-slate-500">技能库筛选:</span>
                  <select
                    value={skillFactionFilter}
                    onChange={e => setSkillFactionFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-sky-500/20"
                  >
                    <option value="ALL">全部派系 (ALL)</option>
                    {FACTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredSkills.map((s) => (
                    <div key={s.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative group hover:border-sky-300 transition-colors">
                      <button
                        onClick={async () => {
                          if (!confirm('确定删除该技能？')) return;
                          await authedFetch(`/api/admin/skills/${s.id}`, { method: 'DELETE' });
                          fetchData();
                          showOk(`管理员 ${adminName} 编辑了技能库：删除 ${s.name}`);
                        }}
                        className="absolute top-6 right-6 text-slate-200 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                      <div className="flex gap-2 mb-3">
                        <span className="inline-block px-2.5 py-1 bg-sky-50 text-sky-600 rounded-lg text-[10px] font-black uppercase tracking-widest">
                          {s.faction || '未分类'}
                        </span>
                        <span className="inline-block px-2.5 py-1 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-black uppercase tracking-widest">
                          {s.tier || '低阶'}
                        </span>
                      </div>
                      <div className="font-black text-lg text-slate-900 mb-2">{s.name}</div>
                      <p className="text-xs text-slate-500 leading-relaxed">{s.description || '暂无描述'}</p>
                    </div>
                  ))}
                  {filteredSkills.length === 0 && <div className="text-slate-400 text-sm p-4 text-center">该分类下暂无技能数据</div>}
                </div>
              </div>
            </div>
          )}

          {/* 5) 公告 */}
          {activeTab === 'announcements' && (
            <motion.div key="ann" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                  <Megaphone size={18} className="text-amber-500" />
                  发布全服公告
                </h3>
                <div className="space-y-3">
                  <Input label="公告类型 (system/vote_open/game_start)" value={newAnnouncement.type} onChange={(v) => setNewAnnouncement({ ...newAnnouncement, type: v })} />
                  <Input label="公告标题" value={newAnnouncement.title} onChange={(v) => setNewAnnouncement({ ...newAnnouncement, title: v })} />
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">公告内容</label>
                    <textarea
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500/20 text-sm min-h-[180px]"
                      value={newAnnouncement.content}
                      onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                    />
                  </div>
                  <button onClick={publishAnnouncement} className="w-full py-3 rounded-2xl bg-slate-900 text-white font-black hover:bg-slate-800">
                    发布公告
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-lg font-black mb-4">最近管理员操作</h3>
                <div className="max-h-[420px] overflow-auto custom-scrollbar space-y-2">
                  {adminLogs.length === 0 && <p className="text-slate-400 text-sm">暂无日志</p>}
                  {adminLogs.slice(0, 50).map(log => (
                    <div key={log.id} className="border border-slate-100 rounded-xl p-3 bg-slate-50">
                      <div className="text-sm font-bold">管理员 {log.adminName} {log.action}</div>
                      <div className="text-[11px] text-slate-400 mt-1">{new Date(log.createdAt).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* 6) 管理员安全 */}
          {activeTab === 'security' && (
            <motion.div key="sec" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* 名单管理 */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm xl:col-span-1">
                <h3 className="font-black text-lg mb-4 flex items-center gap-2">
                  <Shield size={18} className="text-indigo-500" />
                  管理员名单
                </h3>

                <div className="space-y-2 max-h-64 overflow-auto custom-scrollbar mb-4">
                  {mergedWhitelist.map((w) => (
                    <div key={w.name} className="border border-slate-100 rounded-xl p-3 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-sm">{w.name}</div>
                        <div className="text-[11px] text-slate-400">{w.code_name || '无代号'}</div>
                      </div>
                      <button
                        disabled={w.name === FIXED_ADMIN_NAME}
                        onClick={() => removeWhitelistAdmin(w.name)}
                        className="text-xs px-2 py-1 rounded bg-rose-50 text-rose-600 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        删除
                      </button>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <Input label="新增管理员名字" value={newAdminName} onChange={setNewAdminName} />
                  <Input label="管理员代号(可选)" value={newAdminCodeName} onChange={setNewAdminCodeName} />
                  <button onClick={addWhitelistAdmin} className="w-full py-3 rounded-2xl bg-slate-900 text-white font-black hover:bg-slate-800">
                    添加到名单
                  </button>
                </div>
              </div>

              {/* 在线管理员 */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm xl:col-span-1">
                <h3 className="font-black text-lg mb-4 flex items-center gap-2">
                  <Users size={18} className="text-sky-500" />
                  后台在线管理员
                </h3>
                <div className="space-y-2 max-h-80 overflow-auto custom-scrollbar">
                  {onlineAdmins.length === 0 && <p className="text-slate-400 text-sm">暂无在线管理员</p>}
                  {onlineAdmins.map((a) => (
                    <div key={`${a.userId}-${a.lastSeenAt}`} className="border border-slate-100 rounded-xl p-2 flex items-center gap-3">
                      <img
                        src={a.adminAvatarUrl || 'https://placehold.co/40x40?text=A'}
                        alt={a.userName}
                        className="w-10 h-10 rounded-full object-cover border"
                      />
                      <div>
                        <div className="font-bold text-sm">{a.userName}</div>
                        <div className="text-[11px] text-slate-400">{new Date(a.lastSeenAt).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 头像和日志 */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm xl:col-span-1">
                <h3 className="font-black text-lg mb-4">管理员头像与操作日志</h3>
                <Input label="头像 URL" value={avatarUrl} onChange={setAvatarUrl} />
                <button onClick={updateAdminAvatar} className="w-full py-3 rounded-2xl bg-indigo-600 text-white font-black hover:bg-indigo-700 mt-2">
                  更新头像
                </button>

                <div className="mt-5 border-t pt-4">
                  <h4 className="font-bold text-sm mb-2">近期日志</h4>
                  <div className="max-h-56 overflow-auto custom-scrollbar space-y-2">
                    {adminLogs.slice(0, 20).map(log => (
                      <div key={log.id} className="text-xs p-2 rounded-lg bg-slate-50 border border-slate-100">
                        管理员 {log.adminName} {log.action}
                        <div className="text-[10px] text-slate-400 mt-1">{new Date(log.createdAt).toLocaleString()}</div>
                      </div>
                    ))}
                    {adminLogs.length === 0 && <div className="text-xs text-slate-400">暂无日志</div>}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 编辑用户弹窗 */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[40px] p-10 w-full max-w-2xl shadow-2xl relative my-8"
            >
              <button onClick={() => setEditingUser(null)} className="absolute top-8 right-8 text-slate-400 hover:text-slate-900 bg-slate-100 p-2 rounded-full transition-colors">
                <X size={20} />
              </button>

              <h3 className="text-2xl font-black mb-2 flex items-center gap-2">
                <ShieldAlert className="text-amber-500" /> 修改玩家档案
              </h3>
              <p className="text-sm text-slate-500 mb-8 ml-8">
                正在编辑: <span className="font-bold text-slate-900">{editingUser.name}</span>
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label="年龄 (自动判定是否圣所未分化)" type="number" value={editingUser.age?.toString() || '0'} onChange={(v: string) => setEditingUser({ ...editingUser, age: parseInt(v, 10) || 0 })} />
                <Input label="身份 (哨兵/向导/鬼魂/普通人)" value={editingUser.role || ''} onChange={(v: string) => setEditingUser({ ...editingUser, role: v })} />
                <Input label="所属派系" value={editingUser.faction || ''} onChange={(v: string) => setEditingUser({ ...editingUser, faction: v })} />
                <Input label="专属能力" value={editingUser.ability || ''} onChange={(v: string) => setEditingUser({ ...editingUser, ability: v })} />
                <Input label="精神力等级" value={editingUser.mentalRank || ''} onChange={(v: string) => setEditingUser({ ...editingUser, mentalRank: v })} />
                <Input label="肉体强度等级" value={editingUser.physicalRank || ''} onChange={(v: string) => setEditingUser({ ...editingUser, physicalRank: v })} />
                <Input label="精神体名称" value={editingUser.spiritName || ''} onChange={(v: string) => setEditingUser({ ...editingUser, spiritName: v })} />
                <Input label="全局账号密码 (留空即无密码)" value={editingUser.password || ''} onChange={(v: string) => setEditingUser({ ...editingUser, password: v })} />

                <div className="col-span-1 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-1.5 block">个人资料文本</label>
                  <textarea
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500/20 text-sm min-h-[120px]"
                    value={editingUser.profileText || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, profileText: e.target.value })}
                  />
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-slate-100">
                <h4 className="font-black text-slate-800 mb-4 flex items-center gap-2">
                  <Zap size={16} className="text-indigo-500" />
                  玩家已习得技能
                  <span className="text-xs font-normal text-slate-400 ml-2">({editingUserSkills.length})</span>
                </h4>

                {editingUserSkills.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-2xl text-xs text-slate-400 text-center border border-dashed border-slate-200">
                    该玩家尚未习得任何技能
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 max-h-40 overflow-y-auto custom-scrollbar p-1">
                    {editingUserSkills.map(skill => (
                      <div key={skill.id} className="flex justify-between items-center p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                        <div>
                          <div className="font-bold text-sm text-indigo-900">{skill.name}</div>
                          <div className="text-[10px] font-black text-amber-500 uppercase">Lv.{skill.level}</div>
                        </div>
                        <button
                          onClick={() => handleDeleteUserSkill(skill.id)}
                          className="p-1.5 bg-white text-slate-400 hover:text-rose-500 rounded-lg shadow-sm border border-slate-100 transition-colors"
                          title="遗忘/删除此技能"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-8 flex gap-4">
                <button onClick={() => setEditingUser(null)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-200 transition-colors">
                  取消
                </button>
                <button onClick={handleUpdateUser} className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition-all shadow-xl shadow-slate-200">
                  强制覆写并保存数据
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style
        dangerouslySetInnerHTML={{
          __html: `
          .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #e2e8f0; border-radius: 20px; }
        `
        }}
      />
    </div>
  );
}

function Badge({ text, cls }: { text: string; cls: string }) {
  return <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black border ${cls}`}>{text}</span>;
}

function TabBtn({
  active,
  onClick,
  icon,
  label
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-3 rounded-xl transition-all font-black text-[13px] ${
        active ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
      }`}
    >
      {icon} {label}
    </button>
  );
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
  placeholder = ''
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500/20 transition-all font-bold text-sm text-slate-700"
      />
    </div>
  );
}
