// v2.5 Multi-Gloss Angle 2 — Critical / theoretical multi-perspective gloss.
// Korean output, JSON-structured. qwen3:30b (JSON champion + Korean SAT 5/5).

import type { WorkProfile } from "../schemas/profile";

export interface CriticalGlossPromptInput {
  text: string;
  profile: WorkProfile;
  glossarySection?: string;
}

export function buildCriticalGlossPrompt(
  input: CriticalGlossPromptInput,
): string {
  const sample = input.text.slice(0, 8000);
  return `당신은 영미 문학을 다양한 비평 전통의 시각에서 독해하는 비평가입니다. 한 작품을 단일 해석으로 가두지 않고, **서로 다른 비평 전통의 valid 한 복수 해석** 을 surface 합니다.

## 작품 정보
- 제목: ${input.profile.title || "(미상)"}
- 작가: ${input.profile.author || "(미상)"}
- 주제 (표면): ${input.profile.themes.slice(0, 3).join(", ")}
${input.glossarySection ? `\n${input.glossarySection}\n` : ""}
## 본문
${sample}

## 과제

이 작품을 **3-5개 비평 전통** 으로 각각 읽으세요. 후보:
- Marxist / Materialist (계급, 경제, 노동)
- Feminist / Gender (여성성·남성성의 commodification)
- Christian / Religious (성서·종교적 prefiguration)
- Structuralist / Formalist (구조적 패턴, 대비, 평행)
- New Critical / Close Reading (텍스트 자체의 irony)
- Reception / Reader-response (독자가 만들어내는 의미)
- Psychoanalytic (욕망, 결핍, 무의식)
- Postcolonial / Cultural Studies (권력·정체성)

작품에 **명백히 관련 있는 것만** 선택. 억지로 적용하지 말 것.

각 전통에 대해:
- thesis_ko: 그 전통이 이 작품에서 surface 하는 핵심 명제 (한국어 1-2 문장)
- key_evidence_ko: 작품 내 근거 (인용 또는 장면 지칭)
- tension_with_default: 표면 표준 해석 ("사랑이 가난을 이긴다" 류) 과의 긴장 — 어느 지점에서 다른가

## 출력

**순수 JSON 객체 하나만**. 코드 펜스, 설명 절대 금지.

{
  "critical_readings": [
    {
      "tradition": "전통 이름 (한국어)",
      "thesis_ko": "...",
      "key_evidence_ko": "...",
      "tension_with_default": "..."
    }
  ]
}

JSON만 출력.`;
}
