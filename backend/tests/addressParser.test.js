const assert = require('assert');
const {
  parseAddress,
  extractPhone,
  extractPostalCode,
  extractProvince,
  extractCity,
  extractName,
  normalizeProvince
} = require('../src/utils/addressParser');

function runTest(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    console.error(`✗ ${name}`);
    console.error(`  期望: ${e.expected}`);
    console.error(`  实际: ${e.actual}`);
    throw e;
  }
}

console.log('\n=== 地址解析单元测试 ===\n');

console.log('--- extractPhone 手机号提取 ---');
runTest('标准手机号', () => {
  assert.strictEqual(extractPhone('张三 13800001111 浙江省杭州市'), '13800001111');
});
runTest('带国家码+86', () => {
  assert.strictEqual(extractPhone('张三 +86 13800001111 浙江省杭州市'), '13800001111');
});
runTest('带国家码86无+', () => {
  assert.strictEqual(extractPhone('张三 8613800001111 浙江省杭州市'), '13800001111');
});
runTest('带横杠分隔符', () => {
  assert.strictEqual(extractPhone('张三 138-0000-1111 浙江省杭州市'), '13800001111');
});
runTest('多个手机号取第一个', () => {
  assert.strictEqual(extractPhone('张三 13800001111 李四 13900002222'), '13800001111');
});
runTest('非法手机号返回null', () => {
  assert.strictEqual(extractPhone('张三 12345678901 浙江省杭州市'), null);
});
runTest('无手机号返回null', () => {
  assert.strictEqual(extractPhone('张三 浙江省杭州市西湖区'), null);
});

console.log('\n--- extractPostalCode 邮编提取 ---');
runTest('标准6位邮编', () => {
  assert.strictEqual(extractPostalCode('张三 13800001111 浙江省杭州市 310000'), '310000');
});
runTest('无邮编返回null', () => {
  assert.strictEqual(extractPostalCode('张三 13800001111 浙江省杭州市'), null);
});

console.log('\n--- extractProvince 省份提取 ---');
runTest('完整省份名称', () => {
  const result = extractProvince('浙江省杭州市西湖区');
  assert.strictEqual(result.province, '浙江省');
});
runTest('直辖市', () => {
  const result = extractProvince('上海市浦东新区');
  assert.strictEqual(result.province, '上海市');
});
runTest('自治区', () => {
  const result = extractProvince('内蒙古自治区呼和浩特市');
  assert.strictEqual(result.province, '内蒙古自治区');
});
runTest('特别行政区', () => {
  const result = extractProvince('香港特别行政区九龙');
  assert.strictEqual(result.province, '香港特别行政区');
});
runTest('省份简称', () => {
  const result = extractProvince('浙江杭州西湖区');
  assert.strictEqual(result.province, '浙江省');
});
runTest('直辖市简称', () => {
  const result = extractProvince('北京朝阳区');
  assert.strictEqual(result.province, '北京市');
});
runTest('无省份返回null', () => {
  const result = extractProvince('某某街道123号');
  assert.strictEqual(result, null);
});

console.log('\n--- normalizeProvince 省份标准化 ---');
runTest('完整名称不变', () => {
  assert.strictEqual(normalizeProvince('浙江省'), '浙江省');
});
runTest('简称转全称', () => {
  assert.strictEqual(normalizeProvince('浙江'), '浙江省');
});
runTest('内蒙古简称', () => {
  assert.strictEqual(normalizeProvince('内蒙古'), '内蒙古自治区');
});
runTest('无效名称返回null', () => {
  assert.strictEqual(normalizeProvince('不存在'), null);
});

console.log('\n--- extractCity 城市提取 ---');
runTest('普通城市', () => {
  assert.strictEqual(extractCity('浙江省杭州市西湖区', '浙江省'), '杭州市');
});
runTest('直辖市', () => {
  assert.strictEqual(extractCity('上海市浦东新区', '上海市'), '上海市');
});
runTest('自治区城市', () => {
  assert.strictEqual(extractCity('内蒙古自治区呼和浩特市新城区', '内蒙古自治区'), '呼和浩特市');
});
runTest('无省份返回null', () => {
  assert.strictEqual(extractCity('杭州市西湖区', null), null);
});

console.log('\n--- extractName 姓名提取 ---');
runTest('开头姓名', () => {
  assert.strictEqual(extractName('张三 13800001111 浙江省杭州市西湖区', '13800001111', '浙江省', '杭州市'), '张三');
});
runTest('末尾姓名', () => {
  assert.strictEqual(extractName('13800001111 浙江省杭州市西湖区 李四', '13800001111', '浙江省', '杭州市'), '李四');
});
runTest('中间姓名', () => {
  assert.strictEqual(extractName('13800001111 王五 浙江省杭州市西湖区', '13800001111', '浙江省', '杭州市'), '王五');
});
runTest('两字姓名', () => {
  assert.strictEqual(extractName('张三 13800001111 浙江杭州', '13800001111', '浙江省', '杭州市'), '张三');
});
runTest('三字姓名', () => {
  assert.strictEqual(extractName('王小明 13800001111 浙江杭州', '13800001111', '浙江省', '杭州市'), '王小明');
});
runTest('四字姓名', () => {
  assert.strictEqual(extractName('欧阳小明 13800001111 浙江杭州', '13800001111', '浙江省', '杭州市'), '欧阳小明');
});
runTest('逗号分隔', () => {
  assert.strictEqual(extractName('张三,13800001111,浙江省杭州市', '13800001111', '浙江省', '杭州市'), '张三');
});
runTest('顿号分隔', () => {
  assert.strictEqual(extractName('张三、13800001111、浙江省杭州市', '13800001111', '浙江省', '杭州市'), '张三');
});

console.log('\n--- parseAddress 完整解析 ---');

const testCases = [
  {
    name: '标准格式：姓名 手机 省 市 详细地址',
    input: '张三 13800001111 浙江省杭州市西湖区文三路 100 号',
    expected: {
      recipient: '张三',
      phone: '13800001111',
      state: '浙江省',
      city: '杭州市',
      line1: '西湖区文三路 100 号'
    }
  },
  {
    name: '顺序变化：手机 姓名 地址',
    input: '13800001111 李四 上海市浦东新区张江高科技园区博云路2号',
    expected: {
      recipient: '李四',
      phone: '13800001111',
      state: '上海市',
      city: '上海市',
      line1: '浦东新区张江高科技园区博云路2号'
    }
  },
  {
    name: '逗号分隔',
    input: '王五,13900002222,广东省,深圳市,南山区科技园南区',
    expected: {
      recipient: '王五',
      phone: '13900002222',
      state: '广东省',
      city: '深圳市',
      line1: '南山区科技园南区'
    }
  },
  {
    name: '顿号分隔',
    input: '赵六、13700003333、江苏省南京市鼓楼区中山北路1号',
    expected: {
      recipient: '赵六',
      phone: '13700003333',
      state: '江苏省',
      city: '南京市',
      line1: '鼓楼区中山北路1号'
    }
  },
  {
    name: '带邮编',
    input: '钱七 13600004444 北京市海淀区中关村大街1号 100080',
    expected: {
      recipient: '钱七',
      phone: '13600004444',
      state: '北京市',
      city: '北京市',
      line1: '海淀区中关村大街1号',
      postalCode: '100080'
    }
  },
  {
    name: '带+86国家码',
    input: '孙八 +86 13500005555 四川省成都市武侯区人民南路四段',
    expected: {
      recipient: '孙八',
      phone: '13500005555',
      state: '四川省',
      city: '成都市',
      line1: '武侯区人民南路四段'
    }
  },
  {
    name: '省份简称',
    input: '周九 13400006666 浙江杭州西湖区文三路',
    expected: {
      recipient: '周九',
      phone: '13400006666',
      state: '浙江省',
      city: '杭州市',
      line1: '西湖区文三路'
    }
  },
  {
    name: '直辖市简称',
    input: '吴十 13300007777 北京朝阳区建国门外大街1号',
    expected: {
      recipient: '吴十',
      phone: '13300007777',
      state: '北京市',
      city: '北京市',
      line1: '朝阳区建国门外大街1号'
    }
  },
  {
    name: '自治区',
    input: '郑十一 13200008888 内蒙古自治区呼和浩特市新城区新华大街',
    expected: {
      recipient: '郑十一',
      phone: '13200008888',
      state: '内蒙古自治区',
      city: '呼和浩特市',
      line1: '新城区新华大街'
    }
  },
  {
    name: '多种分隔符混合',
    input: '王小明 | 13100009999 | 湖北省 | 武汉市 | 洪山区珞瑜路1037号',
    expected: {
      recipient: '王小明',
      phone: '13100009999',
      state: '湖北省',
      city: '武汉市',
      line1: '洪山区珞瑜路1037号'
    }
  },
  {
    name: '地址在开头',
    input: '陕西省西安市雁塔区小寨东路 13811112222 陈十二',
    expected: {
      recipient: '陈十二',
      phone: '13811112222',
      state: '陕西省',
      city: '西安市',
      line1: '雁塔区小寨东路'
    }
  },
  {
    name: '无分隔符连续文本',
    input: '褚十三13922223333福建省厦门市思明区鼓浪屿',
    expected: {
      recipient: '褚十三',
      phone: '13922223333',
      state: '福建省',
      city: '厦门市',
      line1: '思明区鼓浪屿'
    }
  }
];

testCases.forEach(testCase => {
  runTest(testCase.name, () => {
    const result = parseAddress(testCase.input);
    const expected = testCase.expected;
    
    if (expected.recipient !== undefined) {
      assert.strictEqual(result.recipient, expected.recipient, 
        `recipient 不匹配，期望 ${expected.recipient}，实际 ${result.recipient}`);
    }
    if (expected.phone !== undefined) {
      assert.strictEqual(result.phone, expected.phone,
        `phone 不匹配，期望 ${expected.phone}，实际 ${result.phone}`);
    }
    if (expected.state !== undefined) {
      assert.strictEqual(result.state, expected.state,
        `state 不匹配，期望 ${expected.state}，实际 ${result.state}`);
    }
    if (expected.city !== undefined) {
      assert.strictEqual(result.city, expected.city,
        `city 不匹配，期望 ${expected.city}，实际 ${result.city}`);
    }
    if (expected.line1 !== undefined) {
      assert.strictEqual(result.line1, expected.line1,
        `line1 不匹配，期望 ${expected.line1}，实际 ${result.line1}`);
    }
    if (expected.postalCode !== undefined) {
      assert.strictEqual(result.postalCode, expected.postalCode,
        `postalCode 不匹配，期望 ${expected.postalCode}，实际 ${result.postalCode}`);
    }
  });
});

console.log('\n--- 异常和边界情况 ---');
runTest('空输入', () => {
  const result = parseAddress('');
  assert.strictEqual(result.recipient, null);
  assert.strictEqual(result.phone, null);
  assert.ok(result.warnings.length > 0);
});
runTest('null输入', () => {
  const result = parseAddress(null);
  assert.strictEqual(result.recipient, null);
  assert.ok(result.warnings.length > 0);
});
runTest('只有手机号', () => {
  const result = parseAddress('13800001111');
  assert.strictEqual(result.phone, '13800001111');
  assert.strictEqual(result.recipient, null);
  assert.strictEqual(result.state, null);
  assert.ok(result.warnings.length > 0);
});
runTest('只有地址', () => {
  const result = parseAddress('浙江省杭州市西湖区');
  assert.strictEqual(result.state, '浙江省');
  assert.strictEqual(result.city, '杭州市');
  assert.strictEqual(result.phone, null);
  assert.strictEqual(result.recipient, null);
  assert.ok(result.warnings.length > 0);
});
runTest('无手机号', () => {
  const result = parseAddress('张三 浙江省杭州市西湖区文三路');
  assert.strictEqual(result.recipient, '张三');
  assert.strictEqual(result.phone, null);
  assert.ok(result.warnings.some(w => w.includes('手机号')));
});
runTest('无省份', () => {
  const result = parseAddress('李四 13800001111 某某街道123号');
  assert.strictEqual(result.state, null);
  assert.ok(result.warnings.some(w => w.includes('省份')));
});

console.log('\n=== 所有测试通过! ===\n');
