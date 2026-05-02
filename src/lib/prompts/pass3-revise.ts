export interface ReviseContext {
  profileSummary: string;
  fullRollingSummary: string;
  flaggedBlock: {
    blockId: string;
    originalText: string;
    previousTranslation: { literary: string; literal: string };
    flagReason: string;
  };
  neighbors: { before?: string; after?: string };
}

export function buildRevisePrompt(ctx: ReviseContext): string {
  return `당신은 번역 품질 검수자입니다. 아래 블록은 1차 번역 시 '검토 필요'로 표시되었습니다.
전체 작품 프로파일과 인접 블록을 참고하여 **더 정확한 번역과 주해**를 산출하세요.

## 작품 프로파일
${ctx.profileSummary}

## 전체 누적 줄거리
${ctx.fullRollingSummary}

## 직전 블록 (번역본)
${ctx.neighbors.before || "(없음)"}

## 직후 블록 (번역본)
${ctx.neighbors.after || "(없음)"}

## 검토 대상 블록 (${ctx.flaggedBlock.blockId})
### 원문
${ctx.flaggedBlock.originalText}

### 기존 번역
- 문학적: ${ctx.flaggedBlock.previousTranslation.literary}
- 직역:   ${ctx.flaggedBlock.previousTranslation.literal}

### 플래그 사유
${ctx.flaggedBlock.flagReason}

## 출력 스키마 (JSON)
{
  "blockId": "${ctx.flaggedBlock.blockId}",
  "revised_literary_translation": "개선된 문학적 번역",
  "revised_literal_translation": "개선된 직역",
  "revised_commentary": "개선된 한국어 해설",
  "revision_type": "terminology | context | tone | error",
  "revision_reason": "무엇을 왜 바꿨는지 (한국어)",
  "changes_significant": true
}

JSON만 출력. 변경이 미미하면 changes_significant를 false로.`;
}
