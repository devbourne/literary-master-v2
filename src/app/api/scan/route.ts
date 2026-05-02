// v2 Phase D — scan augmented with start_quote per piece so the server-side
// segmentation agent can find boundaries by body content rather than title alone.

import { callLLM } from "@/lib/llm";
import { parseJsonFromLLM } from "@/lib/parsers/json-parser";

// This route receives only a sample of the text (first ~5000 chars).
// Full text stays on the client side until segmentation/analyze.
export async function POST(req: Request) {
  const { sample, totalLength } = (await req.json()) as {
    sample: string;
    totalLength: number;
  };

  if (!sample || sample.trim().length < 50) {
    return Response.json({ error: "텍스트가 너무 짧습니다." }, { status: 400 });
  }

  const prompt = `아래 텍스트를 읽고 구조를 파악하세요.

## 텍스트 (앞부분, 전체 ${totalLength}자 중 일부)
${sample}

## 과제
이 텍스트가 어떤 구조인지 판단하세요. JSON으로 출력:

1. "type": 텍스트 유형. 다음 중 하나:
   - "single": 단일 작품 (단편소설 하나, 에세이 하나 등)
   - "collection": 여러 작품 모음 (단편집, 챕터 모음 등)
2. "title": 전체 텍스트의 제목 (감지 가능한 경우)
3. "author": 작가명 (감지 가능한 경우)
4. "pieces": 개별 작품/챕터 목록. 각 항목은 다음 두 필드를 가진 객체:
   - "title": 작품/챕터 제목 (대문자 그대로)
   - "start_quote": 해당 작품 본문의 첫 문장 또는 첫 50자 정도. 제목 줄이 아닌 본문 시작 직후의 텍스트를 그대로 인용. 표지·목차 항목이 아닌 실제 본문에서 추출.

단일 작품이면 pieces에 해당 작품 하나만 넣으세요. start_quote는 항상 채워주세요 — 서버가 이 인용으로 본문 경계를 결정합니다.

JSON만 출력. 코드 펜스, 설명, 마크다운 제목 모두 금지.`;

  try {
    const { text: result } = await callLLM(prompt, 1200);
    const parsed = parseJsonFromLLM(result);
    return Response.json(parsed);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "스캔 실패" },
      { status: 500 },
    );
  }
}
