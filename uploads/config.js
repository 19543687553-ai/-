/**
 * 游戏配置常量
 * @type {Object}
 */
const CONFIG = {
  realms:[
    "炼气","筑基","金丹","元婴","化神","炼虚","合体","大乘",
    "真仙","金仙","太乙","大罗","准圣","圣人","天道","大道",
    "作者","观众","粉丝","催更者",
    "手机","科学家",
    "国家","地球",
    "太阳","太阳系","银河系","宇宙"
  ],
  
  expRequirements:(()=>{
    const reqs = [1000];
    for(let i=1; i<28; i++){
      let multiplier = 1.5 + (i * 0.08);
      if(i > 20) multiplier = 2.0;
      reqs.push(Math.floor(reqs[i-1] * multiplier));
    }
    return reqs;
  })(),
  
  beastRealms:(()=>{
    const r=[];
    for(let i=1;i<=15;i++){
      ['初期','中期','大成','巅峰'].forEach(s=>r.push({name:`${i}阶${s}`,tier:i,sub:['初期','中期','大成','巅峰'].indexOf(s)}));
    }
    for(let i=1;i<=12;i++) r.push({name:`古兽${i}阶`,tier:15+i,sub:0});
    r.push({name:'洪荒异种',tier:28,sub:0});
    return r;
  })(),
  
  lifeByStage:[
    100,150,200,300,500,800,1200,1800,2500,4000,6000,9000,15000,25000,50000,100000,
    200000,500000,1000000,2000000,5000000,10000000,20000000,50000000,100000000,200000000,500000000,1000000000
  ],
  
  grades:[
    {n:"废灵根",c:"#888888",m:0.8},
    {n:"伪灵根",c:"#aaaaaa",m:0.9},
    {n:"黄灵根",c:"#cd853f",m:1.0},
    {n:"绿灵根",c:"#5ffa5f",m:1.1},
    {n:"蓝灵根",c:"#5fa8ff",m:1.2},
    {n:"紫灵根",c:"#d9a2ff",m:1.35},
    {n:"红灵根",c:"#ff5555",m:1.5},
    {n:"金灵根",c:"#ffd700",m:1.7},
    {n:"冰灵根",c:"#00ffff",m:1.9},
    {n:"暗灵根",c:"#9400d3",m:2.1},
    {n:"天灵根",c:"#ffffff",m:2.5},
    {n:"混沌灵根",c:"#ff1493",m:3.0}
  ],
  
  gradeWeights:[30,25,20,12,8,3,1.5,0.8,0.4,0.2,0.08,0.02],
  
  skills:[
    {id:"base",n:"基础吐纳",c:0,d:"修炼效率+20%",e:{em:0.2},tier:0,rank:"common"},
    {id:"body",n:"炼体术",c:200,d:"战力+30%,寿元+10",e:{pm:0.3,lm:10},tier:0,rank:"common"},
    {id:"mind",n:"清心咒",c:300,d:"突破概率+15%",e:{bm:0.15},tier:0,rank:"common"},
    {id:"spirit",n:"聚灵诀",c:500,d:"修炼效率+50%",e:{em:0.5},tier:1,rank:"common"},
    {id:"luck",n:"气运术",c:800,d:"探索收益+50%",e:{xm:0.5},tier:1,rank:"common"},
    {id:"sword",n:"御剑术",c:1500,d:"战力+80%",e:{pm:0.8},tier:2,rank:"rare"},
    {id:"fire",n:"烈焰功",c:2000,d:"战力+100%,暴击+10%",e:{pm:1.0,crit:0.1},tier:2,rank:"rare"},
    {id:"ice",n:"玄冰劲",c:2000,d:"战力+100%,防御+20%",e:{pm:1.0,def:0.2},tier:2,rank:"rare"},
    {id:"thunder",n:"雷霆诀",c:2500,d:"战力+120%,速度+15%",e:{pm:1.2,spd:0.15},tier:3,rank:"rare"},
    {id:"heal",n:"长生诀·改",c:3000,d:"寿元+200,回复+50%",e:{lm:200,heal:0.5},tier:3,rank:"rare"},
    {id:"blood",n:"血魔大法",c:5000,d:"战力+200%,寿元-100",e:{pm:2.0,lm:-100},tier:4,rank:"epic"},
    {id:"diamond",n:"金刚不坏",c:6000,d:"防御+100%,战力+50%",e:{pm:0.5,def:1.0},tier:4,rank:"epic"},
    {id:"phantom",n:"幻影迷踪",c:7000,d:"闪避+30%,速度+50%",e:{dodge:0.3,spd:0.5},tier:5,rank:"epic"},
    {id:"devour",n:"吞天魔功",c:8000,d:"战力+150%,吸血+20%",e:{pm:1.5,lifeSteal:0.2},tier:5,rank:"epic"},
    {id:"immortal_sword",n:"万剑归宗",c:12000,d:"战力+300%,暴击+25%",e:{pm:3.0,crit:0.25},tier:6,rank:"legendary"},
    {id:"time",n:"时间法则",c:15000,d:"战力+250%,战斗时间-30%",e:{pm:2.5,timeReduce:0.3},tier:6,rank:"legendary"},
    {id:"space",n:"空间跳跃",c:15000,d:"战力+250%,闪避+40%",e:{pm:2.5,dodge:0.4},tier:6,rank:"legendary"},
    {id:"chaos",n:"混沌真经",c:20000,d:"全属性+100%",e:{pm:1.0,em:1.0,lm:500,bm:0.3},tier:7,rank:"legendary"},
    {id:"nine_turn",n:"九转玄功",c:50000,d:"战力+500%,寿元+1000",e:{pm:5.0,lm:1000},tier:8,rank:"mythic"},
    {id:"three_purity",n:"一气化三清",c:60000,d:"战力+600%,分身战斗",e:{pm:6.0,clone:1},tier:8,rank:"mythic"},
    {id:"buddha",n:"大日如来",c:80000,d:"战力+800%,金刚不坏",e:{pm:8.0,def:2.0},tier:9,rank:"mythic"},
    {id:"star",n:"星辰变",c:100000,d:"战力+1000%,引动星辰之力",e:{pm:10.0},tier:10,rank:"mythic"},
    {id:"dimension",n:"降维打击",c:999999,d:"来自高维的蔑视，战力+9999%",e:{pm:99.99},tier:20,rank:"god"},
    {id:"author",n:"作者之力",c:1000000,d:"我就是天道，战力+99999%",e:{pm:999.99},tier:27,rank:"god"}
  ],
  
  rankColors:{
    common:"#aaaaaa",
    rare:"#00ffff",
    epic:"#9400d3",
    legendary:"#ff1493",
    mythic:"#ffd700",
    god:"#ff0000"
  },
  
  herbs:[
    {id:"lingzhi",n:"灵芝",base:1},
    {id:"xueying",n:"血灵草",base:2},
    {id:"tianxin",n:"天心花",base:3},
    {id:"hunyuan",n:"混元果",base:5}
  ],
  
  recipes:[
    {id:"p1",n:"养元丹",need:{lingzhi:2},eff:{pills:1},desc:"恢复类丹药"},
    {id:"p2",n:"破境丹",need:{lingzhi:3,xueying:2},eff:{breakRate:0.15},desc:"突破概率+15%"},
    {id:"p3",n:"渡劫丹",need:{tianxin:2,hunyuan:1},eff:{breakRate:0.35},desc:"高阶突破辅助"},
    {id:"p4",n:"属性丹·力",need:{xueying:3},eff:{attr:"str",val:3}},
    {id:"p5",n:"属性丹·悟",need:{tianxin:3},eff:{attr:"int",val:3}}
  ],
  
  shopItems:[
    {id:"power_pill",name:"战力丹",icon:"💊",desc:"永久提升1000点基础战力",price:10000,type:"power",value:1000,limit:999},
    {id:"click_power",name:"点击修为卡",icon:"👆",desc:"点击修炼时修为+1 (可叠加)",price:500,type:"click_power"},
    {id:"herb_pack_small",name:"草药小包",icon:"🌿",desc:"随机获得3-5种基础草药",price:5000,type:"herb_pack",tier:"small"},
    {id:"herb_pack_large",name:"草药大礼包",icon:"🎁",desc:"随机获得10-15种高级草药",price:20000,type:"herb_pack",tier:"large"},
    {id:"random_root",name:"随机灵根",icon:"☯️",desc:"重新随机灵根品质(有风险)",price:1000000,type:"root_random"},
    {id:"custom_root",name:"自选灵根",icon:"✨",desc:"自主选择想要的灵根品质",price:100000000,type:"root_custom"},
    {id:"break_pill",name:"破境丹",icon:"🔮",desc:"直接购买破境丹x1",price:50000,type:"pill",pillId:"p2"},
    {id:"life_pill",name:"寿元丹",icon:"❤️",desc:"增加100年寿元",price:200000,type:"life",value:100},
    {id:"exp_pill",name:"修为丹",icon:"⚡",desc:"增加当前境界1%修为",price:8000000,type:"exp",percent:0.01}
  ],
  
  attrs:["str","int","vit","luk"],
  attrName:{str:"力量",int:"悟性",vit:"体质",luk:"气运"},
  
  dataVerify: {
    ENABLED: true,
    MAX_SINGLE_GAIN: 10000000,
    ONE_ZHAO: 1000000000000,
    MAX_TIME_DIFF: 5000,
    RESTRICT_MIN_DAYS: 1,
    RESTRICT_MAX_DAYS: 30,
    SUSPICIOUS_THRESHOLD: 100000000,
    VIOLATION_THRESHOLD: 1000000000,
    MAX_SUSPICIOUS_COUNT: 3,
    CHECK_INTERVAL: 60000
  },
  
  skill: {
    BASE_SUCCESS_RATE: 0.3,
    INT_BONUS_PER_POINT: 0.03
  },
  
  DEV_PASSWORD: 'MjAxMzUx',
  ADMIN_PASSWORD: 'MjAxMzUx',
  
  AUTO_SAVE_INTERVAL: 30000,
  BATTLE_TIMEOUT: 300000,
  CHALLENGE_COOLDOWN: 30000,
  
  AUTO_LOGIN: {
    USERNAME_KEY: 'xiuxian_last_user',
    SESSION_KEY: 'xiuxian_session',
    SESSION_DURATION: 24 * 60 * 60 * 1000
  },
  
  rebirth: {
    BASE_MIN_STAGE: 8,
    STAGE_INCREMENT: 2,
    MAX_ATTR_BONUS: 5.0,
    KEEP_STONES_RATIO: 0.5,
    ATTR_BONUS_PER_REBIRTH: 0.1
  },
  
  battle: {
    BASE_CORES_MIN: 1,
    BASE_CORES_MAX: 5,
    EXTRA_CHANCE: 0.3,
    HIGH_TIER_BONUS: 2
  },
  
  explore: {
    STONES_MIN: 1000,
    STONES_MAX: 10000,
    MAX_LUCK_BONUS: 0.2,
    HERB_CHANCE: 0.7,
    BEAST_CHANCE: 0.15
  },
  
  ONLINE_HEARTBEAT: 30000
};