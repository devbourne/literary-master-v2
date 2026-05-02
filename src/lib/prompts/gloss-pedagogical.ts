// v2.5 Multi-Gloss Angle 3 — Korean reader pedagogical gloss.
// gemma4 (Korean depth + cultural knowledge). JSON-structured for clean
// downstream consumption.

import type { WorkProfile } from "../schemas/profile";

export interface PedagogicalGlossPromptInput {
  text: string;
  profile: WorkProfile;
  glossarySection?: string;
}

export function buildPedagogicalGlossPrompt(
  input: PedagogicalGlossPromptInput,
): string {
  const sample = input.text.slice(0, 8000);
  return `당신은 한국 독자에게 영미 문학을 가르치는 교사입니다. 이 작품을 한국 학생·일반 독자가 깊이 있게 읽도록 돕는 **학습자 specific scaffolding** 을 작성하세요.

## 작품 정보
- 제목: ${input.profile.title || "(미상)"}
- 작가: ${input.profile.author || "(미상)"}
- 시대: ${input.profile.meta.era || "(미상)"}
${input.glossarySection ? `\n${input.glossarySection}\n` : ""}
## 본문
${sample}

## 과제

세 가지 항목을 작성:

### 1. 문화적 함정 (cultural_pitfalls_ko)
한국 독자가 이 작품에서 **놓치기 쉬운 문화·역사 맥락** 을 한국어 산문으로 정리.
- 작품의 시대·사회 배경 중 한국 독자에게 낯선 것
- 종교·신화·역사 reference 가 영어권 독자에게 자연스러우나 한국 독자에겐 추가 설명 필요한 것
- 화폐 단위, 사회 계급, 제도 같은 *암시적 의미* (예: "주당 8달러 가구 임대료" 의 빈곤 감각)
- 3-5 문장 분량.

### 2. 한국 문학 비교 (korean_literature_parallels_ko)
이 작품의 **정서·구조·주제와 비슷한 한국 문학 작품** 1-3편을 들어 짧게 비교.
- 작가, 작품명, 어떤 측면에서 비슷한지 명시
- 표면적 유사가 아니라 **구조적·정서적 共鳴** 짚기
- 2-4 문장 분량.

### 3. 토론 질문 (discussion_questions_ko)
한국 학생 reading group / 수업에서 사용 가능한 **깊이 있는 토론 질문 3개**:
- 작품 표면을 넘어선 해석 차이 surface 가능한 질문
- "예/아니오" 단답 안 됨. open-ended.
- 한 문장씩.

## 출력

**순수 JSON 객체 하나만**. 코드 펜스, 설명 절대 금지.

{
  "cultural_pitfalls_ko": "...",
  "korean_literature_parallels_ko": "...",
  "discussion_questions_ko": [
    "...?",
    "...?",
    "...?"
  ]
}

JSON만 출력.`;
}
