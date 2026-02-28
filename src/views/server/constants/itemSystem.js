// 物品系统标准定义：地区 + 用途（不再使用精神系/元素系等技能派系做分类）

const ITEM_REGIONS = [
  '命之塔', '圣所', '伦敦塔', '公会', '军队',
  '富人区', '贫民区', '恶魔会', '灵异管理所', '观察者', '通用'
];

const ITEM_USAGES = [
  '回复道具',       // 2.1
  '任务道具',       // 2.2
  '技能书学习道具', // 2.3
  '贵重物品'        // 2.4
];

const RECOVERY_EFFECTS = [
  'hp',       // 回复体力值
  'mp',       // 回复MP
  'fury_down' // 降低狂暴值
];

function validateItemPayload(payload = {}) {
  const errors = [];
  const {
    name, region, usageType,
    effectType, effectValue,
    skillName, sellPrice
  } = payload;

  if (!name || String(name).trim().length < 1) errors.push('物品名称不能为空');
  if (!ITEM_REGIONS.includes(region)) errors.push('地区分类无效');
  if (!ITEM_USAGES.includes(usageType)) errors.push('用途分类无效');

  if (usageType === '回复道具') {
    if (!RECOVERY_EFFECTS.includes(effectType)) errors.push('回复道具必须设置 effectType: hp/mp/fury_down');
    if (!Number.isFinite(Number(effectValue)) || Number(effectValue) <= 0) errors.push('回复道具必须设置有效的 effectValue > 0');
  }

  if (usageType === '技能书学习道具') {
    if (!skillName || String(skillName).trim().length < 1) errors.push('技能书学习道具必须绑定 skillName');
  }

  if (usageType === '贵重物品') {
    if (!Number.isFinite(Number(sellPrice)) || Number(sellPrice) <= 0) errors.push('贵重物品必须设置 sellPrice > 0');
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

module.exports = {
  ITEM_REGIONS,
  ITEM_USAGES,
  RECOVERY_EFFECTS,
  validateItemPayload
};
