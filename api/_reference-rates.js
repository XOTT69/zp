// Independently transcribed from the visible calculator on 2026-09-05.
// Source: https://salary.diakirov.com/, displayed version 2.4.3, September 2026.
// The project owner selected these observations as the primary rate source.
// No independent audit against employer payout tables has been performed.
export function makeReferenceCalculators(existing) {
  const scheduleMonthHours = existing.supervisor.scheduleMonthHours;
  const common = (name, salary, ratings, tenureBase, options = {}) => ({
    title: `ЗП ${name}`, shortTitle: name, source: 'Звірено з калькулятором колеги 05.09.2026',
    taxMode: 'gross', taxRate: .23, reference: true, taxiInputMode: 'net',
    scheduleOptions: [{value:'2/2',label:'2/2'},{value:'5/2',label:'5/2'}],
    defaultWorkSchedule: '2/2', scheduleMonthHours, ratingBonusByZone: ratings,
    tenureBase, ratingFirstPartRate: 0, paymentScheduleMode: 'unverified',
    levelBonusByLevelAndZone: matrix(3620,7240),
    defaultInputs: {...existing.supervisor.defaultInputs, year:2026, month:'Вересень', actualHours:165,
      ratingZone:3, level:'level1', testsHigh:false, salary, tenureYears:0,
      nightHours:0, doubleHours:0, fines:0, taxiAmount:0, firstHalfHours:82.5, secondHalfHours:82.5},
    ...options
  });
  const five = values => Object.fromEntries(values.map((v,i)=>[i+1,v]));
  return {
    supervisor: common('СВ',46560,five([19160,16730,14330,11880,9440]),63190,{wowCaseRate:400}),
    service: common('оператора сервісу',16230,five([29950,26350,22720,19110,15500]),38950,{stages:probation(five([22250,19240,16230,13210,10210]))}),
    level4: common('4 лвл / Ментори',22240,{1:34760,2:31160,3:27540},53410,{
      maxRatingZone:3, ratingZones:[1,2,3],levelBonusByLevelAndZone: {
        level1:{default:0},level2:{1:3620,2:3620,3:0},level3:{1:7240,2:3620,3:0}
      }
    }),
    xd: common('ХД',17730,five([32070,28430,24850,21230,17620]),42570,{hasTests:false,hasNight:false,hasDouble:false}),
    iron: common('IRON',22240,five([35570,33370,31160,28800,26740]),53410,{hasTests:false,levelBonusByLevelAndZone:matrix(2400,4800)}),
    sz: common('СЗ',36470,{1:24300,3:21860,4:19460,5:16990},58330,{
      ratingZones:[1,3,4,5],scheduleOptions:[{value:'2/2',label:'2/2'}]
    }),
    psz: common('пСЗ',33370,{1:20030},53410,{
      ratingZones:[1],zoneLabels:{1:'Фіксована'},scheduleOptions:[{value:'2/2',label:'2/2'}],
      levelBonusByLevelAndZone:{level1:{default:0},level2:{1:3620},level3:{1:7240}},
      defaultInputs:{...existing.supervisor.defaultInputs,year:2026,month:'Вересень',salary:33370,actualHours:165,testsHigh:false,ratingZone:1,level:'level1',tenureYears:0}
    }),
    msb: common('МСБ',16230,five([35860,34110,32360,30610,28860]),48590,{stages:probation(five([32900,30220,27540,24860,22180]))}),
    meo: common('МЕО',17730,{1:31660,2:29950,3:28230,4:26530,5:24840},45970,{
      hasTests:false,hasDouble:false,stages:probation(five([23430,21990,20570,19150,17730])),
      ratingZones:[1,2,3,4,5],zoneLabels:{1:'Салатова',2:'Зелена',3:'Жовта',4:'Помаранчева',5:'Червона'},zoneTones:{1:'lime',2:'green',3:'yellow',4:'orange',5:'red'}
    }),
    fm: common('ФМ',17730,{1:31660,2:29950,3:28230,4:26530,5:24840},45970,{
      hasTests:false,hasDouble:false,stages:probation(five([23430,21990,20570,19150,17730])),
      ratingZones:[1,2,3,4,5],zoneLabels:{1:'Салатова',2:'Зелена',3:'Жовта',4:'Помаранчева',5:'Червона'},zoneTones:{1:'lime',2:'green',3:'yellow',4:'orange',5:'red'}
    }),
    concierge: common('Консьєрж',22240,five([35570,33370,31160,28800,26740]),53410,{levelBonusByLevelAndZone:matrix(2400,4800),stages:probation(five([25870,24090,22250,20420,18580]))}),
    soft: common('Софт',14210,five([23530,21130,19920,17490,16300]),34130,{
      hasNight:false,functionalBonusByLevel:{level1:0,level2:1210,level3:3620},
      stages:{before3:{ratingBonusByZone:five([17230,15230,14210,12200,11210]),noQualification:true,noTenure:true},after3:{}}
    })
  };
}

function matrix(second,third) {
  return {level1:{default:0},level2:{1:second,2:second,3:second,4:0,5:0},level3:{1:third,2:third,3:second,4:0,5:0}};
}

function probation(ratingBonusByZone) { return {before3:{ratingBonusByZone,noQualification:true,noTenure:true},after3:{}}; }
