const PROVINCES = [
  '北京市', '天津市', '上海市', '重庆市',
  '河北省', '山西省', '辽宁省', '吉林省', '黑龙江省',
  '江苏省', '浙江省', '安徽省', '福建省', '江西省', '山东省',
  '河南省', '湖北省', '湖南省', '广东省', '海南省',
  '四川省', '贵州省', '云南省', '陕西省', '甘肃省', '青海省',
  '台湾省',
  '内蒙古自治区', '广西壮族自治区', '西藏自治区', '宁夏回族自治区', '新疆维吾尔自治区',
  '香港特别行政区', '澳门特别行政区'
];

const PROVINCE_ABBREV_MAP = {
  '北京': '北京市', '天津': '天津市', '上海': '上海市', '重庆': '重庆市',
  '河北': '河北省', '山西': '山西省', '辽宁': '辽宁省', '吉林': '吉林省', '黑龙江': '黑龙江省',
  '江苏': '江苏省', '浙江': '浙江省', '安徽': '安徽省', '福建': '福建省', '江西': '江西省', '山东': '山东省',
  '河南': '河南省', '湖北': '湖北省', '湖南': '湖南省', '广东': '广东省', '海南': '海南省',
  '四川': '四川省', '贵州': '贵州省', '云南': '云南省', '陕西': '陕西省', '甘肃': '甘肃省', '青海': '青海省',
  '台湾': '台湾省',
  '内蒙古': '内蒙古自治区', '广西': '广西壮族自治区', '西藏': '西藏自治区', '宁夏': '宁夏回族自治区', '新疆': '新疆维吾尔自治区',
  '香港': '香港特别行政区', '澳门': '澳门特别行政区'
};

const MUNICIPALITIES = ['北京市', '天津市', '上海市', '重庆市'];

function normalizeProvince(name) {
  if (!name) return null;
  const trimmed = name.trim();
  if (PROVINCES.includes(trimmed)) return trimmed;
  if (PROVINCE_ABBREV_MAP[trimmed]) return PROVINCE_ABBREV_MAP[trimmed];
  for (const full of PROVINCES) {
    if (full.startsWith(trimmed)) return full;
  }
  for (const [abbrev, full] of Object.entries(PROVINCE_ABBREV_MAP)) {
    if (trimmed.startsWith(abbrev)) return full;
  }
  return null;
}

function extractPhone(text) {
  const phoneRegex = /(?:\+?86[-\s]?)?1[3-9]\d[-\s]?\d{4}[-\s]?\d{4}/g;
  const matches = text.match(phoneRegex);
  if (!matches || matches.length === 0) return null;
  const clean = matches[0].replace(/[+\-\s]/g, '').replace(/^86/, '');
  return clean;
}

function extractPostalCode(text) {
  const postalRegex = /\b\d{6}\b/g;
  const matches = text.match(postalRegex);
  if (!matches || matches.length === 0) return null;
  return matches[0];
}

function extractProvince(text) {
  for (const province of PROVINCES) {
    if (text.includes(province)) {
      return { province, index: text.indexOf(province) };
    }
  }
  for (const [abbrev, full] of Object.entries(PROVINCE_ABBREV_MAP)) {
    const idx = text.indexOf(abbrev);
    if (idx !== -1) {
      return { province: full, index: idx };
    }
  }
  return null;
}

function extractCity(text, province) {
  if (!province) return null;
  
  if (MUNICIPALITIES.includes(province)) {
    const shortName = province.replace('市', '');
    return `${shortName}市`;
  }
  
  const provinceInfo = extractProvince(text);
  const provinceEnd = provinceInfo ? provinceInfo.index + provinceInfo.province.length : 0;
  const textAfterProvince = text.substring(provinceEnd);
  
  const cityRegex = /([\u4e00-\u9fa5]{2,20}?(?:市|自治州|地区|盟))/g;
  const matches = [];
  let match;
  while ((match = cityRegex.exec(textAfterProvince)) !== null) {
    matches.push({ city: match[1], index: match.index + provinceEnd });
  }
  
  if (matches.length === 0) {
    const shortProvince = province.replace(/(省|自治区|特别行政区)$/, '');
    const fallbackRegex = new RegExp(`${shortProvince}([\\u4e00-\\u9fa5]{2,10}?)(?=[\\u4e00-\\u9fa5区县]|$)`, 'g');
    const fallbackMatch = fallbackRegex.exec(text);
    if (fallbackMatch && fallbackMatch[1] && fallbackMatch[1].length >= 2) {
      const cityName = fallbackMatch[1];
      if (!['', '省', '市', '区', '县'].includes(cityName)) {
        return `${cityName}市`;
      }
    }
    return null;
  }
  
  return matches[0].city;
}

function extractName(text, phone, province, city) {
  let remaining = text;
  
  if (phone) {
    const phonePattern = new RegExp(`\\+?86[\\s\\-]*${phone.replace(/(\d)(\d{4})(\d{4})/, '$1[\\s\\-]?$2[\\s\\-]?$3')}|${phone.replace(/(\d)(\d{4})(\d{4})/, '$1[\\s\\-]?$2[\\s\\-]?$3')}`, 'g');
    remaining = remaining.replace(phonePattern, ' ');
  }
  
  const tokens = remaining
    .split(/[\s,，、;；|~\-]+/)
    .map(t => t.trim())
    .filter(t => t.length > 0);
  
  for (const token of tokens) {
    if (/^[\u4e00-\u9fa5]{2,4}$/.test(token)) {
      if (province && token.includes(province.replace(/[市区省]$/, ''))) continue;
      if (city && token.includes(city.replace(/[市区州盟地区]$/, ''))) continue;
      if (/\d/.test(token)) continue;
      return token;
    }
  }
  
  const nameRegex = /^[\u4e00-\u9fa5]{2,4}(?=[\s,，、;；|~\-]|$)/;
  const startMatch = text.match(nameRegex);
  if (startMatch) {
    const name = startMatch[0];
    if (province && !name.includes(province.replace(/[市区省]$/, '')) && 
        city && !name.includes(city.replace(/[市区州盟地区]$/, ''))) {
      return name;
    }
  }
  
  return null;
}

function extractDetail(text, phone, postalCode, province, city, name) {
  let detail = text;
  
  if (phone) {
    detail = detail.replace(new RegExp(`\\+?86[\\s\\-]*${phone.replace(/(\d)(\d{4})(\d{4})/, '$1[\\s\\-]?$2[\\s\\-]?$3')}`, 'g'), ' ');
    detail = detail.replace(new RegExp(phone.replace(/(\d)(\d{4})(\d{4})/, '$1[\\s\\-]?$2[\\s\\-]?$3'), 'g'), ' ');
  }
  if (postalCode) {
    detail = detail.replace(postalCode, ' ');
  }
  if (name) {
    detail = detail.replace(name, ' ');
  }
  if (province) {
    detail = detail.replace(province, ' ');
    for (const [abbrev, full] of Object.entries(PROVINCE_ABBREV_MAP)) {
      if (full === province) {
        detail = detail.replace(abbrev, ' ');
      }
    }
  }
  if (city) {
    detail = detail.replace(city, ' ');
    const cityShort = city.replace(/(市|自治州|地区|盟)$/, '');
    if (cityShort !== city) {
      detail = detail.replace(cityShort, ' ');
    }
  }
  
  detail = detail
    .split(/[\s,，、;；|~\-]+/)
    .map(t => t.trim())
    .filter(t => t.length > 0)
    .join(' ');
  
  if (detail.length < 3) return null;
  return detail;
}

function parseAddress(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return {
      recipient: null,
      phone: null,
      state: null,
      city: null,
      line1: null,
      postalCode: null,
      warnings: ['输入文本为空'],
      rawText: ''
    };
  }
  
  const text = rawText.trim();
  const phone = extractPhone(text);
  const postalCode = extractPostalCode(text);
  const provinceInfo = extractProvince(text);
  const province = provinceInfo ? provinceInfo.province : null;
  const city = extractCity(text, province);
  const name = extractName(text, phone, province, city);
  const line1 = extractDetail(text, phone, postalCode, province, city, name);
  
  const warnings = [];
  if (!name) warnings.push('未识别到收件人姓名，请手动填写');
  if (!phone) warnings.push('未识别到手机号，请手动填写');
  if (!province) warnings.push('未识别到省份，请手动填写');
  if (!city) warnings.push('未识别到城市，请手动填写');
  if (!line1) warnings.push('未识别到详细地址，请手动填写');
  if (!postalCode) warnings.push('未识别到邮编，可手动补充');
  
  return {
    recipient: name,
    phone: phone,
    state: province,
    city: city,
    line1: line1,
    postalCode: postalCode,
    warnings: warnings,
    rawText: text
  };
}

module.exports = {
  parseAddress,
  extractPhone,
  extractPostalCode,
  extractProvince,
  extractCity,
  extractName,
  extractDetail,
  normalizeProvince,
  PROVINCES,
  PROVINCE_ABBREV_MAP
};
