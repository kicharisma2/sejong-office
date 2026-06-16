/**
 * 정부청사 사무실 안내 시스템 - Main Application Logic
 */

// ============================================================
// 0. 비밀번호 인증
// ============================================================
const CORRECT_PASSWORD = 'dododo';
let passwordUnlocked = false;  // 세션 동안 한 번 인증하면 유지
let passwordCallback = null;   // 인증 성공 후 실행할 함수

// ============================================================
// 1. 데이터 관리 (IndexedDB + LocalStorage)
// ============================================================

const DB_KEY = 'gov_directory_db';
const SETTINGS_KEY = 'gov_directory_settings';

// 기본 동 목록 (실제 정부청사 건물 구성)
const DEFAULT_BUILDINGS = [
  { id: 1,  name: '1동',               desc: '국무총리실' },
  { id: 2,  name: '2동',               desc: '공정거래위원회' },
  { id: 3,  name: '3동',               desc: '청사관리본부' },
  { id: 4,  name: '4동',               desc: '과학기술정보통신부' },
  { id: 5,  name: '5동',               desc: '기획예산처, 농림축산식품부' },
  { id: 6,  name: '6동',               desc: '국토교통부, 기후에너지환경부' },
  { id: 7,  name: '7동',               desc: '법제처, 국민권익위원회' },
  { id: 8,  name: '8동',               desc: '우정사업본부' },
  { id: 9,  name: '9동',               desc: '국가보훈부' },
  { id: 10, name: '10동',              desc: '보건복지부' },
  { id: 11, name: '11동',              desc: '고용노동부' },
  { id: 12, name: '12동',              desc: '산업통상자원부' },
  { id: 13, name: '13동',              desc: '산업통상자원부, 기후에너지환경부' },
  { id: 14, name: '14동',              desc: '교육부' },
  { id: 15, name: '15동',              desc: '문화체육관광부' },
  { id: 16, name: '17동',              desc: '인사혁신처' },
  { id: 17, name: '17-2동',            desc: '인사혁신처' },
  { id: 18, name: '중앙동',            desc: '재정경제부, 행정안전부' },
  { id: 19, name: '민원동',            desc: '재정경제부' },
  { id: 21, name: '별관(뱅크빌딩)',     desc: '국토교통부' },
  { id: 22, name: '별관(세종비즈니스센터A동)', desc: '국토교통부' },
  { id: 23, name: '별관(청암빌딩)',     desc: '기후에너지환경부' },
  { id: 24, name: '별관(ak&세종)',      desc: '보건복지부' },
  { id: 25, name: '파이낸스3차',        desc: '중소벤처기업부' },
];

// 앱 상태
let appState = {
  records: [],        // 전체 DB 레코드
  filtered: [],       // 필터링된 레코드
  buildings: [...DEFAULT_BUILDINGS],
  settings: { apiKey: '' },
  currentPage: 1,
  pageSize: 50,
  editingId: null,
  uploadQueue: [],
  extractedRows: [],
  analysisModalItem: null,
};

// ---- 데이터 로드/저장 ----
function loadData() {
  // 동 목록은 항상 코드의 DEFAULT_BUILDINGS를 사용 (낡은 localStorage 데이터 무시)
  appState.buildings = [...DEFAULT_BUILDINGS];
  localStorage.removeItem('gov_buildings'); // 스탄일 동 목록 제거

  try {
    const raw = localStorage.getItem(DB_KEY);
    appState.records = raw ? JSON.parse(raw) : getSampleData();
  } catch { appState.records = getSampleData(); }

  // 데이터 마이그레이션: 행정안전부 14동 → 중앙동
  let migrated = false;
  appState.records.forEach(r => {
    if (r.ministry === '행정안전부' && r.building === '14동') {
      r.building = '중앙동';
      migrated = true;
    }
  });

  // 누락된 updatedAt 필드 기본값 부여 (수정일시 지원)
  appState.records.forEach(r => {
    if (!r.updatedAt) {
      r.updatedAt = Date.now();
      migrated = true;
    }
  });
  if (migrated) saveData();

  try {
    const s = localStorage.getItem(SETTINGS_KEY);
    if (s) appState.settings = { ...appState.settings, ...JSON.parse(s) };
  } catch {}

  // 최초 1회 백업 생성 유도 (백업이 비어있을 경우)
  const backupsJson = localStorage.getItem('gov_directory_backups');
  if (!backupsJson || JSON.parse(backupsJson).length === 0) {
    createBackup();
  }
}

function saveData() {
  localStorage.setItem(DB_KEY, JSON.stringify(appState.records));
  createBackup();
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(appState.settings));
}

function saveBuildings() {
  localStorage.setItem('gov_buildings', JSON.stringify(appState.buildings));
}

// 샘플 데이터 (첨부 사진에서 추출한 실제 데이터)
function getSampleData() {
  return [
    // === 중앙동: 재정경제부 ===
    { id: uid(), building: '중앙동', floor: 7, room: '701', ministry: '재정경제부', dept: '입법심의관 리서치팀', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 7, room: '702', ministry: '재정경제부', dept: '정책기획관 / 기획재정담당관 / 규제개혁법무담당관 / 혁신정책담당관 / 경제교육정책팀', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 7, room: '712', ministry: '재정경제부', dept: '경제구조개혁국장 / 경제구조혁총괄과 / 인력정책과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 7, room: '715', ministry: '재정경제부', dept: '노동시장경쟁제과 / 복지경제과 / 연금보건경제과 / 청년정책과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 7, room: '718', ministry: '재정경제부', dept: '정책조정관 전략경제정책관', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 7, room: '719', ministry: '재정경제부', dept: '정책조정총괄과 / 산업경제과 / 서비스경제과 / 지역경제정책과 / 기업환경과 / 녹색전환경제과 / 전략경제총괄과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 7, room: '720', ministry: '재정경제부', dept: '전략투자지원과 / 전략경제분석과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 7, room: '721', ministry: '재정경제부', dept: '비상안전기획관 / 비상안전기획팀', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 7, room: '730', ministry: '재정경제부', dept: '국제금융국장 / 국제금융심의관', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 7, room: '733', ministry: '재정경제부', dept: '국제금융과 / 외화제도과 / 외화자금과 / 다자금융과 / 금융협력과 / 외환분석팀 / 국제통화팀 / 국제투자협력팀', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 7, room: '703', ministry: '재정경제부', dept: '공용회의실', type: '공통시설', note: '' },
    { id: uid(), building: '중앙동', floor: 7, room: '727', ministry: '재정경제부', dept: '국제회의실', type: '회의실', note: '' },
    
    // === 중앙동: 재정경제부 6층 ===
    { id: uid(), building: '중앙동', floor: 6, room: '601', ministry: '재정경제부', dept: '재산세제과 / 부가가치세제과 / 환경에너지세제과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 6, room: '602', ministry: '재정경제부', dept: '재산소비세정책관 / 국제조세정책관 / 국제조세제도과 / 신국제조세규범과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 6, room: '603', ministry: '재정경제부', dept: '소득세제과 / 법인세제과 / 금융세제과 / 국제조세협력팀', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 6, room: '604', ministry: '재정경제부', dept: '조세총괄정책관 / 소득법인세정책관 / 조세정책과 / 조세특례제도과 / 조세법령운용팀', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 6, room: '610', ministry: '재정경제부', dept: '관세정책관 / 조세분석과 / 조세추계과 / 조세법령개혁팀', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 6, room: '613', ministry: '재정경제부', dept: '관세제도과 / 신산업관세과 / 자유무역협정관세이행과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 6, room: '616', ministry: '재정경제부', dept: '관세협력과 / 반덤핑관세팀', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 6, room: '617', ministry: '재정경제부', dept: '대외경제국장 / 대외경제심의관 / 대외경제총괄과 / 국제경제과 / 통상정책과 / 신통상분석과 / 경제협력과 / 남북경제과 / 남북경협팀 / 다자경제협력팀', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 6, room: '624', ministry: '재정경제부', dept: '운영지원과장 / 관리팀', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 6, room: '627', ministry: '재정경제부', dept: '경리팀', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 6, room: '630', ministry: '재정경제부', dept: '개발금융국장 / 개발금융총괄과 / 국제기구과 / AIIB팀 / 개발전략과 / 개발사업협력과 / 녹색기후기획과', type: '사무실', note: '' },

    // === 중앙동: 재정경제부 8층 ===
    { id: uid(), building: '중앙동', floor: 8, room: '801', ministry: '재정경제부', dept: '정책보좌관팀', type: '사무실', note: '', updatedAt: Date.now() },
    { id: uid(), building: '중앙동', floor: 8, room: '802', ministry: '재정경제부', dept: '기획조정실장 / 국조실장 혁신행정실장', type: '사무실', note: '', updatedAt: Date.now() },
    { id: uid(), building: '중앙동', floor: 8, room: '803', ministry: '재정경제부', dept: '2차관실', type: '사무실', note: '', updatedAt: Date.now() },
    { id: uid(), building: '중앙동', floor: 8, room: '804', ministry: '재정경제부', dept: '자문관 / 정책보좌관', type: '사무실', note: '', updatedAt: Date.now() },
    { id: uid(), building: '중앙동', floor: 8, room: '826', ministry: '재정경제부', dept: '부총리실', type: '사무실', note: '', updatedAt: Date.now() },
    { id: uid(), building: '중앙동', floor: 8, room: '826', ministry: '재정경제부', dept: '종합정책과', type: '사무실', note: '', updatedAt: Date.now() },
    { id: uid(), building: '중앙동', floor: 8, room: '811', ministry: '재정경제부', dept: '1차관실 / 차관보 / 국제경제관리관 / 세제실장', type: '사무실', note: '', updatedAt: Date.now() },
    { id: uid(), building: '중앙동', floor: 8, room: '818', ministry: '재정경제부', dept: '감사관 / 감사담당관', type: '사무실', note: '', updatedAt: Date.now() },
    { id: uid(), building: '중앙동', floor: 8, room: '820', ministry: '재정경제부', dept: '인사과장 / 인사운영팀 / 조직제도팀', type: '사무실', note: '', updatedAt: Date.now() },
    { id: uid(), building: '중앙동', floor: 8, room: '830', ministry: '재정경제부', dept: '경제정책국장 / 거시경제심의관 / 경제분석과 / 물가정책과 / 경제구조분석과', type: '사무실', note: '', updatedAt: Date.now() },
    { id: uid(), building: '중앙동', floor: 8, room: '833', ministry: '재정경제부', dept: '자금시장과장실 / 자금시장분석과 / 재정기획과 / 부동산시장과 / 물가정책대응팀 / 물가구조팀', type: '사무실', note: '', updatedAt: Date.now() },
    { id: uid(), building: '중앙동', floor: 8, room: '801', ministry: '재정경제부', dept: '공용회의실', type: '회의실', note: '', updatedAt: Date.now() },
    { id: uid(), building: '중앙동', floor: 8, room: '805', ministry: '재정경제부', dept: '영상회의실', type: '회의실', note: '', updatedAt: Date.now() },
    { id: uid(), building: '중앙동', floor: 8, room: '819', ministry: '재정경제부', dept: '대회의실', type: '회의실', note: '', updatedAt: Date.now() },

    // === 5동: 기획예산처 ===
    { id: uid(), building: '5동', floor: 7, room: '704', ministry: '기획예산처', dept: '성장기획정책관 / 미래전략과 / 혁신경제전략과 / 탄소중립정책과', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 7, room: '706', ministry: '기획예산처', dept: '통합성장정책관 / 포용사회전략과 / 인구구조혁신과 / 상생협력전략과', type: '사무실', note: '' },

    // === 9층: 재정경제부 / 기획예산처 ===
    { id: uid(), building: '중앙동', floor: 9, room: '901', ministry: '재정경제부', dept: '국제협력대사지원단 외환업무지원TF', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 9, room: '905', ministry: '재정경제부', dept: '공공정책국장 / 공공혁신심의관 / 공공정책총괄과 / 공공제도기획과 / 재무경영과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 9, room: '911', ministry: '재정경제부', dept: '평가분석과 / 인재경영과 / 공공윤리정책기획과 / 공공혁신기획과 / 경영관리과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 9, room: '914', ministry: '재정경제부', dept: '노동조합', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 9, room: '917', ministry: '재정경제부', dept: '회계결산과 국가결산체계개편팀', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 9, room: '925', ministry: '재정경제부', dept: '국고정책관 / 국유재산정책관 / 국고총괄과 / 블록체인기반국고금집행팀 / 국채정책과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 9, room: '926', ministry: '재정경제부', dept: '국채과 / 국유재산정책과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 9, room: '932', ministry: '재정경제부', dept: '출자관리과 / 계약정책과 / 계약정책지원팀 / 계약분쟁조정과 / 공공조달정책과 / 공공계약심사팀 / 국유재산협력과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 9, room: '924', ministry: '재정경제부', dept: '직원카페', type: '공통시설', note: '' },
    { id: uid(), building: '5동', floor: 9, room: '903', ministry: '기획예산처', dept: '재정정책국장 / 재정건전성심의관 / 재정정책총괄과 / 재정전망팀', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 9, room: '917', ministry: '기획예산처', dept: '민간투자정책과', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 9, room: '918', ministry: '기획예산처', dept: '재정관리국장 / 재정성과심의관 / 재정관리총괄과 / 재정성과평가과 / 타당성심사과 / 재정성과관리과 / 보조금관리팀 / 재정사업심층평가팀 / 재정성과제도팀', type: '사무실', note: '' },

    // === 10층: 행정안전부 ===
    { id: uid(), building: '중앙동', floor: 10, room: '1001', ministry: '행정안전부', dept: '재난안전통신망과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 10, room: '1002', ministry: '행정안전부', dept: '재정협력과 / 교부세과 / 회계계약제도과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 10, room: '1003', ministry: '행정안전부', dept: '지방재정국장 / 재정정책과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 10, room: '1005', ministry: '행정안전부', dept: '지방소득소비세제과 / 지방세특례제도과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 10, room: '1006', ministry: '행정안전부', dept: '지방세제국장 / 지방세정책과 / 부동산세제과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 10, room: '1011', ministry: '행정안전부', dept: '지역경제지원국장 / 지역경제과 / 지방규제혁신과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 10, room: '1012', ministry: '행정안전부', dept: '지역금융지원과 / 지방공기업정책과 / 지방공공기관관리과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 10, room: '1016', ministry: '행정안전부', dept: '안전사업조정과 / 재난안전산업과 / 승강기정책과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 10, room: '1017', ministry: '행정안전부', dept: '안전감찰담당관', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 10, room: '1018', ministry: '행정안전부', dept: '재난안전정보통신국장 / 재난정보통신과 / 재난안전데이터과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 10, room: '1004', ministry: '행정안전부', dept: '회의실', type: '회의실', note: '' },
    { id: uid(), building: '중앙동', floor: 10, room: '1009', ministry: '행정안전부', dept: '회의실', type: '회의실', note: '' },
    { id: uid(), building: '중앙동', floor: 10, room: '1013', ministry: '행정안전부', dept: '회의실', type: '회의실', note: '' },
    { id: uid(), building: '중앙동', floor: 10, room: '1015', ministry: '행정안전부', dept: '회의실', type: '회의실', note: '' },
    { id: uid(), building: '중앙동', floor: 10, room: '1014', ministry: '행정안전부', dept: '중회의실', type: '회의실', note: '' },
    { id: uid(), building: '중앙동', floor: 10, room: '1019', ministry: '행정안전부', dept: '공용회의실', type: '회의실', note: '' },
    { id: uid(), building: '중앙동', floor: 10, room: '1010', ministry: '행정안전부', dept: '휴게실', type: '공통시설', note: '' },

    // === 11층: 행정안전부 ===
    { id: uid(), building: '중앙동', floor: 11, room: '1101', ministry: '행정안전부', dept: '균형발전진흥과 / 행정자료실창고', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 11, room: '1102', ministry: '행정안전부', dept: '균형발전국장 / 균형발전제도과 / 지역사회정책과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 11, room: '1105', ministry: '행정안전부', dept: '사회적경제지원과 / 민간협력공동체과 / 지역금융지원과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 11, room: '1106', ministry: '행정안전부', dept: '사회적경제국장 / 사회적경제제도과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 11, room: '1109', ministry: '행정안전부', dept: '정책보좌관', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 11, room: '1112', ministry: '행정안전부', dept: '자치분권국장 / 자치분권제도과 / 주민자치혁신과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 11, room: '1113', ministry: '행정안전부', dept: '자치분권지원과 / 지방인사제도과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 11, room: '1114', ministry: '행정안전부', dept: '선거의회자치법규과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 11, room: '1115', ministry: '행정안전부', dept: '주민과 / 사회통합지원과 / 공무원단체과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 11, room: '1116', ministry: '행정안전부', dept: '지역공동체과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 11, room: '1118', ministry: '행정안전부', dept: '자치행정과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 11, room: '1119', ministry: '행정안전부', dept: '지방행정국장', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 11, room: '1103', ministry: '행정안전부', dept: '회의실', type: '회의실', note: '' },
    { id: uid(), building: '중앙동', floor: 11, room: '1104', ministry: '행정안전부', dept: '회의실', type: '회의실', note: '' },
    { id: uid(), building: '중앙동', floor: 11, room: '1109', ministry: '행정안전부', dept: '회의실', type: '회의실', note: '' },
    { id: uid(), building: '중앙동', floor: 11, room: '1110', ministry: '행정안전부', dept: '휴게실', type: '공통시설', note: '' },
    { id: uid(), building: '중앙동', floor: 11, room: '1115', ministry: '행정안전부', dept: '행정자료실', type: '공통시설', note: '' },
    { id: uid(), building: '중앙동', floor: 11, room: '1119', ministry: '행정안전부', dept: '여성휴게실', type: '공통시설', note: '' },
    { id: uid(), building: '중앙동', floor: 11, room: '',     ministry: '행정안전부', dept: '전망라운지', type: '공통시설', note: '' },
    { id: uid(), building: '중앙동', floor: 11, room: '',     ministry: '행정안전부', dept: '카페', type: '공통시설', note: '' },

    // === 12층: 행정안전부 ===
    { id: uid(), building: '중앙동', floor: 12, room: '1201', ministry: '행정안전부', dept: '장관실', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 12, room: '1206', ministry: '행정안전부', dept: '운영지원과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 12, room: '1207', ministry: '행정안전부', dept: '인사기획관', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 12, room: '1211', ministry: '행정안전부', dept: '안전정책국장 / 안전정책총괄과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 12, room: '1212', ministry: '행정안전부', dept: '자연재난실장 / 사회재난실장 / 재난관리정책관', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 12, room: '1213', ministry: '행정안전부', dept: '재난협력정책관', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 12, room: '1214', ministry: '행정안전부', dept: '재난안전관리본부장', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 12, room: '1215', ministry: '행정안전부', dept: '정책기획관 / 기획재정담당관', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 12, room: '1217', ministry: '행정안전부', dept: '차관실', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 12, room: '1218', ministry: '행정안전부', dept: '자치분권실장', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 12, room: '1219', ministry: '행정안전부', dept: '지방행정실장', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 12, room: '1220', ministry: '행정안전부', dept: '지방재정경제실장', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 12, room: '1202', ministry: '행정안전부', dept: '중회의실', type: '회의실', note: '' },
    { id: uid(), building: '중앙동', floor: 12, room: '1203', ministry: '행정안전부', dept: '청백당', type: '공통시설', note: '' },
    { id: uid(), building: '중앙동', floor: 12, room: '1204', ministry: '행정안전부', dept: '대회의실', type: '회의실', note: '' },
    { id: uid(), building: '중앙동', floor: 12, room: '1205', ministry: '행정안전부', dept: '음향조정실', type: '공통시설', note: '' },
    { id: uid(), building: '중앙동', floor: 12, room: '1209', ministry: '행정안전부', dept: '인사상담실', type: '공통시설', note: '' },
    { id: uid(), building: '중앙동', floor: 12, room: '1210', ministry: '행정안전부', dept: '우편함', type: '공통시설', note: '' },
    { id: uid(), building: '중앙동', floor: 12, room: '1216', ministry: '행정안전부', dept: '업무지원실', type: '공통시설', note: '' },

    // === 13층: 행정안전부 ===
    { id: uid(), building: '중앙동', floor: 13, room: '1301', ministry: '행정안전부', dept: '혁신기획과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 13, room: '1302', ministry: '행정안전부', dept: '행정제도과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 13, room: '1305', ministry: '행정안전부', dept: '혁신행정담당관 / 성과관리담당관', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 13, room: '1306', ministry: '행정안전부', dept: '법무담당관', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 13, room: '1309', ministry: '행정안전부', dept: '정보보호팀', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 13, room: '1310', ministry: '행정안전부', dept: '데이터정보화담당관', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 13, room: '1311', ministry: '행정안전부', dept: '국제행정협력관 / 국제협력담당관 / 행정한류담당관', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 13, room: '1314', ministry: '행정안전부', dept: '비상안전기획관', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 13, room: '1318', ministry: '행정안전부', dept: '조직기획과 / 조직진단과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 13, room: '1319', ministry: '행정안전부', dept: '경제조직과 / 사회조직과 / 행정조직과 / 인사조직과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 13, room: '1320', ministry: '행정안전부', dept: '조직정책관', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 13, room: '1322', ministry: '행정안전부', dept: '민원제도과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 13, room: '1323', ministry: '행정안전부', dept: '국민참여정책과 / 정보공개제도과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 13, room: '1324', ministry: '행정안전부', dept: '정부혁신기획관', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 13, room: '1303', ministry: '행정안전부', dept: '북카페', type: '공통시설', note: '' },
    { id: uid(), building: '중앙동', floor: 13, room: '1304', ministry: '행정안전부', dept: '작업실', type: '공통시설', note: '' },
    { id: uid(), building: '중앙동', floor: 13, room: '1308', ministry: '행정안전부', dept: '회의실', type: '회의실', note: '' },
    { id: uid(), building: '중앙동', floor: 13, room: '1312', ministry: '행정안전부', dept: '회의실', type: '회의실', note: '' },
    { id: uid(), building: '중앙동', floor: 13, room: '1321', ministry: '행정안전부', dept: '회의실', type: '회의실', note: '' },
    { id: uid(), building: '중앙동', floor: 13, room: '1309', ministry: '행정안전부', dept: '휴게실', type: '공통시설', note: '' },
    { id: uid(), building: '중앙동', floor: 13, room: '1315', ministry: '행정안전부', dept: '중회의실', type: '회의실', note: '' },

    // === 중앙동: 행정안전부 14층 ===
    { id: uid(), building: '중앙동', floor: 14, room: '1401', ministry: '행정안전부', dept: '휴게실', type: '공통시설', note: '' },
    { id: uid(), building: '중앙동', floor: 14, room: '1402', ministry: '행정안전부', dept: '복무감찰담당관', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 14, room: '1403', ministry: '행정안전부', dept: '심의실', type: '공통시설', note: '' },
    { id: uid(), building: '중앙동', floor: 14, room: '1404', ministry: '행정안전부', dept: '감사관', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 14, room: '1405', ministry: '행정안전부', dept: '감사담당관', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 14, room: '1406', ministry: '행정안전부', dept: '디지털보안정책과 / 디지털인프라혁신과 / 지역디지털협력과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 14, room: '1408', ministry: '행정안전부', dept: '인공지능정부기반국장', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 14, room: '1409', ministry: '행정안전부', dept: '회의실', type: '회의실', note: '' },
    { id: uid(), building: '중앙동', floor: 14, room: '1411', ministry: '행정안전부', dept: '행정정보공유과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 14, room: '1412', ministry: '행정안전부', dept: '인공지능정부서비스국장 / 공공서비스혁신과 / 국민맞춤서비스과 / 농림포털정책과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 14, room: '1413', ministry: '행정안전부', dept: '공용회의실', type: '회의실', note: '' },
    { id: uid(), building: '중앙동', floor: 14, room: '1414', ministry: '행정안전부', dept: '공용회의실', type: '회의실', note: '' },
    { id: uid(), building: '중앙동', floor: 14, room: '1415', ministry: '행정안전부', dept: '인공지능정부정책국장 / 인공지능정부정책과 / 공공인공지능혁신과 / 공공데이터정책과 / 공공데이터분석관리과 / 인공지능정부협력과', type: '사무실', note: '' },
    { id: uid(), building: '중앙동', floor: 14, room: '1417', ministry: '행정안전부', dept: '상담실', type: '공통시설', note: '' },
    { id: uid(), building: '중앙동', floor: 14, room: '1418', ministry: '행정안전부', dept: '상설감사장', type: '공통시설', note: '' },

    // === 중앙동: 행정안전부 4층 ===
    { id: uid(), building: '중앙동', floor: 4, room: '402', ministry: '행정안전부', dept: '위기관리지원과 / 중앙민방위경보통제센터', type: '사무실', note: '', updatedAt: Date.now() },
    { id: uid(), building: '중앙동', floor: 4, room: '403', ministry: '행정안전부', dept: '민방위심의관 / 민방위과 / 비상대비훈련과', type: '사무실', note: '', updatedAt: Date.now() },
    { id: uid(), building: '중앙동', floor: 4, room: '406', ministry: '행정안전부', dept: '비상대비정책국장 / 비상대비기획과 / 비상대비자원과', type: '사무실', note: '', updatedAt: Date.now() },
    { id: uid(), building: '중앙동', floor: 4, room: '407', ministry: '행정안전부', dept: '사회재난현장지원과', type: '사무실', note: '', updatedAt: Date.now() },
    { id: uid(), building: '중앙동', floor: 4, room: '408', ministry: '행정안전부', dept: '재난복구지원국장 / 복구지원과 / 재난구호과 / 재난보험과', type: '사무실', note: '', updatedAt: Date.now() },
    { id: uid(), building: '중앙동', floor: 4, room: '409', ministry: '행정안전부', dept: '자연재난현장지원과', type: '사무실', note: '', updatedAt: Date.now() },
    { id: uid(), building: '중앙동', floor: 4, room: '410', ministry: '행정안전부', dept: '사회재난정책국장 / 사회재난정책과 / 재난안전점검과', type: '사무실', note: '', updatedAt: Date.now() },
    { id: uid(), building: '중앙동', floor: 4, room: '401', ministry: '행정안전부', dept: '여성휴게실', type: '공통시설', note: '', updatedAt: Date.now() },
    { id: uid(), building: '중앙동', floor: 4, room: '405/407', ministry: '행정안전부', dept: '회의실', type: '회의실', note: '', updatedAt: Date.now() },
    { id: uid(), building: '중앙동', floor: 4, room: '411', ministry: '행정안전부', dept: '휴게실', type: '공통시설', note: '', updatedAt: Date.now() },
    { id: uid(), building: '중앙동', floor: 4, room: '412', ministry: '행정안전부', dept: '행정안전부 당직실', type: '공통시설', note: '', updatedAt: Date.now() },
    { id: uid(), building: '중앙동', floor: 4, room: '413', ministry: '행정안전부', dept: '새마을금고', type: '공통시설', note: '', updatedAt: Date.now() },

    // === 6동: 국토교통부 ===
    { id: uid(), building: '6동', floor: 3, room: '316', ministry: '국토교통부', dept: '감사관 / 감사담당관', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 3, room: '319', ministry: '국토교통부', dept: '지적재조사기획단 기획관 / 사업총괄과', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 3, room: '323', ministry: '국토교통부', dept: '대변인 / 홍보담당관 / 비상안전기획관', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 3, room: '325', ministry: '국토교통부', dept: '행정정보시스템통합콜센터', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 3, room: '326', ministry: '국토교통부', dept: '예비군중대장실', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 3, room: '328', ministry: '국토교통부', dept: '기자실', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 3, room: '330', ministry: '국토교통부', dept: '건축안전과 / 기반시설팀', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 3, room: '335', ministry: '국토교통부', dept: '국토교통부 노동조합', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 3, room: '341', ministry: '국토교통부', dept: '건설산업과 / 해외건설정책과 / 해외건설지원과', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 3, room: '343', ministry: '국토교통부', dept: '건설정책국장 / 건설정책과', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 3, room: '349', ministry: '국토교통부', dept: '기술안전정책관 / 기술정책과 / 기술혁신과 / 건설안전과 / 시설안전과', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 3, room: '352', ministry: '국토교통부', dept: '자동차정책관 / 자동차정책과 / 자동차안전팀', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 3, room: '353', ministry: '국토교통부', dept: '공정건설추진팀', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 3, room: '354', ministry: '국토교통부', dept: '토지정책관 / 토지정책과 / 부동산산업과 / 부동산평가과 / 부동산개발정책과', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 3, room: '331', ministry: '국토교통부', dept: '다목적홀', type: '공통시설', note: '' },

    // === 6동: 행정중심복합도시건설청 ===
    { id: uid(), building: '6동', floor: 3, room: '303', ministry: '행정중심복합도시건설청', dept: '노동조합사무실', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 3, room: '304', ministry: '행정중심복합도시건설청', dept: '브리핑실', type: '공통시설', note: '' },
    { id: uid(), building: '6동', floor: 3, room: '305', ministry: '행정중심복합도시건설청', dept: '운영지원과 / 기획재정담당관실 / 혁신행정담당관실', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 3, room: '308', ministry: '행정중심복합도시건설청', dept: '청장실', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 3, room: '311', ministry: '행정중심복합도시건설청', dept: '차장실 / 기획조정관실 / 위원장 / 국제회의장', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 3, room: '312', ministry: '행정중심복합도시건설청', dept: '당직실', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 3, room: '362', ministry: '행정중심복합도시건설청', dept: '도시공간건축과 / 교통계획과', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 3, room: '366', ministry: '행정중심복합도시건설청', dept: '도시계획국장실 / 시설시업국장실 / 도시정책과 / 도시성장촉진과', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 3, room: '369', ministry: '행정중심복합도시건설청', dept: '사업관리총괄과 / 광역도로과 / 공공청사건축과 / 공공공사건축과', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 3, room: '371', ministry: '행정중심복합도시건설청', dept: '국립박물관단지', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 3, room: '372', ministry: '행정중심복합도시건설청', dept: '외의실', type: '회의실', note: '' },

    // === 6동: 기후에너지환경부 / 국토교통부 5층 ===
    { id: uid(), building: '6동', floor: 5, room: '503', ministry: '기후에너지환경부', dept: '환경정보자료실', type: '공통시설', note: '' },
    { id: uid(), building: '6동', floor: 5, room: '505', ministry: '기후에너지환경부', dept: '대기환경정책과 / 대기관리과', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 5, room: '510', ministry: '기후에너지환경부', dept: '대기환경정책관실 / 교통환경과 / 통합허가제도과', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 5, room: '511', ministry: '기후에너지환경부', dept: '고농도미세먼지종합상황실', type: '공통시설', note: '' },
    { id: uid(), building: '6동', floor: 5, room: '512', ministry: '기후에너지환경부', dept: '환경정책기술담당관실', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 5, room: '564', ministry: '기후에너지환경부', dept: '회의실', type: '회의실', note: '' },
    { id: uid(), building: '6동', floor: 5, room: '565', ministry: '기후에너지환경부', dept: '대회의실', type: '회의실', note: '' },
    { id: uid(), building: '6동', floor: 5, room: '566', ministry: '기후에너지환경부', dept: '회의실', type: '회의실', note: '' },
    { id: uid(), building: '6동', floor: 5, room: '568', ministry: '기후에너지환경부', dept: '국토환경정책과 / 환경영향평가과 / 야생동물질병관리팀', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 5, room: '571', ministry: '기후에너지환경부', dept: '자연보전국장실 / 자연생태정책과', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 5, room: '573', ministry: '기후에너지환경부', dept: '생물다양성과 / 자연공원과', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 5, room: '574', ministry: '기후에너지환경부', dept: '노동조합사무실', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 5, room: '575', ministry: '기후에너지환경부', dept: '당직실', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 5, room: '517', ministry: '국토교통부', dept: '미래전략일자리담당관 / 항공정책실장실 / 국토도시실장실 / 주택토지실장실 / 교통물류실장실', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 5, room: '523', ministry: '국토교통부', dept: '2차관실 / 기획조정실장실', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 5, room: '527', ministry: '국토교통부', dept: '장관실 / 1차관실 / 국제회의실', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 5, room: '531', ministry: '국토교통부', dept: '영상회의실 / 중회의실 / 당직실 / 운영지원과(문서복지)', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 5, room: '545', ministry: '국토교통부', dept: '방송실', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 5, room: '546', ministry: '국토교통부', dept: '대회의실', type: '회의실', note: '' },
    { id: uid(), building: '6동', floor: 5, room: '552', ministry: '국토교통부', dept: '운영지원과장 / 운영지원과(인사) / 운영지원과(서무/경리재산)', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 5, room: '555', ministry: '국토교통부', dept: '정보화통계담당관 / 정보보호담당관 / 규제개혁법무담당관', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 5, room: '557', ministry: '국토교통부', dept: '국제협력통상담당관', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 5, room: '559', ministry: '국토교통부', dept: '정책기획관 / 재정담당관', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 5, room: '537', ministry: '공통시설', dept: '체력단련실', type: '공통시설', note: '' },
    { id: uid(), building: '6동', floor: 5, room: '539', ministry: '공통시설', dept: '직원휴게실', type: '공통시설', note: '' },

    // === 6동: 기후에너지환경부 / 국토교통부 6층 ===
    { id: uid(), building: '6동', floor: 6, room: '603', ministry: '기후에너지환경부', dept: 'PC유지보수실 / 인사상담실', type: '공통시설', note: '' },
    { id: uid(), building: '6동', floor: 6, room: '604', ministry: '기후에너지환경부', dept: '운영지원과장실 / 행정팀 / 인사팀 / 재무팀', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 6, room: '607', ministry: '기후에너지환경부', dept: '차관실', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 6, room: '609', ministry: '기후에너지환경부', dept: '종합상황실', type: '공통시설', note: '' },
    { id: uid(), building: '6동', floor: 6, room: '611', ministry: '기후에너지환경부', dept: '장관정책보좌관실', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 6, room: '612', ministry: '기후에너지환경부', dept: '장관실', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 6, room: '614', ministry: '기후에너지환경부', dept: '초기대응상황실', type: '공통시설', note: '' },
    { id: uid(), building: '6동', floor: 6, room: '615', ministry: '기후에너지환경부', dept: '비상안전담당관실', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 6, room: '617', ministry: '기후에너지환경부', dept: 'K-GX 기획단', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 6, room: '618', ministry: '기후에너지환경부', dept: '갑질피해신고센터', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 6, room: '619', ministry: '기후에너지환경부', dept: '감사관실 / 감사담당관실', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 6, room: '663', ministry: '기후에너지환경부', dept: '회의실', type: '회의실', note: '' },
    { id: uid(), building: '6동', floor: 6, room: '665', ministry: '기후에너지환경부', dept: '기후에너지정책관실 / 기후에너지정책과 / 기후경제과 / 기후에너지재정과', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 6, room: '666', ministry: '기후에너지환경부', dept: '회의실', type: '회의실', note: '' },
    { id: uid(), building: '6동', floor: 6, room: '668', ministry: '기후에너지환경부', dept: '기후에너지정책실장실 / 기후적응과', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 6, room: '671', ministry: '기후에너지환경부', dept: '기획조정실장실 / 정책기획관실 / 기획재정담당관실', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 6, room: '673', ministry: '기후에너지환경부', dept: '혁신행정담당관실 / 규제개혁법무담당관실 / 정보화담당관실 / 정보보호담당관실', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 6, room: '622', ministry: '국토교통부', dept: '종합교통정책관 / 교통정책총괄과 / 교통안전정책과 / 버스정책과 / 모빌리티정책과 / 생활교통복지과', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 6, room: '626', ministry: '국토교통부', dept: '물류정책관 / 물류정책과', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 6, room: '629', ministry: '국토교통부', dept: '생활물류정책팀', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 6, room: '630', ministry: '국토교통부', dept: '첨단물류과 / 물류산업과', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 6, room: '632', ministry: '국토교통부', dept: '항공산업과 / 국제항공과', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 6, room: '634', ministry: '국토교통부', dept: '항공정책도서실', type: '공통시설', note: '' },
    { id: uid(), building: '6동', floor: 6, room: '636', ministry: '국토교통부', dept: '항공정책관 / 항공정책과', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 6, room: '640', ministry: '국토교통부', dept: '항공안전정책관 / 항공안전정책과 / 항공자격팀 / 항공운항과 / 항공기술과 / 항공교통과 / 항행위성정책과 / 항행안전정보과', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 6, room: '643', ministry: '국토교통부', dept: '정보화교육장', type: '공통시설', note: '' },
    { id: uid(), building: '6동', floor: 6, room: '653', ministry: '국토교통부', dept: '공항정책관 / 공항정책과 / 공항안전환경과 / 항행시설과 / 공항건설팀', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 6, room: '656', ministry: '국토교통부', dept: '도로국장 / 도로정책과 / 도로건설과 / 도로투자지원과 / 도로관리과 / 도로시설안전과 / 디지털도로팀', type: '사무실', note: '' },
    { id: uid(), building: '6동', floor: 6, room: '660', ministry: '국토교통부', dept: '국가정보센터', type: '공통시설', note: '' },

    // === 5동: 농림축산식품부 4층 ===
    { id: uid(), building: '5동', floor: 4, room: '416', ministry: '농림축산식품부', dept: '장관실', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 4, room: '420', ministry: '농림축산식품부', dept: '차관실 / 식량정책실장실', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 4, room: '413', ministry: '농림축산식품부', dept: '기획조정실장실 / 농산업혁신정책실장실 / 정책기획관 / 비상안전기획관', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 4, room: '426', ministry: '농림축산식품부', dept: '정책보좌관 / 대변인실 / 홍보담당관 디지털소통팀', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 4, room: '404', ministry: '농림축산식품부', dept: '감사관실 / 감사담당관', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 4, room: '402', ministry: '농림축산식품부', dept: '운영지원과', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 4, room: '410', ministry: '농림축산식품부', dept: '기획재정담당관 / 규제개혁법무담당관', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 4, room: '409', ministry: '농림축산식품부', dept: '농촌정책국 / 농업정책관', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 4, room: '405~407', ministry: '농림축산식품부', dept: '농촌정책과 / 농촌공간계획과 / 농촌사회서비스과 / 농촌경제과 / 농촌재생지원팀 / 농산업전략기획단', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 4, room: '472~475', ministry: '농림축산식품부', dept: '농업정책과 / 농지과 / 농업금융정책과 / 농촌여성정책과 / 청년농육성정책팀', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 4, room: '456', ministry: '농림축산식품부', dept: '농촌소득에너지정책관', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 4, room: '456~458', ministry: '농림축산식품부', dept: '농촌소득정책과 / 농업재해보험과 / 농촌에너지정책과 / 농업재해지원팀 / 농촌탄소중립추진팀', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 4, room: '453', ministry: '농림축산식품부', dept: '동물복지정책국 / 동물복지정책과 / 반려산업동물의료과 / 동물보호과 / 개식용종식추진단', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 4, room: '467', ministry: '농림축산식품부', dept: '방역정책국 / 방역정책과 / 구제역방역과 / 조류인플루엔자방역과', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 4, room: '464', ministry: '농림축산식품부', dept: '대회의실', type: '회의실', note: '' },
    { id: uid(), building: '5동', floor: 4, room: '468', ministry: '농림축산식품부', dept: '중회의실', type: '회의실', note: '' },
    { id: uid(), building: '5동', floor: 4, room: '476-1', ministry: '농림축산식품부', dept: '중회의실(상설감사장)', type: '회의실', note: '' },
    { id: uid(), building: '5동', floor: 4, room: '476-2', ministry: '농림축산식품부', dept: '소회의실', type: '회의실', note: '' },
    { id: uid(), building: '5동', floor: 4, room: '451', ministry: '농림축산식품부', dept: '소회의실', type: '회의실', note: '' },
    { id: uid(), building: '5동', floor: 4, room: '403', ministry: '농림축산식품부', dept: '소회의실', type: '회의실', note: '' },
    { id: uid(), building: '5동', floor: 4, room: '460', ministry: '농림축산식품부', dept: '재난상황실', type: '공통시설', note: '' },
    { id: uid(), building: '5동', floor: 4, room: '430', ministry: '농림축산식품부', dept: '당직실', type: '공통시설', note: '' },

    // === 5동: 기획예산처 4층 ===
    { id: uid(), building: '5동', floor: 4, room: '433', ministry: '기획예산처', dept: '장관실', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 4, room: '435', ministry: '기획예산처', dept: '차관실', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 4, room: '431', ministry: '기획예산처', dept: '정책보좌관', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 4, room: '440', ministry: '기획예산처', dept: '기획조정실장 / 미래전략실장 / 자문관 및 청년보좌역 / 정책보좌팀 / 미션추진단', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 4, room: '440', ministry: '기획예산처', dept: '운영지원과장 / 인사팀 / 관리팀 / 경리팀', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 4, room: '446', ministry: '기획예산처', dept: '재정성과국장 / 재정성과총괄과 / 재정사업심층평가팀 / 재정집행과', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 4, room: '446', ministry: '기획예산처', dept: '재정투자심의관 / 타당성심사과 / 민간투자정책과', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 4, room: '450', ministry: '기획예산처', dept: '성과제도혁신과 / 통합평가과 / 재정성과제도팀', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 4, room: '432', ministry: '기획예산처', dept: '영상회의실', type: '회의실', note: '' },
    { id: uid(), building: '5동', floor: 4, room: '434', ministry: '기획예산처', dept: '중회의실', type: '회의실', note: '' },
    { id: uid(), building: '5동', floor: 4, room: '436', ministry: '기획예산처', dept: '영상회의실', type: '회의실', note: '' },
    { id: uid(), building: '5동', floor: 4, room: '443', ministry: '기획예산처', dept: '대회의실', type: '회의실', note: '' },

    // === 5동: 기획예산처 / 국토교통부 5층 ===
    { id: uid(), building: '5동', floor: 5, room: '508', ministry: '기획예산처', dept: '행정국방예산심의관 / 법사예산과 / 행정외교예산과 / 국방예산과 / 방위력강화예산과', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 5, room: '512', ministry: '기획예산처', dept: '복지안전예산심의관 / 국민복지예산과 / 연금보건예산과 / 지역예산과 / 국민안전예산과', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 5, room: '515', ministry: '기획예산처', dept: '예산실장 / 예산총괄과 / 기금운용혁신과 / 인력예산팀', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 5, room: '518', ministry: '기획예산처', dept: '예산총괄심의관 / 예산심의실', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 5, room: '524', ministry: '기획예산처', dept: '예산정책과 / 예산기준과 / 예산소통협력과', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 5, room: '531', ministry: '기획예산처', dept: '성장기획정책관 / 미래전략과 / 혁신경제전략과 / 탄소중립정책과', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 5, room: '533', ministry: '기획예산처', dept: '통합성장정책관 / 포용사회전략과 / 인구구조혁신과 / 상생협력전략과 / 지속가능경제지원팀', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 5, room: '537', ministry: '기획예산처', dept: '거시분석지원팀 / 재정지표관리팀', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 5, room: '538', ministry: '기획예산처', dept: '재정혁신정책관 / 재정혁신총괄과 / 지속가능재정과 / 재정기획분석과 / 지출혁신과', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 5, room: '538', ministry: '기획예산처', dept: '재정참여정책관 / 재정협력총괄과 / 국제재정협력과 / 국제재정협력팀', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 5, room: '540', ministry: '기획예산처', dept: '열린재정정보과 / 재정시스템팀', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 5, room: '549', ministry: '기획예산처', dept: '국고보조금 부정수급관리단', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 5, room: '555', ministry: '기획예산처', dept: '정책기획관 / 기획재정담당관 / 혁신행정담당관 / 규제개혁법무담당관', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 5, room: '558', ministry: '기획예산처', dept: '사회예산심의관 / 고용노동예산과 / 기후에너지환경예산과 / 인적자원예산과 / 문화체육관광예산과 / 투자사업관리과', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 5, room: '558', ministry: '기획예산처', dept: '경제예산심의관 / 인공지능디지털예산과 / 농림해양예산과 / 과학기술혁신예산과 / 지방재정팀', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 5, room: '563', ministry: '기획예산처', dept: '경제예산심의관 / 국토교통예산과 / 산업중소벤처예산과', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 5, room: '506', ministry: '기획예산처', dept: '공용휴게실', type: '공통시설', note: '' },
    { id: uid(), building: '5동', floor: 5, room: '509~511', ministry: '기획예산처', dept: '예산협의실', type: '회의실', note: '' },
    { id: uid(), building: '5동', floor: 5, room: '517', ministry: '기획예산처', dept: '예산영상회의실', type: '회의실', note: '' },
    { id: uid(), building: '5동', floor: 5, room: '525', ministry: '기획예산처', dept: 'UPS 전산실 / OP룸', type: '공통시설', note: '' },
    { id: uid(), building: '5동', floor: 5, room: '528', ministry: '기획예산처', dept: '노동조합사무실', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 5, room: '529', ministry: '기획예산처', dept: '자녀돌봄스마트워크센터', type: '공통시설', note: '' },
    { id: uid(), building: '5동', floor: 5, room: '530', ministry: '기획예산처', dept: '복합업무공간 1', type: '공통시설', note: '' },
    { id: uid(), building: '5동', floor: 5, room: '545~546', ministry: '기획예산처', dept: '복합업무공간 2(동호회실)', type: '공통시설', note: '' },
    { id: uid(), building: '5동', floor: 5, room: '548', ministry: '기획예산처', dept: '공용영상회의실', type: '회의실', note: '' },
    { id: uid(), building: '5동', floor: 5, room: '549', ministry: '기획예산처', dept: '남자휴게실 / 여자휴게실 / 수유실 / 통신실 / 당직실', type: '공통시설', note: '' },
    { id: uid(), building: '5동', floor: 5, room: '501', ministry: '국토교통부', dept: '철도건설과 / 수도권광역급행철도과 / 철도시설안전과', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 5, room: '502', ministry: '국토교통부', dept: '광역급행철도추진단', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 5, room: '504', ministry: '국토교통부', dept: '철도국장 / 철도정책과 / 철도운영과 / 철도안전정책과', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 5, room: '566', ministry: '국토교통부', dept: '철도안전정책과 / 철도운행안전과', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 5, room: '569', ministry: '국토교통부', dept: '행정자료실', type: '공통시설', note: '' },
    { id: uid(), building: '5동', floor: 5, room: '540', ministry: '공통시설', dept: '예약식당', type: '공통시설', note: '' },
    { id: uid(), building: '5동', floor: 5, room: '581', ministry: '공통시설', dept: '체력단련실', type: '공통시설', note: '' },

    // === 5동: 기획예산처 / 국토교통부 6층 ===
    { id: uid(), building: '5동', floor: 6, room: '629', ministry: '기획예산처', dept: '감사담당관', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 6, room: '633', ministry: '기획예산처', dept: '대변인실 / 홍보담당관 / 디지털미디어팀', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 6, room: '633', ministry: '기획예산처', dept: '정보화담당관 / 입법심의관', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 6, room: '635', ministry: '기획예산처', dept: '복권위원회 사무처장 / 복권총괄과 / 발행관리과 / 기금사업과', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 6, room: '629', ministry: '기획예산처', dept: '기록관 / 도서실 / 스마트라운지', type: '공통시설', note: '' },
    { id: uid(), building: '5동', floor: 6, room: '601', ministry: '국토교통부', dept: '청년정책과', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 6, room: '602', ministry: '국토교통부', dept: '대구경북통합신공항건설추진단장 / 대구경북통합신공항건설추진단 / 철도시설안전과', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 6, room: '603', ministry: '국토교통부', dept: '도시정비기획준비단 / 도시재생과 / 회의실', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 6, room: '607', ministry: '국토교통부', dept: '공공택지추진단장 / 공공택지관리과 / 공공택지기획과', type: '사무실', note: '' },
    { id: uid(), building: '5동', floor: 6, room: '607', ministry: '국토교통부', dept: '회의실', type: '회의실', note: '' },
    { id: uid(), building: '5동', floor: 6, room: '624', ministry: '국토교통부', dept: '혁신도시발전추진단 부단장 / 혁신도시정책총괄과 / 혁신도시지원협력과 / 철도지하화통합개발추진단', type: '사무실', note: '' },

    // === 4동: 과학기술정보통신부 6층 ===
    { id: uid(), building: '4동', floor: 6, room: '608', ministry: '과학기술정보통신부', dept: '정보보호네트워크정책실장', type: '사무실', note: '' },
    { id: uid(), building: '4동', floor: 6, room: '610', ministry: '과학기술정보통신부', dept: '정보보호네트워크정책관 / 네트워크정책과 / 디지털인프라안전과 / 정보보호기획과 / 정보보호산업과 / 사이버침해대응과 / 사이버침해조사과', type: '사무실', note: '' },
    { id: uid(), building: '4동', floor: 6, room: '607', ministry: '과학기술정보통신부', dept: '통신정책관 / 통신정책기획과 / 통신경쟁정책과 / 통신이용제도과 / 통신자원정책과', type: '사무실', note: '' },
    { id: uid(), building: '4동', floor: 6, room: '604', ministry: '과학기술정보통신부', dept: '전파정책국 / 전파정책기획과 / 전파방송관리과 / 주파수정책과 / 전자파안전과', type: '사무실', note: '' },
    { id: uid(), building: '4동', floor: 6, room: '620', ministry: '과학기술정보통신부', dept: '감사관', type: '사무실', note: '' },
    { id: uid(), building: '4동', floor: 6, room: '622', ministry: '과학기술정보통신부', dept: '미래인재정책국 / 미래인재정책과 / 미래인재양성과 / 과학기술문화과 / 과학기술안전기반팀', type: '사무실', note: '' },

    // === 4동: 과학기술정보통신부 5층 ===
    { id: uid(), building: '4동', floor: 5, room: '504', ministry: '과학기술정보통신부', dept: '부총리 겸 과기정통부 장관실', type: '사무실', note: '' },
    { id: uid(), building: '4동', floor: 5, room: '506', ministry: '과학기술정보통신부', dept: '1차관실', type: '사무실', note: '' },
    { id: uid(), building: '4동', floor: 5, room: '508', ministry: '과학기술정보통신부', dept: '2차관실', type: '사무실', note: '' },
    { id: uid(), building: '4동', floor: 5, room: '509', ministry: '과학기술정보통신부', dept: '과학기술혁신본부장실', type: '사무실', note: '' },
    { id: uid(), building: '4동', floor: 5, room: '510', ministry: '과학기술정보통신부', dept: '장관정책보좌관실', type: '사무실', note: '' },
    { id: uid(), building: '4동', floor: 5, room: '538', ministry: '과학기술정보통신부', dept: '과학기술·인공지능정책보좌관 / 과학기술·인공지능정책협력관 / 과학기술인공지능협력담당관 / 첨단인재정책담당관', type: '사무실', note: '' },
    { id: uid(), building: '4동', floor: 5, room: '513', ministry: '과학기술정보통신부', dept: '운영지원과', type: '사무실', note: '' },
    { id: uid(), building: '4동', floor: 5, room: '531', ministry: '과학기술정보통신부', dept: '기획조정실장', type: '사무실', note: '' },
    { id: uid(), building: '4동', floor: 5, room: '528', ministry: '과학기술정보통신부', dept: '정책기획관 / 기획재정담당관 / 혁신행정담당관 / 규제개혁법무담당관 / 정보화담당관 / 정보보호담당관', type: '사무실', note: '' },
    { id: uid(), building: '4동', floor: 5, room: '520', ministry: '과학기술정보통신부', dept: '국제협력관 / 국제협력총괄담당관 / 미주아시아협력담당관 / 구주아프리카협력담당관 / 다자협력담당관', type: '사무실', note: '' },
    { id: uid(), building: '4동', floor: 5, room: '519', ministry: '과학기술정보통신부', dept: '비상안전기획관', type: '사무실', note: '' },
    { id: uid(), building: '4동', floor: 5, room: '550', ministry: '과학기술정보통신부', dept: '과학기술혁신조정관', type: '사무실', note: '' },
    { id: uid(), building: '4동', floor: 5, room: '548', ministry: '과학기술정보통신부', dept: '과학기술정책관 / 과학기술정책과 / 과학기술신산업과 / 과학기술규제개혁과 / 전략기술육성과', type: '사무실', note: '' },
    { id: uid(), building: '4동', floor: 5, room: '545', ministry: '과학기술정보통신부', dept: '연구개발투자심의국 / 연구예산총괄과 / 연구개발투자조정과 / 공공에너지조정과 / 기계정보분석조정과 / 생명기초조정과', type: '사무실', note: '' },
    { id: uid(), building: '4동', floor: 5, room: '541', ministry: '과학기술정보통신부', dept: '성과평가정책국 / 성과평가정책과 / 연구평가혁신과 / 연구제도혁신과 / 연구윤리권익보호과 / 과학기술정보분석과 / 연구개발타당성심사팀', type: '사무실', note: '' },
    { id: uid(), building: '4동', floor: 5, room: '557', ministry: '과학기술정보통신부', dept: '홍보담당관', type: '사무실', note: '' },
    { id: uid(), building: '4동', floor: 5, room: '533', ministry: '과학기술정보통신부', dept: '전국공무원노동조합', type: '사무실', note: '' },
    { id: uid(), building: '4동', floor: 5, room: '534', ministry: '과학기술정보통신부', dept: '남자휴게실', type: '공통시설', note: '' },
    { id: uid(), building: '4동', floor: 5, room: '539', ministry: '과학기술정보통신부', dept: '여자휴게실', type: '공통시설', note: '' },

    // === 4동: 과학기술정보통신부 4층 ===
    { id: uid(), building: '4동', floor: 4, room: '409', ministry: '과학기술정보통신부', dept: '연구개발정책실장', type: '사무실', note: '' },
    { id: uid(), building: '4동', floor: 4, room: '411', ministry: '과학기술정보통신부', dept: '기초원천연구정책관 / 연구개발정책과 / 기초연구진흥과 / 원천기술과 / 우주기술과 / 우주개발과 / 원자력연구개발과 / 원자력정책관', type: '사무실', note: '' },
    { id: uid(), building: '4동', floor: 4, room: '408', ministry: '과학기술정보통신부', dept: '미래전략기술정책관 / 미래전략기술정책과 / 첨단바이오기술과 / 원자력연구개발과 / 핵융합에너지지원기술과 / 바이오융합혁신팀', type: '사무실', note: '' },
    { id: uid(), building: '4동', floor: 4, room: '404', ministry: '과학기술정보통신부', dept: '연구성과혁신관 / 연구성과혁신정책과 / 연구산업진흥과 / 지역과학기술진흥과 / 연구조직혁신과 / 연구인프라혁신과', type: '사무실', note: '' },
    { id: uid(), building: '4동', floor: 4, room: '421', ministry: '과학기술정보통신부', dept: '인공지능정책실장', type: '사무실', note: '' },
    { id: uid(), building: '4동', floor: 4, room: '424', ministry: '과학기술정보통신부', dept: '인공지능정책기획관 / 인공지능정책기획과 / 인공지능데이터정책과 / 인공지능인터넷네트워크과 / 디지털산업상생팀 / 인공지능신뢰성지원과', type: '사무실', note: '' },
    { id: uid(), building: '4동', floor: 4, room: '444', ministry: '과학기술정보통신부', dept: '인공지능인프라정책관 / 인공지능기술기반정책과 / 인공지능데이터정책과 / 인공지능클라우드혁신과 / 인공지능데이터활용과', type: '사무실', note: '' },
    { id: uid(), building: '4동', floor: 4, room: '431', ministry: '과학기술정보통신부', dept: '정보통신산업정책관실', type: '사무실', note: '' },
    { id: uid(), building: '4동', floor: 4, room: '430', ministry: '과학기술정보통신부', dept: '정보통신정책관 / 정보통신산업정책과 / 디지털사회기획과 / 디지털신산업제도과 / 디지털포용정책과', type: '사무실', note: '' },
    { id: uid(), building: '4동', floor: 4, room: '420', ministry: '과학기술정보통신부', dept: '소프트웨어정책관 / 소프트웨어정책과 / 소프트웨어산업과 / 디지털콘텐츠과', type: '사무실', note: '' },
    { id: uid(), building: '4동', floor: 4, room: '417', ministry: '과학기술정보통신부', dept: '정보통신산업기반관 / 정보통신산업기반과 / 정보통신방송기술정책과', type: '사무실', note: '' },
    { id: uid(), building: '4동', floor: 4, room: '447', ministry: '과학기술정보통신부', dept: '전산실', type: '공통시설', note: '' },
    { id: uid(), building: '4동', floor: 4, room: '433', ministry: '과학기술정보통신부', dept: '국가공무원노동조합', type: '사무실', note: '' },
    { id: uid(), building: '4동', floor: 4, room: '434', ministry: '과학기술정보통신부', dept: '남자휴게실', type: '공통시설', note: '' },
    { id: uid(), building: '4동', floor: 4, room: '439', ministry: '과학기술정보통신부', dept: '여자휴게실', type: '공통시설', note: '' },
    { id: uid(), building: '4동', floor: 4, room: '455', ministry: '과학기술정보통신부', dept: '복합커뮤니티', type: '공통시설', note: '' },
    { id: uid(), building: '4동', floor: 4, room: '457', ministry: '과학기술정보통신부', dept: '강당', type: '공통시설', note: '' },

    // === 4동: 과학기술정보통신부 3층 ===
    { id: uid(), building: '4동', floor: 3, room: '323', ministry: '과학기술정보통신부', dept: '대변인실', type: '사무실', note: '' },
    { id: uid(), building: '4동', floor: 3, room: '327', ministry: '과학기술정보통신부', dept: '기자실 / 브리핑룸', type: '공통시설', note: '' },
  ];
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ============================================================
// 2. UI 초기화
// ============================================================

function init() {
  loadData();
  setupTabs();
  setupSearch();
  setupUpload();
  setupDatabase();
  setupSettings();
  setupModals();
  setupPasswordModal();
  refreshAllSelects();
  updateDbStats();
  renderQuickMinistries();
  checkApiKeyStatus();
}

// ---- 탭 전환 ----
function setupTabs() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + tab).classList.add('active');
      if (tab === 'database') renderDbTable();
      if (tab === 'settings') {
        renderSettings();
        renderBackups();
      }
    });
  });
}

// ============================================================
// 3. 검색 기능
// ============================================================

function setupSearch() {
  const btnSearch = document.getElementById('btn-search');
  const keyword = document.getElementById('search-keyword');
  btnSearch.addEventListener('click', doSearch);
  keyword.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  document.getElementById('btn-export-results').addEventListener('click', exportResults);
}

function doSearch() {
  const building = document.getElementById('search-building').value.trim();
  const ministry = document.getElementById('search-ministry').value.trim();
  const keyword = document.getElementById('search-keyword').value.trim().toLowerCase();

  const results = appState.records.filter(r => {
    const bMatch = !building || r.building === building;
    const mMatch = !ministry || r.ministry === ministry;
    const kMatch = !keyword || (
      r.dept?.toLowerCase().includes(keyword) ||
      r.room?.toLowerCase().includes(keyword) ||
      r.ministry?.toLowerCase().includes(keyword) ||
      r.note?.toLowerCase().includes(keyword)
    );
    return bMatch && mMatch && kMatch;
  });

  const placeholder = document.getElementById('search-placeholder');
  const resultsEl = document.getElementById('search-results');
  const emptyEl = document.getElementById('search-empty');
  const grid = document.getElementById('results-grid');

  placeholder.classList.add('hidden');

  if (results.length === 0) {
    resultsEl.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
  resultsEl.classList.remove('hidden');
  document.getElementById('result-count').textContent = `검색 결과 ${results.length}건`;

  grid.innerHTML = '';
  results.forEach(r => {
    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = `
      <div class="result-card-header">
        <span class="result-ministry">${esc(r.ministry)}</span>
        <span class="building-pill">${esc(r.building)}</span>
      </div>
      <div class="result-location">${esc(r.room)}호</div>
      <div class="result-dept">${highlightKeyword(esc(r.dept), document.getElementById('search-keyword').value)}</div>
      <div class="result-meta">
        <span>🏢 ${esc(r.building)}</span>
        <span>📶 ${r.floor}층</span>
        ${r.type !== '사무실' ? `<span class="type-badge type-${r.type}">${esc(r.type)}</span>` : ''}
      </div>
      ${r.note ? `<div style="margin-top:8px;font-size:12px;color:var(--text-muted)">${esc(r.note)}</div>` : ''}
    `;
    grid.appendChild(card);
  });

  appState.filtered = results;
}

function highlightKeyword(text, keyword) {
  if (!keyword) return text;
  const k = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(k, 'gi'), m => `<mark style="background:#fef08a;border-radius:2px">${m}</mark>`);
}

function renderQuickMinistries() {
  const ministries = [...new Set(appState.records.map(r => r.ministry))].slice(0, 12);
  const container = document.getElementById('quick-ministries');
  container.innerHTML = ministries.map(m =>
    `<button class="quick-tag" onclick="quickSearch('${m}')">${esc(m)}</button>`
  ).join('');
}

function quickSearch(ministry) {
  document.getElementById('search-ministry').value = ministry;
  doSearch();
}

function exportResults() {
  const data = appState.filtered || appState.records;
  exportToExcel(data, '검색결과');
}

// ============================================================
// 4. 사진 업로드 & AI 분석
// ============================================================

function setupUpload() {
  const zone = document.getElementById('upload-zone');
  const fileInput = document.getElementById('file-input');

  // Drag & Drop
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener('change', () => handleFiles(fileInput.files));

  document.getElementById('btn-analyze-all').addEventListener('click', () => {
    requirePassword(() => analyzeAll());
  });
  document.getElementById('btn-clear-queue').addEventListener('click', clearQueue);
  document.getElementById('btn-save-extracted').addEventListener('click', saveExtracted);
  document.getElementById('btn-export-extracted').addEventListener('click', () => {
    exportToExcel(appState.extractedRows, '추출데이터');
  });
  document.getElementById('btn-add-analysis-row').addEventListener('click', addAnalysisRow);
  document.getElementById('btn-save-analysis').addEventListener('click', saveAnalysisResult);
}

function handleFiles(files) {
  Array.from(files).forEach(file => {
    if (!file.type.startsWith('image/')) return;
    const item = {
      id: uid(),
      file,
      name: file.name,
      url: URL.createObjectURL(file),
      status: 'pending',
      extractedBuilding: guessBuilding(file.name),
      extractedData: [],
    };
    appState.uploadQueue.push(item);
  });
  renderQueue();
}

function guessBuilding(filename) {
  // 파일명에서 동 번호 추출: "6동_3층.jpg", "14동.jpg", "국토부6층.jpg" 등
  const patterns = [
    /(\d+)동/,
    /(\d+)f/i,
  ];
  for (const p of patterns) {
    const m = filename.match(p);
    if (m) {
      const num = parseInt(m[1]);
      if (num >= 1 && num <= 15) return `${num}동`;
    }
  }
  return '';
}

function renderQueue() {
  const queueEl = document.getElementById('upload-queue');
  const list = document.getElementById('queue-list');
  document.getElementById('queue-count').textContent = appState.uploadQueue.length;

  if (appState.uploadQueue.length > 0) queueEl.classList.remove('hidden');
  else { queueEl.classList.add('hidden'); return; }

  list.innerHTML = '';
  appState.uploadQueue.forEach(item => {
    const el = document.createElement('div');
    el.className = `queue-item ${item.status}`;
    el.innerHTML = `
      <img class="queue-img" src="${item.url}" alt="${esc(item.name)}" />
      <div class="queue-info">
        <div class="queue-name" title="${esc(item.name)}">${esc(item.name)}</div>
        <div class="queue-meta">${item.extractedBuilding || '동 미감지'} · ${formatBytes(item.file.size)}</div>
        <div class="queue-actions-row">
          <span class="queue-status ${item.status}">${statusLabel(item.status)}</span>
          <button class="btn-sm btn-outline" style="padding:3px 8px;font-size:11px" onclick="analyzeSingle('${item.id}')">분석</button>
          <button class="btn-sm" style="padding:3px 8px;font-size:11px;background:none;border:none;cursor:pointer;color:var(--danger)" onclick="removeQueue('${item.id}')">✕</button>
        </div>
      </div>
    `;
    list.appendChild(el);
  });
}

function statusLabel(s) {
  const map = { pending: '대기', analyzing: '분석중', done: '완료', error: '오류' };
  return map[s] || s;
}
function formatBytes(b) { if (b < 1024) return b + 'B'; if (b < 1048576) return (b/1024).toFixed(1)+'KB'; return (b/1048576).toFixed(1)+'MB'; }

function removeQueue(id) {
  appState.uploadQueue = appState.uploadQueue.filter(x => x.id !== id);
  renderQueue();
}

function clearQueue() {
  appState.uploadQueue = [];
  appState.extractedRows = [];
  renderQueue();
  document.getElementById('extracted-data').classList.add('hidden');
}

async function analyzeAll() {
  const pending = appState.uploadQueue.filter(x => x.status === 'pending');
  if (pending.length === 0) { toast('분석할 사진이 없습니다', 'warning'); return; }
  for (const item of pending) {
    await analyzeSingle(item.id);
  }
}

function analyzeSingle(id) {
  requirePassword(() => _doAnalyzeSingle(id));
}

async function _doAnalyzeSingle(id) {
  const item = appState.uploadQueue.find(x => x.id === id);
  if (!item) return;

  const apiKey = appState.settings.apiKey;
  if (!apiKey) {
    toast('API 키를 먼저 설정해주세요 (설정 탭)', 'warning');
    return;
  }

  item.status = 'analyzing';
  renderQueue();

  try {
    const base64 = await fileToBase64(item.file);
    const result = await callGeminiVision(apiKey, base64, item.file.type);
    item.extractedData = result;
    item.status = 'done';
    toast(`${item.name} 분석 완료 (${result.length}건)`, 'success');
    openAnalysisModal(item);
  } catch(e) {
    item.status = 'error';
    toast(`분석 실패: ${e.message}`, 'error');
  }
  renderQueue();
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function callGeminiVision(apiKey, base64, mimeType) {
  const prompt = `이 사진은 대한민국 정부청사 엘리베이터 옆 안내판 사진입니다.
사진에서 부처명과 각 호실별 과/팀/실/관 이름을 모두 추출해주세요.

반드시 JSON 배열로만 응답하세요. 다른 텍스트 없이 JSON만 출력하세요.
각 항목의 형식:
{
  "floor": 층 번호(숫자, 모르면 null),
  "room": "호실 번호(예: 352)",
  "ministry": "부처명",
  "dept": "부서/과/팀명 (여러 개면 / 로 구분)",
  "type": "사무실 또는 공통시설 또는 회의실 또는 기타"
}

예시:
[
  {"floor": 3, "room": "352", "ministry": "국토교통부", "dept": "자동차정책관 / 자동차정책과", "type": "사무실"},
  {"floor": 7, "room": "703", "ministry": "재정경제부", "dept": "공용회의실", "type": "공통시설"}
]

공통시설(회의실, 휴게실, 강당 등)도 포함해서 모두 추출하세요.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64 } }
          ]
        }],
        generationConfig: { temperature: 0.1, response_mime_type: 'application/json' }
      })
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'API 오류');
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // JSON 파싱 실패 시 텍스트에서 JSON 부분 추출 시도
    const match = text.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
    return [];
  }
}

// ---- Analysis Modal ----
function openAnalysisModal(item) {
  appState.analysisModalItem = item;
  const modal = document.getElementById('modal-analysis');
  document.getElementById('analysis-preview-img').src = item.url;

  // 동 선택
  const bldSelect = document.getElementById('analysis-building');
  bldSelect.innerHTML = '<option value="">동 선택...</option>' +
    appState.buildings.map(b => `<option value="${esc(b.name)}" ${b.name === item.extractedBuilding ? 'selected' : ''}>${esc(b.name)} - ${esc(b.desc)}</option>`).join('');

  renderAnalysisTable(item.extractedData);
  modal.classList.remove('hidden');
}

function renderAnalysisTable(rows) {
  const tbody = document.getElementById('analysis-result-tbody');
  tbody.innerHTML = '';
  rows.forEach((row, idx) => {
    const tr = document.createElement('tr');
    tr.dataset.idx = idx;
    tr.innerHTML = `
      <td class="editable-cell"><input type="number" value="${row.floor ?? ''}" placeholder="층" data-field="floor" /></td>
      <td class="editable-cell"><input type="text" value="${esc(row.room ?? '')}" placeholder="호실" data-field="room" /></td>
      <td class="editable-cell"><input type="text" value="${esc(row.ministry ?? '')}" placeholder="부처명" data-field="ministry" /></td>
      <td class="editable-cell" style="min-width:180px"><input type="text" value="${esc(row.dept ?? '')}" placeholder="부서/과명" data-field="dept" /></td>
      <td class="editable-cell">
        <select data-field="type" style="border:1px solid var(--border);border-radius:4px;padding:4px;font-size:12px;font-family:var(--font)">
          <option ${row.type==='사무실'?'selected':''}>사무실</option>
          <option ${row.type==='공통시설'?'selected':''}>공통시설</option>
          <option ${row.type==='회의실'?'selected':''}>회의실</option>
          <option ${row.type==='기타'?'selected':''}>기타</option>
        </select>
      </td>
      <td><button onclick="removeAnalysisRow(${idx})" style="background:none;border:none;cursor:pointer;color:var(--danger);font-size:16px">✕</button></td>
    `;
    // Sync inputs back to data
    tr.querySelectorAll('[data-field]').forEach(input => {
      input.addEventListener('change', () => {
        const i = parseInt(tr.dataset.idx);
        const f = input.dataset.field;
        appState.analysisModalItem.extractedData[i][f] = input.value;
      });
    });
    tbody.appendChild(tr);
  });
}

function addAnalysisRow() {
  if (!appState.analysisModalItem) return;
  appState.analysisModalItem.extractedData.push({ floor: null, room: '', ministry: '', dept: '', type: '사무실' });
  renderAnalysisTable(appState.analysisModalItem.extractedData);
}

function removeAnalysisRow(idx) {
  if (!appState.analysisModalItem) return;
  appState.analysisModalItem.extractedData.splice(idx, 1);
  renderAnalysisTable(appState.analysisModalItem.extractedData);
}

function saveAnalysisResult() {
  const item = appState.analysisModalItem;
  if (!item) return;
  const building = document.getElementById('analysis-building').value;
  if (!building) { toast('동을 선택해주세요', 'warning'); return; }

  // Read current table values
  const tbody = document.getElementById('analysis-result-tbody');
  const rows = [];
  tbody.querySelectorAll('tr').forEach(tr => {
    const inputs = tr.querySelectorAll('[data-field]');
    const row = {};
    inputs.forEach(inp => { row[inp.dataset.field] = inp.value; });
    if (row.dept || row.room) rows.push(row);
  });

  let added = 0;
  rows.forEach(row => {
    if (!row.dept && !row.room) return;
    const record = {
      id: uid(),
      building,
      floor: parseInt(row.floor) || extractFloorFromRoom(row.room, building),
      room: row.room || '',
      ministry: row.ministry || '',
      dept: row.dept || '',
      type: row.type || '사무실',
      note: '',
      updatedAt: Date.now(),
    };
    appState.records.push(record);
    added++;
  });

  saveData();
  closeModal('modal-analysis');
  toast(`${added}건이 데이터베이스에 저장되었습니다`, 'success');
  updateDbStats();
  refreshAllSelects();
  renderQuickMinistries();
  item.status = 'done';
}

function extractFloorFromRoom(room, building) {
  if (!room) return null;
  const num = parseInt(room);
  if (isNaN(num)) return null;
  // 호실 첫 자리(들)이 층 번호
  const s = String(num);
  if (s.length === 3) return parseInt(s[0]);
  if (s.length === 4) return parseInt(s.slice(0, 2));
  return null;
}

function saveExtracted() {
  // 추출 테이블에서 직접 저장
  const rows = appState.extractedRows;
  if (!rows.length) { toast('저장할 데이터가 없습니다', 'warning'); return; }
  rows.forEach(r => {
    if (!appState.records.find(x => x.id === r.id)) {
      appState.records.push({ ...r });
    }
  });
  saveData();
  toast(`${rows.length}건 저장 완료`, 'success');
  updateDbStats();
  refreshAllSelects();
}

// ============================================================
// 5. 데이터베이스 관리
// ============================================================

function setupDatabase() {
  document.getElementById('btn-add-row').addEventListener('click', () => openRowModal(null));
  document.getElementById('btn-export-all').addEventListener('click', () => exportToExcel(appState.records, '전체데이터'));
  document.getElementById('btn-download-template').addEventListener('click', downloadTemplate);
  document.getElementById('excel-import-input').addEventListener('change', importExcel);
  document.getElementById('btn-filter').addEventListener('click', applyDbFilter);
  document.getElementById('btn-filter-reset').addEventListener('click', resetDbFilter);
  document.getElementById('select-all-db').addEventListener('change', toggleSelectAll);
  document.getElementById('btn-delete-selected').addEventListener('click', deleteSelected);
  document.getElementById('filter-keyword').addEventListener('keydown', e => { if (e.key === 'Enter') applyDbFilter(); });
}

let dbFilteredRecords = null;

function applyDbFilter() {
  const building = document.getElementById('filter-building').value;
  const ministry = document.getElementById('filter-ministry').value;
  const keyword = document.getElementById('filter-keyword').value.toLowerCase().trim();
  dbFilteredRecords = appState.records.filter(r => {
    const b = !building || r.building === building;
    const m = !ministry || r.ministry === ministry;
    const k = !keyword || r.dept?.toLowerCase().includes(keyword) || r.room?.includes(keyword) || r.ministry?.toLowerCase().includes(keyword);
    return b && m && k;
  });
  appState.currentPage = 1;
  renderDbTable();
}

function resetDbFilter() {
  document.getElementById('filter-building').value = '';
  document.getElementById('filter-ministry').value = '';
  document.getElementById('filter-keyword').value = '';
  dbFilteredRecords = null;
  appState.currentPage = 1;
  renderDbTable();
}

function renderDbTable() {
  const records = dbFilteredRecords || appState.records;
  const tbody = document.getElementById('db-tbody');
  const empty = document.getElementById('db-empty');
  const tableEl = document.getElementById('db-table');
  const { currentPage, pageSize } = appState;

  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  const pageRecords = records.slice(start, end);

  if (records.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    tableEl.querySelector('thead').classList.add('hidden');
  } else {
    empty.classList.add('hidden');
    tableEl.querySelector('thead').classList.remove('hidden');
    tbody.innerHTML = '';
    pageRecords.forEach(r => {
      const tr = document.createElement('tr');
      tr.dataset.id = r.id;
      const timeStr = r.updatedAt ? formatDateTime(r.updatedAt) : '-';
      tr.innerHTML = `
        <td><input type="checkbox" class="row-checkbox" data-id="${r.id}" /></td>
        <td><span class="building-pill" style="font-size:11px">${esc(r.building)}</span></td>
        <td>${r.floor ?? '-'}층</td>
        <td><strong>${esc(r.room)}</strong>호</td>
        <td>${esc(r.ministry)}</td>
        <td style="max-width:300px">${esc(r.dept)}</td>
        <td><span class="type-badge type-${r.type || '사무실'}">${esc(r.type || '사무실')}</span></td>
        <td style="color:var(--text-muted);font-size:12px">${esc(r.note || '')}</td>
        <td style="font-size:11px;color:var(--text-muted);white-space:nowrap">${timeStr}</td>
        <td>
          <button class="btn-sm btn-outline" style="padding:4px 8px;font-size:11px" onclick="openRowModal('${r.id}')">수정</button>
          <button class="btn-sm btn-danger" style="padding:4px 8px;font-size:11px;margin-left:4px" onclick="confirmDelete('${r.id}')">삭제</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
    // Checkbox change
    tbody.querySelectorAll('.row-checkbox').forEach(cb => {
      cb.addEventListener('change', updateSelectedActions);
    });
  }

  renderPagination(records.length);
  updateDbStats();
}

function renderPagination(total) {
  const { currentPage, pageSize } = appState;
  const pages = Math.ceil(total / pageSize);
  const pg = document.getElementById('pagination');
  pg.innerHTML = '';
  if (pages <= 1) return;

  const maxPages = 7;
  let start = Math.max(1, currentPage - 3);
  let end = Math.min(pages, start + maxPages - 1);
  start = Math.max(1, end - maxPages + 1);

  if (start > 1) {
    addPageBtn(pg, 1, currentPage);
    if (start > 2) pg.insertAdjacentHTML('beforeend', '<span style="padding:0 4px;color:var(--text-muted)">…</span>');
  }
  for (let i = start; i <= end; i++) addPageBtn(pg, i, currentPage);
  if (end < pages) {
    if (end < pages - 1) pg.insertAdjacentHTML('beforeend', '<span style="padding:0 4px;color:var(--text-muted)">…</span>');
    addPageBtn(pg, pages, currentPage);
  }
}

function addPageBtn(container, page, current) {
  const btn = document.createElement('button');
  btn.className = 'page-btn' + (page === current ? ' active' : '');
  btn.textContent = page;
  btn.onclick = () => { appState.currentPage = page; renderDbTable(); };
  container.appendChild(btn);
}

function toggleSelectAll(e) {
  document.querySelectorAll('.row-checkbox').forEach(cb => { cb.checked = e.target.checked; });
  updateSelectedActions();
}

function updateSelectedActions() {
  const checked = document.querySelectorAll('.row-checkbox:checked');
  const panel = document.getElementById('selected-actions');
  document.getElementById('selected-count').textContent = `${checked.length}개 선택됨`;
  if (checked.length > 0) panel.classList.remove('hidden');
  else panel.classList.add('hidden');
}

function deleteSelected() {
  const ids = [...document.querySelectorAll('.row-checkbox:checked')].map(cb => cb.dataset.id);
  if (!ids.length) return;
  confirmAction(`선택한 ${ids.length}건을 삭제하시겠습니까?`, () => {
    appState.records = appState.records.filter(r => !ids.includes(r.id));
    if (dbFilteredRecords) dbFilteredRecords = dbFilteredRecords.filter(r => !ids.includes(r.id));
    saveData();
    renderDbTable();
    updateDbStats();
    refreshAllSelects();
    toast(`${ids.length}건 삭제 완료`, 'success');
  });
}

function confirmDelete(id) {
  const r = appState.records.find(x => x.id === id);
  if (!r) return;
  confirmAction(`"${r.dept}" (${r.building} ${r.room}호)를 삭제하시겠습니까?`, () => {
    appState.records = appState.records.filter(x => x.id !== id);
    if (dbFilteredRecords) dbFilteredRecords = dbFilteredRecords.filter(x => x.id !== id);
    saveData();
    renderDbTable();
    updateDbStats();
    refreshAllSelects();
    toast('삭제되었습니다', 'success');
  });
}

// ---- Row Modal (Add / Edit) ----
function openRowModal(id) {
  appState.editingId = id;
  const modal = document.getElementById('modal-row');
  const title = document.getElementById('modal-title');

  // Populate building select
  const bldSelect = document.getElementById('modal-building');
  bldSelect.innerHTML = '<option value="">선택...</option>' +
    appState.buildings.map(b => `<option value="${esc(b.name)}">${esc(b.name)} - ${esc(b.desc)}</option>`).join('');

  // Ministry datalist
  const ministries = [...new Set(appState.records.map(r => r.ministry))];
  document.getElementById('ministry-datalist').innerHTML = ministries.map(m => `<option value="${esc(m)}">`).join('');

  if (id) {
    title.textContent = '항목 수정';
    const r = appState.records.find(x => x.id === id);
    if (r) {
      document.getElementById('modal-building').value = r.building || '';
      document.getElementById('modal-floor').value = r.floor || '';
      document.getElementById('modal-room').value = r.room || '';
      document.getElementById('modal-ministry').value = r.ministry || '';
      document.getElementById('modal-dept').value = r.dept || '';
      document.getElementById('modal-type').value = r.type || '사무실';
      document.getElementById('modal-note').value = r.note || '';
    }
  } else {
    title.textContent = '항목 추가';
    document.getElementById('modal-building').value = '';
    document.getElementById('modal-floor').value = '';
    document.getElementById('modal-room').value = '';
    document.getElementById('modal-ministry').value = '';
    document.getElementById('modal-dept').value = '';
    document.getElementById('modal-type').value = '사무실';
    document.getElementById('modal-note').value = '';
  }
  modal.classList.remove('hidden');
}

function saveRowModal() {
  const building = document.getElementById('modal-building').value.trim();
  const floor = parseInt(document.getElementById('modal-floor').value) || null;
  const room = document.getElementById('modal-room').value.trim();
  const ministry = document.getElementById('modal-ministry').value.trim();
  const dept = document.getElementById('modal-dept').value.trim();
  const type = document.getElementById('modal-type').value;
  const note = document.getElementById('modal-note').value.trim();

  if (!building || !room || !ministry || !dept) {
    toast('동, 호실, 부처명, 부서명은 필수입니다', 'warning');
    return;
  }

  if (appState.editingId) {
    const r = appState.records.find(x => x.id === appState.editingId);
    if (r) { Object.assign(r, { building, floor, room, ministry, dept, type, note, updatedAt: Date.now() }); }
  } else {
    appState.records.push({ id: uid(), building, floor, room, ministry, dept, type, note, updatedAt: Date.now() });
  }
  saveData();
  closeModal('modal-row');
  renderDbTable();
  updateDbStats();
  refreshAllSelects();
  renderQuickMinistries();
  toast(appState.editingId ? '수정 완료' : '추가 완료', 'success');
}

// ============================================================
// 6. Excel 가져오기/내보내기
// ============================================================

function exportToExcel(records, sheetName = '데이터') {
  const rows = [['동', '층', '호실', '부처명', '부서/과명', '유형', '비고', '수정일시']];
  records.forEach(r => {
    const timeStr = r.updatedAt ? formatDateTime(r.updatedAt) : '-';
    rows.push([r.building, r.floor, r.room, r.ministry, r.dept, r.type || '사무실', r.note || '', timeStr]);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [10, 6, 10, 16, 40, 10, 20, 20].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `정부청사_${sheetName}_${dateStr()}.xlsx`);
  toast('Excel 파일이 다운로드되었습니다', 'success');
}

function downloadTemplate() {
  const rows = [
    ['동', '층', '호실', '부처명', '부서/과명', '유형', '비고'],
    ['6동', 3, '352', '국토교통부', '자동차정책관 / 자동차정책과', '사무실', ''],
    ['7동', 7, '701', '재정경제부', '입법심의관 리서치팀', '사무실', ''],
    ['14동', 14, '1401', '행정안전부', '휴게실', '공통시설', ''],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [10, 6, 10, 16, 40, 10, 20].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '입력양식');
  XLSX.writeFile(wb, '정부청사_입력양식.xlsx');
  toast('양식이 다운로드되었습니다', 'success');
}

function importExcel(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = evt => {
    try {
      const wb = XLSX.read(evt.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const headers = data[0];

      // Column index mapping (flexible)
      const colMap = {};
      const fieldAliases = {
        building: ['동', '동번호', 'building'],
        floor: ['층', '층수', 'floor'],
        room: ['호실', '호', 'room'],
        ministry: ['부처명', '부처', '기관명', 'ministry'],
        dept: ['부서/과명', '과명', '부서명', '부서', 'dept', 'department'],
        type: ['유형', 'type'],
        note: ['비고', 'note'],
      };
      Object.entries(fieldAliases).forEach(([field, aliases]) => {
        const idx = headers.findIndex(h => aliases.includes(String(h).trim()));
        if (idx !== -1) colMap[field] = idx;
      });

      let added = 0, skipped = 0;
      data.slice(1).forEach(row => {
        if (!row.length || !row[colMap.dept] && !row[colMap.room]) { skipped++; return; }
        const record = {
          id: uid(),
          building: String(row[colMap.building] ?? '').trim(),
          floor: parseInt(row[colMap.floor]) || null,
          room: String(row[colMap.room] ?? '').trim(),
          ministry: String(row[colMap.ministry] ?? '').trim(),
          dept: String(row[colMap.dept] ?? '').trim(),
          type: String(row[colMap.type] ?? '사무실').trim() || '사무실',
          note: String(row[colMap.note] ?? '').trim(),
          updatedAt: Date.now(),
        };
        if (record.dept || record.room) { appState.records.push(record); added++; }
        else skipped++;
      });

      saveData();
      renderDbTable();
      updateDbStats();
      refreshAllSelects();
      renderQuickMinistries();
      toast(`Excel 가져오기 완료: ${added}건 추가, ${skipped}건 건너뜀`, 'success');
    } catch (err) {
      toast('Excel 파일 읽기 오류: ' + err.message, 'error');
    }
    e.target.value = '';
  };
  reader.readAsArrayBuffer(file);
}

function dateStr() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}

// ============================================================
// 7. 설정 탭
// ============================================================

function setupSettings() {
  document.getElementById('btn-save-api-key').addEventListener('click', () => {
    const key = document.getElementById('api-key-input').value.trim();
    if (key === '****************') {
      toast('API 키가 이미 저장되어 있습니다', 'info');
      return;
    }
    appState.settings.apiKey = key;
    saveSettings();
    checkApiKeyStatus();
    renderSettings();
    toast(key ? 'API 키가 저장되었습니다' : 'API 키가 삭제되었습니다', 'success');
  });

  document.getElementById('btn-reset-buildings').addEventListener('click', () => {
    appState.buildings = [...DEFAULT_BUILDINGS];
    saveBuildings();
    renderSettings();
    refreshAllSelects();
    toast('기본 동 목록으로 초기화되었습니다', 'success');
  });

  document.getElementById('btn-reset-all').addEventListener('click', () => {
    confirmAction('⚠️ 전체 데이터를 초기화하면 되돌릴 수 없습니다. 정말로 삭제하시겠습니까?', () => {
      requirePassword(() => {
        appState.records = [];
        dbFilteredRecords = null;
        saveData();
        renderDbTable();
        updateDbStats();
        refreshAllSelects();
        renderQuickMinistries();
        toast('전체 데이터가 초기화되었습니다', 'warning');
      }, true, '전체 데이터 초기화', '데이터 초기화를 위해 관리자 비밀번호를 입력해주세요.');
    });
  });
}

function renderSettings() {
  // API Key - mask the key to prevent copy/pasting or viewing
  const keyInput = document.getElementById('api-key-input');
  if (appState.settings.apiKey) {
    keyInput.value = '****************';
  } else {
    keyInput.value = '';
  }
  // Buildings
  const list = document.getElementById('buildings-list');
  list.innerHTML = appState.buildings.map(b =>
    `<div class="building-tag"><span>${esc(b.name)} - ${esc(b.desc)}</span></div>`
  ).join('');
}

function checkApiKeyStatus() {
  const card = document.getElementById('api-key-card');
  if (appState.settings.apiKey) card.classList.add('hidden');
  else card.classList.remove('hidden');
}

// ---- 데이터 자동 백업 및 복구 ----
function createBackup() {
  try {
    const backupsJson = localStorage.getItem('gov_directory_backups');
    let backups = backupsJson ? JSON.parse(backupsJson) : [];

    const now = Date.now();

    // 중복 방지: 마지막 백업과 현재 레코드가 완전히 동일하면 스킵
    if (backups.length > 0) {
      const last = backups[0];
      if (JSON.stringify(last.records) === JSON.stringify(appState.records)) {
        return;
      }
    }

    backups.unshift({
      timestamp: now,
      records: JSON.parse(JSON.stringify(appState.records))
    });

    // 최대 10개로 제한
    if (backups.length > 10) {
      backups = backups.slice(0, 10);
    }

    localStorage.setItem('gov_directory_backups', JSON.stringify(backups));
    renderBackups();
  } catch (e) {
    console.error('백업 실패', e);
  }
}

function renderBackups() {
  const list = document.getElementById('backup-list');
  if (!list) return;

  try {
    const backupsJson = localStorage.getItem('gov_directory_backups');
    const backups = backupsJson ? JSON.parse(backupsJson) : [];

    if (backups.length === 0) {
      list.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:12px; font-size:13px; margin:0;">백업 기록이 없습니다.</p>';
      return;
    }

    list.innerHTML = backups.map(b => {
      const date = new Date(b.timestamp);
      const timeStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}:${String(date.getSeconds()).padStart(2,'0')}`;
      return `
        <div class="backup-item" style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:var(--bg-light); border-radius:6px; border:1px solid var(--border);">
          <div style="display:flex; flex-direction:column; gap:2px;">
            <span style="font-size:13px; font-weight:600; color:var(--text);">${timeStr}</span>
            <span style="font-size:11px; color:var(--text-muted);">저장된 항목 수: ${b.records.length}개</span>
          </div>
          <button class="btn-sm btn-primary" onclick="restoreBackup(${b.timestamp})" style="padding:4px 8px; font-size:11px;">복구</button>
        </div>
      `;
    }).join('');
  } catch (e) {
    list.innerHTML = '<p style="text-align:center; color:var(--danger); padding:12px; font-size:13px;">백업 목록 로드 오류</p>';
  }
}

function restoreBackup(timestamp) {
  try {
    const backupsJson = localStorage.getItem('gov_directory_backups');
    if (!backupsJson) return;
    const backups = JSON.parse(backupsJson);
    const backup = backups.find(b => b.timestamp === timestamp);
    if (!backup) return;

    const date = new Date(backup.timestamp);
    const timeStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}:${String(date.getSeconds()).padStart(2,'0')}`;

    confirmAction(`⚠️ ${timeStr} 시점의 데이터로 복구하시겠습니까?\n현재 데이터는 백업 데이터로 덮어씌워집니다.`, () => {
      requirePassword(() => {
        appState.records = JSON.parse(JSON.stringify(backup.records));
        // 복구 직후 새로운 백업이 중복 생성되는 것 방지
        localStorage.setItem(DB_KEY, JSON.stringify(appState.records));

        dbFilteredRecords = null;
        renderDbTable();
        updateDbStats();
        refreshAllSelects();
        renderQuickMinistries();
        renderBackups();
        toast(`${timeStr} 시점으로 복구 완료`, 'success');
      }, true, '데이터 복구', '데이터 복구를 위해 관리자 비밀번호를 입력해주세요.');
    });
  } catch (e) {
    toast('복구 실패: ' + e.message, 'error');
  }
}

// 전역 스코프에 노출시켜 HTML onclick 속성에서 접근할 수 있도록 함
window.restoreBackup = restoreBackup;

// ============================================================
// 8. 공통 유틸리티
// ============================================================

function updateDbStats() {
  const r = appState.records;
  document.getElementById('stat-total').textContent = r.length.toLocaleString();
  document.getElementById('stat-ministries').textContent = new Set(r.map(x => x.ministry)).size;
  document.getElementById('stat-buildings').textContent = new Set(r.map(x => x.building)).size;
}

function refreshAllSelects() {
  const buildings = [...new Set(appState.records.map(r => r.building))].sort();
  const ministries = [...new Set(appState.records.map(r => r.ministry))].sort();

  const buildingSelects = ['search-building', 'filter-building'];
  const ministrySelects = ['search-ministry', 'filter-ministry'];

  buildingSelects.forEach(id => {
    const el = document.getElementById(id);
    const cur = el.value;
    el.innerHTML = `<option value="">전체 동</option>` + buildings.map(b => `<option value="${esc(b)}">${esc(b)}</option>`).join('');
    el.value = cur;
  });
  ministrySelects.forEach(id => {
    const el = document.getElementById(id);
    const cur = el.value;
    el.innerHTML = `<option value="">전체 부처</option>` + ministries.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
    el.value = cur;
  });
}

// ---- Modal Helpers ----
function setupModals() {
  document.getElementById('btn-modal-save').addEventListener('click', saveRowModal);
  // Close on backdrop
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay.id); });
  });
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function confirmAction(message, onOk) {
  document.getElementById('confirm-message').textContent = message;
  document.getElementById('modal-confirm').classList.remove('hidden');
  const btn = document.getElementById('btn-confirm-ok');
  btn.onclick = () => { closeModal('modal-confirm'); onOk(); };
}

// ---- Toast ----
function toast(msg, type = 'info') {
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type] || ''}</span><span>${esc(msg)}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'slideDown .3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

// ---- Escape HTML ----
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function formatDateTime(ts) {
  if (!ts) return '-';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '-';
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

// ============================================================
// 9. 비밀번호 게이트 함수
// ============================================================

/**
 * AI 분석이 필요한 동작 실행 전 비밀번호 확인
 * @param {Function} callback - 인증 성공 시 실행할 함수
 */
function requirePassword(callback, force = false, title = '', desc = '') {
  if (passwordUnlocked && !force) {
    // 이미 인증된 세션이고 강제 인증이 아니면 바로 실행
    callback();
    return;
  }
  passwordCallback = callback;
  openPasswordModal(title, desc);
}

function openPasswordModal(title = '', desc = '') {
  const modal = document.getElementById('modal-password');
  const input = document.getElementById('password-input');
  const err = document.getElementById('password-error');

  const titleEl = modal.querySelector('p[style*="font-size:15px"]');
  const descEl = modal.querySelector('p[style*="font-size:13px"]');
  if (titleEl) {
    titleEl.textContent = title || 'AI 분석 기능 접근';
  }
  if (descEl) {
    descEl.textContent = desc || '이 기능은 관리자 전용입니다. 비밀번호를 입력하세요.';
  }

  input.value = '';
  err.classList.add('hidden');
  modal.classList.remove('hidden');
  setTimeout(() => input.focus(), 100);
}

function closePasswordModal() {
  document.getElementById('modal-password').classList.add('hidden');
  document.getElementById('password-input').value = '';
  document.getElementById('password-error').classList.add('hidden');
  passwordCallback = null;
}

function verifyPassword() {
  const input = document.getElementById('password-input');
  const err = document.getElementById('password-error');
  const val = input.value;

  if (val === CORRECT_PASSWORD) {
    passwordUnlocked = true;
    document.getElementById('modal-password').classList.add('hidden');
    err.classList.add('hidden');
    toast('인증 완료! AI 분석을 시작합니다', 'success');
    if (passwordCallback) {
      const cb = passwordCallback;
      passwordCallback = null;
      cb();
    }
  } else {
    err.classList.remove('hidden');
    // 흔들기 애니메이션
    input.style.animation = 'none';
    input.offsetHeight; // reflow
    input.style.animation = 'shake 0.4s ease';
    input.value = '';
    input.focus();
  }
}

function setupPasswordModal() {
  const confirmBtn = document.getElementById('btn-password-confirm');
  const input = document.getElementById('password-input');
  const toggleBtn = document.getElementById('btn-toggle-pw');

  confirmBtn.addEventListener('click', verifyPassword);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') verifyPassword(); });
  toggleBtn.addEventListener('click', () => {
    input.type = input.type === 'password' ? 'text' : 'password';
    toggleBtn.textContent = input.type === 'password' ? '👁' : '🙈';
  });

  // 배경 클릭 시 닫기
  document.getElementById('modal-password').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-password')) closePasswordModal();
  });
}

// ============================================================
// Start
// ============================================================
document.addEventListener('DOMContentLoaded', init);
