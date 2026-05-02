// v2.5 Track C — Glossary extraction prompt.

import type { WorkProfile } from "../schemas/profile";

export interface GlossaryPromptInput {
  text: string;
  profile: WorkProfile;
}

export function buildGlossaryPrompt(input: GlossaryPromptInput): string {
  const charNames = input.profile.characters
    .map((c) => c.name)
    .filter(Boolean)
    .join(", ");
  const symNames = input.profile.symbolism
    .map((s) => s.symbol)
    .filter(Boolean)
    .join(", ");

  // Cap input text to keep prompt cost bounded; the first 6 KB usually contains
  // the bulk of named-entity introductions in short fiction.
  const sampleText = input.text.slice(0, 6000);

  return `당신은 영어 단편을 한국어로 번역하는 편집자가 사용할 **고유명사 사전 (Glossary)** 을 만듭니다.

## 작품 정보 (Profile에서)
- 제목: ${input.profile.title || "(미상)"}
- 작가: ${input.profile.author || "(미상)"}
- 등장인물: ${charNames || "(없음)"}
- 상징: ${symNames || "(없음)"}

## 본문 샘플 (앞부분)
${sampleText}

## 과제

본문에 등장하는 모든 **고유명사**를 추출하고 표준 한국어 표기를 정하세요. 다음 카테고리로:

- **person**: 인물 이름 (Della, Jim, ...)
- **place**: 지명, 건물명, 가게명 (Coney Island, Sofronie's, ...)
- **work_title**: 작품/책 제목 (The Gift of the Magi, Bible, ...)
- **concept**: 종교·신화·역사적 개념 (Magi, Sabbath, Queen of Sheba, ...)
- **object**: 특정 명사로 굳어진 사물 (the watch, the platinum fob chain, ...)
- **other**: 위에 안 맞는 것

규칙:
1. 일반 명사 (love, money, hair) 는 제외 — 고유명사만.
2. 같은 사람의 여러 표기 (Della, Mrs. James Dillingham Young) 는 별도 entry.
3. 의미적 함정에 주의:
   - "the Magi" / "Magi": **마기** (동방박사) — 절대 "마귀"가 아님.
   - "James Dillingham" 같은 영문 이름은 한국어 표기 (제임스 딜링햄) + note 에 발음 가이드.
4. note_ko 는 한국 독자가 모를 수 있는 배경 1-2문장. 필수 아님.

## 출력 형식

**순수 JSON 객체 하나만**. 코드 펜스, 설명 절대 금지.

{
  "entries": [
    { "english": "...", "korean": "...", "type": "person|place|work_title|concept|object|other", "note_ko": "(선택)" }
  ]
}

JSON만 출력.`;
}
