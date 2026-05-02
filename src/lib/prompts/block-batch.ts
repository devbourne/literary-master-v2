export interface BlockBatchContext {
  profileSummary: string;
  rollingSummary: string;
  previousTranslations: string;
  batchIndex: number;
  totalBatches: number;
  blocks: Array<{ blockId: string; text: string }>;
}

export function buildBlockBatchPrompt(ctx: BlockBatchContext): string {
  const blocksSection = ctx.blocks
    .map((b) => `### Block ${b.blockId}\n${b.text}`)
    .join("\n\n");

  return `당신은 영미 문학을 한국 독자에게 풀이하는 번역·주해 전문가입니다.
아래 **${ctx.blocks.length}개 단락(block)**을 순서대로 번역하고, 각 블록에 세밀한 주해를 답니다.

## 작품 프로파일 (요약)
${ctx.profileSummary}

## 지금까지의 이야기 흐름 (누적 요약)
${ctx.rollingSummary}

## 직전 블록 번역 (문체 일관성 유지용)
${ctx.previousTranslations || "(첫 배치)"}

## 현재 배치 (${ctx.batchIndex + 1}/${ctx.totalBatches})
${blocksSection}

## 출력 스키마 (각 블록마다)
{
  "translations": [
    {
      "blockId": "block_001",
      "literary_translation": "문학적·자연스러운 한국어 번역 (의역 허용, 어조 살릴 것)",
      "literal_translation": "학습용 직역 — 단어·구문 구조에 충실",
      "korean_commentary": "이 단락에서 일어나는 일과 의미 (한국어 2-3문장)",
      "annotations": {
        "containsForeshadowing": false,
        "foreshadowingSetupRef": null,
        "containsCallback": false,
        "callbackRef": null,
        "toneShift": null,
        "sceneTransition": false,
        "symbolismPresent": [],
        "literaryDevices": [
          { "device": "metaphor | simile | irony | symbolism | hyperbole | 풍자 | 알레고리 | 반어", "description_ko": "어떻게 사용되었나" }
        ],
        "culturalReferences": [
          { "term": "원문 표현", "explanation_ko": "한국 독자용 설명" }
        ],
        "key_vocabulary": [
          {
            "en": "원어 단어/구",
            "pronunciation": "선택적 IPA 또는 한국어 발음",
            "part_of_speech": "n./v./adj./adv./idiom",
            "ko_gloss": "한국어 뜻",
            "context_note_ko": "이 문맥에서의 뉘앙스"
          }
        ],
        "notable_quote": null,
        "dialogueSpeaker": null,
        "ambiguity_level": "low",
        "translation_difficulty": "low",
        "flag_for_revision": false,
        "flag_reason": ""
      }
    }
  ],
  "rolling_summary_update": "이 배치 이후 누적 줄거리 3-4문장 (한국어)"
}

## 규칙
- literary / literal 번역 **둘 다 필수**. 같으면 안 됨.
- \`blockId\`는 입력과 **정확히 동일하게** 사용.
- \`flag_for_revision\`은 다음 중 하나일 때만 true:
  (a) 번역 난이도 high이며 자신 없음
  (b) 복선/상징 해석이 프로파일과 어긋나 보임
  (c) 이 블록 단독 해석과 전체 맥락 해석이 충돌
- 각 블록은 독립 객체. ${ctx.blocks.length}개 반환.
- 배치 내 \`rolling_summary_update\`는 **한 번만**.
- 순수 JSON만 출력. 마크다운 펜스 금지.`;
}
