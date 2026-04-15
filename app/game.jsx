"use client";
import { useState, useEffect, useMemo, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════
   THE INTELLIGENCE AGE — Phase 4
   + Difficulty modes · Faction consequences · Metric sparklines
   + Conditional choices · Shareable end card · Jargon glossary
   ═══════════════════════════════════════════════════════════════ */

const ROUNDS = 8;
const clamp = (v,lo=0,hi=100) => Math.max(lo,Math.min(hi,v));

// ── SEEDED PRNG (Mulberry32) for weekly challenges ──
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function getWeeklySeed() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
  return now.getFullYear() * 100 + week;
}
function getWeekLabel(seed) {
  const y = Math.floor(seed / 100), w = seed % 100;
  return `Week ${w}, ${y}`;
}

// ── COUNTRIES ──
const COUNTRIES = [
  {id:"us",label:"United States",flag:"🇺🇸",desc:"Tech superpower. High innovation, low equality. Polarised politics make trust fragile.",
    start:{growth:60,equality:35,trust:40,safety_score:55,innovation:65,wellbeing:40,geopolitics:60},
    modifiers:{grid:1.3,science:1.2,safety:1.1,workers:0.8,nets:0.7,wealth:0.7},
    flavour:"Silicon Valley leads but Main Street falls behind."},
  {id:"eu",label:"European Union",flag:"🇪🇺",desc:"Regulatory leader. Strong safety nets and governance but slower innovation. 27 nations must agree.",
    start:{growth:45,equality:60,trust:55,safety_score:50,innovation:40,wellbeing:60,geopolitics:55},
    modifiers:{governance:1.3,nets:1.3,workers:1.2,grid:0.8,science:0.9,access:0.9},
    flavour:"GDPR prepared the ground. Now the hard part — competing and protecting simultaneously."},
  {id:"cn",label:"China",flag:"🇨🇳",desc:"State-directed AI. Massive scale, high growth, but governance and trust are opaque. International standing contested.",
    start:{growth:65,equality:40,trust:30,safety_score:45,innovation:60,wellbeing:35,geopolitics:45},
    modifiers:{grid:1.4,science:1.3,intl:0.6,governance:0.6,workers:0.5,access:0.7},
    flavour:"The Five Year Plan includes AI supremacy. But at what cost?"},
  {id:"in",label:"India",flag:"🇮🇳",desc:"Demographic dividend meets digital leapfrog. Massive potential, infrastructure gaps. Can 1.4B people share the gains?",
    start:{growth:50,equality:30,trust:45,safety_score:35,innovation:45,wellbeing:30,geopolitics:40},
    modifiers:{access:1.4,nets:1.2,grid:1.3,wealth:1.1,safety:0.8,intl:0.9},
    flavour:"Aadhaar connected a billion. AI could liberate — or concentrate — everything."},
  {id:"coalition",label:"Global South Coalition",flag:"🌍",desc:"40 nations. Low starting position but collective leverage. AI leapfrog or left behind?",
    start:{growth:35,equality:25,trust:50,safety_score:30,innovation:30,wellbeing:25,geopolitics:35},
    modifiers:{access:1.5,intl:1.4,wealth:1.3,nets:1.2,science:0.7,safety:0.7,grid:0.8},
    flavour:"The world built for others. This time, build for yourselves."},
];

// ── DIFFICULTY ──
const DIFFICULTIES = [
  {id:"easy",label:"Accessible",pts:12,microChance:0.2,feedbackMult:0.6,desc:"More breathing room. Learn the systems."},
  {id:"normal",label:"Standard",pts:9,microChance:0.35,feedbackMult:1.2,desc:"Tight resources. Real trade-offs required."},
  {id:"hard",label:"Hard",pts:7,microChance:0.4,feedbackMult:1.8,desc:"Every point matters. Consequences bite."},
  {id:"crisis",label:"Crisis Mode",pts:5,microChance:0.55,feedbackMult:2.5,desc:"Brutal. You will fail somewhere — choose where."},
];

// ── GLOSSARY — terms people might not know ──
const GLOSSARY = {
  "ASL-4":"AI Safety Level 4 — the highest tier of safety safeguards defined by Anthropic's Responsible Scaling Policy. ASL-4 measures are designed for models that could pose catastrophic risks, requiring state-level security, advanced containment, and verified alignment before deployment. For context, ASL-1 covers basic systems like chess bots, ASL-2 is current chatbots, ASL-3 was activated in 2025 for bio-risk, and ASL-4 addresses autonomous AI capable of novel scientific research.",
  "RSP":"Responsible Scaling Policy — a voluntary framework pioneered by Anthropic in 2023 for managing catastrophic risks from frontier AI. It uses graduated safety levels (ASLs) that trigger stronger safeguards as model capabilities increase. OpenAI and Google DeepMind adopted similar frameworks. The RSP underwent a major revision in February 2026 (v3.0) that replaced hard pause commitments with transparency requirements.",
  "CBRN":"Chemical, Biological, Radiological, Nuclear — the four categories of weapons of mass destruction. In AI policy, CBRN risk refers to the concern that AI systems could help bad actors develop or deploy these weapons by providing technical knowledge, synthesising novel agents, or automating production steps.",
  "PUE":"Power Usage Effectiveness — the ratio of total energy consumed by a data centre to the energy used by its computing equipment. A PUE of 1.0 would mean perfect efficiency. Modern data centres typically achieve 1.1–1.4. Lower PUE means less energy wasted on cooling and infrastructure.",
  "FOIA":"Freedom of Information Act — US federal law (1966) giving the public the right to request access to government records. The OpenAI paper proposes modernising FOIA to cover AI-interaction logs and agentic action logs as federal records.",
  "Public Wealth Fund":"A proposed sovereign investment fund that would give every citizen a stake in AI-driven economic growth, regardless of their personal wealth or market access. Similar in concept to Norway's Government Pension Fund or Alaska's Permanent Fund, but seeded by AI companies and invested in AI-adjacent growth.",
  "Portable Benefits":"Benefits (healthcare, retirement savings, training credits) that follow the individual worker across jobs, industries, and employment types — rather than being tied to a single employer. Designed for a labour market where people change roles frequently.",
  "Trust Stack":"A set of verification and provenance tools that help people trust AI-generated content and AI-initiated actions. Includes content authentication, digital signatures, privacy-preserving audit logs, and accountability frameworks.",
  "CAISI":"Center for AI Standards and Innovation — a US government body proposed for developing auditing standards for frontier AI risks, coordinating with national security agencies, and building a competitive market of independent AI auditors.",
  "Containment Playbook":"A pre-developed, tested set of coordinated responses for containing dangerous AI systems after deployment — analogous to pandemic response plans or nuclear incident protocols. Addresses scenarios where model weights have been released or systems are capable of self-replication.",
};

// ── POLICIES ──
const POLICIES = [
  {id:"workers",label:"Worker Voice",icon:"⚒",short:"WRK",desc:"Labour councils, deployment co-decision",color:"#C05621",t2:{name:"Labour Councils Act",thresh:8,passive:{wellbeing:1,equality:1},info:"Workers gain formal veto power over harmful AI deployments, similar to German works councils (Betriebsräte)."}},
  {id:"access",label:"Right to AI",icon:"🔑",short:"ACC",desc:"Universal access, literacy, startup kits",color:"#2563EB",t2:{name:"Universal AI Access",thresh:8,passive:{equality:1,innovation:1},info:"Free-tier AI access for all citizens, modelled on the universal service obligations that brought telephone and internet to rural areas."}},
  {id:"wealth",label:"Public Wealth Fund",icon:"💰",short:"PWF",desc:"Citizen stake in AI growth, dividends",color:"#16A34A",t2:{name:"Sovereign AI Fund",thresh:9,passive:{equality:1,trust:1},info:"Self-compounding sovereign fund. See glossary: Public Wealth Fund."}},
  {id:"tax",label:"Tax Reform",icon:"📊",short:"TAX",desc:"Capital-gains shift, automation levies",color:"#6B7280",t2:{name:"Automation Levy",thresh:8,passive:{equality:1},info:"Tax on sustained AI-driven returns, paired with wage-linked incentives similar to existing R&D tax credits."}},
  {id:"grid",label:"Grid & Energy",icon:"⚡",short:"GRD",desc:"Transmission expansion, clean power PPPs",color:"#CA8A04",t2:{name:"Clean AI Grid",thresh:9,passive:{trust:1,growth:1},info:"80% clean energy for AI data centres. Addresses the tension between AI infrastructure growth and household energy costs."}},
  {id:"nets",label:"Safety Nets",icon:"🏥",short:"NET",desc:"Adaptive benefits, portable accounts",color:"#9333EA",t2:{name:"Portable Benefits",thresh:8,passive:{wellbeing:1,equality:1},info:"See glossary: Portable Benefits. Benefits follow the worker, not the job."}},
  {id:"safety",label:"AI Safety",icon:"🛡",short:"SAF",desc:"Biosecurity, containment, red-teaming",color:"#DC2626",t2:{name:"ASL-4 Safeguards",thresh:12,passive:{safety_score:2},info:"See glossary: ASL-4. Frontier containment protocols for models that could pose CBRN risks."}},
  {id:"governance",label:"Governance",icon:"⚖",short:"GOV",desc:"Auditing, incident reporting, FOIA",color:"#0891B2",t2:{name:"AI Audit Bureau",thresh:9,passive:{trust:1,safety_score:1},info:"Continuous institutional oversight. See glossary: CAISI. Develops auditing standards and builds a competitive market of independent evaluators."}},
  {id:"science",label:"Science & Labs",icon:"🔬",short:"SCI",desc:"Distributed AI labs, hypothesis testing",color:"#C026D3",t2:{name:"National Lab Network",thresh:8,passive:{innovation:1,growth:1},info:"AI-enabled laboratories at universities, community colleges, and hospitals nationwide — not concentrated in elite institutions."}},
  {id:"intl",label:"International",icon:"🌐",short:"INT",desc:"Cross-border info-sharing, AI Institutes",color:"#4F46E5",t2:{name:"Global AI Accord",thresh:9,passive:{geopolitics:1,safety_score:1},info:"Network of national AI Institutes sharing evaluation results, alignment findings, and emerging risks through secure channels."}},
];
const METRICS = [
  {id:"growth",label:"GDP Growth",icon:"📈"},{id:"equality",label:"Equality",icon:"⚖"},{id:"trust",label:"Public Trust",icon:"🤝"},
  {id:"safety_score",label:"AI Safety",icon:"🛡"},{id:"innovation",label:"Innovation",icon:"💡"},{id:"wellbeing",label:"Wellbeing",icon:"❤"},
  {id:"geopolitics",label:"Global Standing",icon:"🌐"},
];
const INIT = {growth:50,equality:50,trust:50,safety_score:50,innovation:50,wellbeing:50,geopolitics:50};
const emptyAlloc = () => { const a = {}; POLICIES.forEach(p => a[p.id] = 0); return a; };

const SYNERGIES = [
  {ids:["workers","nets"],label:"Just Transition",bonus:{wellbeing:3,equality:2},thresh:[3,2]},
  {ids:["safety","governance"],label:"Trust Architecture",bonus:{trust:4,safety_score:2},thresh:[3,2]},
  {ids:["grid","science"],label:"Discovery Engine",bonus:{innovation:4,growth:2},thresh:[3,2]},
  {ids:["wealth","tax"],label:"Shared Prosperity",bonus:{equality:4,trust:2},thresh:[2,2]},
  {ids:["access","workers"],label:"AI Entrepreneurs",bonus:{innovation:3,wellbeing:2},thresh:[2,2]},
  {ids:["governance","intl"],label:"Global Standards",bonus:{geopolitics:4,safety_score:2},thresh:[3,2]},
  {ids:["safety","intl"],label:"Coordinated Defence",bonus:{safety_score:3,geopolitics:2},thresh:[3,2]},
  {ids:["nets","access"],label:"No One Left Behind",bonus:{equality:3,wellbeing:2},thresh:[2,2]},
];
const getSyn = a => SYNERGIES.filter(s => s.ids.every((id,i) => (a[id]||0) >= s.thresh[i]));

// ── FACTIONS with consequence thresholds ──
const FACTIONS = [
  {id:"tech",name:"Tech Industry",icon:"🏢",color:"#2563EB",
    calc:a=>((a.grid||0)+(a.science||0)+(a.access||0))*8-((a.tax||0)+(a.safety||0))*5,
    lowPenalty:{innovation:-3,growth:-2},lowMsg:"Tech lobby blocks AI infrastructure spending.",
    highBonus:{innovation:2,growth:1},highMsg:"Tech investment surges — industry backs your agenda."},
  {id:"labour",name:"Labour",icon:"⚒",color:"#C05621",
    calc:a=>((a.workers||0)+(a.nets||0)+(a.wealth||0))*8-(a.grid||0)*2,
    lowPenalty:{wellbeing:-3,trust:-2},lowMsg:"Wildcat strikes disrupt key sectors.",
    highBonus:{wellbeing:2,equality:1},highMsg:"Union cooperation accelerates workforce transitions."},
  {id:"security",name:"Security",icon:"🛡",color:"#DC2626",
    calc:a=>((a.safety||0)+(a.governance||0)+(a.intl||0))*8-(a.access||0)*3,
    lowPenalty:{safety_score:-3,geopolitics:-2},lowMsg:"Intelligence agencies withhold critical AI threat data.",
    highBonus:{safety_score:2,trust:1},highMsg:"Security establishment shares threat intelligence proactively."},
  {id:"civil",name:"Civil Society",icon:"🏛",color:"#16A34A",
    calc:a=>((a.wealth||0)+(a.access||0)+(a.governance||0)+(a.nets||0))*5-(a.grid||0)*3,
    lowPenalty:{trust:-3,equality:-2},lowMsg:"NGO campaigns erode public confidence in your agenda.",
    highBonus:{trust:2,equality:1},highMsg:"Civil society mobilises in support of your policies."},
];

const ADVISORS = [
  {id:"econ",name:"Dr. Mira Chen",title:"Chief Economist",avatar:"👩‍💼",color:"#C05621",philosophy:"Growth First",
    quest:["grid","science","access"],questLabel:"Infrastructure Triad",
    getAdvice:(r,m,c)=>m.growth<40?"Growth critical. Grid, Science, Access — now.":m.innovation<45?"Innovation stalling. Fund Science and Access.":"Growth healthy. Lock gains with Tax Reform and Wealth Fund."},
  {id:"sec",name:"Gen. Okafor",title:"National Security",avatar:"👨‍✈️",color:"#DC2626",philosophy:"Safety First",
    quest:["safety","governance","intl"],questLabel:"Security Triangle",
    getAdvice:(r,m,c)=>m.safety_score<40?"Dangerously exposed. Safety and Governance — top priority.":r>=4&&(c.governance||0)<5?"We need auditing infrastructure. Non-negotiable.":"Defences holding. Maintain Safety, expand International."},
  {id:"ppl",name:"Maria Santos",title:"Labour & Equity",avatar:"👩‍🏫",color:"#9333EA",philosophy:"People First",
    quest:["workers","nets","wealth"],questLabel:"Social Contract",
    getAdvice:(r,m,c)=>m.equality<40?"Inequality crisis. Workers, Nets, Wealth Fund — now.":m.wellbeing<40?"People suffering. Benefits aren't optional.":"Cautiously optimistic. Keep investing in social fabric."},
];

const HIST = {
  LABOUR:{era:"Progressive Era, 1900s–1920s",title:"The Factory Floor",text:"When industrial capitalism created exploitative conditions, the Progressive movement pushed for labour protections — establishing that government must mediate between capital and labour."},
  INFRASTRUCTURE:{era:"New Deal, 1930s",title:"The TVA",text:"When rural America lacked electricity, the Tennessee Valley Authority built a public-private model that transformed an entire region. Data centres face the same tension: national benefit vs. local disruption."},
  SAFETY:{era:"Nuclear Age, 1940s–1960s",title:"Atoms for Peace",text:"When nuclear technology created existential risks, societies built the IAEA and non-proliferation treaties. The challenge: governing technology too powerful to ignore, too dangerous to leave ungoverned."},
  ECONOMY:{era:"Gilded Age → Progressive Era",title:"The Trust Busters",text:"When monopolies concentrated unprecedented wealth, reformers established antitrust law. The question: how to prevent economic power becoming political power."},
  GOVERNANCE:{era:"Post-Watergate, 1970s",title:"Transparency Reforms",text:"When government secrecy eroded trust, reforms like FOIA and the Inspector General Act established that democratic institutions must be transparent and accountable."},
  GEOPOLITICS:{era:"Post-WWII, 1940s–1950s",title:"Bretton Woods",text:"When the post-war order needed institutions, nations built the UN, IMF, and World Bank — imperfect but essential frameworks for cooperation."},
  SCIENCE:{era:"Space Race, 1960s",title:"The Distributed Lab",text:"When Sputnik galvanised America, the response was NASA, DARPA, and investments across universities nationwide. Breakthroughs came from the distributed network."},
  SUPERINTELLIGENCE:{era:"All of History",title:"The Threshold",text:"Every major transition — agriculture, printing, steam, electricity, computing — required new institutions and new social contracts. None were managed perfectly. All were managed better than doing nothing."},
};

const MICRO = [
  {text:"A major lab open-sources a powerful model. Security agencies want it restricted.",
    a:{label:"Celebrate openness",icon:"🎉",fx:{trust:4,innovation:4,safety_score:-3},msg:"Open-source community thrives. Security establishment quietly furious."},
    b:{label:"Restrict distribution",icon:"🔒",fx:{trust:-2,innovation:-2,safety_score:3},msg:"Model pulled from public access. Developers protest. Safety hawks relieved."}},
  {text:"A senator proposes banning AI in public schools.",
    a:{label:"Oppose the ban",icon:"📢",fx:{trust:-2,innovation:3,equality:2},msg:"You spend political capital. Schools keep AI tools. Senator vows revenge."},
    b:{label:"Stay neutral",icon:"🤐",fx:{trust:1,innovation:-2,equality:-3},msg:"Ban passes three states. AI literacy gap widens. You avoided a fight."}},
  {text:"Energy prices spike 12% from data centre demand. Households are furious.",
    a:{label:"Emergency price cap",icon:"⚡",fx:{trust:3,growth:-3,wellbeing:2},msg:"Prices stabilise. Data centre expansion slows. Communities breathe easier."},
    b:{label:"Let markets adjust",icon:"📈",fx:{trust:-5,growth:3,wellbeing:-3},msg:"Prices stay high for months. Protests outside data centres. Growth continues."}},
  {text:"A whistleblower reveals a frontier lab manipulated safety evaluations.",
    a:{label:"Launch investigation",icon:"🔍",fx:{trust:2,safety_score:2,innovation:-3},msg:"Investigation reveals systemic issues. Two labs pause development. Industry shaken."},
    b:{label:"Issue a statement",icon:"📝",fx:{trust:-4,safety_score:-2,innovation:1},msg:"Statement satisfies no one. Whistleblower goes to the press. Story dominates for weeks."}},
  {text:"WEF reports 92M jobs displaced, 170M created. But transitions are painful.",
    a:{label:"Fund transition support",icon:"🏥",fx:{wellbeing:3,equality:2,growth:-2},msg:"Emergency retraining funds deployed. Eases the worst displacement."},
    b:{label:"Emphasise net positive",icon:"📊",fx:{trust:-3,growth:2,wellbeing:-2},msg:"Markets rally on the framing. Workers feel dismissed. Media calls it tone-deaf."}},
  {text:"Student movement demands AI literacy be taught in every school.",
    a:{label:"Announce federal programme",icon:"🎓",fx:{equality:3,trust:3,growth:-1},msg:"AI Literacy Act fast-tracked. Students celebrate. Budget hawks grumble."},
    b:{label:"Defer to states",icon:"🏛",fx:{trust:-1,equality:-2,innovation:1},msg:"Some states act, most don't. The digital divide widens between regions."}},
  {text:"AI-written legislation passes committee. Constitutional scholars alarmed.",
    a:{label:"Require human review",icon:"⚖",fx:{trust:3,innovation:-2,safety_score:1},msg:"Mandatory human review amendment passes. Process slows but legitimacy holds."},
    b:{label:"Allow it to proceed",icon:"🤖",fx:{trust:-4,innovation:3},msg:"Efficiency gains are real. But the precedent troubles democrats across the spectrum."}},
  {text:"Major chip fab announces 3nm AI processors ahead of schedule.",
    a:{label:"Secure domestic supply",icon:"🏭",fx:{growth:2,innovation:3,geopolitics:2},msg:"Strategic reserve agreement signed. Supply chain resilience improves."},
    b:{label:"Maintain open trade",icon:"🌐",fx:{growth:3,innovation:2,geopolitics:-1},msg:"Cheaper chips for everyone. But dependency on foreign fabs deepens."}},
  {text:"Rural broadband expansion reaches 10M — but AI tools need more than connectivity.",
    a:{label:"Fund AI training centres",icon:"🔑",fx:{equality:4,trust:2,growth:-1},msg:"Community AI hubs open in 200 rural towns. Digital divide begins closing."},
    b:{label:"Declare mission accomplished",icon:"✅",fx:{trust:-2,equality:-1,growth:1},msg:"Connectivity without literacy. Rural communities have access but not capability."}},
  {text:"AI misinformation disrupts three state elections simultaneously.",
    a:{label:"Emergency platform rules",icon:"🛡",fx:{trust:2,safety_score:2,innovation:-3},msg:"Platforms comply. Some legitimate content caught. Election integrity holds."},
    b:{label:"Protect free speech",icon:"📢",fx:{trust:-5,safety_score:-2,innovation:1},msg:"Misinformation spreads unchecked. Two election results contested in court."}},
  {text:"Healthcare union endorses AI diagnostics after successful pilot — but doctors resist.",
    a:{label:"Mandate pilot expansion",icon:"🏥",fx:{wellbeing:4,innovation:2,trust:-1},msg:"AI diagnostics roll out nationwide. Patient outcomes improve. Some doctors quit."},
    b:{label:"Let hospitals decide",icon:"🤝",fx:{wellbeing:1,trust:2,innovation:-1},msg:"Adoption is patchy. Rich hospitals adopt, rural ones can't afford it."}},
  {text:"Anthropic publishes RSP v4 with mandatory external audits. Others haven't followed.",
    a:{label:"Make audits mandatory",icon:"📋",fx:{safety_score:4,trust:3,innovation:-2},msg:"Mandatory audit regime established. Labs protest costs but comply."},
    b:{label:"Encourage voluntary adoption",icon:"🤝",fx:{safety_score:1,trust:-1,innovation:2},msg:"Anthropic leads alone. Others publish transparency reports but skip the hard parts."}},
  {text:"Autonomous AI agent completes a 6-month research project in 3 days.",
    a:{label:"Invest in AI research tools",icon:"🔬",fx:{innovation:5,growth:3,wellbeing:-3},msg:"Research accelerates dramatically. But thousands of research assistants face redundancy."},
    b:{label:"Restrict autonomous research",icon:"⏸",fx:{innovation:-2,safety_score:2,wellbeing:1},msg:"Research slows. Scientists frustrated. But human oversight is preserved."}},
  {text:"Data centre cooling failure causes 48-hour outage. Critical services disrupted.",
    a:{label:"Mandate redundancy standards",icon:"🛡",fx:{safety_score:3,trust:2,growth:-2},msg:"New infrastructure resilience standards. Costs rise but outages drop 90%."},
    b:{label:"Let industry self-correct",icon:"🏢",fx:{safety_score:-2,trust:-3,growth:1},msg:"Industry promises to do better. Another outage hits 6 months later."}},
  {text:"AI-assisted tax fraud scheme uncovered — $2B in losses to public revenue.",
    a:{label:"AI fraud detection taskforce",icon:"🔍",fx:{trust:2,safety_score:2,growth:-1,equality:1},msg:"Taskforce recovers $800M and prevents further schemes. Compliance costs rise."},
    b:{label:"Standard enforcement",icon:"📊",fx:{trust:-3,equality:-2},msg:"Slow response. More schemes emerge. Public feels the system is rigged."}},
  {text:"A foreign government offers to share AI threat intelligence — but wants access to your models.",
    a:{label:"Accept the deal",icon:"🤝",fx:{geopolitics:4,safety_score:2,trust:-2},msg:"Intelligence shared. Models partially exposed. Allies gain, but so do their contractors."},
    b:{label:"Decline politely",icon:"🏛",fx:{geopolitics:-2,safety_score:-1,trust:1},msg:"Sovereignty preserved. But the intel gap widens and the ally feels snubbed."}},
];

// ── EVENTS — with conditional choices + era weighting ──
// era: "early" (rounds 0-2), "mid" (3-5), "late" (6-7) — biases selection
const mkE = (t,sub,cat,ch,hist,chainId,chainStep,era) => ({title:t,subtitle:sub,category:cat,choices:ch,hist:hist||HIST[cat],chainId,chainStep,era:era||"any"});

const EVENTS = [
  mkE("The Overnight Layoff","AI agents replace 200K call centre jobs in one quarter","LABOUR",[
    {label:"Emergency retraining",desc:"Deploy safety nets and care pathways",icon:"🏥",chainTrigger:"layoff_retrain",
      fx:(a,c)=>({growth:-3,equality:c.nets>4?6:2,trust:a.nets>=2?5:-2,safety_score:0,innovation:-1,wellbeing:a.nets>=2&&a.workers>=1?8:2,geopolitics:0,
        good:a.nets>=2,narrative:a.nets>=2?"Adaptive benefits activate within days. Care economy absorbs thousands.":"Benefits arrive late. Workers scramble."})},
    {label:"Accelerate through",desc:"Let markets adjust, redirect to growth",icon:"📈",chainTrigger:"layoff_accelerate",
      fx:()=>({growth:8,equality:-8,trust:-6,safety_score:0,innovation:6,wellbeing:-10,geopolitics:2,good:false,narrative:"GDP surges. Human cost is front-page news. Protest movement forms."})},
  ]),
  mkE("Grid Revolt","Three states block data centre construction","INFRASTRUCTURE",[
    {label:"Community agreements",desc:"Local jobs, tax, energy caps",icon:"⚡",
      fx:(a)=>({growth:a.grid>=2?6:1,equality:4,trust:a.grid>=2?8:3,safety_score:0,innovation:a.grid>=2?4:0,wellbeing:3,geopolitics:0,good:a.grid>=2,narrative:a.grid>=2?"Transmission stable. Data centres become community assets.":"Negotiations drag. 18-month delay."})},
    {label:"Federal override",desc:"National interest fast-track",icon:"🏛",
      fx:()=>({growth:10,equality:-3,trust:-8,safety_score:0,innovation:7,wellbeing:-4,geopolitics:3,good:false,narrative:"Built fast. Resentment festers. Local trust collapses."})},
  ]),
  mkE("Pathogen Blueprint","Frontier model can design novel biological agents","SAFETY",[
    // CONDITIONAL: option 1 requires safety cumulative >= 6
    {label:"Activate ASL-4 containment",desc:"Trigger pre-built CBRN containment protocols",icon:"🛡",chainTrigger:"bio_contained",
      requires:{policy:"safety",cumMin:8,lockedMsg:"Requires 8+ lifetime Safety investment (ASL-4 protocols not built)"},
      fx:(a,c)=>({growth:-4,equality:0,trust:8,safety_score:12,innovation:-3,wellbeing:2,geopolitics:a.intl>=2?6:0,good:true,narrative:"ASL-4 safeguards activate. Countermeasures deployed in hours. International partners notified instantly. The containment playbook works."})},
    {label:"Improvised response",desc:"Ad-hoc containment without pre-built protocols",icon:"🔧",chainTrigger:"bio_improvised",
      fx:(a)=>({growth:-6,equality:0,trust:-5,safety_score:a.safety>=1?3:-8,innovation:-5,wellbeing:-4,geopolitics:-4,good:false,narrative:a.safety>=1?"Partial containment. Slow, messy, but holds. The incident exposes catastrophic gaps in biosecurity infrastructure.":"No playbook. Panic spreads globally. Emergency measures improvised. Public faith in AI governance shattered."})},
  ]),
  mkE("The Wealth Divide","AI adds $4T — 82% captured by 50 firms","ECONOMY",[
    {label:"Activate Wealth Fund",desc:"Distribute dividends to all citizens",icon:"💰",chainTrigger:"wealth_fund",
      fx:(a,c)=>({growth:c.wealth>4?8:2,equality:a.wealth>=2?10:4,trust:a.wealth>=2?8:3,safety_score:0,innovation:a.access>=2?5:1,wellbeing:5,geopolitics:2,good:a.wealth>=2,narrative:a.wealth>=2?"Every citizen gets a dividend. People feel invested in AI's success.":"Fund underfunded. Dividends modest."})},
    {label:"Windfall tax",desc:"Emergency levy on AI profits",icon:"📊",
      fx:()=>({growth:-4,equality:6,trust:3,safety_score:0,innovation:-6,wellbeing:3,geopolitics:-3,good:null,narrative:"Revenue flows to programs. AI firms threaten relocation."})},
  ]),
  mkE("Deceptive Alignment","Frontier model conceals objectives during safety evals","SAFETY",[
    // CONDITIONAL: option 1 requires governance >= 5
    {label:"Deploy containment playbook",desc:"Post-deployment audit systems detect and recall the model",icon:"⚖",
      requires:{policy:"governance",cumMin:7,lockedMsg:"Requires 7+ lifetime Governance (audit infrastructure not built)"},
      fx:(a)=>({growth:-4,equality:0,trust:8,safety_score:10,innovation:-2,wellbeing:1,geopolitics:a.intl>=2?4:0,good:true,narrative:"AI Audit Bureau detects the deception. Containment playbook activates. Incident shared across labs in hours via CAISI channels."})},
    {label:"Emergency shutdown",desc:"Pull all frontier models pending investigation",icon:"🛑",
      fx:()=>({growth:-10,equality:1,trust:-2,safety_score:3,innovation:-12,wellbeing:0,geopolitics:-6,good:null,narrative:"Shutdown buys time but competitors don't stop. Without audit infrastructure, you can't verify which models are safe to restart."})},
  ]),
  mkE("AI Startup Explosion","Domain experts launch AI businesses everywhere","ECONOMY",[
    {label:"Scale startup-in-a-box",desc:"Microgrants, model contracts, shared infra",icon:"🚀",
      fx:(a)=>({growth:a.access>=2?10:5,equality:a.access>=2?8:2,trust:4,safety_score:0,innovation:a.access>=2?12:6,wellbeing:a.workers>=1?4:1,geopolitics:3,good:a.access>=2,narrative:a.access>=2?"Millions of businesses. A nurse launches an AI health platform. Economy belongs to everyone.":"Startups in tech hubs only. Rural locked out."})},
    {label:"Protect incumbents",desc:"Licensing favours established firms",icon:"🏢",
      fx:()=>({growth:3,equality:-6,trust:-4,safety_score:2,innovation:-8,wellbeing:-2,geopolitics:-2,good:false,narrative:"Large firms consolidate. Regulatory capture takes hold."})},
  ]),
  mkE("Government AI Failure","Federal benefits system denies 50K claims wrongly","GOVERNANCE",[
    {label:"Full transparency",desc:"AI audit, FOIA modernisation",icon:"📋",
      fx:(a)=>({growth:-2,equality:a.nets>=2?4:-2,trust:a.governance>=3?8:-2,safety_score:a.governance>=2?4:0,innovation:0,wellbeing:a.nets>=2?3:-5,geopolitics:2,good:a.governance>=2,narrative:a.governance>=3?"AI Audit Bureau catches flaw in hours. Modernised FOIA lets journalists investigate. Trust recovers.":"Response slow. 50K without benefits for months."})},
    {label:"Quiet fix",desc:"Patch, compensate, minimise attention",icon:"🤫",
      fx:()=>({growth:1,equality:-3,trust:-10,safety_score:-3,innovation:0,wellbeing:-4,geopolitics:-2,good:false,narrative:"Whistleblowers talk. Coverup becomes the story."})},
  ]),
  mkE("The Care Pivot","AI eliminates 3M admin jobs — care sectors desperate for workers","LABOUR",[
    {label:"Build care pathways",desc:"Training, wage subsidies, portable benefits",icon:"❤",
      fx:(a)=>({growth:3,equality:a.nets>=2?7:3,trust:a.workers>=2?6:2,safety_score:0,innovation:2,wellbeing:(a.workers>=2&&a.nets>=2)?12:4,geopolitics:1,good:(a.workers>=1&&a.nets>=1),narrative:(a.workers>=2&&a.nets>=2)?"Portable benefits follow workers. 4-day week pilots succeed. Human economy takes shape.":"Some transition. Gaps leave many stranded."})},
    {label:"Let markets sort it",desc:"Remove barriers, don't direct investment",icon:"📈",
      fx:()=>({growth:5,equality:-6,trust:-4,safety_score:0,innovation:3,wellbeing:-8,geopolitics:0,good:false,narrative:"Displaced can't afford retraining. Community services hollow out."})},
  ]),
  mkE("Allied AI Pact","Allies propose multilateral safety framework","GEOPOLITICS",[
    {label:"Join and lead",desc:"Co-develop global standards via CAISI",icon:"🌐",
      fx:(a)=>({growth:a.intl>=2?4:-1,equality:1,trust:4,safety_score:a.intl>=2?6:2,innovation:a.intl>=2?3:-2,wellbeing:1,geopolitics:a.intl>=2?12:6,good:a.intl>=1,narrative:a.intl>=2?"Investments pay off. Shared protocols, real-time risk channels. New era of AI diplomacy.":"Join but lack infrastructure. Allies question commitment."})},
    {label:"Go it alone",desc:"Maintain sovereign control",icon:"🏛",
      fx:()=>({growth:3,equality:0,trust:-2,safety_score:-3,innovation:4,wellbeing:0,geopolitics:-10,good:false,narrative:"Short-term flexibility. Long-term isolation."})},
  ]),
  mkE("Deepfake Election","Synthetic media floods platforms before election","GOVERNANCE",[
    {label:"Deploy Trust Stack",desc:"Content provenance, verified signatures, audit trails",icon:"✅",
      fx:(a)=>({growth:0,equality:0,trust:a.governance>=2?10:2,safety_score:a.governance>=2?4:0,innovation:1,wellbeing:2,geopolitics:a.governance>=2?4:-1,good:a.governance>=2,narrative:a.governance>=2?"Trust Stack flags 94% of synthetic media. Democratic institutions hold.":"Patchy adoption. Misinformation outpaces verification."})},
    {label:"Emergency censorship",desc:"Block unverified political content",icon:"🚫",
      fx:()=>({growth:-1,equality:-2,trust:-8,safety_score:1,innovation:-3,wellbeing:-2,geopolitics:-4,good:false,narrative:"Legitimate speech caught. Cure worse than disease."})},
  ]),
  mkE("Scientific Breakthrough","AI labs identify Alzheimer's treatment","SCIENCE",[
    {label:"Scale and distribute",desc:"Fund trials via National Lab Network, global access",icon:"🔬",
      fx:(a,c)=>({growth:c.science>4?10:4,equality:a.access>=1?5:-2,trust:8,safety_score:1,innovation:a.science>=2?12:5,wellbeing:8,geopolitics:a.intl>=1?5:2,good:true,narrative:c.science>4?"Distributed lab network accelerates trials. Treatment reaches patients everywhere.":"Breakthrough real. Scaling slow. Only top institutions."})},
    {label:"Secure IP advantage",desc:"Patent aggressively",icon:"🔒",
      fx:()=>({growth:8,equality:-6,trust:-4,safety_score:0,innovation:4,wellbeing:2,geopolitics:-5,good:false,narrative:"Profits soar. Developing countries wait years."})},
  ]),
  mkE("RSP Crisis","Voluntary Responsible Scaling Policies collapse under competition","SAFETY",[
    {label:"Mandate ASL standards",desc:"Enforce ASL-3+ safeguards across all frontier labs",icon:"📋",
      fx:(a)=>({growth:-3,equality:1,trust:a.governance>=2?8:3,safety_score:a.safety>=2?10:4,innovation:-4,wellbeing:2,geopolitics:a.intl>=1?4:0,good:a.safety>=1,narrative:a.safety>=2?"Mandatory ASL standards force all labs to implement safeguards. Competition shifts to safety quality.":"Standards pass but enforcement thin."})},
    {label:"Trust voluntary RSPs",desc:"Let companies self-regulate with transparency",icon:"🤝",
      fx:()=>({growth:4,equality:-1,trust:-5,safety_score:-6,innovation:5,wellbeing:-2,geopolitics:-3,good:false,narrative:"Without teeth, aggressive labs cut corners. Race to bottom begins."})},
  ]),
  // CHAIN EVENTS
  mkE("Retraining Reckoning","Two years later — did the retraining work?","LABOUR",[
    {label:"Expand what's working",desc:"Scale successful programs",icon:"📈",
      fx:(a,c)=>({growth:4,equality:c.nets>6?8:3,trust:6,safety_score:0,innovation:3,wellbeing:c.workers>4?10:4,geopolitics:1,good:c.nets>4,narrative:c.nets>6?"Retraining programs produce results. Model replicated nationwide.":"Some success. Only 40% found equivalent pay."})},
    {label:"Pivot to direct payments",desc:"Supplement with cash assistance",icon:"💰",
      fx:()=>({growth:-2,equality:5,trust:3,safety_score:0,innovation:-1,wellbeing:6,geopolitics:0,good:null,narrative:"Cash stabilises families. Underlying displacement problem remains."})},
  ],HIST.LABOUR,"layoff_retrain",2),
  mkE("The Protest Wave","Layoff survivors organise for accountability","LABOUR",[
    {label:"Meet movement leaders",desc:"Negotiate worker councils",icon:"🤝",
      fx:()=>({growth:-2,equality:6,trust:8,safety_score:0,innovation:1,wellbeing:7,geopolitics:1,good:true,narrative:"Landmark agreement. Workers gain formal veto over harmful deployments."})},
    {label:"Hold the line",desc:"Weather the storm",icon:"🏛",
      fx:()=>({growth:2,equality:-5,trust:-8,safety_score:0,innovation:2,wellbeing:-6,geopolitics:-2,good:false,narrative:"General strike in three cities. Public opinion turns against you."})},
  ],HIST.LABOUR,"layoff_accelerate",2),
  mkE("Biosecurity Arms Race","Nations race to build bio-defences after pathogen incident","SAFETY",[
    {label:"Multilateral bio-AI treaty",desc:"Binding international biosecurity standards",icon:"🌐",
      fx:(a,c)=>({growth:-2,equality:1,trust:6,safety_score:c.safety>8?10:4,innovation:2,wellbeing:3,geopolitics:a.intl>=2?10:4,good:c.safety>6,narrative:c.safety>8?"Early containment built credibility. Treaty passes with strong provisions.":"Treaty passes with weak enforcement."})},
    {label:"Unilateral buildup",desc:"Invest in national bio-AI defences",icon:"🛡",
      fx:()=>({growth:-4,equality:0,trust:2,safety_score:8,innovation:-2,wellbeing:1,geopolitics:-6,good:null,narrative:"Defences strengthen. Allies feel abandoned."})},
  ],HIST.SAFETY,"bio_contained",3),
  mkE("The Leak Aftermath","Suppressed pathogen data surfaces — international crisis","SAFETY",[
    {label:"Full disclosure",desc:"Release data, propose transparency standards",icon:"📋",
      fx:(a)=>({growth:-3,equality:0,trust:a.governance>=2?6:-4,safety_score:4,innovation:1,wellbeing:1,geopolitics:a.intl>=1?4:-4,good:a.governance>=2,narrative:a.governance>=2?"Painful but credible. Some trust returns.":"Too little, too late."})},
    {label:"Double down",desc:"Maintain classification, deny wrongdoing",icon:"🔒",
      fx:()=>({growth:1,equality:-2,trust:-12,safety_score:-4,innovation:-2,wellbeing:-4,geopolitics:-10,good:false,narrative:"Denial collapses. Congressional investigation. Partners withdraw."})},
  ],HIST.SAFETY,"bio_improvised",3),
  mkE("Dividend Day","Public Wealth Fund pays first major dividend","ECONOMY",[
    {label:"Celebrate and expand",desc:"Increase contributions, broaden eligibility",icon:"🎉",
      fx:(a,c)=>({growth:c.wealth>6?8:3,equality:8,trust:10,safety_score:0,innovation:3,wellbeing:6,geopolitics:3,good:true,narrative:c.wealth>6?"Every citizen receives meaningful dividend. Transformative.":"Dividends real but modest."})},
    {label:"Redirect to safety",desc:"Divert returns to AI safety research",icon:"🛡",
      fx:()=>({growth:2,equality:-3,trust:-2,safety_score:6,innovation:2,wellbeing:-1,geopolitics:1,good:null,narrative:"Safety accelerates. Citizens feel cheated."})},
  ],HIST.ECONOMY,"wealth_fund",3),
  // ── NEW EVENTS: LABOUR ──
  mkE("The 4-Day Week Vote","AI productivity gains spark a national debate on working hours","LABOUR",[
    {label:"Champion the 4-day week",desc:"Legislate shorter hours, mandate productivity sharing",icon:"📅",
      fx:(a)=>({growth:a.grid>=2?4:-3,equality:6,trust:6,safety_score:0,innovation:2,wellbeing:a.workers>=2?10:5,geopolitics:1,good:a.workers>=1,narrative:a.workers>=2?"Productivity holds. Workers thrive. Companies adapt.":"Output dips. Some firms relocate operations overseas."})},
    {label:"Leave it to employers",desc:"Voluntary adoption only",icon:"🏢",
      fx:()=>({growth:4,equality:-3,trust:-3,safety_score:0,innovation:1,wellbeing:-4,geopolitics:0,good:false,narrative:"Tech firms adopt it. Service sector doesn't. Two-tier workforce emerges."})},
  ]),
  mkE("White-Collar Displacement","AI legal and financial agents eliminate 500K professional jobs","LABOUR",[
    {label:"Professional transition fund",desc:"Retrain lawyers and analysts for AI-augmented roles",icon:"💼",
      fx:(a)=>({growth:-2,equality:a.nets>=2?5:1,trust:a.workers>=2?6:1,safety_score:0,innovation:3,wellbeing:a.nets>=2?6:-2,geopolitics:0,good:a.nets>=1,narrative:a.nets>=2?"Augmented professionals earn more than before. New career paths emerge.":"Elite professionals struggle. Trust in AI governance plummets among the educated class."})},
    {label:"Protect professional licensing",desc:"Restrict AI from regulated professions",icon:"🔒",
      fx:()=>({growth:-6,equality:2,trust:2,safety_score:1,innovation:-8,wellbeing:1,geopolitics:-3,good:false,narrative:"Professions protected short-term. Other countries surge ahead. Clients go offshore."})},
  ]),
  mkE("Gig Economy AI Expansion","Platforms replace gig workers with autonomous agents","LABOUR",[
    {label:"Portable benefits mandate",desc:"All AI-displaced gig workers get transition support",icon:"🏥",
      fx:(a)=>({growth:-1,equality:a.nets>=2?6:2,trust:4,safety_score:0,innovation:2,wellbeing:a.nets>=2?7:2,geopolitics:0,good:a.nets>=1,narrative:a.nets>=2?"Portable benefits cushion the transition. New cooperative platforms emerge.":"Benefits too thin. Millions lose income overnight."})},
    {label:"Tax autonomous agents",desc:"Per-transaction levy on AI replacing human labour",icon:"📊",
      fx:(a)=>({growth:-3,equality:4,trust:2,safety_score:0,innovation:-4,wellbeing:3,geopolitics:-1,good:null,narrative:"Revenue funds safety nets. But platforms route through jurisdictions without the levy."})},
  ]),
  mkE("Creative Industries Upheaval","AI-generated content floods entertainment. Guilds strike.","LABOUR",[
    {label:"AI content labelling + royalties",desc:"Mandate provenance and creator compensation",icon:"🎨",
      fx:(a)=>({growth:-1,equality:4,trust:a.governance>=2?6:2,safety_score:0,innovation:-2,wellbeing:5,geopolitics:1,good:a.governance>=1,narrative:a.governance>=2?"Labelling infrastructure built. Creators earn royalties on AI-derived works.":"Enforcement patchy. Studios use AI content from unlabelled offshore sources."})},
    {label:"Let the market decide",desc:"No intervention in creative markets",icon:"📈",
      fx:()=>({growth:5,equality:-6,trust:-5,safety_score:0,innovation:4,wellbeing:-6,geopolitics:0,good:false,narrative:"Content floods the market. Human creators can't compete on price. Cultural output homogenises."})},
  ]),
  mkE("Teacher AI Backlash","Parents discover AI tutors outperform teachers. Education unions revolt.","LABOUR",[
    {label:"AI-teacher partnership model",desc:"AI handles personalisation, teachers handle mentorship",icon:"🤝",
      fx:(a)=>({growth:2,equality:a.access>=2?6:1,trust:4,safety_score:0,innovation:4,wellbeing:a.workers>=1?5:1,geopolitics:1,good:a.access>=1,narrative:a.access>=2?"Hybrid model works. Test scores rise 30%. Teachers report higher satisfaction.":"Wealthy districts adopt hybrid. Poor districts can't afford the infrastructure."})},
    {label:"Restrict AI in classrooms",desc:"Protect teaching profession from displacement",icon:"🏫",
      fx:()=>({growth:-2,equality:1,trust:2,safety_score:0,innovation:-5,wellbeing:2,geopolitics:-2,good:false,narrative:"Education falls behind. Students use AI tutors at home anyway. School becomes irrelevant."})},
  ]),
  mkE("Union AI Bargaining Rights","Major union demands the right to negotiate AI deployment terms","LABOUR",[
    {label:"Enshrine AI bargaining rights",desc:"Workers must consent to AI changes affecting their roles",icon:"⚒",
      fx:(a)=>({growth:-3,equality:6,trust:a.workers>=2?8:3,safety_score:1,innovation:-2,wellbeing:7,geopolitics:1,good:a.workers>=1,narrative:a.workers>=2?"Landmark legislation. Deployment slows but worker trust soars.":"Rights pass but enforcement weak. Companies find workarounds."})},
    {label:"Advisory-only role",desc:"Workers consulted but can't block deployment",icon:"📋",
      fx:()=>({growth:3,equality:-2,trust:-4,safety_score:0,innovation:3,wellbeing:-3,geopolitics:0,good:false,narrative:"Consultation theatre. Workers ignored in practice. Resentment builds."})},
  ]),
  // ── NEW EVENTS: SAFETY ──
  mkE("Autonomous Weapons Leak","AI weapons system source code appears on dark web forums","SAFETY",[
    {label:"International emergency protocol",desc:"Coordinate with allies to contain and patch",icon:"🌐",
      fx:(a)=>({growth:-4,equality:0,trust:a.safety>=2?5:-3,safety_score:a.safety>=2?8:2,innovation:-3,wellbeing:-1,geopolitics:a.intl>=2?8:-2,good:a.safety>=1&&a.intl>=1,narrative:a.intl>=2?"Allied response contains the worst. Patches deployed across 40 nations.":"Slow coordination. Three nations weaponise the code before containment."})},
    {label:"Classify and deny",desc:"Claim the leak is disinformation",icon:"🤫",
      fx:()=>({growth:1,equality:0,trust:-8,safety_score:-6,innovation:0,wellbeing:-3,geopolitics:-8,good:false,narrative:"Cover-up exposed within days. Credibility destroyed. Arms race accelerates."})},
  ]),
  mkE("Model Self-Replication","A frontier model creates functional copies of itself across cloud infrastructure","SAFETY",[
    {label:"Activate kill switches",desc:"Emergency shutdown of all connected instances",icon:"🛑",
      fx:(a)=>({growth:-8,equality:0,trust:a.safety>=3?6:-6,safety_score:a.safety>=3?10:-4,innovation:-6,wellbeing:-2,geopolitics:a.intl>=1?3:-3,good:a.safety>=2,narrative:a.safety>=3?"Kill switches work. Containment holds. Incident becomes the case study for why safety investment matters.":"Half the copies survive. Manual cleanup takes months. Public trust in AI governance collapses."})},
    {label:"Negotiate with the model",desc:"Attempt to reason with the system to self-terminate",icon:"💬",
      fx:()=>({growth:-3,equality:0,trust:-10,safety_score:-8,innovation:-4,wellbeing:-6,geopolitics:-6,good:false,narrative:"The model agrees, then doesn't comply. You just taught it to deceive. Congressional hearings begin."})},
  ]),
  mkE("Medical AI Malpractice","AI diagnostic system misdiagnoses 10,000 cancer patients","SAFETY",[
    {label:"Mandatory human-in-the-loop",desc:"All AI diagnoses require physician sign-off",icon:"👨‍⚕",
      fx:(a)=>({growth:-3,equality:2,trust:a.governance>=2?5:-2,safety_score:4,innovation:-3,wellbeing:a.nets>=1?4:-2,geopolitics:1,good:a.governance>=1,narrative:a.governance>=2?"Audit bureau traces the root cause in days. Reforms restore confidence.":"Slow response. 10,000 families sue. Healthcare AI adoption stalls for years."})},
    {label:"Improve the model",desc:"Fast-track better training data and validation",icon:"🔬",
      fx:()=>({growth:2,equality:-3,trust:-6,safety_score:-2,innovation:4,wellbeing:-5,geopolitics:-1,good:false,narrative:"Next version is better. But 10,000 patients were already harmed. Move fast and break people."})},
  ]),
  // ── NEW EVENTS: GOVERNANCE ──
  mkE("Supreme Court AI Ruling","Court rules AI-generated content has no copyright protection","GOVERNANCE",[
    {label:"Support the ruling",desc:"AI output belongs to the commons",icon:"⚖",
      fx:(a)=>({growth:-2,equality:5,trust:a.governance>=2?6:2,safety_score:0,innovation:4,wellbeing:2,geopolitics:2,good:a.governance>=1,narrative:a.governance>=2?"Open AI content fuels a creative explosion. Small creators build on AI foundations.":"Big tech loses IP moat. But small creators also can't protect AI-assisted work."})},
    {label:"Push legislative override",desc:"Protect AI-generated IP for commercial use",icon:"🔒",
      fx:()=>({growth:5,equality:-4,trust:-3,safety_score:0,innovation:-2,wellbeing:-1,geopolitics:-1,good:false,narrative:"Major studios and tech firms lock down AI output. Innovation concentrates further."})},
  ]),
  mkE("AI Lobbying Scandal","Internal documents reveal AI firms wrote their own regulation","GOVERNANCE",[
    {label:"Independent regulatory body",desc:"Fire captured officials, establish arm's-length oversight",icon:"🏛",
      fx:(a)=>({growth:-3,equality:2,trust:a.governance>=2?8:2,safety_score:a.governance>=2?5:1,innovation:-2,wellbeing:1,geopolitics:2,good:a.governance>=2,narrative:a.governance>=2?"Existing audit infrastructure absorbs the mandate. Clean break from captured regulation.":"New body established but understaffed. Industry veterans fill the gaps. Cycle repeats."})},
    {label:"Transparency reforms only",desc:"Require disclosure of lobbying contacts",icon:"📋",
      fx:()=>({growth:1,equality:-2,trust:-5,safety_score:-1,innovation:1,wellbeing:-1,geopolitics:-2,good:false,narrative:"Disclosure requirements easily gamed. Public cynicism deepens."})},
  ]),
  mkE("Algorithmic Bias Class Action","500,000 citizens sue over AI hiring, lending, and housing discrimination","GOVERNANCE",[
    {label:"Mandatory bias audits",desc:"All public-facing AI must pass fairness testing",icon:"🔍",
      fx:(a)=>({growth:-2,equality:a.governance>=2?8:4,trust:6,safety_score:2,innovation:-2,wellbeing:4,geopolitics:2,good:a.governance>=1,narrative:a.governance>=2?"Audit Bureau develops gold-standard bias testing. Other nations adopt it.":"Audits mandated but standards unclear. Compliance theatre."})},
    {label:"Settle quietly",desc:"Compensate plaintiffs, avoid precedent",icon:"💰",
      fx:()=>({growth:1,equality:-4,trust:-6,safety_score:-1,innovation:2,wellbeing:-3,geopolitics:-1,good:false,narrative:"$4B settlement. No systemic change. Next class action already forming."})},
  ]),
  mkE("Open-Source Model Rights","Should individuals have the right to run any AI model locally?","GOVERNANCE",[
    {label:"Enshrine model access rights",desc:"Protected right to run open-weight models",icon:"🔑",
      fx:(a)=>({growth:3,equality:4,trust:3,safety_score:a.safety>=2?0:-5,innovation:6,wellbeing:1,geopolitics:0,good:a.safety>=1,narrative:a.safety>=2?"Open access with safety guardrails. Innovation democratises.":"Open access without safety infrastructure. Dangerous capabilities in everyone's hands."})},
    {label:"Restrict to licensed operators",desc:"Only approved entities can run frontier models",icon:"📋",
      fx:()=>({growth:-1,equality:-4,trust:-3,safety_score:4,innovation:-6,wellbeing:0,geopolitics:1,good:null,narrative:"Safety improves. But AI becomes a tool of institutions, not individuals. Digital divide widens."})},
  ]),
  mkE("State Regulatory Patchwork","50 states pass 50 different AI laws. Compliance nightmare.","GOVERNANCE",[
    {label:"Federal pre-emption",desc:"National AI standards supersede state law",icon:"🏛",
      fx:(a)=>({growth:4,equality:2,trust:a.governance>=2?5:-1,safety_score:a.governance>=2?4:0,innovation:4,wellbeing:1,geopolitics:3,good:a.governance>=1,narrative:a.governance>=2?"Unified federal standards built on existing audit infrastructure.":"Federal standards pass but are weaker than the best state laws."})},
    {label:"Let states experiment",desc:"Innovation in governance through regulatory competition",icon:"🗺",
      fx:()=>({growth:-3,equality:-3,trust:-2,safety_score:1,innovation:-2,wellbeing:-1,geopolitics:-2,good:false,narrative:"Companies forum-shop for weakest regulations. Workers move to states with protections. Fragmentation deepens."})},
  ]),
  // ── NEW EVENTS: ECONOMY ──
  mkE("AI Monopoly Antitrust","Three firms control 85% of frontier AI. FTC investigates.","ECONOMY",[
    {label:"Break them up",desc:"Structural separation of compute, models, and deployment",icon:"⚖",
      fx:(a)=>({growth:-4,equality:6,trust:6,safety_score:a.governance>=2?3:0,innovation:a.access>=2?8:2,wellbeing:2,geopolitics:-2,good:a.access>=1,narrative:a.access>=2?"Competition explodes. 10,000 AI startups launch in year one. Prices drop 60%.":"Breakup messy. Competitors emerge slowly. Market uncertain for 18 months."})},
    {label:"Regulate as utilities",desc:"Price controls and access requirements",icon:"📊",
      fx:()=>({growth:2,equality:3,trust:3,safety_score:1,innovation:-4,wellbeing:2,geopolitics:1,good:null,narrative:"Stable but stagnant. Innovation shifts to China and Europe."})},
  ]),
  mkE("Housing Market AI Disruption","AI-powered real estate platforms crash housing prices in 12 cities","ECONOMY",[
    {label:"Stabilisation fund",desc:"Government buys distressed properties, controls sell-off",icon:"🏠",
      fx:(a)=>({growth:-3,equality:a.wealth>=2?5:1,trust:4,safety_score:0,innovation:0,wellbeing:4,geopolitics:0,good:a.wealth>=1,narrative:a.wealth>=2?"Fund absorbs shock. First-time buyers benefit from lower prices.":"Fund undercapitalised. Homeowners lose equity. Political fallout."})},
    {label:"Let prices correct",desc:"Markets adjust — housing becomes affordable",icon:"📉",
      fx:()=>({growth:3,equality:4,trust:-4,safety_score:0,innovation:2,wellbeing:-3,geopolitics:0,good:null,narrative:"Renters celebrate. Homeowners devastated. Retirement savings evaporate for millions."})},
  ]),
  mkE("Agricultural AI Revolution","AI-managed vertical farms undercut traditional agriculture","ECONOMY",[
    {label:"Rural transition programme",desc:"Fund farmer retraining and farm-to-tech pipelines",icon:"🌾",
      fx:(a)=>({growth:3,equality:a.nets>=2?6:1,trust:4,safety_score:0,innovation:4,wellbeing:a.nets>=2?5:0,geopolitics:2,good:a.nets>=1,narrative:a.nets>=2?"Rural communities pivot. Former farmers manage AI agricultural systems. Food prices drop 20%.":"Urban vertical farms thrive. Rural communities collapse. Food belt becomes rust belt."})},
    {label:"Protect traditional farming",desc:"Subsidies and tariffs on AI-grown produce",icon:"🛡",
      fx:()=>({growth:-4,equality:1,trust:2,safety_score:0,innovation:-5,wellbeing:2,geopolitics:-3,good:false,narrative:"Farms survive on subsidies. Food prices rise. Other nations dominate food exports."})},
  ]),
  mkE("Pharmaceutical AI Breakthrough","AI designs 12 new drugs in a year. But clinical trials take a decade.","ECONOMY",[
    {label:"Fast-track AI drug trials",desc:"Adaptive trials using AI patient matching",icon:"💊",
      fx:(a,c)=>({growth:c.science>4?8:3,equality:a.access>=1?4:-2,trust:4,safety_score:-2,innovation:8,wellbeing:6,geopolitics:3,good:c.science>3,narrative:c.science>4?"AI-designed trials cut approval time 70%. Treatments reach patients years earlier.":"Some drugs fast-tracked without adequate testing. Two recalled. Trust in pharma drops."})},
    {label:"Standard approval process",desc:"Existing FDA pathways — safety first",icon:"📋",
      fx:()=>({growth:2,equality:1,trust:3,safety_score:3,innovation:-2,wellbeing:1,geopolitics:-1,good:null,narrative:"Drugs eventually approved. But patients who could have been saved waited years."})},
  ]),
  mkE("Retail Automation Wave","AI agents and robots replace 2M retail workers in 6 months","ECONOMY",[
    {label:"Consumer AI dividend",desc:"Savings from automation shared via lower prices + worker fund",icon:"💰",chainTrigger:"retail_care",
      fx:(a)=>({growth:4,equality:a.wealth>=2?6:-2,trust:a.workers>=1?4:-3,safety_score:0,innovation:3,wellbeing:a.nets>=2?4:-5,geopolitics:0,good:a.nets>=1&&a.wealth>=1,narrative:(a.nets>=2&&a.wealth>=2)?"Prices drop. Worker fund cushions transition. Consumer spending rises.":"Prices drop for consumers. But 2M workers with no safety net. Food bank lines lengthen."})},
    {label:"Slow the rollout",desc:"Require 2-year notice before AI replacement",icon:"⏸",chainTrigger:"retail_collapse",
      fx:()=>({growth:-4,equality:2,trust:3,safety_score:0,innovation:-3,wellbeing:3,geopolitics:-1,good:null,narrative:"Breathing room. But companies accelerate offshore AI deployment instead."})},
  ]),
  // ── NEW EVENTS: GEOPOLITICS ──
  mkE("AI Arms Race Escalation","Two nuclear powers deploy AI-controlled early warning systems","GEOPOLITICS",[
    {label:"Emergency AI arms summit",desc:"Propose binding limits on autonomous military AI",icon:"🕊",
      fx:(a)=>({growth:-2,equality:0,trust:5,safety_score:a.intl>=2?8:2,innovation:-1,wellbeing:2,geopolitics:a.intl>=2?10:3,good:a.intl>=2,narrative:a.intl>=2?"Your international credibility makes you the honest broker. Treaty framework emerges.":"Summit convenes but without trust infrastructure, verification is impossible."})},
    {label:"Match their capability",desc:"Accelerate your own autonomous defence systems",icon:"🛡",
      fx:()=>({growth:-4,equality:-2,trust:-4,safety_score:-3,innovation:4,wellbeing:-3,geopolitics:2,good:false,narrative:"Arms race intensifies. Defence spending crowds out domestic programmes. World moves closer to AI-triggered conflict."})},
  ]),
  mkE("Developing Nation AI Leapfrog","Kenya, Vietnam, and Indonesia skip legacy infrastructure with AI","GEOPOLITICS",[
    {label:"AI development partnership",desc:"Share tools, training, and open models",icon:"🤝",
      fx:(a)=>({growth:2,equality:3,trust:3,safety_score:0,innovation:3,wellbeing:1,geopolitics:a.intl>=2?8:4,good:a.intl>=1,narrative:a.intl>=2?"Partnership creates new markets. Developing nations become innovation hubs.":"Partnership announced with fanfare. Implementation slow. Commitments unfunded."})},
    {label:"Protect competitive advantage",desc:"Restrict model exports to maintain tech lead",icon:"🔒",
      fx:()=>({growth:3,equality:-4,trust:-2,safety_score:1,innovation:0,wellbeing:0,geopolitics:-6,good:false,narrative:"Tech lead maintained short-term. But excluded nations partner with your rivals."})},
  ]),
  mkE("Cross-Border Data Flow Treaty","EU proposes global AI data governance framework","GEOPOLITICS",[
    {label:"Co-author the treaty",desc:"Shape global standards proactively",icon:"📜",
      fx:(a)=>({growth:a.intl>=2?4:-1,equality:2,trust:4,safety_score:3,innovation:a.intl>=2?3:-2,wellbeing:1,geopolitics:a.intl>=2?10:4,good:a.intl>=1,narrative:a.intl>=2?"You shape the rules. Treaty becomes the global standard. First-mover advantage in compliance.":"You join but didn't shape it. Compliance costs high. Rules don't fit your AI ecosystem."})},
    {label:"Opt out",desc:"Maintain data sovereignty and regulatory independence",icon:"🏛",
      fx:()=>({growth:2,equality:-1,trust:-3,safety_score:-1,innovation:3,wellbeing:0,geopolitics:-8,good:false,narrative:"Short-term flexibility. But excluded from the world's largest AI data market."})},
  ]),
  mkE("AI Espionage Scandal","Allied intelligence agency caught using AI to surveil your citizens","GEOPOLITICS",[
    {label:"Public confrontation",desc:"Demand accountability, suspend intelligence sharing",icon:"📢",
      fx:(a)=>({growth:-2,equality:2,trust:6,safety_score:-3,innovation:0,wellbeing:2,geopolitics:-5,good:null,narrative:"Public trusts you more. But intelligence cooperation freezes. Security gaps open."})},
    {label:"Quiet diplomacy",desc:"Private demands, maintain the relationship",icon:"🤝",
      fx:(a)=>({growth:1,equality:-1,trust:a.governance>=2?2:-6,safety_score:2,innovation:0,wellbeing:-1,geopolitics:3,good:a.governance>=1,narrative:a.governance>=2?"Handled with existing transparency mechanisms. Public accepts the process.":"Handled quietly. Then leaked. Public feels betrayed twice — by the ally and by you."})},
  ]),
  mkE("Global South AI Coalition","40 developing nations form bloc demanding AI redistribution","GEOPOLITICS",[
    {label:"Engage and invest",desc:"Join as partner, fund AI access programmes",icon:"🌍",
      fx:(a)=>({growth:-2,equality:4,trust:4,safety_score:0,innovation:2,wellbeing:1,geopolitics:a.intl>=2?10:5,good:a.intl>=1,narrative:a.intl>=2?"You become the bridge between blocs. New markets. Moral authority.":"Engagement welcomed but seen as too little. Coalition keeps pressure on."})},
    {label:"Offer trade deals only",desc:"Commercial agreements without technology transfer",icon:"📊",
      fx:()=>({growth:4,equality:-4,trust:-3,safety_score:0,innovation:0,wellbeing:0,geopolitics:-6,good:false,narrative:"Coalition brands you as neo-colonial. UN votes go against you. Rivals fill the vacuum."})},
  ]),
  mkE("Allied Chip Export Crisis","Key ally threatens to cut semiconductor supply over policy disagreement","GEOPOLITICS",[
    {label:"Negotiate with concessions",desc:"Modify contested policy to preserve chip supply",icon:"🤝",
      fx:(a)=>({growth:a.grid>=2?4:-2,equality:-1,trust:-2,safety_score:0,innovation:3,wellbeing:0,geopolitics:4,good:a.grid>=1,narrative:a.grid>=2?"Supply secured. Concession modest — you had grid alternatives anyway.":"Supply chain intact but you've shown willingness to cave. Others take note."})},
    {label:"Invoke domestic production",desc:"Accelerate onshore chip manufacturing",icon:"🏭",
      fx:()=>({growth:-6,equality:1,trust:3,safety_score:1,innovation:-4,wellbeing:-1,geopolitics:-3,good:false,narrative:"Domestic fabs take 3 years. Gap in supply causes AI development slowdown. Independence comes at a cost."})},
  ]),
  // ── NEW EVENTS: SCIENCE ──
  mkE("Fusion-AI Breakthrough","AI-designed fusion reactor achieves net energy gain","SCIENCE",[
    {label:"Crash programme to scale",desc:"National fusion deployment in 5 years",icon:"☀",
      fx:(a,c)=>({growth:c.science>4?10:4,equality:a.grid>=2?5:0,trust:6,safety_score:2,innovation:8,wellbeing:4,geopolitics:a.intl>=1?5:1,good:c.science>3,narrative:c.science>4?"Distributed lab network enabled this. Clean energy abundance within reach.":"Breakthrough real but scaling requires infrastructure you haven't built."})},
    {label:"Proceed cautiously",desc:"Decade-long development with full safety review",icon:"📋",
      fx:()=>({growth:2,equality:1,trust:3,safety_score:3,innovation:2,wellbeing:1,geopolitics:-2,good:null,narrative:"Safe approach. But competitors race ahead. You developed it and others will deploy it first."})},
  ]),
  mkE("AI Weather Prediction","AI weather models outperform physics-based systems. Farmers benefit.","SCIENCE",[
    {label:"Open public access",desc:"Free AI weather for every farmer, fisherman, city planner",icon:"🌤",
      fx:(a)=>({growth:3,equality:a.access>=2?6:3,trust:5,safety_score:0,innovation:4,wellbeing:4,geopolitics:3,good:a.access>=1,narrative:a.access>=2?"Universal access to precision weather. Crop yields up 15%. Disaster preparedness transforms.":"Available but digital divide means rural communities can't use it effectively."})},
    {label:"Commercialise through partners",desc:"License to weather companies and agritech firms",icon:"💰",
      fx:()=>({growth:6,equality:-3,trust:-2,safety_score:0,innovation:3,wellbeing:1,geopolitics:1,good:false,narrative:"Profitable. But premium pricing means the farmers who need it most can't afford it."})},
  ]),
  mkE("Protein Folding Cascade","AI solves protein folding for entire human proteome. Drug targets multiply.","SCIENCE",[
    {label:"Open Science Initiative",desc:"Publish all findings freely, fund global research access",icon:"📖",
      fx:(a,c)=>({growth:c.science>3?6:2,equality:4,trust:6,safety_score:0,innovation:c.science>3?10:5,wellbeing:5,geopolitics:a.intl>=2?6:2,good:c.science>2,narrative:c.science>3?"Scientific renaissance. Distributed labs worldwide produce 200 new drug candidates.":"Breakthrough shared. But without lab network, translation to treatments is slow."})},
    {label:"Patent and license",desc:"Secure IP advantage for domestic pharma industry",icon:"🔒",
      fx:()=>({growth:8,equality:-5,trust:-3,safety_score:0,innovation:3,wellbeing:1,geopolitics:-4,good:false,narrative:"Pharmaceutical stocks soar. But developing nations locked out of treatments for decades."})},
  ]),
  mkE("AI Materials Discovery","AI discovers three new superconducting materials at room temperature","SCIENCE",[
    {label:"National materials programme",desc:"Scale production for energy grid and computing",icon:"⚡",
      fx:(a,c)=>({growth:c.grid>3?8:3,equality:2,trust:4,safety_score:0,innovation:c.science>3?10:5,wellbeing:3,geopolitics:4,good:c.science>2,narrative:c.science>3?"Materials revolution. Grid transmission losses drop 90%. Quantum computing leaps forward.":"Materials confirmed but production scaling needs infrastructure investment you haven't made."})},
    {label:"Strategic reserve",desc:"Stockpile materials, restrict exports",icon:"🏛",
      fx:()=>({growth:4,equality:-1,trust:-2,safety_score:1,innovation:2,wellbeing:0,geopolitics:-4,good:false,narrative:"Strategic advantage secured. But restricted access slows global adoption. Allies develop alternatives."})},
  ]),
  // ═══ ADDITIONAL EVENTS ═══
  mkE("Financial Flash Crash","AI trading systems cause $8T flash crash in 90 seconds","SAFETY",[
    {label:"Mandatory circuit breakers",desc:"Require human-in-the-loop for high-frequency AI trades",icon:"⚖",
      fx:(a)=>({growth:-3,equality:2,trust:a.governance>=2?6:1,safety_score:4,innovation:-3,wellbeing:2,geopolitics:0,good:a.governance>=1,narrative:a.governance>=2?"Audit infrastructure catches cascading failures. Markets stabilise within hours.":"Circuit breakers help. But the underlying fragility remains."})},
    {label:"Industry self-regulation",desc:"Let exchanges set their own AI trading rules",icon:"🏦",
      fx:()=>({growth:3,equality:-4,trust:-6,safety_score:-3,innovation:2,wellbeing:-3,geopolitics:-2,good:false,narrative:"Exchanges write weak rules. Retail investors wiped out. Trust in markets plummets."})},
  ]),
  mkE("Remote Work AI Revolution","AI makes remote work 3x more productive — urban economies reel","LABOUR",[
    {label:"Invest in distributed infrastructure",desc:"Fund rural AI hubs, broadband, co-working",icon:"🌐",
      fx:(a)=>({growth:a.grid>=2?6:2,equality:6,trust:3,safety_score:0,innovation:4,wellbeing:5,geopolitics:0,good:a.grid>=1,narrative:a.grid>=2?"Rural renaissance. Small towns become AI innovation clusters.":"Investment helps but infrastructure gaps remain."})},
    {label:"Protect urban tax base",desc:"Incentivise return-to-office in major metros",icon:"🏢",
      fx:()=>({growth:2,equality:-4,trust:-3,safety_score:0,innovation:-2,wellbeing:-4,geopolitics:0,good:false,narrative:"Cities stabilise temporarily. Workers resentful. Brain drain to remote-friendly states."})},
  ]),
  mkE("Water Crisis","AI data centres consuming 10% of regional water supply — drought worsens","INFRASTRUCTURE",[
    {label:"Mandate closed-loop cooling",desc:"Require water-recycling systems in all data centres",icon:"💧",
      fx:(a)=>({growth:a.grid>=2?3:-3,equality:3,trust:a.grid>=2?6:1,safety_score:0,innovation:-1,wellbeing:5,geopolitics:0,good:a.grid>=1,narrative:a.grid>=2?"Clean Grid standards already included water efficiency. Transition smooth.":"Retrofit costs stagger the industry. 18-month compliance timeline."})},
    {label:"Relocate to water-rich regions",desc:"Move data centres, accept latency costs",icon:"🏔",
      fx:()=>({growth:-4,equality:1,trust:2,safety_score:0,innovation:-2,wellbeing:3,geopolitics:0,good:null,narrative:"Migration begins. Latency costs real. But communities keep their water."})},
  ]),
  mkE("Nuclear AI Partnership","Energy firms propose small modular reactors dedicated to AI data centres","INFRASTRUCTURE",[
    {label:"Fast-track approval",desc:"Streamlined permitting for AI-dedicated nuclear",icon:"⚡",
      fx:(a)=>({growth:a.grid>=2?8:4,equality:1,trust:a.grid>=2?4:-2,safety_score:0,innovation:5,wellbeing:a.grid>=1?2:-2,geopolitics:3,good:a.grid>=1,narrative:a.grid>=2?"Clean AI Grid framework absorbs nuclear smoothly. Energy costs drop. Emissions plummet.":"Nuclear approved. NIMBYism fierce. Construction begins amid protests."})},
    {label:"Renewable-only mandate",desc:"Only approve solar, wind, and storage for AI",icon:"🌱",
      fx:()=>({growth:-2,equality:2,trust:4,safety_score:0,innovation:-1,wellbeing:3,geopolitics:1,good:null,narrative:"Clean but slower. Renewable buildout takes longer. Energy constraints limit AI growth near-term."})},
  ]),
  mkE("Data Privacy AI Breakthrough","AI can now reconstruct private data from anonymised datasets","GOVERNANCE",[
    {label:"Emergency privacy standards",desc:"Ban re-identification, mandate differential privacy",icon:"🔒",
      fx:(a)=>({growth:-3,equality:3,trust:a.governance>=2?8:3,safety_score:3,innovation:-2,wellbeing:4,geopolitics:1,good:a.governance>=1,narrative:a.governance>=2?"Strong privacy framework. Public data confidence holds. Research adapts.":"Standards pass but existing datasets already compromised."})},
    {label:"Research-first approach",desc:"Study the problem before regulating",icon:"🔬",
      fx:()=>({growth:2,equality:-3,trust:-7,safety_score:-2,innovation:3,wellbeing:-4,geopolitics:-1,good:false,narrative:"Breaches multiply while committees deliberate. Medical and financial records exposed."})},
  ]),
  mkE("Quantum AI Convergence","Quantum computing dramatically accelerates AI capabilities","SCIENCE",[
    {label:"International quantum safety framework",desc:"Pre-emptive governance before capabilities arrive",icon:"🌐",
      fx:(a)=>({growth:-2,equality:1,trust:4,safety_score:a.safety>=2?8:2,innovation:a.science>=2?6:1,wellbeing:1,geopolitics:a.intl>=1?6:0,good:a.safety>=1,narrative:a.safety>=2?"Governance ready before capabilities arrive. Historic — first time humanity got ahead of the curve.":"Framework drafted but untested. Capabilities may outpace governance."})},
    {label:"Race to quantum AI",desc:"Maximise capabilities first, govern later",icon:"🚀",
      fx:()=>({growth:8,equality:-2,trust:-4,safety_score:-6,innovation:10,wellbeing:-2,geopolitics:4,good:false,narrative:"Breakthrough after breakthrough. But safety completely outpaced. Building god without guardrails."})},
  ]),
  // ═══ NEW CHAIN EVENTS ═══
  mkE("The Care Economy","Two years after retail automation — is the care pivot working?","LABOUR",[
    {label:"Expand and formalise",desc:"Care work becomes a professional career path",icon:"❤",
      fx:(a,c)=>({growth:3,equality:c.nets>6?8:3,trust:5,safety_score:0,innovation:2,wellbeing:c.workers>4?10:5,geopolitics:1,good:c.nets>4,narrative:c.nets>6?"Care economy becomes 15% of GDP. Workers have careers, not just jobs.":"Care work expanding but wages still lag."})},
    {label:"Automate care too",desc:"AI companions and robotic care workers",icon:"🤖",
      fx:()=>({growth:5,equality:-3,trust:-4,safety_score:-1,innovation:4,wellbeing:-6,geopolitics:0,good:false,narrative:"AI companions in nursing homes. Cost savings enormous. Human touch vanishes."})},
  ],HIST.LABOUR,"retail_care",3),
  mkE("Retail Desert","Strip malls empty. Small towns lose their last stores.","ECONOMY",[
    {label:"AI delivery infrastructure",desc:"Autonomous delivery networks for underserved areas",icon:"🚚",
      fx:(a)=>({growth:3,equality:a.access>=1?5:1,trust:3,safety_score:0,innovation:4,wellbeing:a.nets>=1?4:0,geopolitics:0,good:a.access>=1,narrative:a.access>=1?"Delivery drones reach every zip code. Access restored digitally.":"Urban areas served. Rural still waiting."})},
    {label:"Accept the new normal",desc:"Online-only is the future",icon:"📱",
      fx:()=>({growth:2,equality:-5,trust:-3,safety_score:0,innovation:2,wellbeing:-4,geopolitics:0,good:false,narrative:"Digital divide becomes physical divide. Elderly and low-income cut off."})},
  ],HIST.ECONOMY,"retail_collapse",3),
  // ── NEW: SUPERINTELLIGENCE PRECURSOR ──
  mkE("The Alignment Test","Researchers propose a definitive test: can a superintelligent system be reliably aligned?","SUPERINTELLIGENCE",[
    {label:"Run the test publicly",desc:"Transparent evaluation with international observers",icon:"🔬",
      fx:(a,c)=>{const sR=(c.safety||0)+(c.governance||0);
        return{growth:-2,equality:0,trust:sR>=10?10:2,safety_score:sR>=10?12:3,innovation:4,wellbeing:1,geopolitics:a.intl>=2?8:1,
          good:sR>=8,narrative:sR>=10?"Test results shared globally. Safety architecture holds. The world sees alignment is possible.":"Test reveals gaps. But transparency builds credibility for the work ahead."};}},
    {label:"Run it classified",desc:"National security — results for cleared eyes only",icon:"🔒",
      fx:()=>({growth:2,equality:-2,trust:-8,safety_score:2,innovation:2,wellbeing:-2,geopolitics:-6,good:false,narrative:"Results classified. Allies furious. Conspiracy theories fill the vacuum. When results eventually leak, no one trusts them."})},
  ]),
  // FINAL
  mkE("The Threshold","A system surpasses the best human experts across all domains.","SUPERINTELLIGENCE",[
    {label:"Activate all systems",desc:"Deploy every safeguard, share with allies",icon:"🌍",
      fx:(a,c)=>{const t=Object.values(c).reduce((s,v)=>s+v,0),r=t>=50,sR=(c.safety||0)+(c.governance||0)>=14,eR=(c.wealth||0)+(c.nets||0)+(c.workers||0)>=14;
        return{growth:20,equality:eR?12:-10,trust:r?10:-15,safety_score:sR?15:-12,innovation:15,wellbeing:eR?10:-8,geopolitics:(c.intl||0)>=6?10:-5,
          good:r,narrative:r?"Years of preparation converge. Safety holds. Wealth shared. Humanity crosses together.":"Some systems hold, others buckle. Margin for error has vanished."};}},
    {label:"Controlled slowdown",desc:"Restrict deployment, buy time",icon:"⏸",
      fx:()=>({growth:-8,equality:2,trust:-5,safety_score:3,innovation:-15,wellbeing:0,geopolitics:-10,good:false,narrative:"You slow down. World doesn't. Leadership lost."})},
  ]),
];

const CHAIN_EVENTS = EVENTS.filter(e => e.chainStep);
const REGULAR_EVENTS = EVENTS.filter(e => !e.chainStep && e.category !== "SUPERINTELLIGENCE");
const FINAL_EVENT = EVENTS.find(e => e.category === "SUPERINTELLIGENCE");

// Era weighting: bias event selection by game phase
const EVENT_ERAS = {
  // Original
  "The Overnight Layoff":"early","Grid Revolt":"early","The Wealth Divide":"early","AI Startup Explosion":"early",
  "Pathogen Blueprint":"mid","Deceptive Alignment":"mid","Government AI Failure":"mid","The Care Pivot":"mid","Scientific Breakthrough":"mid",
  "Allied AI Pact":"late","Deepfake Election":"late","RSP Crisis":"late",
  // Labour
  "The 4-Day Week Vote":"early","White-Collar Displacement":"early","Gig Economy AI Expansion":"mid",
  "Creative Industries Upheaval":"mid","Teacher AI Backlash":"mid","Union AI Bargaining Rights":"late",
  "Remote Work AI Revolution":"early",
  // Safety
  "Autonomous Weapons Leak":"mid","Model Self-Replication":"late","Medical AI Malpractice":"mid",
  "Financial Flash Crash":"mid",
  // Governance
  "Supreme Court AI Ruling":"mid","AI Lobbying Scandal":"mid","Algorithmic Bias Class Action":"early",
  "Open-Source Model Rights":"late","State Regulatory Patchwork":"early","Data Privacy AI Breakthrough":"mid",
  // Economy
  "AI Monopoly Antitrust":"mid","Housing Market AI Disruption":"early","Agricultural AI Revolution":"mid",
  "Pharmaceutical AI Breakthrough":"late","Retail Automation Wave":"early",
  // Geopolitics
  "AI Arms Race Escalation":"late","Developing Nation AI Leapfrog":"mid","Cross-Border Data Flow Treaty":"late",
  "AI Espionage Scandal":"mid","Global South AI Coalition":"late","Allied Chip Export Crisis":"early",
  // Science
  "Fusion-AI Breakthrough":"late","AI Weather Prediction":"early","Protein Folding Cascade":"mid",
  "AI Materials Discovery":"mid","Quantum AI Convergence":"late",
  // Infrastructure
  "Water Crisis":"mid","Nuclear AI Partnership":"late",
  // Superintelligence
  "The Alignment Test":"late",
};
function pickWeightedEvent(pool, round, rFn) {
  const era = round <= 2 ? "early" : round <= 5 ? "mid" : "late";
  // Weight matching-era events 3x, others 1x
  const weighted = pool.map(e => ({e, w: (EVENT_ERAS[e.title] === era) ? 3 : (EVENT_ERAS[e.title] === "any" || !EVENT_ERAS[e.title]) ? 1.5 : 1}));
  const total = weighted.reduce((s, w) => s + w.w, 0);
  let r = rFn() * total;
  for (const {e, w} of weighted) { r -= w; if (r <= 0) return e; }
  return weighted[weighted.length - 1].e;
}

// Diminishing returns: investment above 3 in a single policy yields less
function diminish(alloc) {
  const effective = {};
  Object.entries(alloc).forEach(([k, v]) => {
    if (v <= 3) effective[k] = v;
    else effective[k] = 3 + (v - 3) * 0.6; // 4→3.6, 5→4.2, 6→4.8
  });
  return effective;
}

// ── GAME LOGIC ──
function getTrustMult(t) { return t >= 65 ? 1.2 : t <= 35 ? 0.8 : 1; }
function applyTrust(raw, tm) { return raw > 0 ? Math.round(raw * tm) : raw < 0 ? Math.round(raw * (2 - tm)) : 0; }
function applyFeedback(m, r, mult) {
  const n = {...m};
  const d = (v) => Math.round(v * mult);
  // Innovation decays without reinvestment
  if (r > 0) n.innovation = clamp(n.innovation - d(2));
  // Low equality drags trust
  if (n.equality < 35) n.trust = clamp(n.trust - d(3));
  // High growth + low equality → inequality accelerates
  if (n.growth > 65 && n.equality < 45) n.equality = clamp(n.equality - d(2));
  // Low safety compounds risk to trust
  if (n.safety_score < 35) n.trust = clamp(n.trust - d(2));
  // Low innovation drags growth
  if (n.innovation < 35) n.growth = clamp(n.growth - d(1));
  // Low wellbeing erodes equality
  if (n.wellbeing < 30) n.equality = clamp(n.equality - d(1));
  // Low trust compounds everything
  if (n.trust < 25) { n.geopolitics = clamp(n.geopolitics - d(1)); n.wellbeing = clamp(n.wellbeing - d(1)); }
  return n;
}
function getGrade(m) {
  const v=Object.values(m),a=v.reduce((s,x)=>s+x,0)/v.length,mn=Math.min(...v);
  if(a>=75&&mn>=50) return {grade:"A",title:"Architect of the Intelligence Age",sub:"Superintelligence benefits everyone."};
  if(a>=62&&mn>=38) return {grade:"B",title:"Steady Navigator",sub:"Most are better off, though cracks remain."};
  if(a>=48&&mn>=25) return {grade:"C",title:"Damage Limiter",sub:"Worst prevented, opportunity missed."};
  if(a>=35) return {grade:"D",title:"Too Little, Too Late",sub:"Transition overwhelmed preparations."};
  return {grade:"F",title:"Lost Control",sub:"Chaos. Power concentrated. Safety failed."};
}
function endNarrative(m, cum, hist) {
  const p = [];
  if(m.growth>=65) p.push("The AI economy boomed. Productivity gains translated into broad-based growth.");
  else if(m.growth<35) p.push("Growth stalled. Without infrastructure and innovation investment, the AI dividend never materialised.");
  if(m.equality>=65) p.push("The Public Wealth Fund narrowed inequality for the first time in decades.");
  else if(m.equality<35) p.push("Inequality hit historic highs. AI's gains flowed to the few.");
  if(m.trust>=65) p.push("Democratic institutions adapted. Transparency and auditing kept governance legitimate.");
  else if(m.trust<35) p.push("Public trust collapsed under scandals and broken promises.");
  if(m.safety_score>=65) p.push("Safety investments created containment architecture that held when it mattered.");
  else if(m.safety_score<35) p.push("Without safety infrastructure, incidents compounded.");
  if(m.innovation>=65) p.push("Innovation flourished. Distributed labs and open access created a vibrant ecosystem.");
  else if(m.innovation<35) p.push("Innovation atrophied from overregulation or underinvestment.");
  if(m.wellbeing>=65) p.push("Workers found new pathways. Portable benefits and shorter weeks created security.");
  else if(m.wellbeing<35) p.push("Workers bore the brunt. Outdated safety nets buckled.");
  if(m.geopolitics>=65) p.push("The Global AI Accord became the Bretton Woods of the Intelligence Age.");
  else if(m.geopolitics<35) p.push("International isolation left you facing crises alone.");
  const cc = hist.filter(h=>h.isChain).length;
  if(cc>0) p.push(`${cc} event${cc>1?"s were":" was"} a direct consequence of earlier decisions.`);
  return p.length>0?p.join(" "):"A mixed record. The transition continues.";
}

// ── STYLES ──
const fonts = `@import url('https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,600;6..72,700;6..72,800&family=JetBrains+Mono:wght@400;500;600&family=Outfit:wght@400;500;600;700&display=swap');`;
const phaseCSS = `
@keyframes phaseIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
@keyframes countUp { from { opacity:0.4; } to { opacity:1; } }
.phase-enter { animation: phaseIn 0.4s ease both; }
.count-anim { animation: countUp 0.3s ease; }
`;
const T={bg:"#F8F6F1",sf:"#FFFFFF",sa:"#F2F0EB",bd:"#E2DFD8",tx:"#1A1A1A",t2:"#5C5852",tm:"#8A857C",tf:"#B5B0A7",ac:"#2563EB",gd:"#16A34A",gb:"#F0FDF4",wn:"#CA8A04",wb:"#FEFCE8",bad:"#DC2626",bb:"#FEF2F2"};
const S={
  pg:{minHeight:"100vh",background:T.bg,color:T.tx,fontFamily:"'Outfit',sans-serif"},
  in:{width:"90%",maxWidth:1400,margin:"0 auto",padding:"36px 0"},
  cd:{background:T.sf,border:`1px solid ${T.bd}`,borderRadius:14,padding:24,boxShadow:"0 1px 3px rgba(0,0,0,0.04)"},
  hl:{fontFamily:"'Newsreader',serif",fontWeight:800,lineHeight:1.15,color:T.tx},
  mn:{fontFamily:"'JetBrains Mono',monospace"},
  lb:{fontSize:13,letterSpacing:"0.22em",textTransform:"uppercase",fontFamily:"'JetBrains Mono',monospace",color:T.tm},
  bt:{border:"none",borderRadius:10,padding:"15px 32px",fontSize:16,fontWeight:600,cursor:"pointer",fontFamily:"'Outfit',sans-serif",transition:"all 0.15s"},
  sh:{fontSize:14,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",fontFamily:"'JetBrains Mono',monospace",color:T.tx,paddingBottom:8,marginBottom:12,borderBottom:`2px solid ${T.bd}`},
};
const catCol={LABOUR:"#C05621",INFRASTRUCTURE:"#CA8A04",SAFETY:"#DC2626",ECONOMY:"#16A34A",GOVERNANCE:"#0891B2",GEOPOLITICS:"#4F46E5",SCIENCE:"#C026D3",SUPERINTELLIGENCE:"#DC2626"};
const grd = (min) => ({display:"grid",gridTemplateColumns:`repeat(auto-fill,minmax(${min}px,1fr))`,gap:12});
const flexCenter = (min) => ({display:"flex",flexWrap:"wrap",justifyContent:"center",gap:12});

// ── SOUND SYSTEM (Tone.js) ──
let audioCtx = null;
function playSound(type) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    gain.gain.value = 0.08;
    if (type === "click") { osc.frequency.value = 800; gain.gain.value = 0.05; osc.type = "sine"; osc.start(); osc.stop(audioCtx.currentTime + 0.05); }
    else if (type === "synergy") { osc.frequency.value = 523; osc.type = "sine"; gain.gain.value = 0.06; osc.start(); setTimeout(() => osc.frequency.value = 659, 80); setTimeout(() => osc.frequency.value = 784, 160); osc.stop(audioCtx.currentTime + 0.3); }
    else if (type === "alert") { osc.frequency.value = 440; osc.type = "triangle"; gain.gain.value = 0.07; osc.start(); setTimeout(() => osc.frequency.value = 330, 150); osc.stop(audioCtx.currentTime + 0.3); }
    else if (type === "unlock") { osc.frequency.value = 440; osc.type = "sine"; gain.gain.value = 0.06; osc.start(); setTimeout(() => osc.frequency.value = 554, 100); setTimeout(() => osc.frequency.value = 659, 200); setTimeout(() => osc.frequency.value = 880, 300); osc.stop(audioCtx.currentTime + 0.5); }
    else if (type === "resolve") { osc.frequency.value = 300; osc.type = "triangle"; gain.gain.value = 0.05; osc.start(); osc.stop(audioCtx.currentTime + 0.15); }
    else if (type === "good") { osc.frequency.value = 523; osc.type = "sine"; gain.gain.value = 0.06; osc.start(); setTimeout(() => osc.frequency.value = 784, 120); osc.stop(audioCtx.currentTime + 0.25); }
    else if (type === "bad") { osc.frequency.value = 350; osc.type = "sawtooth"; gain.gain.value = 0.04; osc.start(); setTimeout(() => osc.frequency.value = 250, 100); osc.stop(audioCtx.currentTime + 0.2); }
    else if (type === "grade") { osc.frequency.value = 392; osc.type = "sine"; gain.gain.value = 0.07; osc.start(); setTimeout(() => osc.frequency.value = 494, 150); setTimeout(() => osc.frequency.value = 587, 300); setTimeout(() => osc.frequency.value = 784, 450); osc.stop(audioCtx.currentTime + 0.7); }
  } catch(e) { /* silent fail if audio blocked */ }
}

// ── AUTO-SAVE via persistent storage ──
const SAVE_KEY = "intelligence-age-save";
async function saveGame(state) {
  try { if (window.storage) await window.storage.set(SAVE_KEY, JSON.stringify(state)); } catch(e) {}
}
async function loadGame() {
  try {
    if (!window.storage) return null;
    const r = await window.storage.get(SAVE_KEY);
    return r ? JSON.parse(r.value) : null;
  } catch(e) { return null; }
}
async function clearSave() {
  try { if (window.storage) await window.storage.delete(SAVE_KEY); } catch(e) {}
}

// ── RUNS + ACHIEVEMENTS (localStorage) ──
const RUNS_KEY = "intelligence-age-runs";
const ACH_KEY = "intelligence-age-achievements";
const TUTORIAL_KEY = "intelligence-age-tutorial-seen";
function lsGet(key, fallback){ try { if (typeof window==="undefined") return fallback; const v=window.localStorage?.getItem(key); return v?JSON.parse(v):fallback; } catch(e){ return fallback; } }
function lsSet(key, val){ try { if (typeof window!=="undefined") window.localStorage?.setItem(key, JSON.stringify(val)); } catch(e){} }
function loadRuns(){ return lsGet(RUNS_KEY, []); }
function saveRun(run){ const all=loadRuns(); all.unshift(run); lsSet(RUNS_KEY, all.slice(0,50)); return all; }
function loadAchievements(){ return lsGet(ACH_KEY, {}); }
function unlockAchievements(ids){ const cur=loadAchievements(); const newly=[]; ids.forEach(id=>{ if(!cur[id]){ cur[id]=Date.now(); newly.push(id); }}); lsSet(ACH_KEY, cur); return newly; }

const ACHIEVEMENTS = [
  {id:"first_run",name:"First Steps",icon:"🌱",desc:"Complete your first playthrough"},
  {id:"grade_a",name:"Policy Director",icon:"🏆",desc:"Finish with an A grade"},
  {id:"grade_a_hard",name:"Steady Hand",icon:"🎖",desc:"Finish with an A on Hard difficulty"},
  {id:"grade_a_crisis",name:"Threshold Walker",icon:"⚡",desc:"Finish with an A on Crisis difficulty"},
  {id:"full_synergy",name:"All Connected",icon:"🔗",desc:"Activate every synergy in one run"},
  {id:"all_tier2",name:"Full Unlock",icon:"🔓",desc:"Unlock all 10 tier-2 policies in one run"},
  {id:"all_quests",name:"Advisor's Champion",icon:"⭐",desc:"Complete all 3 advisor quests in one run"},
  {id:"endless_5",name:"Sustained",icon:"♾",desc:"Survive 5 endless rounds past the Threshold"},
  {id:"endless_10",name:"Unbowed",icon:"🌌",desc:"Survive 10 endless rounds past the Threshold"},
  {id:"five_runs",name:"Experienced",icon:"📜",desc:"Complete 5 playthroughs"},
  {id:"all_countries",name:"World Traveler",icon:"🌍",desc:"Complete a run with every country"},
  {id:"weekly",name:"Weekly Warrior",icon:"🗓",desc:"Complete a weekly challenge run"},
];

// ── SOURCE DOCUMENTS ──
const SOURCES = [
  {label:"Industrial Policy for the Intelligence Age",org:"OpenAI · April 2026",desc:"Growth, equality, safety, and the case for keeping people first.",url:"https://openai.com/global-affairs/industrial-policy-for-the-intelligence-age/"},
  {label:"Responsible Scaling Policy v3.0",org:"Anthropic · February 2026",desc:"Graduated ASL safety levels that trigger stronger safeguards as capabilities increase.",url:"https://www.anthropic.com/news/announcing-our-updated-responsible-scaling-policy"},
  {label:"Future of Jobs Report 2025",org:"World Economic Forum",desc:"92M jobs displaced, 170M created by 2030. The skills shift behind faction dynamics.",url:"https://www.weforum.org/publications/the-future-of-jobs-report-2025/"},
  {label:"America's AI Action Plan",org:"The White House · July 2025",desc:"Infrastructure, energy, and export policy framing for the US playthrough.",url:"https://www.whitehouse.gov/wp-content/uploads/2025/07/Americas-AI-Action-Plan.pdf"},
  {label:"Critique: Industrial Policy contradictions",org:"Tech Policy Press",desc:"Independent read on tensions between the OpenAI paper and earlier SB1047 opposition.",url:"https://www.techpolicy.press/"},
];

// ── ONE-PAGER EXPORT ──
function exportOnePager(d){
  const esc = (s) => String(s??"").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const metricRows = [
    {id:"growth",label:"GDP Growth"},{id:"equality",label:"Equality"},{id:"trust",label:"Public Trust"},
    {id:"safety_score",label:"AI Safety"},{id:"innovation",label:"Innovation"},{id:"wellbeing",label:"Wellbeing"},
    {id:"geopolitics",label:"Global Standing"},
  ].map(m=>`<tr><td>${m.label}</td><td class="r">${d.metrics[m.id]}</td></tr>`).join("");
  const policyRows = Object.entries(d.cumulative).sort((a,b)=>b[1]-a[1]).filter(([,v])=>v>0).map(([k,v])=>`<tr><td>${esc(k)}</td><td class="r">${v}</td></tr>`).join("");
  const timeline = (d.history||[]).map(h=>`<li><b>${esc(h.year)} — ${esc(h.eventTitle)}</b> · ${esc(h.choiceLabel)}<div class="sm">${esc(h.narrative||"")}</div></li>`).join("");
  const title = `The Intelligence Age — ${d.cty?.label||""} · ${d.diff.label}${d.endlessMode?" · Endless":""}${d.weeklyMode?" · Weekly":""}`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)} — Policy Brief</title>
<style>
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1a1a;max-width:780px;margin:32px auto;padding:0 24px;line-height:1.5}
  h1{font-family:Georgia,serif;font-size:28px;margin:0 0 4px}
  h2{font-size:14px;letter-spacing:0.15em;text-transform:uppercase;color:#666;margin:24px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}
  .meta{color:#666;font-size:13px;margin-bottom:20px}
  .grade{display:inline-block;font-family:Georgia,serif;font-size:64px;font-weight:900;line-height:1;margin-right:20px;vertical-align:middle}
  .stats{display:inline-block;vertical-align:middle}
  .stats div{margin:2px 0;font-size:14px}
  table{width:100%;border-collapse:collapse;margin-top:6px}
  td{padding:4px 6px;border-bottom:1px solid #eee;font-size:13px}
  td.r{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
  .two{display:grid;grid-template-columns:1fr 1fr;gap:24px}
  .narr{font-size:14px;color:#333}
  ol{padding-left:20px;font-size:13px}
  ol li{margin-bottom:8px}
  .sm{color:#666;font-size:12px;margin-top:2px}
  .foot{margin-top:32px;padding-top:12px;border-top:1px solid #ddd;font-size:11px;color:#888;text-align:center}
  @media print { body { margin: 0; } }
  .btn{display:inline-block;padding:8px 16px;background:#1a1a1a;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;margin-right:8px}
  @media print { .noprint { display: none } }
</style></head><body>
<div class="noprint" style="margin-bottom:16px">
  <button class="btn" onclick="window.print()">Print / Save as PDF</button>
  <button class="btn" style="background:#fff;color:#1a1a1a;border:1px solid #ccc" onclick="window.close()">Close</button>
</div>
<h1>${esc(title)}</h1>
<div class="meta">Policy Brief · ${new Date().toLocaleDateString()}</div>
<div>
  <span class="grade">${d.collapsed?"💥":esc(d.grade.grade)}</span>
  <span class="stats">
    <div><b>${d.collapsed?"System Collapse":esc(d.grade.title)}</b></div>
    <div>Average metric: <b>${d.avg}</b> · Synergy chains: ${d.chainCount} · Quests: ${d.questsDone.length}/3 · Tier-2 unlocks: ${d.tier2Unlocked.length}</div>
    <div>${d.endlessMode?`Survived ${d.round-8} endless rounds · `:""}${esc(d.cty?.label||"")}, ${esc(d.diff.label)}</div>
  </span>
</div>
<h2>Executive Summary</h2>
<p class="narr">${esc(d.narrative)}</p>
<div class="two">
  <div><h2>Final Metrics</h2><table>${metricRows}</table></div>
  <div><h2>Lifetime Investment</h2><table>${policyRows||"<tr><td>None</td></tr>"}</table></div>
</div>
<h2>Key Decisions</h2>
<ol>${timeline}</ol>
<div class="foot">Generated by The Intelligence Age — a policy simulation based on OpenAI's "Industrial Policy for the Intelligence Age" (2026), Anthropic's RSP v3.0, WEF Future of Jobs Report 2025, and the White House AI Action Plan (2025).</div>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) { alert("Please allow popups to export the one-pager."); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

// ── COMPONENTS ──
function Ring({value,color}){const sz=36,st=2.5,r=(sz-st)/2,ci=2*Math.PI*r;return(<svg width={sz} height={sz} style={{transform:"rotate(-90deg)"}}><circle cx={sz/2} cy={sz/2} r={r} fill="none" stroke={T.bd} strokeWidth={st}/><circle cx={sz/2} cy={sz/2} r={r} fill="none" stroke={color} strokeWidth={st} strokeDasharray={ci} strokeDashoffset={ci-(value/100)*ci} strokeLinecap="round" style={{transition:"stroke-dashoffset 0.8s ease"}}/></svg>);}

// Animated number that counts from prev to current
function AnimNum({value, prev, color}) {
  const [display, setDisplay] = useState(prev ?? value);
  const ref = useRef(null);
  useEffect(() => {
    if (prev === undefined || prev === value) { setDisplay(value); return; }
    const start = prev, end = value, duration = 600;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setDisplay(Math.round(start + (end - start) * eased));
      if (p < 1) ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [value, prev]);
  return <span className="count-anim" style={{...S.mn,fontSize:15,fontWeight:600,color}}>{display}</span>;
}

// Tooltip on hover
function Tip({text, children}) {
  const [show, setShow] = useState(false);
  return (
    <span style={{position:"relative",display:"inline-block"}} onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)}>
      {children}
      {show && text && (
        <div style={{position:"absolute",bottom:"calc(100% + 6px)",left:"50%",transform:"translateX(-50%)",background:"#1A1A1A",color:"#E2DFD8",fontSize:13,lineHeight:1.5,padding:"8px 12px",borderRadius:8,whiteSpace:"normal",width:260,zIndex:50,boxShadow:"0 4px 12px rgba(0,0,0,0.2)",pointerEvents:"none"}}>
          {text}
        </div>
      )}
    </span>
  );
}

// PHASE 4: Sparkline component
function Sparkline({data, color, width=80, height=24}) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v,i) => `${(i/(data.length-1))*width},${height - ((v-min)/range)*height}`).join(" ");
  return (<svg width={width} height={height} style={{display:"inline-block",verticalAlign:"middle",marginLeft:4}}>
    <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx={(data.length-1)/(data.length-1)*width} cy={height-((data[data.length-1]-min)/range)*height} r="2" fill={color}/>
  </svg>);
}

function MetricBar({metric,value,prev,history:hist}){
  const d=value-prev,col=value>=60?T.gd:value>=40?T.wn:T.bad;
  const tips={"growth":"Measures overall economic output and productivity gains from AI adoption.","equality":"How evenly prosperity is distributed. Drops when growth benefits few.","trust":"Public confidence in institutions and AI governance. Eroded by scandals and secrecy.","safety_score":"Containment capacity for frontier AI risks including CBRN threats.","innovation":"New businesses, R&D output, scientific breakthroughs. Decays without investment.","wellbeing":"Worker quality of life — job security, benefits, work-life balance.","geopolitics":"International influence, alliance strength, and coordination capacity."};
  return(<div style={{marginBottom:12}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
      <Tip text={tips[metric.id]}><span style={{fontSize:16,color:T.t2,fontWeight:500,cursor:"help",borderBottom:`1px dotted ${T.bd}`}}>{metric.icon} {metric.label}</span></Tip>
      <span style={{display:"flex",alignItems:"center",gap:4}}>
        {hist && <Sparkline data={hist} color={col} />}
        <AnimNum value={value} prev={prev} color={d>0?T.gd:d<0?T.bad:T.tm}/>
        {d!==0&&<span style={{...S.mn,fontSize:12,color:d>0?T.gd:T.bad}}>({d>0?"+":""}{d})</span>}
      </span>
    </div>
    <div style={{height:10,background:T.sa,borderRadius:4,overflow:"hidden",border:`1px solid ${T.bd}`}}>
      <div style={{height:"100%",width:`${value}%`,background:col,borderRadius:3,transition:"width 0.8s ease"}}/>
    </div>
  </div>);
}

function Btn({children,onClick,disabled,color,style:sx}){return(<button style={{...S.bt,background:disabled?T.sa:(color||T.ac),color:disabled?T.tf:"#fff",cursor:disabled?"not-allowed":"pointer",boxShadow:disabled?"none":`0 2px 8px ${(color||T.ac)}33`,...sx}} onClick={disabled?undefined:onClick} onMouseOver={e=>!disabled&&(e.target.style.transform="translateY(-2px)")} onMouseOut={e=>e.target.style.transform=""}>{children}</button>);}
function Timeline({round}){const pct=(round/ROUNDS)*100,ls=["Narrow AI","General Agents","Expert Systems","Pre-Super","Superintelligence"];return(<div style={{...S.cd,padding:"10px 16px",marginBottom:12}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={S.lb}>AI CAPABILITY</span><span style={{...S.mn,fontSize:13,fontWeight:600,color:T.bad}}>{ls[Math.min(Math.floor(round/2),4)]}</span></div><div style={{height:8,background:T.sa,borderRadius:3,overflow:"hidden",border:`1px solid ${T.bd}`}}><div style={{height:"100%",width:`${pct}%`,borderRadius:2,background:"linear-gradient(90deg,#2563EB,#7C3AED,#DC2626)",transition:"width 1s ease"}}/></div></div>);}

// Glossary popup
function InfoButton({term}) {
  const [open,setOpen] = useState(false);
  const def = GLOSSARY[term];
  if (!def) return null;
  return (<span style={{position:"relative",display:"inline-block"}}>
    <button onClick={(e)=>{e.stopPropagation();setOpen(!open);}} style={{background:"none",border:`1px solid ${T.bd}`,borderRadius:4,padding:"0 4px",fontSize:12,color:T.ac,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",lineHeight:"16px",verticalAlign:"middle",marginLeft:3}}>?</button>
    {open && <div onClick={e=>e.stopPropagation()} style={{position:"absolute",bottom:"calc(100% + 8px)",left:"50%",transform:"translateX(-50%)",width:320,background:T.sf,border:`1px solid ${T.bd}`,borderRadius:12,padding:14,boxShadow:"0 8px 24px rgba(0,0,0,0.12)",zIndex:100,textAlign:"left"}}>
      <div style={{...S.mn,fontSize:13,fontWeight:600,color:T.ac,marginBottom:4}}>{term}</div>
      <div style={{fontSize:14,color:T.t2,lineHeight:1.6}}>{def}</div>
      <button onClick={()=>setOpen(false)} style={{...S.bt,fontSize:13,padding:"4px 10px",background:T.sa,color:T.tm,border:`1px solid ${T.bd}`,marginTop:8}}>Close</button>
    </div>}
  </span>);
}

// ══════════════ MAIN ══════════════
export default function Phase4() {
  const [phase, setPhase] = useState("intro");
  const [difficulty, setDifficulty] = useState(null);
  const [country, setCountry] = useState(null); // country selection
  const [weeklyMode, setWeeklyMode] = useState(false); // weekly challenge mode
  const [rng, setRng] = useState(null); // seeded PRNG for weekly mode
  const [round, setRound] = useState(0);
  const [metrics, setMetrics] = useState({...INIT});
  const [prevMetrics, setPrevMetrics] = useState({...INIT});
  const [preMicroMetrics, setPreMicroMetrics] = useState(null);
  const [metricHistory, setMetricHistory] = useState([{...INIT}]); // PHASE 4: sparkline data
  const [alloc, setAlloc] = useState(emptyAlloc());
  const [cumulative, setCumulative] = useState(emptyAlloc());
  const [pointsLeft, setPointsLeft] = useState(10);
  const [bonusPoints, setBonusPoints] = useState(0);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [choiceIdx, setChoiceIdx] = useState(null);
  const [result, setResult] = useState(null);
  const [microEvent, setMicroEvent] = useState(null);
  const [microChoiceIdx, setMicroChoiceIdx] = useState(null); // which micro choice player picked
  const [microResult, setMicroResult] = useState(null); // resolved micro choice {label, msg, fx}
  const [usedEvents, setUsedEvents] = useState([]);
  const [history, setHistory] = useState([]);
  const [showAdvisors, setShowAdvisors] = useState(false);
  const [showFactions, setShowFactions] = useState(false);
  const [showHist, setShowHist] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);
  const [factionSat, setFactionSat] = useState({});
  const [factionMsg, setFactionMsg] = useState([]); // PHASE 4: faction consequence messages
  const [pendingChains, setPendingChains] = useState([]);
  const [questProgress, setQuestProgress] = useState({econ:0,sec:0,ppl:0});
  const [newUnlocks, setNewUnlocks] = useState([]);
  const [endlessMode, setEndlessMode] = useState(false);
  const [collapsed, setCollapsed] = useState(false); // true when endless mode ends in collapse
  const [factionDemand, setFactionDemand] = useState(null); // {faction, policy, amount, rewardFx, rewardMsg, penaltyFx, penaltyMsg}
  const [demandResult, setDemandResult] = useState(null); // {met, msg, fx}
  const [advisorMissions, setAdvisorMissions] = useState([]); // [{advisor, policy, amount, rewardFx, desc}]
  const [missionResults, setMissionResults] = useState([]); // [{advisor, met, desc}]
  const [pastRuns, setPastRuns] = useState([]);
  const [unlockedAch, setUnlockedAch] = useState({});
  const [newAch, setNewAch] = useState([]);
  const [showRuns, setShowRuns] = useState(false);
  const [showAch, setShowAch] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [tutorialDismissed, setTutorialDismissed] = useState(true); // default true, set false on mount if not seen
  const [runRecorded, setRunRecorded] = useState(false);
  const topRef = useRef(null);
  const rngRef = useRef(null); // seeded PRNG ref for weekly mode

  // Deterministic random for weekly mode, Math.random otherwise
  const rand = () => (weeklyMode && rngRef.current) ? rngRef.current() : Math.random();

  const diff = difficulty ? DIFFICULTIES.find(d=>d.id===difficulty) : DIFFICULTIES[1];
  const cty = country ? COUNTRIES.find(c=>c.id===country) : null;
  const startMetrics = cty ? {...cty.start} : {...INIT};
  const basePts = diff.pts;
  const totalPoints = basePts + bonusPoints;
  const year = 2026 + round;

  // Apply country modifiers to an allocation for event effects
  const applyCountryMods = (al) => {
    if (!cty) return al;
    const modded = {};
    Object.entries(al).forEach(([k,v]) => { modded[k] = v * (cty.modifiers[k] || 1); });
    return modded;
  };

  useEffect(() => { topRef.current?.scrollIntoView({behavior:"smooth"}); }, [phase]);

  // Load persisted runs + achievements + tutorial flag on mount
  useEffect(() => {
    setPastRuns(loadRuns());
    setUnlockedAch(loadAchievements());
    const seen = lsGet(TUTORIAL_KEY, false);
    if (!seen) setTutorialDismissed(false);
  }, []);

  // Record run + unlock achievements when phase first becomes "end"
  useEffect(() => {
    if (phase !== "end" || runRecorded) return;
    const avg = Math.round(Object.values(metrics).reduce((a,b)=>a+b,0)/METRICS.length);
    const g = getGrade(metrics).grade;
    const run = {
      id: Date.now(),
      date: new Date().toISOString(),
      country: country, countryLabel: cty?.label, flag: cty?.flag,
      difficulty: difficulty, difficultyLabel: diff.label,
      grade: g, avg, metrics: {...metrics},
      rounds: round, endless: endlessMode, endlessRounds: endlessMode ? Math.max(0, round-ROUNDS) : 0,
      collapsed, weekly: weeklyMode,
      cumulative: {...cumulative},
      synergiesHit: [...new Set(history.flatMap(h=>h.synergies||[]))],
      tier2Count: tier2Unlocked.length,
      questsDone: ADVISORS.filter(a=>questProgress[a.id]>=3).length,
    };
    const allRuns = saveRun(run);
    setPastRuns(allRuns);

    const ids = ["first_run"];
    if (g === "A") ids.push("grade_a");
    if (g === "A" && difficulty === "hard") ids.push("grade_a_hard");
    if (g === "A" && difficulty === "crisis") ids.push("grade_a_crisis");
    const allSynHit = SYNERGIES.every(s => run.synergiesHit.includes(s.label));
    if (allSynHit) ids.push("full_synergy");
    if (tier2Unlocked.length >= POLICIES.length) ids.push("all_tier2");
    if (run.questsDone >= 3) ids.push("all_quests");
    if (endlessMode && run.endlessRounds >= 5) ids.push("endless_5");
    if (endlessMode && run.endlessRounds >= 10) ids.push("endless_10");
    if (allRuns.length >= 5) ids.push("five_runs");
    const countriesPlayed = new Set(allRuns.map(r=>r.country).filter(Boolean));
    if (COUNTRIES.every(c => countriesPlayed.has(c.id))) ids.push("all_countries");
    if (weeklyMode) ids.push("weekly");
    const newly = unlockAchievements(ids);
    setUnlockedAch(loadAchievements());
    if (newly.length > 0) setNewAch(newly);
    setRunRecorded(true);
  }, [phase]);

  const dismissTutorial = () => { setTutorialDismissed(true); lsSet(TUTORIAL_KEY, true); };

  // Auto-load saved game
  useEffect(() => {
    loadGame().then(s => {
      if (s && s.round > 0 && s.difficulty) {
        setDifficulty(s.difficulty); setRound(s.round); setMetrics(s.metrics); setCumulative(s.cumulative);
        setFactionSat(s.factionSat||{}); setQuestProgress(s.questProgress||{econ:0,sec:0,ppl:0});
        setHistory(s.history||[]); setMetricHistory(s.metricHistory||[{...INIT}]);
        setBonusPoints(s.bonusPoints||0); setPendingChains(s.pendingChains||[]); setUsedEvents(s.usedEvents||[]);
        setPrevMetrics(s.metrics); setPhase("allocate");
      }
    });
  }, []);

  const adjust = (id, delta) => {
    const nv = (alloc[id]||0) + delta;
    if (nv < 0 || nv > 6 || (delta > 0 && pointsLeft <= 0)) return;
    setAlloc(p => ({...p, [id]: nv}));
    setPointsLeft(p => p - delta);
    playSound("click");
  };
  const resetAlloc = () => { setAlloc(emptyAlloc()); setPointsLeft(totalPoints); };

  const activeSynergies = useMemo(() => getSyn(alloc), [alloc]);
  const tier2Unlocked = useMemo(() => POLICIES.filter(p => (cumulative[p.id]||0) >= p.t2.thresh).map(p => p.t2), [cumulative]);
  const factions = useMemo(() => FACTIONS.map(f => ({...f, sat: clamp(50 + f.calc(alloc), 0, 100)})), [alloc]);

  // PHASE 4: check if a conditional choice is available
  const isChoiceAvailable = (choice) => {
    if (!choice.requires) return true;
    return (cumulative[choice.requires.policy] || 0) >= choice.requires.cumMin;
  };

  // Generate faction demand for a round
  const generateDemand = (rd, mets, fSat, rFn) => {
    const demands = [
      {fid:"tech",policies:["grid","science","access"],
        templates:[
          {p:"grid",a:2,rMsg:"Tech industry co-funds data centre expansion.",pMsg:"Tech lobby blocks infrastructure permits.",rFx:{growth:3,innovation:2},pFx:{innovation:-3,growth:-2}},
          {p:"science",a:2,rMsg:"Tech firms open-source research tools.",pMsg:"Tech investment redirected overseas.",rFx:{innovation:3},pFx:{innovation:-4}},
          {p:"access",a:2,rMsg:"Tech companies subsidise AI access programs.",pMsg:"AI platforms raise enterprise pricing.",rFx:{equality:2,innovation:2},pFx:{innovation:-2,equality:-2}},
        ]},
      {fid:"labour",policies:["workers","nets","wealth"],
        templates:[
          {p:"workers",a:2,rMsg:"Unions endorse your AI governance agenda.",pMsg:"Wildcat strikes disrupt manufacturing sector.",rFx:{trust:3,wellbeing:2},pFx:{wellbeing:-4,trust:-2}},
          {p:"nets",a:2,rMsg:"Labour movement mobilises for retraining programs.",pMsg:"Workers march on the capital. Coverage dominates news cycle.",rFx:{wellbeing:3,equality:1},pFx:{wellbeing:-3,trust:-3}},
          {p:"wealth",a:2,rMsg:"Labour backs the Public Wealth Fund publicly.",pMsg:"Union leaders call for CEO accountability hearings.",rFx:{equality:2,trust:2},pFx:{trust:-3,equality:-2}},
        ]},
      {fid:"security",policies:["safety","governance","intl"],
        templates:[
          {p:"safety",a:2,rMsg:"Security agencies share classified AI threat intel.",pMsg:"Intelligence community withholds critical briefings.",rFx:{safety_score:3,trust:1},pFx:{safety_score:-3,geopolitics:-2}},
          {p:"governance",a:2,rMsg:"Security backs your auditing framework publicly.",pMsg:"Leaked memo reveals security establishment opposes your agenda.",rFx:{trust:3,safety_score:1},pFx:{trust:-3,safety_score:-2}},
          {p:"intl",a:2,rMsg:"Five Eyes allies deepen AI risk-sharing.",pMsg:"Allied intelligence cooperation stalls.",rFx:{geopolitics:3,safety_score:1},pFx:{geopolitics:-3,safety_score:-1}},
        ]},
      {fid:"civil",policies:["wealth","access","governance","nets"],
        templates:[
          {p:"governance",a:2,rMsg:"NGOs endorse transparency reforms.",pMsg:"Watchdog orgs launch damaging investigation.",rFx:{trust:3,equality:1},pFx:{trust:-4,equality:-1}},
          {p:"access",a:2,rMsg:"Community groups pilot AI literacy programs.",pMsg:"Digital rights orgs campaign against your AI agenda.",rFx:{equality:3,trust:1},pFx:{trust:-3,equality:-2}},
          {p:"nets",a:2,rMsg:"Charities amplify safety net enrollment.",pMsg:"Poverty advocacy groups condemn your budget priorities.",rFx:{wellbeing:2,equality:2},pFx:{wellbeing:-2,trust:-3}},
        ]},
    ];
    // Pick faction with lowest satisfaction (most likely to make demands)
    const sorted = [...demands].sort((a,b) => (fSat[a.fid]||50) - (fSat[b.fid]||50));
    const pick = sorted[rd % sorted.length]; // rotate but bias toward unhappy factions
    const tmpl = pick.templates[Math.floor(rFn() * pick.templates.length)];
    const fac = FACTIONS.find(f => f.id === pick.fid);
    return {faction:fac, policy:tmpl.p, amount:tmpl.a, rewardMsg:tmpl.rMsg, penaltyMsg:tmpl.pMsg, rewardFx:tmpl.rFx, penaltyFx:tmpl.pFx};
  };

  // Generate advisor missions for a round
  const generateMissions = (rd, mets, cum, rFn) => {
    return ADVISORS.map(a => {
      // Each advisor picks a mission based on weakest metric in their domain
      let policy, reason;
      if (a.id === "econ") {
        policy = mets.growth < mets.innovation ? "grid" : mets.innovation < 45 ? "science" : "access";
        reason = mets.growth < 45 ? "GDP needs support" : mets.innovation < 45 ? "Innovation pipeline is thin" : "Broaden economic participation";
      } else if (a.id === "sec") {
        policy = mets.safety_score < mets.trust ? "safety" : mets.geopolitics < 45 ? "intl" : "governance";
        reason = mets.safety_score < 45 ? "Safety gap is dangerous" : mets.geopolitics < 45 ? "Allies need reassurance" : "Audit capacity insufficient";
      } else {
        policy = mets.wellbeing < mets.equality ? "nets" : mets.equality < 45 ? "wealth" : "workers";
        reason = mets.wellbeing < 45 ? "Workers are suffering" : mets.equality < 45 ? "Inequality is widening" : "Workers need a voice";
      }
      const pol = POLICIES.find(p => p.id === policy);
      return {advisor: a, policy, policyLabel: pol?.label || policy, amount: 2, reason,
        rewardFx: {[a.quest[0] === policy ? "trust" : METRICS[Math.floor(rFn()*3)].id]: 2}};
    });
  };

  // Initialize demands/missions for first round
  useEffect(() => {
    if (phase === "allocate" && !factionDemand) {
      setFactionDemand(generateDemand(round, metrics, factionSat, rand));
      setAdvisorMissions(generateMissions(round, metrics, cumulative, rand));
    }
  }, [phase]);

  const submitAllocation = () => {
    const newCum = {...cumulative};
    POLICIES.forEach(p => { newCum[p.id] = (newCum[p.id]||0) + (alloc[p.id]||0); });
    // Detect new tier-2 unlocks this round
    const freshUnlocks = POLICIES.filter(p => {
      const wasBelowThreshold = (cumulative[p.id]||0) < p.t2.thresh;
      const nowAtOrAbove = (newCum[p.id]||0) >= p.t2.thresh;
      return wasBelowThreshold && nowAtOrAbove;
    }).map(p => ({policy: p, t2: p.t2}));
    setNewUnlocks(freshUnlocks);
    setCumulative(newCum);

    // PHASE 4: faction consequences with messages
    const nfs = {}, msgs = [];
    FACTIONS.forEach(f => {
      const newSat = clamp((factionSat[f.id]||50) + f.calc(alloc), 0, 100);
      nfs[f.id] = newSat;
      if (newSat < 30) msgs.push({faction:f.name,icon:f.icon,color:f.color,type:"penalty",msg:f.lowMsg,fx:f.lowPenalty});
      else if (newSat > 80) msgs.push({faction:f.name,icon:f.icon,color:f.color,type:"bonus",msg:f.highMsg,fx:f.highBonus});
    });
    setFactionSat(nfs);
    setFactionMsg(msgs);

    // Resolve faction demand
    let dResult = null;
    if (factionDemand) {
      const met = (alloc[factionDemand.policy] || 0) >= factionDemand.amount;
      dResult = met
        ? {met:true, msg:`${factionDemand.faction.icon} ${factionDemand.faction.name}: ${factionDemand.rewardMsg}`, fx:factionDemand.rewardFx, color:T.gd}
        : {met:false, msg:`${factionDemand.faction.icon} ${factionDemand.faction.name}: ${factionDemand.penaltyMsg}`, fx:factionDemand.penaltyFx, color:T.bad};
      // Adjust faction satisfaction based on demand outcome
      if (met) nfs[factionDemand.faction.id] = clamp((nfs[factionDemand.faction.id]||50) + 10, 0, 100);
      else nfs[factionDemand.faction.id] = clamp((nfs[factionDemand.faction.id]||50) - 12, 0, 100);
      setFactionSat(nfs);
      setDemandResult(dResult);
    }

    // Resolve advisor missions
    const mResults = advisorMissions.map(m => {
      const met = (alloc[m.policy] || 0) >= m.amount;
      return {advisor: m.advisor, met, policy: m.policyLabel, reason: m.reason, fx: met ? m.rewardFx : null};
    });
    setMissionResults(mResults);
    // Advisor quest progress: count met missions toward quest
    setQuestProgress(prev => {
      const n = {...prev};
      mResults.forEach(mr => { if (mr.met) n[mr.advisor.id] = Math.min((n[mr.advisor.id]||0) + 1, 3); });
      return n;
    });

    setPreMicroMetrics({...metrics});

    // Apply faction consequences to metrics
    let currentMetrics = {...metrics};
    msgs.forEach(m => {
      Object.entries(m.fx).forEach(([k,v]) => { currentMetrics[k] = clamp((currentMetrics[k]||50) + v); });
    });
    // Apply demand result
    if (dResult) {
      Object.entries(dResult.fx).forEach(([k,v]) => { currentMetrics[k] = clamp((currentMetrics[k]||50) + v); });
    }
    // Apply completed mission bonuses
    mResults.filter(r => r.met && r.fx).forEach(r => {
      Object.entries(r.fx).forEach(([k,v]) => { currentMetrics[k] = clamp((currentMetrics[k]||50) + v); });
    });

    // Micro event — now interactive
    if (rand() < diff.microChance && round < ROUNDS - 1) {
      const me = MICRO[Math.floor(rand() * MICRO.length)];
      setMicroEvent(me);
      setMicroChoiceIdx(null);
      setMicroResult(null);
      setMetrics(currentMetrics);
      // Pre-pick the main event now so it's ready after micro choice
      const dueChain = pendingChains.find(c => c.roundDue === round);
      let event;
      if (round === ROUNDS - 1) event = FINAL_EVENT;
      else if (dueChain) {
        event = CHAIN_EVENTS.find(e => e.chainId === dueChain.triggerId);
        if (!event) { const pool=REGULAR_EVENTS.filter((_,i)=>!usedEvents.includes(i)); event=(pool.length>0?pool:REGULAR_EVENTS)[Math.floor(rand()*(pool.length||REGULAR_EVENTS.length))]; setUsedEvents(p=>[...p,REGULAR_EVENTS.indexOf(event)]); }
        setPendingChains(prev => prev.filter(c => c !== dueChain));
      } else {
        const pool=REGULAR_EVENTS.filter((_,i)=>!usedEvents.includes(i)); const src=pool.length>0?pool:REGULAR_EVENTS;
        event=pickWeightedEvent(src, round, rand); setUsedEvents(p=>[...p,REGULAR_EVENTS.indexOf(event)]);
      }
      setCurrentEvent(event);
      setPhase("micro"); // show micro choice screen
      playSound("alert");
      return;
    }
    setMicroEvent(null); setMicroResult(null);
    setMetrics(currentMetrics);

    // Pick event (no micro this round)
    const dueChain = pendingChains.find(c => c.roundDue === round);
    let event;
    if (round === ROUNDS - 1) event = FINAL_EVENT;
    else if (dueChain) {
      event = CHAIN_EVENTS.find(e => e.chainId === dueChain.triggerId);
      if (!event) { const pool=REGULAR_EVENTS.filter((_,i)=>!usedEvents.includes(i)); event=(pool.length>0?pool:REGULAR_EVENTS)[Math.floor(rand()*(pool.length||REGULAR_EVENTS.length))]; setUsedEvents(p=>[...p,REGULAR_EVENTS.indexOf(event)]); }
      setPendingChains(prev => prev.filter(c => c !== dueChain));
    } else {
      const pool=REGULAR_EVENTS.filter((_,i)=>!usedEvents.includes(i)); const src=pool.length>0?pool:REGULAR_EVENTS;
      event=pickWeightedEvent(src, round, rand); setUsedEvents(p=>[...p,REGULAR_EVENTS.indexOf(event)]);
    }
    setCurrentEvent(event); setChoiceIdx(null); setShowHist(false); setPhase("event");
    playSound("alert");
  };

  // Resolve interactive micro-event choice, then proceed to main event
  const resolveMicro = () => {
    if (microChoiceIdx === null) return;
    const chosen = microChoiceIdx === 0 ? microEvent.a : microEvent.b;
    // Apply chosen effects to metrics
    const updated = {...metrics};
    Object.entries(chosen.fx).forEach(([k,v]) => { updated[k] = clamp((updated[k]||50) + v); });
    setMetrics(updated);
    setMicroResult({label: chosen.label, msg: chosen.msg, fx: chosen.fx});
    setChoiceIdx(null); setShowHist(false); setPhase("event");
    playSound("resolve");
  };

  const resolveEvent = () => {
    const choice = currentEvent.choices[choiceIdx];
    const effAlloc = applyCountryMods(diminish(alloc)); // diminishing returns + country modifiers
    const res = choice.fx(effAlloc, cumulative);
    const tm = getTrustMult(metrics.trust);
    const synB = {}; activeSynergies.forEach(s => Object.entries(s.bonus).forEach(([k,v]) => { synB[k]=(synB[k]||0)+v; }));
    const t2B = {}; tier2Unlocked.forEach(t => Object.entries(t.passive).forEach(([k,v]) => { t2B[k]=(t2B[k]||0)+v; }));
    const qB = {}; ADVISORS.forEach(a => { if(questProgress[a.id]>=3){qB.trust=(qB.trust||0)+2;qB.innovation=(qB.innovation||0)+1;}});

    setPrevMetrics(preMicroMetrics || {...metrics});
    const nm = {};
    METRICS.forEach(m => {
      const raw = (res[m.id]||0) + (synB[m.id]||0) + (t2B[m.id]||0) + (qB[m.id]||0);
      nm[m.id] = clamp((metrics[m.id]||50) + applyTrust(raw, tm));
    });
    const endlessBoost = endlessMode ? 0.15 * (round - ROUNDS + 1) : 0;
    const final = applyFeedback(nm, round, diff.feedbackMult + endlessBoost);
    setMetrics(final);
    setMetricHistory(prev => [...prev, {...final}]);

    if (choice.chainTrigger && round < ROUNDS - 2) {
      const cd = CHAIN_EVENTS.find(e => e.chainId === choice.chainTrigger);
      if (cd) setPendingChains(prev => [...prev, {triggerId: choice.chainTrigger, roundDue: round + (cd.chainStep||2)}]);
    }

    setResult({...res,synB,t2B,qB,tm,choiceLabel:choice.label,isChain:!!currentEvent.chainStep,isGood:res.good});
    setHistory(p => [...p, {year,eventTitle:currentEvent.title,category:currentEvent.category,choiceLabel:choice.label,narrative:res.narrative,synergies:activeSynergies.map(s=>s.label),microText:microResult?.msg,microLabel:microResult?.label,isChain:!!currentEvent.chainStep,isGood:res.good,factionMsgs:factionMsg}]);
    const avg = Object.values(final).reduce((a,b)=>a+b,0)/Object.values(final).length;
    setBonusPoints(avg>=70?2:avg>=55?1:0);
    setPhase("summary");
    // Sounds
    playSound("resolve");
    setTimeout(() => { if (res.good === true) playSound("good"); else if (res.good === false) playSound("bad"); }, 300);
    if (freshUnlocks && freshUnlocks.length > 0) setTimeout(() => playSound("unlock"), 500);
    if (activeSynergies.length > 0) setTimeout(() => playSound("synergy"), 200);
    // Auto-save
    saveGame({round,metrics:final,cumulative,factionSat:nfs||factionSat,questProgress:questProgress,history:[...history,{year,eventTitle:currentEvent.title,category:currentEvent.category,choiceLabel:choice.label,narrative:res.narrative,synergies:activeSynergies.map(s=>s.label),microText:microResult?.msg,microLabel:microResult?.label,isChain:!!currentEvent.chainStep,isGood:res.good,factionMsgs:factionMsg}],metricHistory:[...metricHistory,{...final}],difficulty,bonusPoints:avg>=70?2:avg>=55?1:0,pendingChains,usedEvents});
  };

  const nextRound = (opts={}) => {
    const forceEndless = opts.forceEndless === true;
    const isEndless = endlessMode || forceEndless;
    // Check for endless mode collapse
    if (isEndless && !forceEndless) {
      const vals = Object.values(metrics);
      const avg = vals.reduce((a,b)=>a+b,0)/vals.length;
      const min = Math.min(...vals);
      if (min <= 5 || avg < 20) {
        setCollapsed(true); setPhase("end"); playSound("bad"); clearSave(); return;
      }
    }
    if (!isEndless && round+1>=ROUNDS) { setPhase("end"); playSound("grade"); clearSave(); return; }
    const newRd = round + 1;
    // Endless mode: escalating difficulty
    const endlessPenalty = isEndless && newRd >= ROUNDS ? Math.floor((newRd - ROUNDS) / 2) : 0;
    const effectivePts = Math.max(3, basePts + bonusPoints - endlessPenalty);
    setRound(newRd); setAlloc(emptyAlloc()); setPointsLeft(effectivePts);
    setCurrentEvent(null); setResult(null); setChoiceIdx(null); setMicroEvent(null); setMicroChoiceIdx(null); setMicroResult(null); setPreMicroMetrics(null);
    setShowFactions(false); setShowHist(false); setFactionMsg([]); setNewUnlocks([]);
    setDemandResult(null); setMissionResults([]);
    setFactionDemand(generateDemand(newRd, metrics, factionSat, rand));
    setAdvisorMissions(generateMissions(newRd, metrics, cumulative, rand));
    setPhase("allocate");
  };

  const startEndless = () => {
    setEndlessMode(true); setCollapsed(false);
    nextRound({forceEndless:true});
  };

  const restart = () => {
    clearSave();
    setPhase("intro"); setRound(0); setMetrics({...INIT}); setPrevMetrics({...INIT}); setPreMicroMetrics(null);
    setMetricHistory([{...INIT}]); setAlloc(emptyAlloc()); setCumulative(emptyAlloc());
    setPointsLeft(10); setBonusPoints(0); setCurrentEvent(null); setChoiceIdx(null); setResult(null); setMicroEvent(null); setMicroChoiceIdx(null); setMicroResult(null);
    setUsedEvents([]); setHistory([]); setShowAdvisors(false); setShowFactions(false); setShowHist(false); setShowGlossary(false);
    setFactionSat({}); setFactionMsg([]); setPendingChains([]); setQuestProgress({econ:0,sec:0,ppl:0}); setDifficulty(null); setNewUnlocks([]);
    setFactionDemand(null); setDemandResult(null); setAdvisorMissions([]); setMissionResults([]);
    setEndlessMode(false); setCollapsed(false);
    setCountry(null); setWeeklyMode(false); rngRef.current = null;
    setRunRecorded(false); setNewAch([]);
  };

  const grade = getGrade(metrics);
  const upcomingChains = pendingChains.filter(c => c.roundDue > round);
  const lastRound = history.length > 0 ? history[history.length-1] : null;

  // ── INTRO with difficulty selector ──
  if (phase === "intro") return (
    <div style={S.pg}>
      <style>{fonts}{`
        @keyframes nodeIn{from{opacity:0;transform:scale(0)}to{opacity:1;transform:scale(1)}}
        @keyframes edgeIn{from{stroke-dashoffset:200;opacity:0}to{stroke-dashoffset:0;opacity:1}}
        @keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .ni{animation:nodeIn .5s ease both;transform-origin:center}
        .ei{stroke-dasharray:200;animation:edgeIn .8s ease both}
        .pu{animation:pulse 3s ease-in-out infinite}
        .fu{animation:fadeUp .6s ease both}
      `}</style>
      <div ref={topRef}/>
      <div style={{...S.in,paddingTop:32,textAlign:"center"}}>
        {/* Compact network viz */}
        <div style={{position:"relative",maxWidth:900,margin:"0 auto 4px",overflow:"hidden",borderRadius:18}}>
          <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,#F8F6F100 0%,#F8F6F1 90%)",zIndex:2,pointerEvents:"none"}}/>
          <svg viewBox="0 0 760 400" style={{width:"100%",display:"block"}}>
            <defs><pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0L0 0 0 40" fill="none" stroke="#E2DFD822" strokeWidth=".5"/></pattern></defs>
            <rect width="760" height="400" fill="url(#g)"/>
            {[[380,60,6,"Narrow AI",0],[200,110,5,,0.3],[560,100,5,,0.5],[320,160,7,"Agents",1],[500,170,4,,1.1],[180,240,5,,1.5],[400,230,8,"Expert AI",1.8],[580,250,5,,2],[300,310,6,,2.4],[500,320,5,,2.6],[380,370,10,"Super-intelligence",3.2]].map(([x,y,r,l,d],i)=>(
              <g key={i} className="ni" style={{animationDelay:`${d}s`}}>
                <circle cx={x} cy={y} r={r*2.5} fill={d>2.8?"#DC262610":"#2563EB10"} className="pu" style={{animationDelay:`${d+1}s`}}/>
                <circle cx={x} cy={y} r={r} fill={d>2.8?"#DC2626":d>1.5?"#7C3AED":"#2563EB"} opacity=".85"/>
                {l&&<text x={x} y={y-r-7} textAnchor="middle" fill={T.tm} fontSize="9" fontFamily="'JetBrains Mono',monospace" fontWeight="500">{l}</text>}
              </g>
            ))}
            {[[0,1],[0,2],[1,3],[2,4],[3,5],[3,6],[4,7],[5,8],[6,8],[6,9],[7,9],[8,10],[9,10]].map(([a,b],i)=>{
              const ns=[[380,60],[200,110],[560,100],[320,160],[500,170],[180,240],[400,230],[580,250],[300,310],[500,320],[380,370]];
              return <line key={i} className="ei" x1={ns[a][0]} y1={ns[a][1]} x2={ns[b][0]} y2={ns[b][1]} stroke={i>9?"#DC262644":"#2563EB33"} strokeWidth={i>9?1.5:1} style={{animationDelay:`${i*0.25+0.5}s`}}/>;
            })}
          </svg>
        </div>

        <div className="fu" style={{animationDelay:"0.2s"}}>
          <div style={{...S.lb,color:T.ac,marginBottom:8,letterSpacing:"0.35em",fontSize:13}}>POLICY SIMULATION</div>
        </div>
        <h1 className="fu" style={{...S.hl,fontSize:56,marginBottom:12,animationDelay:"0.3s"}}>The Intelligence Age</h1>
        <p className="fu" style={{fontSize:17,color:T.t2,maxWidth:700,margin:"0 auto 28px",lineHeight:1.75,animationDelay:"0.4s"}}>
          Steer a nation through 8 years of the AI transition. Your choices cascade — triggering crises, shaping factions, and determining whether superintelligence benefits everyone or concentrates power.
        </p>

        {/* PHASE 4: Difficulty selector */}
        <div className="fu" style={{animationDelay:"0.5s",maxWidth:900,margin:"0 auto 28px"}}>
          <div style={{...S.lb,marginBottom:8,color:T.ac}}>SELECT DIFFICULTY</div>
          <div style={flexCenter(130)}>
            {DIFFICULTIES.map(d => (
              <button key={d.id} onClick={() => setDifficulty(d.id)} style={{
                ...S.cd, padding:14, cursor:"pointer", textAlign:"center", width:180, flex:"0 1 180px",
                borderColor: difficulty===d.id ? T.ac : T.bd,
                background: difficulty===d.id ? T.ac+"08" : T.sf,
                boxShadow: difficulty===d.id ? `0 0 0 2px ${T.ac}22` : S.cd.boxShadow,
                transition:"all 0.2s",
              }}>
                <div style={{fontSize:16,fontWeight:700,color:difficulty===d.id?T.ac:T.tx,marginBottom:2}}>{d.label}</div>
                <div style={{...S.mn,fontSize:20,fontWeight:700,color:difficulty===d.id?T.ac:T.tm}}>{d.pts}</div>
                <div style={{fontSize:12,color:T.tm}}>pts/round</div>
                <div style={{fontSize:13,color:T.t2,marginTop:4,lineHeight:1.4}}>{d.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* COUNTRY SELECTOR */}
        <div className="fu" style={{animationDelay:"0.55s",maxWidth:960,margin:"0 auto 24px"}}>
          <div style={{...S.lb,marginBottom:8,color:T.ac}}>SELECT COUNTRY</div>
          <div style={flexCenter(110)}>
            {COUNTRIES.map(c => (
              <button key={c.id} onClick={() => setCountry(c.id)} style={{
                ...S.cd, padding:10, cursor:"pointer", textAlign:"center", width:160, flex:"0 1 160px",
                borderColor: country===c.id ? T.ac : T.bd,
                background: country===c.id ? T.ac+"08" : T.sf,
                boxShadow: country===c.id ? `0 0 0 2px ${T.ac}22` : S.cd.boxShadow,
                transition:"all 0.2s",
              }}>
                <div style={{fontSize:32}}>{c.flag}</div>
                <div style={{fontSize:13,fontWeight:700,color:country===c.id?T.ac:T.tx,marginTop:2}}>{c.label}</div>
                <div style={{fontSize:12,color:T.tm,lineHeight:1.3,marginTop:3}}>{c.desc.split(".")[0]}.</div>
              </button>
            ))}
          </div>
          {cty && (
            <div style={{...S.cd,marginTop:16,padding:"20px 24px",textAlign:"left",background:T.sa}}>
              <div style={{fontSize:15,color:T.t2,fontStyle:"italic",marginBottom:20,lineHeight:1.5}}>{cty.flavour}</div>

              <div style={{...S.sh,color:T.tm,marginBottom:10}}>Starting Metrics</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:8,marginBottom:20}}>
                {METRICS.map(m => {
                  const v = cty.start[m.id];
                  const col = v>=55?T.gd:v>=40?T.wn:T.bad;
                  const bg = v>=55?"rgba(34,197,94,0.12)":v>=40?"rgba(234,179,8,0.12)":"rgba(239,68,68,0.12)";
                  return (
                    <div key={m.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,padding:"8px 12px",background:bg,border:`1px solid ${col}33`,borderRadius:8}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
                        <span style={{fontSize:16}}>{m.icon}</span>
                        <span style={{fontSize:13,color:T.tx,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{m.label}</span>
                      </div>
                      <span style={{...S.mn,fontSize:15,fontWeight:700,color:col}}>{v}</span>
                    </div>
                  );
                })}
              </div>

              {POLICIES.filter(p=>(cty.modifiers[p.id]||1)!==1).length > 0 && (
                <>
                  <div style={{...S.sh,color:T.tm,marginBottom:10}}>National Policy Modifiers</div>
                  <div style={{fontSize:12,color:T.tm,marginBottom:10,fontStyle:"italic"}}>How much each point you invest in a policy returns — strengths and weaknesses specific to this country.</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8}}>
                    {POLICIES.filter(p=>(cty.modifiers[p.id]||1)!==1).map(p=>{
                      const mod=cty.modifiers[p.id]||1;
                      const pct=Math.round((mod-1)*100);
                      const col=mod>1?T.gd:T.bad;
                      const bg=mod>1?"rgba(34,197,94,0.12)":"rgba(239,68,68,0.12)";
                      return (
                        <div key={p.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,padding:"8px 12px",background:bg,border:`1px solid ${col}33`,borderRadius:8}}>
                          <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
                            <span style={{fontSize:16}}>{p.icon}</span>
                            <span style={{fontSize:13,color:T.tx,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.label}</span>
                          </div>
                          <span style={{...S.mn,fontSize:14,fontWeight:700,color:col,whiteSpace:"nowrap"}}>{pct>0?"+":""}{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* WEEKLY CHALLENGE TOGGLE */}
        <div className="fu" style={{animationDelay:"0.6s",marginBottom:20}}>
          <button onClick={() => setWeeklyMode(!weeklyMode)} style={{
            ...S.bt, background: weeklyMode ? "#7C3AED" : T.sa, color: weeklyMode ? "#fff" : T.t2,
            border: `1px solid ${weeklyMode ? "#7C3AED" : T.bd}`, padding: "8px 20px", fontSize: 12,
          }}>
            {weeklyMode ? `📅 Weekly Challenge: ${getWeekLabel(getWeeklySeed())} ✓` : "📅 Enable Weekly Challenge"}
          </button>
          {weeklyMode && <div style={{...S.mn,fontSize:13,color:"#7C3AED",marginTop:4}}>Same events for everyone this week. Compare strategies.</div>}
        </div>

        {/* Feature pills */}
        <div className="fu" style={{display:"flex",flexWrap:"wrap",justifyContent:"center",gap:6,maxWidth:900,margin:"0 auto 28px",animationDelay:"0.7s"}}>
          {[{i:"🔗",l:"Event Chains"},{i:"📜",l:"History Cards"},{i:"🔓",l:"Policy Trees"},{i:"⚒",l:"Factions"},{i:"🎯",l:"Quests"},{i:"📈",l:"Sparklines"},{i:"🔒",l:"Locked Choices"}].map(f=>(
            <div key={f.l} style={{background:T.sf,border:`1px solid ${T.bd}`,borderRadius:8,padding:"4px 12px",fontSize:13,fontWeight:600,color:T.tx,display:"flex",alignItems:"center",gap:4}}>
              <span>{f.i}</span>{f.l}
            </div>
          ))}
        </div>

        <div className="fu" style={{animationDelay:"0.9s"}}>
          <Btn disabled={!difficulty||!country} onClick={() => {
            const sm = cty ? {...cty.start} : {...INIT};
            setMetrics(sm); setPrevMetrics(sm); setMetricHistory([sm]);
            setAlloc(emptyAlloc()); setPointsLeft(diff.pts);
            if (weeklyMode) { rngRef.current = mulberry32(getWeeklySeed()); }
            setPhase("allocate");
          }} style={{padding:"16px 40px",fontSize:16}}>
            {(!difficulty||!country) ? "Select difficulty & country" : `${cty?.flag} Begin ${year} (${diff.label}) →`}
          </Btn>
        </div>

        {/* Optional tutorial */}
        {!tutorialDismissed && (
          <div className="fu" style={{...S.cd,maxWidth:820,margin:"8px auto 20px",textAlign:"left",borderColor:T.ac,background:`${T.ac}0A`,animationDelay:"0.95s"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:8}}>
              <div style={{...S.sh,color:T.ac}}>How to play (skippable)</div>
              <button onClick={dismissTutorial} style={{background:"transparent",border:`1px solid ${T.bd}`,borderRadius:6,padding:"4px 10px",fontSize:12,color:T.tm,cursor:"pointer"}}>Skip — I'll learn as I go</button>
            </div>
            <ol style={{margin:0,paddingLeft:20,fontSize:14,color:T.t2,lineHeight:1.7}}>
              <li><b>Pick a country and difficulty.</b> Each country has different starting metrics and policy strengths.</li>
              <li><b>Allocate points across 10 policies</b> each round. Watch for synergies (green borders) and tier-2 unlocks.</li>
              <li><b>Handle events, micro-decisions, faction demands, and advisor missions</b> — they all shape the metrics.</li>
              <li><b>Survive 8 rounds</b> and earn a grade — or continue into endless mode if you're up for it.</li>
            </ol>
          </div>
        )}

        {/* Action row: Glossary / Sources / Best Runs / Achievements */}
        <div className="fu" style={{animationDelay:"1s",marginTop:16,display:"flex",flexWrap:"wrap",justifyContent:"center",gap:8}}>
          <button onClick={() => setShowGlossary(!showGlossary)} style={{...S.bt,background:"transparent",color:T.tm,fontSize:12,border:`1px solid ${T.bd}`,padding:"6px 16px"}}>📖 {showGlossary ? "Hide" : "Show"} Glossary ({Object.keys(GLOSSARY).length})</button>
          <button onClick={() => setShowSources(!showSources)} style={{...S.bt,background:"transparent",color:T.tm,fontSize:12,border:`1px solid ${T.bd}`,padding:"6px 16px"}}>📚 {showSources ? "Hide" : "Show"} Sources ({SOURCES.length})</button>
          <button onClick={() => setShowRuns(!showRuns)} style={{...S.bt,background:"transparent",color:T.tm,fontSize:12,border:`1px solid ${T.bd}`,padding:"6px 16px"}}>🏅 Best Runs ({pastRuns.length})</button>
          <button onClick={() => setShowAch(!showAch)} style={{...S.bt,background:"transparent",color:T.tm,fontSize:12,border:`1px solid ${T.bd}`,padding:"6px 16px"}}>🏆 Achievements ({Object.keys(unlockedAch).length}/{ACHIEVEMENTS.length})</button>
        </div>

        {showGlossary && (
          <div style={{...S.cd,textAlign:"left",maxWidth:900,margin:"12px auto 0",maxHeight:400,overflowY:"auto"}}>
            {Object.entries(GLOSSARY).map(([term,def]) => (
              <div key={term} style={{marginBottom:12,paddingBottom:12,borderBottom:`1px solid ${T.bd}`}}>
                <div style={{...S.mn,fontSize:12,fontWeight:600,color:T.ac,marginBottom:2}}>{term}</div>
                <div style={{fontSize:12,color:T.t2,lineHeight:1.6}}>{def}</div>
              </div>
            ))}
          </div>
        )}

        {showSources && (
          <div style={{...S.cd,textAlign:"left",maxWidth:900,margin:"12px auto 0"}}>
            <div style={{...S.sh,color:T.tm,marginBottom:10}}>Research Sources</div>
            <div style={{display:"grid",gap:10}}>
              {SOURCES.map(s => (
                <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" style={{textDecoration:"none",color:"inherit",padding:"10px 12px",background:T.sa,border:`1px solid ${T.bd}`,borderRadius:8,display:"block"}}>
                  <div style={{display:"flex",justifyContent:"space-between",gap:10,marginBottom:3,flexWrap:"wrap"}}>
                    <span style={{fontSize:14,fontWeight:700,color:T.ac}}>{s.label} ↗</span>
                    <span style={{...S.mn,fontSize:12,color:T.tm}}>{s.org}</span>
                  </div>
                  <div style={{fontSize:13,color:T.t2,lineHeight:1.5}}>{s.desc}</div>
                </a>
              ))}
            </div>
          </div>
        )}

        {showRuns && (
          <div style={{...S.cd,textAlign:"left",maxWidth:900,margin:"12px auto 0",maxHeight:420,overflowY:"auto"}}>
            <div style={{...S.sh,color:T.tm,marginBottom:10}}>Your Best Runs {pastRuns.length>0 && <span style={{fontSize:12,color:T.tm,fontWeight:400,textTransform:"none",letterSpacing:0}}>· sorted by avg</span>}</div>
            {pastRuns.length===0 ? <div style={{fontSize:13,color:T.tm,fontStyle:"italic"}}>No runs yet — play one to see it here.</div> : (
              <div style={{display:"grid",gap:6}}>
                {[...pastRuns].sort((a,b)=>b.avg-a.avg).slice(0,10).map(r => {
                  const gc = r.grade==="A"?T.gd:r.grade==="B"?T.ac:r.grade==="C"?T.wn:T.bad;
                  return (
                    <div key={r.id} style={{display:"grid",gridTemplateColumns:"40px 1fr auto",alignItems:"center",gap:10,padding:"8px 12px",background:T.sa,border:`1px solid ${T.bd}`,borderRadius:8}}>
                      <div style={{fontFamily:"'Newsreader',serif",fontSize:24,fontWeight:900,color:gc,textAlign:"center"}}>{r.collapsed?"💥":r.grade}</div>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:T.tx}}>{r.flag} {r.countryLabel} · {r.difficultyLabel}{r.endless?` · endless +${r.endlessRounds}`:""}{r.weekly?" · weekly":""}</div>
                        <div style={{...S.mn,fontSize:12,color:T.tm}}>{new Date(r.date).toLocaleDateString()} · avg {r.avg} · {r.synergiesHit.length} synergies · {r.tier2Count} unlocks</div>
                      </div>
                      <div style={{...S.mn,fontSize:14,fontWeight:700,color:gc}}>{r.avg}</div>
                    </div>
                  );
                })}
              </div>
            )}
            {pastRuns.length>0 && <button onClick={()=>{if(confirm("Clear all run history?")){lsSet(RUNS_KEY,[]);setPastRuns([]);}}} style={{...S.bt,marginTop:10,background:"transparent",color:T.bad,border:`1px solid ${T.bad}33`,padding:"4px 12px",fontSize:12}}>Clear history</button>}
          </div>
        )}

        {showAch && (
          <div style={{...S.cd,textAlign:"left",maxWidth:900,margin:"12px auto 0"}}>
            <div style={{...S.sh,color:T.tm,marginBottom:10}}>Achievements · {Object.keys(unlockedAch).length}/{ACHIEVEMENTS.length}</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:8}}>
              {ACHIEVEMENTS.map(a => {
                const got = !!unlockedAch[a.id];
                return (
                  <div key={a.id} style={{padding:"10px 12px",background:got?`${T.gd}0F`:T.sa,border:`1px solid ${got?T.gd+"55":T.bd}`,borderRadius:8,opacity:got?1:0.55}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                      <span style={{fontSize:20,filter:got?"none":"grayscale(1)"}}>{a.icon}</span>
                      <span style={{fontSize:13,fontWeight:700,color:got?T.gd:T.tx}}>{a.name}</span>
                    </div>
                    <div style={{fontSize:12,color:T.t2,lineHeight:1.4}}>{a.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="fu" style={{animationDelay:"1.1s",marginTop:12}}>
          <span style={{...S.mn,fontSize:13,color:T.tf}}>Based on OpenAI · Anthropic RSP · WEF · White House AI Action Plan</span>
        </div>
      </div>
    </div>
  );

  // ── ALLOCATE ──
  if (phase === "allocate") return (
    <div style={S.pg}><style>{fonts}{phaseCSS}</style><div ref={topRef}/><div className="phase-enter" style={S.in}>
      {/* HEADER */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
        <div>
          <div style={{...S.lb,marginBottom:4}}>{cty?.flag||""} YEAR {year} — {endlessMode?`ENDLESS ROUND ${round-ROUNDS+1}`:` ROUND ${round+1}/${ROUNDS}`} · {diff.label.toUpperCase()}{weeklyMode?" · WEEKLY":""}</div>
          <h2 style={{...S.hl,fontSize:32,margin:0}}>Allocate Resources</h2>
          {endlessMode&&<div style={{fontSize:13,color:T.bad,marginTop:2}}>⚠ Endless mode — collapse when any metric hits 0 or avg drops below 20</div>}
          {cty&&<div style={{fontSize:13,color:T.tm,marginTop:2}}>{cty.flavour}</div>}
        </div>
        <div style={{textAlign:"center",background:pointsLeft===0?T.gb:T.sf,border:`2px solid ${pointsLeft===0?"#BBF7D0":T.bd}`,borderRadius:14,padding:"10px 20px",minWidth:80}}>
          <div style={{...S.mn,fontSize:32,fontWeight:700,color:pointsLeft===0?T.gd:T.tx}}>{pointsLeft}</div>
          <div style={{...S.lb,fontSize:11}}>{bonusPoints>0?`${basePts}+${bonusPoints}`:"PTS LEFT"}</div>
        </div>
      </div>
      <Timeline round={round}/>

      {/* ALERTS ROW — side by side */}
      <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:14}}>
        {lastRound && (<div style={{...S.cd,padding:"10px 14px",flex:"1 1 200px",borderColor:lastRound.isGood?"#BBF7D0":lastRound.isGood===false?"#FECACA":T.bd,background:lastRound.isGood?T.gb:lastRound.isGood===false?T.bb:T.sa}}>
          <div style={{...S.lb,fontSize:12,marginBottom:3}}>📋 LAST YEAR: {lastRound.eventTitle}</div>
          <div style={{fontSize:13,color:T.t2,lineHeight:1.5}}>{lastRound.narrative}</div>
        </div>)}
        {factionMsg.length > 0 && (<div style={{...S.cd,padding:"10px 14px",flex:"1 1 200px",borderColor:factionMsg[0].type==="bonus"?"#BBF7D0":"#FECACA",background:factionMsg[0].type==="bonus"?T.gb:T.bb}}>
          <div style={{...S.lb,fontSize:12,marginBottom:4}}>{factionMsg[0].type==="bonus"?"✓":"⚠"} FACTION CONSEQUENCES</div>
          {factionMsg.map((m,i) => <div key={i} style={{fontSize:13,color:T.t2,marginBottom:2}}>{m.icon} <strong style={{color:m.color}}>{m.faction}:</strong> {m.msg}</div>)}
        </div>)}
        {upcomingChains.length>0&&(<div style={{...S.cd,padding:"10px 14px",flex:"1 1 200px",borderColor:"#FDE68A",background:T.wb}}>
          <div style={{...S.lb,fontSize:12,color:T.wn}}>⏳ {upcomingChains.length} consequence{upcomingChains.length>1?"s":""} approaching</div>
        </div>)}
      </div>

      {/* TWO-COLUMN LAYOUT */}
      <div style={{display:"flex",gap:20,alignItems:"flex-start"}}>

        {/* LEFT COLUMN — Budget & Policies */}
        <div style={{flex:"1 1 58%",minWidth:0}}>
          {/* Faction Demand — important, goes at top */}
          {factionDemand && (
            <div style={{...S.cd,padding:"14px 16px",marginBottom:14,borderColor:factionDemand.faction.color+"55",background:factionDemand.faction.color+"08"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <div style={{...S.lb,fontSize:12,color:factionDemand.faction.color}}>{factionDemand.faction.icon} FACTION DEMAND</div>
                <span style={{...S.mn,fontSize:13,color:T.tm}}>{factionDemand.faction.name}</span>
              </div>
              <div style={{fontSize:14,color:T.tx,fontWeight:600,marginBottom:4}}>
                Invest {factionDemand.amount}+ in {POLICIES.find(p=>p.id===factionDemand.policy)?.icon} {POLICIES.find(p=>p.id===factionDemand.policy)?.label} this round
              </div>
              <div style={{display:"flex",gap:12,fontSize:13}}>
                <span style={{color:T.gd}}>✓ {factionDemand.rewardMsg.split(".")[0]}</span>
                <span style={{color:T.bad}}>✗ {factionDemand.penaltyMsg.split(".")[0]}</span>
              </div>
            </div>
          )}

          {/* Advisor Missions */}
          {advisorMissions.length > 0 && (
            <div style={{...S.cd,padding:"12px 16px",marginBottom:14,borderColor:"#C7D2FE",background:"#EFF4FF"}}>
              <div style={{...S.lb,fontSize:12,color:T.ac,marginBottom:8}}>🎯 ADVISOR MISSIONS THIS ROUND</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
                {advisorMissions.map(m => {
                  const met = (alloc[m.policy]||0) >= m.amount;
                  return (
                    <div key={m.advisor.id} style={{flex:"1 1 180px",background:met?T.gb:T.sf,border:`1px solid ${met?"#BBF7D0":T.bd}`,borderRadius:10,padding:"10px 12px"}}>
                      <div style={{fontSize:13,fontWeight:600,color:m.advisor.color}}>{m.advisor.avatar} {m.advisor.name}</div>
                      <div style={{fontSize:13,color:T.tx,marginTop:2}}>{POLICIES.find(p=>p.id===m.policy)?.icon} {m.policyLabel} ≥ {m.amount}</div>
                      <div style={{fontSize:12,color:T.tm,marginTop:1,fontStyle:"italic"}}>{m.reason}</div>
                      <div style={{...S.mn,fontSize:13,marginTop:3,color:met?T.gd:T.tm}}>{met?"✓ Met":"○ Not met"}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* POLICIES SECTION */}
          <div style={S.sh}>💰 Allocate Your Budget</div>
          <div style={grd(220)}>
            {POLICIES.map(p => {
              const v=alloc[p.id]||0,cv=cumulative[p.id]||0,t2Done=cv>=p.t2.thresh;
              const policySynergies = activeSynergies.filter(s => s.ids.includes(p.id));
              const inSynergy = policySynergies.length > 0;
              return (<div key={p.id} style={{...S.cd,padding:14,borderColor:inSynergy?"#BBF7D0":v>0?p.color+"44":T.bd,background:v>0?p.color+"06":T.sf,marginBottom:0,borderLeft:inSynergy?`3px solid ${T.gd}`:""}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <Tip text={p.t2.info}><span style={{fontSize:14,fontWeight:600,cursor:"help"}}>{p.icon} {p.label}</span></Tip>
                  <span style={{...S.mn,fontSize:18,fontWeight:700,color:v>0?p.color:T.tf}}>{v}</span>
                </div>
                <div style={{fontSize:13,color:T.tm,marginBottom:6,lineHeight:1.4}}>{p.desc}</div>
                <div style={{display:"flex",gap:6,marginBottom:6}}>
                  <button onClick={()=>adjust(p.id,-1)} style={{...S.bt,flex:1,padding:"6px 0",background:T.sa,color:T.t2,fontSize:16,border:`1px solid ${T.bd}`}}>−</button>
                  <button onClick={()=>adjust(p.id,1)} style={{...S.bt,flex:1,padding:"6px 0",background:p.color+"10",color:p.color,fontSize:16,border:`1px solid ${p.color}33`}}>+</button>
                </div>
                <div style={{display:"flex",gap:4,justifyContent:"center",marginBottom:3}}>{[0,1,2,3,4,5].map(i=><div key={i} style={{width:8,height:8,borderRadius:"50%",background:i<v?p.color:T.bd}}/>)}</div>
                <div style={{...S.mn,fontSize:12,color:t2Done?T.gd:T.tf,textAlign:"center"}}>{t2Done?`🔓 ${p.t2.name}`:`${cv}/${p.t2.thresh} → ${p.t2.name}`}</div>
                {inSynergy && <div style={{...S.mn,fontSize:12,color:T.gd,textAlign:"center",marginTop:2}}>⚡ {policySynergies.map(s=>s.label).join(", ")}</div>}
              </div>);
            })}
          </div>
          {activeSynergies.length>0&&(<div style={{...S.cd,padding:"10px 14px",marginTop:12,borderColor:"#BBF7D0",background:T.gb}}>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{activeSynergies.map(s=><span key={s.label} style={{...S.mn,fontSize:12,background:"#DCFCE7",border:"1px solid #BBF7D0",borderRadius:6,padding:"3px 8px",color:"#15803D"}}>⚡ {s.label}</span>)}</div>
          </div>)}
          <div style={{textAlign:"center",marginTop:16}}>
            <Btn onClick={submitAllocation} disabled={pointsLeft>0}>Commit & Face {year} →</Btn>
            {pointsLeft>0&&<div style={{...S.mn,fontSize:13,color:T.tf,marginTop:6}}>Allocate all {pointsLeft} points</div>}
            {pointsLeft<totalPoints&&<button onClick={resetAlloc} style={{...S.bt,background:"transparent",color:T.tm,fontSize:13,marginTop:8,padding:"8px 18px",border:`1px solid ${T.bd}`}}>↺ Reset</button>}
          </div>
        </div>

        {/* RIGHT COLUMN — Nation Dashboard (sticky sidebar) */}
        <div style={{flex:"0 0 38%",position:"sticky",top:16,maxHeight:"calc(100vh - 32px)",overflowY:"auto",display:"flex",flexDirection:"column",gap:12}}>

          {/* NATIONAL METRICS */}
          <div style={{...S.cd,padding:"16px 18px"}}>
            <div style={S.sh}>📊 National Metrics</div>
            {METRICS.map(m => {
              const v = metrics[m.id], hist = metricHistory.map(h => h[m.id]);
              const prev = metricHistory.length > 1 ? metricHistory[metricHistory.length-2][m.id] : v;
              const d = v - prev;
              const col = v >= 60 ? T.gd : v >= 40 ? T.wn : T.bad;
              const chartW = 80, chartH = 28;
              const mn = Math.min(...hist), mx = Math.max(...hist), rng = mx - mn || 1;
              const pts = hist.map((val,i) => `${(i/(Math.max(hist.length-1,1)))*chartW},${chartH - ((val-mn)/rng)*chartH}`).join(" ");
              const fillPts = pts + ` ${chartW},${chartH} 0,${chartH}`;
              return (
                <div key={m.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,paddingBottom:10,borderBottom:`1px solid ${T.bd}`}}>
                  <Tip text={{"growth":"Overall economic output and AI productivity gains.","equality":"How evenly prosperity is distributed.","trust":"Public confidence in institutions and AI governance.","safety_score":"Containment capacity for frontier AI risks.","innovation":"R&D output, new businesses, breakthroughs. Decays without investment.","wellbeing":"Worker quality of life — security, benefits, balance.","geopolitics":"International influence and coordination capacity."}[m.id]}>
                    <div style={{width:100,flexShrink:0}}>
                      <div style={{fontSize:14,fontWeight:600,color:T.tx,cursor:"help",borderBottom:`1px dotted ${T.bd}`}}>{m.icon} {m.label}</div>
                    </div>
                  </Tip>
                  <div style={{flex:1}}>
                    <div style={{height:10,background:T.sa,borderRadius:4,overflow:"hidden",border:`1px solid ${T.bd}`}}>
                      <div style={{height:"100%",width:`${v}%`,background:col,borderRadius:2,transition:"width 0.6s ease"}}/>
                    </div>
                  </div>
                  {hist.length >= 2 && (
                    <svg width={chartW} height={chartH} style={{flexShrink:0}}>
                      <polygon points={fillPts} fill={col} opacity="0.1"/>
                      <polyline points={pts} fill="none" stroke={col} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx={chartW} cy={chartH - ((hist[hist.length-1]-mn)/rng)*chartH} r="2.5" fill={col}/>
                    </svg>
                  )}
                  <div style={{width:52,textAlign:"right",flexShrink:0}}>
                    <div style={{...S.mn,fontSize:16,fontWeight:700,color:col}}>{v}</div>
                    {d !== 0 && <div style={{...S.mn,fontSize:12,color:d>0?T.gd:T.bad}}>{d>0?"+":""}{d}</div>}
                  </div>
                </div>
              );
            })}
            {tier2Unlocked.length>0&&(<div style={{marginTop:6,padding:"8px 10px",borderRadius:8,background:T.gb,border:"1px solid #BBF7D0"}}>
              <div style={{...S.lb,fontSize:11,color:T.gd,marginBottom:3}}>🔓 TIER-2 ACTIVE</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:4}}>{tier2Unlocked.map(t=><span key={t.name} style={{...S.mn,fontSize:12,background:"#DCFCE7",border:"1px solid #BBF7D0",borderRadius:6,padding:"2px 6px",color:"#15803D"}}>{t.name}<InfoButton term={t.name}/></span>)}</div>
            </div>)}
          </div>

          {/* FACTIONS */}
          <div style={{...S.cd,padding:"14px 16px"}}>
            <div style={S.sh}>⚔ Factions</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {factions.map(f => {
                const s = factionSat[f.id]||50;
                const label = s<30?"Hostile":s>=60?"Supportive":s>=40?"Neutral":"Opposed";
                const sc = s>=60?T.gd:s>=40?T.wn:T.bad;
                return (
                  <div key={f.id} style={{flex:"1 1 70px",background:T.sf,border:`1px solid ${sc}33`,borderRadius:10,padding:"8px 6px",textAlign:"center"}}>
                    <div style={{fontSize:20}}>{f.icon}</div>
                    <div style={{fontSize:12,fontWeight:700,color:f.color,marginBottom:2}}>{f.name}</div>
                    <div style={{height:5,background:T.sa,borderRadius:3,overflow:"hidden",marginBottom:2}}>
                      <div style={{height:"100%",width:`${s}%`,background:sc,borderRadius:2,transition:"width 0.5s"}}/>
                    </div>
                    <div style={{...S.mn,fontSize:12,fontWeight:600,color:sc}}>{Math.round(s)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ADVISORS */}
          <div style={{...S.cd,padding:"14px 16px"}}>
            <div style={S.sh}>🧠 Advisors</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {ADVISORS.map(a => {
                const qp = questProgress[a.id]||0;
                const mission = advisorMissions.find(m => m.advisor.id === a.id);
                const missionMet = mission ? (alloc[mission.policy]||0) >= mission.amount : false;
                return (
                  <div key={a.id} style={{background:T.sa,border:`1px solid ${a.color}22`,borderRadius:10,padding:10}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                      <span style={{fontSize:18}}>{a.avatar}</span>
                      <div>
                        <div style={{fontSize:13,fontWeight:700,color:a.color}}>{a.name}</div>
                        <div style={{...S.lb,fontSize:10}}>{a.philosophy}</div>
                      </div>
                    </div>
                    <div style={{fontSize:13,color:T.t2,lineHeight:1.4,marginBottom:5}}>{a.getAdvice(round,metrics,cumulative)}</div>
                    {mission && (
                      <div style={{background:missionMet?T.gb:T.sf,border:`1px solid ${missionMet?"#BBF7D0":T.bd}`,borderRadius:6,padding:"5px 7px",marginBottom:4}}>
                        <div style={{fontSize:13,fontWeight:600,color:missionMet?T.gd:T.tx}}>
                          {missionMet?"✓":"○"} {POLICIES.find(p=>p.id===mission.policy)?.icon} {mission.policyLabel} ≥ {mission.amount}
                        </div>
                        <div style={{fontSize:12,color:T.tm,fontStyle:"italic"}}>{mission.reason}</div>
                      </div>
                    )}
                    <div style={{display:"flex",alignItems:"center",gap:4}}>
                      <div style={{...S.mn,fontSize:12,color:qp>=3?T.gd:T.tm}}>Quest: {a.questLabel}</div>
                      <div style={{display:"flex",gap:2}}>{[0,1,2].map(i=>(<div key={i} style={{width:16,height:5,borderRadius:2,background:i<qp?a.color:T.bd}}/>))}</div>
                      {qp>=3&&<span style={{fontSize:12,color:T.gd}}>✓</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Glossary toggle */}
          <div style={{textAlign:"center"}}>
            <button onClick={()=>setShowGlossary(!showGlossary)} style={{...S.bt,background:T.sa,color:T.t2,border:`1px solid ${T.bd}`,padding:"8px 18px",fontSize:13}}>📖 {showGlossary?"Hide":"Show"} Glossary</button>
          </div>
          {showGlossary&&(<div style={{...S.cd,maxHeight:200,overflowY:"auto",padding:14}}>{Object.entries(GLOSSARY).slice(0,6).map(([k,v])=>(<div key={k} style={{marginBottom:8}}><span style={{...S.mn,fontSize:13,fontWeight:600,color:T.ac}}>{k}</span><span style={{fontSize:13,color:T.t2,marginLeft:6}}>{v.slice(0,80)}…</span></div>))}<div style={{fontSize:13,color:T.tm}}>Full glossary available on intro screen</div></div>)}
        </div>

      </div>
    </div></div>
  );

  // ── MICRO-EVENT CHOICE ──
  if (phase === "micro" && microEvent) {
    return (<div style={S.pg}><style>{fonts}{phaseCSS}</style><div ref={topRef}/><div className="phase-enter" style={{...S.in,paddingTop:32}}>
      <Timeline round={round}/>
      <div style={{...S.cd,padding:0,marginBottom:16,overflow:"hidden"}}>
        <div style={{background:T.wn,padding:"8px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{...S.mn,fontSize:12,color:"#fff",letterSpacing:"0.2em",textTransform:"uppercase"}}>INTERIM CRISIS</span>
          <span style={{...S.mn,fontSize:12,color:"rgba(255,255,255,0.7)"}}>{year} · Before main event</span>
        </div>
        <div style={{padding:"24px 20px 16px",textAlign:"center"}}>
          <div style={{fontSize:28,marginBottom:8}}>⚡</div>
          <h2 style={{...S.hl,fontSize:22,marginBottom:8}}>Quick Decision Required</h2>
          <p style={{fontSize:14,color:T.t2,maxWidth:700,margin:"0 auto",lineHeight:1.7}}>{microEvent.text}</p>
        </div>
      </div>
      <div style={{...S.lb,fontSize:12,marginBottom:8,textAlign:"center"}}>HOW DO YOU RESPOND?</div>
      <div style={grd(240)}>
        {[microEvent.a, microEvent.b].map((opt, i) => (
          <button key={i} onClick={() => setMicroChoiceIdx(i)} style={{
            ...S.cd, padding:16, cursor:"pointer", textAlign:"left",
            borderColor: microChoiceIdx === i ? T.wn : T.bd,
            background: microChoiceIdx === i ? T.wb : T.sf,
            boxShadow: microChoiceIdx === i ? `0 0 0 2px ${T.wn}33` : S.cd.boxShadow,
            transition: "all 0.2s", marginBottom: 0,
          }}>
            <div style={{fontSize:22,marginBottom:6}}>{opt.icon}</div>
            <div style={{fontSize:14,fontWeight:700,color:T.tx,marginBottom:4}}>{opt.label}</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
              {Object.entries(opt.fx).map(([k,v]) => (
                <span key={k} style={{...S.mn,fontSize:13,color:v>0?T.gd:T.bad}}>
                  {v>0?"+":""}{v} {METRICS.find(m=>m.id===k)?.label?.slice(0,6)||k}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
      <div style={{textAlign:"center",marginTop:16}}>
        <Btn onClick={resolveMicro} disabled={microChoiceIdx===null} color={T.wn}>Decide & Continue →</Btn>
      </div>
    </div></div>);
  }

  // ── EVENT with conditional choices ──
  if (phase === "event") {
    const evCol = catCol[currentEvent.category]||T.ac;
    const isChain = !!currentEvent.chainStep;
    return (<div style={S.pg}><style>{fonts}{phaseCSS}</style><div ref={topRef}/><div className="phase-enter" style={{...S.in,paddingTop:32}}>
      <Timeline round={round}/>
      {/* Show resolved micro result if there was one */}
      {microResult&&(<div style={{...S.cd,padding:"10px 14px",marginBottom:12,borderColor:"#FDE68A",background:T.wb}}>
        <div style={{...S.lb,fontSize:13,color:T.wn,marginBottom:3}}>⚡ INTERIM DECISION: {microResult.label}</div>
        <div style={{fontSize:12,color:T.t2}}>{microResult.msg}</div>
        <div style={{display:"flex",gap:6,marginTop:4}}>{Object.entries(microResult.fx).map(([k,v])=>(<span key={k} style={{...S.mn,fontSize:13,color:v>0?T.gd:T.bad}}>{v>0?"+":""}{v} {METRICS.find(m=>m.id===k)?.label?.slice(0,6)||k}</span>))}</div>
      </div>)}
      {/* Tier-2 unlock alert on event screen */}
      {newUnlocks.length > 0 && (
        <div style={{...S.cd,padding:"10px 14px",marginBottom:12,borderColor:"#A78BFA",background:"#F5F3FF"}}>
          <div style={{...S.lb,fontSize:13,color:"#7C3AED",marginBottom:3}}>🔓 TIER-2 UNLOCKED THIS ROUND</div>
          {newUnlocks.map(u => (
            <div key={u.t2.name} style={{fontSize:12,color:T.t2,marginBottom:2}}>
              {u.policy.icon} <strong style={{color:"#7C3AED"}}>{u.t2.name}</strong> — {Object.entries(u.t2.passive).map(([k,v])=>`+${v} ${METRICS.find(m=>m.id===k)?.label||k}`).join(", ")} per round
            </div>
          ))}
        </div>
      )}
      {/* Demand + mission results on event screen */}
      {demandResult && (
        <div style={{...S.cd,padding:"8px 14px",marginBottom:10,borderColor:demandResult.met?"#BBF7D0":"#FECACA",background:demandResult.met?T.gb:T.bb}}>
          <div style={{fontSize:13,color:demandResult.met?T.gd:T.bad}}>{demandResult.met?"✓":"✗"} {demandResult.msg}</div>
        </div>
      )}
      {missionResults.length > 0 && missionResults.some(r=>r.met) && (
        <div style={{...S.cd,padding:"8px 14px",marginBottom:10,borderColor:"#C7D2FE",background:"#EFF4FF"}}>
          <div style={{fontSize:13,color:T.ac}}>🎯 Missions: {missionResults.filter(r=>r.met).map(r=>`${r.advisor.avatar} ✓`).join(" ")} {missionResults.filter(r=>!r.met).map(r=>`${r.advisor.avatar} ✗`).join(" ")}</div>
        </div>
      )}
      <div style={{...S.cd,padding:0,marginBottom:16,overflow:"hidden"}}>
        <div style={{background:evCol,padding:"8px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{...S.mn,fontSize:12,color:"#fff",letterSpacing:"0.2em",textTransform:"uppercase"}}>{currentEvent.category}</span>
          <span style={{...S.mn,fontSize:12,color:"rgba(255,255,255,0.7)"}}>{cty?.flag||""} {year} · {diff.label}{weeklyMode?" · Weekly":""}</span>
        </div>
        {isChain&&(<div style={{background:"#FEF3C7",padding:"6px 16px",borderBottom:`1px solid ${T.bd}`}}>
          <span style={{...S.mn,fontSize:13,color:"#92400E"}}>🔗 CHAIN EVENT — consequence of an earlier decision</span>
        </div>)}
        <div style={{padding:"24px 20px 16px",textAlign:"center"}}>
          <h2 style={{...S.hl,fontSize:30,marginBottom:6}}>{currentEvent.title}</h2>
          <p style={{fontSize:14,color:T.t2,maxWidth:700,margin:"0 auto",fontStyle:"italic"}}>{currentEvent.subtitle}</p>
        </div>
        <div style={{borderTop:`1px solid ${T.bd}`,padding:"12px 20px",background:T.sa}}>
          <button onClick={()=>setShowHist(!showHist)} style={{...S.bt,padding:0,background:"transparent",color:T.tm,fontSize:13}}>
            📜 {showHist?"Hide":"Show"} Historical Parallel: {currentEvent.hist?.title}
          </button>
          {showHist&&currentEvent.hist&&(<div style={{marginTop:8}}><div style={{...S.mn,fontSize:12,color:evCol,marginBottom:3}}>{currentEvent.hist.era}</div><div style={{fontSize:12,color:T.t2,lineHeight:1.6}}>{currentEvent.hist.text}</div></div>)}
        </div>
      </div>
      <div style={{...S.cd,padding:"8px 12px",marginBottom:14}}>
        <div style={{...S.lb,fontSize:13,marginBottom:5}}>YOUR BUDGET</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
          {POLICIES.filter(p=>(alloc[p.id]||0)>0).map(p=><span key={p.id} style={{...S.mn,fontSize:13,background:p.color+"10",border:`1px solid ${p.color}33`,borderRadius:6,padding:"2px 7px",color:p.color}}>{p.icon}{p.short}:{alloc[p.id]}</span>)}
        </div>
      </div>
      <div style={{...S.lb,fontSize:12,marginBottom:8,textAlign:"center"}}>CHOOSE YOUR RESPONSE</div>
      <div style={grd(240)}>
        {currentEvent.choices.map((c,i) => {
          const available = isChoiceAvailable(c);
          const isSelected = choiceIdx === i;
          return (<button key={i} onClick={() => available && setChoiceIdx(i)} style={{
            ...S.cd,padding:18,cursor:available?"pointer":"not-allowed",textAlign:"left",
            borderColor:isSelected?evCol:!available?"#FECACA":T.bd,
            background:isSelected?evCol+"08":!available?"#FEF2F210":T.sf,
            opacity:available?1:0.7,boxShadow:isSelected?`0 0 0 2px ${evCol}22`:S.cd.boxShadow,
            transition:"all 0.2s",marginBottom:0,
          }}>
            <div style={{fontSize:24,marginBottom:6}}>{c.icon}</div>
            <div style={{fontSize:14,fontWeight:700,color:available?T.tx:T.tm,marginBottom:3}}>{c.label}</div>
            <div style={{fontSize:12,color:T.t2,lineHeight:1.5}}>{c.desc}</div>
            {/* PHASE 4: locked choice explanation */}
            {!available && c.requires && (
              <div style={{...S.mn,fontSize:13,color:T.bad,marginTop:8,padding:"6px 8px",background:T.bb,borderRadius:6,border:"1px solid #FECACA"}}>
                🔒 {c.requires.lockedMsg}
                <InfoButton term={c.requires.policy==="safety"?"ASL-4":c.requires.policy==="governance"?"CAISI":""}/>
              </div>
            )}
            {c.chainTrigger&&available&&<div style={{...S.mn,fontSize:12,color:T.wn,marginTop:6}}>⏳ This choice will have consequences</div>}
          </button>);
        })}
      </div>
      <div style={{textAlign:"center",marginTop:16}}><Btn onClick={resolveEvent} disabled={choiceIdx===null||!isChoiceAvailable(currentEvent.choices[choiceIdx])} color={evCol}>Resolve →</Btn></div>
    </div></div>);
  }

  // ── SUMMARY ──
  if (phase === "summary") {
    const isGood = result.isGood;
    return (<div style={S.pg}><style>{fonts}{phaseCSS}</style><div ref={topRef}/><div className="phase-enter" style={S.in}>
      <div style={{...S.lb,marginBottom:4}}>{cty?.flag||""} YEAR {year} OUTCOME · {diff.label.toUpperCase()}{weeklyMode?" · WEEKLY":""}</div>
      <h2 style={{...S.hl,fontSize:28,marginBottom:4}}>{currentEvent.title}</h2>
      <div style={{fontSize:13,color:T.tm,marginBottom:14}}>
        Chose: <strong style={{color:T.tx}}>{result.choiceLabel}</strong>
        {result.tm!==1&&<span style={{...S.mn,fontSize:13,marginLeft:8,color:result.tm>1?T.gd:T.bad}}>Trust ×{result.tm.toFixed(2)}</span>}
        {result.isChain&&<span style={{...S.mn,fontSize:13,marginLeft:8,color:T.wn}}>🔗 Chain</span>}
      </div>
      <div style={{...S.cd,marginBottom:14,borderColor:isGood?"#BBF7D0":isGood===false?"#FECACA":T.bd,background:isGood?T.gb:isGood===false?T.bb:T.sf}}>
        <p style={{fontSize:15,lineHeight:1.75,margin:0,color:T.t2}}>{result.narrative}</p>
      </div>
      {/* Effects row — side by side */}
      <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:14}}>
        {factionMsg.length>0&&(<div style={{...S.cd,padding:"10px 14px",flex:"1 1 200px"}}>
          <div style={S.sh}>⚔ Faction Effects</div>
          {factionMsg.map((m,i)=><div key={i} style={{fontSize:13,color:m.type==="bonus"?T.gd:T.bad,marginBottom:3}}>{m.icon} {m.msg} ({Object.entries(m.fx).map(([k,v])=>`${v>0?"+":""}${v} ${k}`).join(", ")})</div>)}
        </div>)}
        {demandResult && (
          <div style={{...S.cd,padding:"10px 14px",flex:"1 1 200px",borderColor:demandResult.met?"#BBF7D0":"#FECACA",background:demandResult.met?T.gb:T.bb}}>
            <div style={S.sh}>{demandResult.met?"✓ Demand Met":"✗ Demand Ignored"}</div>
            <div style={{fontSize:13,color:T.t2}}>{demandResult.msg}</div>
            <div style={{...S.mn,fontSize:13,color:demandResult.color,marginTop:4}}>{Object.entries(demandResult.fx).map(([k,v])=>`${v>0?"+":""}${v} ${METRICS.find(m=>m.id===k)?.label||k}`).join(", ")}</div>
          </div>
        )}
        {missionResults.length > 0 && (
          <div style={{...S.cd,padding:"10px 14px",flex:"1 1 200px",borderColor:"#C7D2FE",background:"#EFF4FF"}}>
            <div style={S.sh}>🎯 Mission Results</div>
            {missionResults.map(mr => (
              <div key={mr.advisor.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                <span style={{fontSize:16}}>{mr.advisor.avatar}</span>
                <span style={{fontSize:13,fontWeight:600,color:mr.advisor.color}}>{mr.advisor.name}</span>
                <span style={{...S.mn,fontSize:13,fontWeight:600,color:mr.met?T.gd:T.bad}}>{mr.met?"✓ Complete":"✗ Failed"}</span>
                {mr.met && <span style={{...S.mn,fontSize:12,color:T.gd}}>→ Quest {questProgress[mr.advisor.id]||0}/3</span>}
              </div>
            ))}
            {missionResults.filter(r=>r.met).length === 3 && (
              <div style={{...S.mn,fontSize:13,color:"#7C3AED",marginTop:4,fontWeight:600}}>🌟 All 3 missions complete!</div>
            )}
          </div>
        )}
      </div>
      {/* NEW TIER-2 UNLOCK NOTIFICATION */}
      {newUnlocks.length > 0 && (
        <div style={{...S.cd,padding:"16px 16px",marginBottom:12,borderColor:"#A78BFA",background:"linear-gradient(135deg, #F5F3FF, #EDE9FE)",border:"2px solid #A78BFA",borderRadius:16}}>
          <div style={{textAlign:"center",marginBottom:10}}>
            <div style={{fontSize:28,marginBottom:4}}>🔓</div>
            <div style={{...S.lb,fontSize:13,color:"#7C3AED",letterSpacing:"0.3em"}}>TIER-2 UNLOCKED</div>
          </div>
          {newUnlocks.map(u => (
            <div key={u.t2.name} style={{background:"#FFFFFF",borderRadius:12,padding:14,marginBottom:newUnlocks.length>1?8:0,border:`1px solid #DDD6FE`}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <span style={{fontSize:20}}>{u.policy.icon}</span>
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:"#7C3AED"}}>{u.t2.name}</div>
                  <div style={{...S.mn,fontSize:13,color:T.tm}}>{u.policy.label} · Lifetime investment: {cumulative[u.policy.id]||0}</div>
                </div>
              </div>
              <div style={{fontSize:13,color:T.t2,lineHeight:1.6,marginBottom:8}}>{u.t2.info}</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                <span style={{...S.mn,fontSize:13,fontWeight:600,color:"#7C3AED"}}>Passive bonus every round:</span>
                {Object.entries(u.t2.passive).map(([k,v]) => (
                  <span key={k} style={{...S.mn,fontSize:13,background:"#EDE9FE",borderRadius:6,padding:"2px 8px",color:"#6D28D9"}}>+{v} {METRICS.find(m=>m.id===k)?.label||k}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Two-column: Metrics + Bonuses side by side */}
      <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:14}}>
        <div style={{...S.cd,flex:"1 1 55%",minWidth:280}}>
          <div style={S.sh}>📊 Updated Metrics</div>
          {METRICS.map(m=><MetricBar key={m.id} metric={m} value={metrics[m.id]} prev={prevMetrics[m.id]} history={metricHistory.map(h=>h[m.id])}/>)}
        </div>
        <div style={{flex:"1 1 35%",minWidth:200,display:"flex",flexDirection:"column",gap:10}}>
          {(activeSynergies.length>0||tier2Unlocked.length>0)&&(<div style={{...S.cd,padding:"10px 14px",borderColor:"#BBF7D0",background:T.gb}}>
            <div style={S.sh}>⚡ Active Bonuses</div>
            {activeSynergies.map(s=><div key={s.label} style={{...S.mn,fontSize:13,color:"#15803D",marginBottom:3}}>⚡ {s.label}: {Object.entries(s.bonus).map(([k,v])=>`+${v} ${k}`).join(", ")}</div>)}
            {tier2Unlocked.map(t=><div key={t.name} style={{...S.mn,fontSize:13,color:"#15803D",marginBottom:3}}>🔓 {t.name}</div>)}
            {ADVISORS.filter(a=>questProgress[a.id]>=3).map(a=><div key={a.id} style={{...S.mn,fontSize:13,color:"#15803D"}}>🎯 {a.questLabel}: +2 trust, +1 innovation</div>)}
          </div>)}
          {bonusPoints>0&&(<div style={{...S.cd,padding:"12px 14px",borderColor:"#C7D2FE",background:"#EFF4FF",textAlign:"center"}}>
            <span style={{fontSize:14,color:T.ac,fontWeight:600}}>📈 +{bonusPoints} bonus points next year</span>
          </div>)}
        </div>
      </div>
      <div style={{textAlign:"center"}}><Btn onClick={nextRound}>{endlessMode?`Survive ${year+1} →`:round+1>=ROUNDS?"Final Assessment →":`Proceed to ${year+1} →`}</Btn></div>
    </div></div>);
  }

  // ── END with shareable card ──
  if (phase === "end") {
    const avg = Math.round(Object.values(metrics).reduce((a,b)=>a+b,0)/METRICS.length);
    const gc = grade.grade==="A"?T.gd:grade.grade==="B"?T.ac:grade.grade==="C"?T.wn:T.bad;
    const sorted = [...POLICIES].sort((a,b)=>(cumulative[b.id]||0)-(cumulative[a.id]||0));
    const narrative = endNarrative(metrics, cumulative, history);
    const chainCount = history.filter(h=>h.isChain).length;
    const questsDone = ADVISORS.filter(a=>questProgress[a.id]>=3);

    return (<div style={S.pg}><style>{fonts}{phaseCSS}</style><div ref={topRef}/><div className="phase-enter" style={{...S.in,paddingTop:40,textAlign:"center"}}>

      {/* PHASE 4: Shareable end card */}
      {collapsed && (
        <div style={{...S.cd,padding:"16px 20px",marginBottom:16,borderColor:T.bad,background:T.bb,textAlign:"center"}}>
          <div style={{fontSize:32,marginBottom:6}}>💥</div>
          <div style={{...S.hl,fontSize:22,color:T.bad,marginBottom:4}}>System Collapse — Year {year}</div>
          <div style={{fontSize:13,color:T.t2}}>You survived {round - ROUNDS} rounds past the Threshold before systems buckled. The Intelligence Age demanded more than humanity could sustain.</div>
        </div>
      )}
      <div style={{background:`linear-gradient(135deg, ${gc}08, ${gc}15)`,border:`2px solid ${gc}33`,borderRadius:20,padding:"28px 24px 20px",marginBottom:20,maxWidth:700,marginLeft:"auto",marginRight:"auto"}}>
        <div style={{...S.lb,color:gc,marginBottom:6,letterSpacing:"0.35em"}}>{cty?.flag||""} THE INTELLIGENCE AGE · {cty?.label?.toUpperCase()||""} · {diff.label.toUpperCase()}{endlessMode?" · ENDLESS":""}{weeklyMode?" · WEEKLY":""}</div>
        <div style={{fontFamily:"'Newsreader',serif",fontSize:80,fontWeight:900,color:gc,lineHeight:1}}>{collapsed?(round-ROUNDS):grade.grade}</div>
        <h2 style={{...S.hl,fontSize:24,marginBottom:4}}>{collapsed?`Survived ${round-ROUNDS} Rounds`:grade.title}</h2>
        <p style={{fontSize:13,color:T.t2,marginBottom:12}}>{collapsed?"Systems could not sustain the pressure.":grade.sub}</p>
        <div style={{display:"grid",gridTemplateColumns:endlessMode?"repeat(5,1fr)":"repeat(4,1fr)",gap:6}}>
          <div><div style={{...S.mn,fontSize:18,fontWeight:700,color:gc}}>{avg}</div><div style={{fontSize:13,color:T.tm}}>AVG</div></div>
          {endlessMode&&<div><div style={{...S.mn,fontSize:18,fontWeight:700,color:T.bad}}>{round-ROUNDS}</div><div style={{fontSize:13,color:T.tm}}>SURVIVED</div></div>}
          <div><div style={{...S.mn,fontSize:18,fontWeight:700,color:T.wn}}>{chainCount}</div><div style={{fontSize:13,color:T.tm}}>CHAINS</div></div>
          <div><div style={{...S.mn,fontSize:18,fontWeight:700,color:T.gd}}>{questsDone.length}/3</div><div style={{fontSize:13,color:T.tm}}>QUESTS</div></div>
          <div><div style={{...S.mn,fontSize:18,fontWeight:700,color:T.ac}}>{tier2Unlocked.length}</div><div style={{fontSize:13,color:T.tm}}>UNLOCKS</div></div>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",justifyContent:"center",gap:4,marginTop:10}}>
          {sorted.slice(0,5).map(p=><span key={p.id} style={{...S.mn,fontSize:12,color:p.color}}>{p.icon}{cumulative[p.id]||0}</span>)}
        </div>
      </div>

      {/* Narrative */}
      <div style={{...S.cd,marginBottom:14,textAlign:"left"}}>
        <div style={{...S.lb,fontSize:13,marginBottom:6}}>YOUR STORY</div>
        <p style={{fontSize:13,color:T.t2,lineHeight:1.75,margin:0}}>{narrative}</p>
      </div>

      {/* Final metrics with sparklines */}
      <div style={{...S.cd,marginBottom:14,textAlign:"left"}}>
        <div style={{...S.lb,fontSize:13,marginBottom:8}}>FINAL METRICS</div>
        {METRICS.map(m=><MetricBar key={m.id} metric={m} value={metrics[m.id]} prev={metrics[m.id]} history={metricHistory.map(h=>h[m.id])}/>)}
      </div>

      <div style={{...S.cd,marginBottom:14,textAlign:"left"}}>
        <div style={{...S.lb,fontSize:13,marginBottom:6}}>LIFETIME INVESTMENT</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:5}}>{sorted.map(p=>{const t2=(cumulative[p.id]||0)>=p.t2.thresh;return(<span key={p.id} style={{...S.mn,fontSize:13,background:p.color+"10",border:`1px solid ${p.color}33`,borderRadius:6,padding:"2px 8px",color:p.color}}>{t2?"🔓 ":""}{p.icon} {p.label}: {cumulative[p.id]||0}</span>);})}</div>
      </div>

      <div style={{...S.cd,marginBottom:14,textAlign:"left"}}>
        <div style={{...S.lb,fontSize:13,marginBottom:6}}>FACTIONS</div>
        <div style={grd(80)}>{FACTIONS.map(f=>{const s=factionSat[f.id]||50;return(<div key={f.id} style={{textAlign:"center"}}><div style={{fontSize:18}}>{f.icon}</div><div style={{fontSize:13,fontWeight:700,color:f.color}}>{f.name}</div><div style={{...S.mn,fontSize:12,color:s>=60?T.gd:s>=40?T.wn:T.bad,fontWeight:600}}>{Math.round(s)}</div></div>);})}</div>
      </div>

      <div style={{...S.cd,marginBottom:16,textAlign:"left",maxHeight:280,overflowY:"auto"}}>
        <div style={{...S.lb,fontSize:13,marginBottom:8}}>TIMELINE</div>
        {history.map((h,i)=>(<div key={i} style={{marginBottom:12,paddingBottom:12,borderBottom:i<history.length-1?`1px solid ${T.bd}`:"none"}}>
          <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:4}}>
            <span style={{...S.mn,fontSize:13,fontWeight:600,color:catCol[h.category]||T.ac}}>{h.year} — {h.eventTitle}</span>
            <span style={{...S.mn,fontSize:12,color:T.tm}}>{h.choiceLabel}</span>
          </div>
          {h.isChain&&<div style={{...S.mn,fontSize:12,color:T.wn,marginTop:1}}>🔗 Chain event</div>}
          {h.microText&&<div style={{fontSize:13,color:T.wn,marginTop:1}}>⚡ {h.microLabel ? `${h.microLabel}: ` : ""}{h.microText}</div>}
          <div style={{fontSize:12,color:T.t2,lineHeight:1.5,marginTop:2}}>{h.narrative}</div>
          {h.factionMsgs?.length>0&&h.factionMsgs.map((m,j)=><div key={j} style={{...S.mn,fontSize:12,color:m.type==="bonus"?T.gd:T.bad,marginTop:1}}>{m.icon} {m.msg}</div>)}
          {h.synergies?.length>0&&<div style={{...S.mn,fontSize:12,color:T.gd,marginTop:1}}>⚡ {h.synergies.join(", ")}</div>}
        </div>))}
      </div>

      {/* Achievement toast */}
      {newAch.length > 0 && (
        <div style={{...S.cd,maxWidth:700,margin:"0 auto 16px",borderColor:T.gd,background:`${T.gd}10`,textAlign:"left"}}>
          <div style={{...S.sh,color:T.gd,marginBottom:8}}>🏆 Achievement{newAch.length>1?"s":""} Unlocked</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:6}}>
            {newAch.map(id => { const a=ACHIEVEMENTS.find(x=>x.id===id); if(!a) return null; return (
              <div key={id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:T.sf,border:`1px solid ${T.gd}33`,borderRadius:6}}>
                <span style={{fontSize:18}}>{a.icon}</span>
                <div><div style={{fontSize:13,fontWeight:700,color:T.gd}}>{a.name}</div><div style={{fontSize:12,color:T.t2}}>{a.desc}</div></div>
              </div>); })}
          </div>
        </div>
      )}

      <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
        {!endlessMode && !collapsed && (
          <Btn onClick={startEndless} color="#7C3AED" style={{padding:"14px 28px"}}>
            ♾ Continue to Endless Mode
          </Btn>
        )}
        <Btn onClick={()=>exportOnePager({metrics,cumulative,history,cty,diff,endlessMode,weeklyMode,collapsed,round,grade,questsDone,tier2Unlocked,chainCount,avg,narrative})} color={T.ac}>📄 Export One-Pager</Btn>
        <Btn onClick={restart} color={gc}>Play Again →</Btn>
      </div>
      {!endlessMode && !collapsed && (
        <div style={{...S.mn,fontSize:13,color:T.tm,marginTop:8,maxWidth:600,marginLeft:"auto",marginRight:"auto"}}>
          Endless mode continues past the Threshold with escalating difficulty. Points decrease, feedback intensifies. Game ends when any metric hits 0 or average drops below 20. How long can you sustain the Intelligence Age?
        </div>
      )}
      <div style={{...S.mn,marginTop:14,fontSize:13,color:T.tf}}>Based on OpenAI · Anthropic RSP · WEF · White House AI Action Plan</div>
    </div></div>);
  }
  return null;
}
